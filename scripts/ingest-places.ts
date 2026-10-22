import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, pool } from '../src/db/index';
import { places } from '../src/db/schema';
import type { CuratedSpotRecord } from '../src/lib/curated-spots';
import {
  filterDatatourismeRecord,
  mapDatatourismeToPlace,
} from '../src/lib/ingest/datatourisme-connector';
import { haversineDistanceKm } from '../src/lib/utils/geo';

export interface IngestOptions {
  curatedPath?: string;
  openDataPath?: string;
  dbClient?: any;
}

export interface IngestSummary {
  success: boolean;
  curatedTotal: number;
  curatedInserted: number;
  curatedUpdated: number;
  openDataTotal: number;
  openDataInserted: number;
  openDataUpdated: number;
  errors: string[];
}

/**
 * Ingestion souveraine des lieux Morbihan dans PostgreSQL :
 * 1. Pépites et spots curés avec descriptions exclusives, galeries et conseils marée originaux.
 * 2. Données ouvertes DATAtourisme admissibles fusionnées sans écraser les contenus curés.
 */
export async function ingestPlaces(options: IngestOptions = {}): Promise<IngestSummary> {
  const summary: IngestSummary = {
    success: true,
    curatedTotal: 0,
    curatedInserted: 0,
    curatedUpdated: 0,
    openDataTotal: 0,
    openDataInserted: 0,
    openDataUpdated: 0,
    errors: [],
  };

  // 1. Chargement des spots curés locaux
  const curatedCandidates = options.curatedPath
    ? [options.curatedPath]
    : [
        path.resolve(process.cwd(), 'data/curated-spots.json'),
        path.resolve(process.cwd(), '../data/curated-spots.json'),
      ];

  let rawCurated: string | null = null;
  for (const candidate of curatedCandidates) {
    if (fs.existsSync(candidate)) {
      rawCurated = fs.readFileSync(candidate, 'utf-8');
      break;
    }
  }

  if (!rawCurated) {
    summary.errors.push('Curated spots file not found at data/curated-spots.json');
    summary.success = false;
    return summary;
  }

  let curatedSpots: CuratedSpotRecord[] = [];
  try {
    curatedSpots = JSON.parse(rawCurated);
    summary.curatedTotal = curatedSpots.length;
  } catch (err) {
    summary.errors.push(`Invalid JSON in curated-spots.json: ${err instanceof Error ? err.message : String(err)}`);
    summary.success = false;
    return summary;
  }

  // 2. Client Drizzle PostgreSQL
  const dbClient = options.dbClient ?? db;

  // Récupération des slugs existants pour distinguer les créations des mises à jour
  const existingSlugs = new Set<string>();
  try {
    const existing = await dbClient.select({ slug: places.slug }).from(places);
    if (Array.isArray(existing)) {
      for (const row of existing) {
        if (row && typeof row.slug === 'string') {
          existingSlugs.add(row.slug);
        }
      }
    }
  } catch {
    // Si la table est vide ou en cas de mock partiel
  }

  // 3. Upsert des spots curés avec sourceType = 'CURATED'
  const curatedSlugs = new Set(curatedSpots.map((s) => s.slug));
  for (const spot of curatedSpots) {
    try {
      const isUpdate = existingSlugs.has(spot.slug);
      const coverUrl =
        spot.photoGallery?.find((p) => p.isCover)?.url ??
        spot.photoGallery?.[0]?.url ??
        null;

      await dbClient
        .insert(places)
        .values({
          externalId: `curated:${spot.slug}`,
          slug: spot.slug,
          name: spot.name,
          shortDescription: spot.shortDescription,
          fullDescription: spot.fullDescription ?? null,
          category: spot.category,
          commune: spot.commune,
          communeSlug: spot.communeSlug,
          sector: spot.sector,
          latitude: spot.latitude,
          longitude: spot.longitude,
          parkingLat: spot.parkingLat ?? null,
          parkingLng: spot.parkingLng ?? null,
          contextualRules: spot.contextualRules,
          trailData: (spot as any).trailData ?? null,
          coverImageUrl: coverUrl,
          photoGallery: spot.photoGallery ?? [],
          practicalInfo: spot.practicalInfo ?? null,
          tideDetails: spot.tideDetails ?? null,
          sourceType: 'CURATED',
          isSponsored: false,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: places.slug,
          set: {
            name: spot.name,
            shortDescription: spot.shortDescription,
            fullDescription: spot.fullDescription ?? null,
            category: spot.category,
            commune: spot.commune,
            communeSlug: spot.communeSlug,
            sector: spot.sector,
            latitude: spot.latitude,
            longitude: spot.longitude,
            parkingLat: spot.parkingLat ?? null,
            parkingLng: spot.parkingLng ?? null,
            contextualRules: spot.contextualRules,
            trailData: (spot as any).trailData ?? null,
            coverImageUrl: coverUrl,
            photoGallery: spot.photoGallery ?? [],
            practicalInfo: spot.practicalInfo ?? null,
            tideDetails: spot.tideDetails ?? null,
            sourceType: 'CURATED',
            updatedAt: new Date(),
          },
        });

      if (isUpdate) {
        summary.curatedUpdated++;
      } else {
        summary.curatedInserted++;
        existingSlugs.add(spot.slug);
      }
    } catch (err) {
      summary.errors.push(`Curated spot ${spot.slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 4. Ingestion optionnelle des données ouvertes DATAtourisme (si présentes)
  const openDataCandidates = options.openDataPath
    ? [options.openDataPath]
    : [
        path.resolve(process.cwd(), 'data/datatourisme.json'),
        path.resolve(process.cwd(), '../data/datatourisme.json'),
      ];

  let rawOpenData: string | null = null;
  for (const candidate of openDataCandidates) {
    if (fs.existsSync(candidate)) {
      rawOpenData = fs.readFileSync(candidate, 'utf-8');
      break;
    }
  }

  if (rawOpenData) {
    try {
      const records = JSON.parse(rawOpenData);
      if (Array.isArray(records)) {
        summary.openDataTotal = records.length;
        for (const record of records) {
          if (!filterDatatourismeRecord(record)) continue;
          const partial = mapDatatourismeToPlace(record);
          if (!partial) continue;

          // Heuristique spatiale & souveraineté :
          // Si le lieu open data a le même slug OU se trouve à moins de 300 mètres
          // d'un spot curé de référence, la curation souveraine prévaut et aucun doublon n'est créé.
          const isNearCurated = curatedSpots.some(
            (s) => haversineDistanceKm(partial.latitude, partial.longitude, s.latitude, s.longitude) < 0.3
          );

          if (existingSlugs.has(partial.slug) || curatedSlugs.has(partial.slug) || isNearCurated) {
            continue;
          }

          try {
            await dbClient
              .insert(places)
              .values({
                externalId: partial.externalId ?? `datatourisme:${partial.slug}`,
                slug: partial.slug,
                name: partial.name,
                shortDescription: partial.shortDescription,
                fullDescription: partial.fullDescription ?? null,
                category: partial.category,
                commune: partial.commune,
                communeSlug: partial.communeSlug,
                sector: partial.sector,
                latitude: partial.latitude,
                longitude: partial.longitude,
                contextualRules: partial.contextualRules,
                coverImageUrl: partial.coverImageUrl ?? null,
                photoGallery: [],
                sourceType: 'DATATOURISME',
                isSponsored: false,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: places.slug,
                set: {
                  name: partial.name,
                  shortDescription: partial.shortDescription,
                  fullDescription: partial.fullDescription ?? null,
                  category: partial.category,
                  commune: partial.commune,
                  communeSlug: partial.communeSlug,
                  sector: partial.sector,
                  latitude: partial.latitude,
                  longitude: partial.longitude,
                  contextualRules: partial.contextualRules,
                  coverImageUrl: partial.coverImageUrl ?? null,
                  sourceType: 'DATATOURISME',
                  updatedAt: new Date(),
                },
              });

            summary.openDataInserted++;
            existingSlugs.add(partial.slug);
          } catch (err) {
            summary.errors.push(`OpenData place ${partial.slug}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    } catch (err) {
      summary.errors.push(`Failed to parse open data file: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  summary.success = summary.errors.length === 0;
  return summary;
}

/**
 * Point d'entrée CLI pour la commande db:ingest
 */
export async function main() {
  console.log('--- Ingestion des Lieux & Pépites (Curated & Open Data) ---');
  const start = Date.now();

  const customOpenData = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : undefined;

  let summary: IngestSummary;
  try {
    summary = await ingestPlaces({
      openDataPath: customOpenData,
    });
  } catch (err) {
    console.error('Erreur fatale lors de l’ingestion :', err);
    process.exit(1);
  } finally {
    try {
      await pool.end();
    } catch {
      // Ignorer si déjà clos
    }
  }

  const duration = Date.now() - start;

  console.log(`Statut : ${summary.success ? 'SUCCÈS' : 'AVEC ERREURS'}`);
  console.log(`Spots curés traités : ${summary.curatedTotal}`);
  console.log(`  - Nouveaux lieux insérés : ${summary.curatedInserted}`);
  console.log(`  - Lieux mis à jour       : ${summary.curatedUpdated}`);

  if (summary.openDataTotal > 0) {
    console.log(`Enregistrements Open Data analysés : ${summary.openDataTotal}`);
    console.log(`  - Lieux Open Data insérés : ${summary.openDataInserted}`);
  }

  console.log(`Durée : ${duration}ms`);

  if (summary.errors.length > 0) {
    console.error(`Erreurs (${summary.errors.length}) :`);
    for (const e of summary.errors.slice(0, 10)) {
      console.error(`  - ${e}`);
    }
  }

  process.exit(summary.success ? 0 : 1);
}

// Auto-exécution si lancé directement via tsx/node
const isDirectExecution = () => {
  try {
    if (!process.argv[1]) return false;
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
};

if (isDirectExecution()) {
  main().catch((err) => {
    console.error('Fatal CLI execution error:', err);
    process.exit(1);
  });
}
