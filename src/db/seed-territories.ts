import { eq, and } from 'drizzle-orm';
import { territories, territoryClusters, places, type Territory, type TerritoryCluster } from './schema';

export interface HistoricalClusterMapping {
  slug: string;
  name: string;
  barrierGroupId: number;
  weatherSectorSlug: string;
}

export const MORBIHAN_TERRITORY = {
  slug: 'morbihan-sud',
  name: 'Morbihan Sud',
  hasTides: true,
  centerLatitude: 47.6,
  centerLongitude: -2.85,
  defaultZoom: 11,
};

/**
 * Mapping des 4 secteurs historiques Morbihan avec leurs identifiants de barrière topologique (anti-bouchons)
 * - 1: Golfe Nord (Vannes, Arradon, Baden, Séné...)
 * - 2: Presqu'île de Rhuys (Sarzeau, Arzon, Saint-Gildas...)
 * - 3: Presqu'île de Quiberon (Quiberon, Saint-Pierre, Carnac...)
 * - 4: Ria d'Étel (Étel, Belz, Plouhinec...)
 */
export const HISTORICAL_SECTOR_CLUSTER_MAP: Record<string, HistoricalClusterMapping> = {
  'Golfe': {
    slug: 'golfe',
    name: 'Golfe du Morbihan',
    barrierGroupId: 1,
    weatherSectorSlug: 'VANNES',
  },
  'Presqu-ile de Rhuys': {
    slug: 'rhuys',
    name: "Presqu'île de Rhuys",
    barrierGroupId: 2,
    weatherSectorSlug: 'SARZEAU',
  },
  'Presqu-ile de Quiberon': {
    slug: 'quiberon',
    name: "Presqu'île de Quiberon",
    barrierGroupId: 3,
    weatherSectorSlug: 'QUIBERON',
  },
  'Ria d-Etel': {
    slug: 'ria-etel',
    name: "Ria d'Étel",
    barrierGroupId: 4,
    weatherSectorSlug: 'ETEL',
  },
};

export interface SeedTerritoriesResult {
  territory: Territory;
  clusters: Record<string, TerritoryCluster>;
}

/**
 * Initialise le territoire Morbihan Sud, configure les 4 clusters géographiques avec leurs barrierGroupId,
 * et effectue la migration rétrocompatible des places existantes en renseignant territoryId et clusterId.
 */
export async function seedMorbihanTerritory(database: any): Promise<SeedTerritoriesResult> {
  // 1. Initialiser le territoire 'morbihan-sud'
  const territoryRows = await database
    .select()
    .from(territories)
    .where(eq(territories.slug, MORBIHAN_TERRITORY.slug));

  let territory: Territory = territoryRows[0];
  if (!territory) {
    const inserted = await database
      .insert(territories)
      .values(MORBIHAN_TERRITORY)
      .returning();
    territory = inserted[0];
  } else {
    await database
      .update(territories)
      .set({
        name: MORBIHAN_TERRITORY.name,
        hasTides: MORBIHAN_TERRITORY.hasTides,
        centerLatitude: MORBIHAN_TERRITORY.centerLatitude,
        centerLongitude: MORBIHAN_TERRITORY.centerLongitude,
        defaultZoom: MORBIHAN_TERRITORY.defaultZoom,
      })
      .where(eq(territories.id, territory.id));
  }

  const clustersCreated: Record<string, TerritoryCluster> = {};

  // 2. Initialiser chaque cluster et lier les places du secteur historique
  for (const [historicalSector, clusterData] of Object.entries(HISTORICAL_SECTOR_CLUSTER_MAP)) {
    const clusterRows = await database
      .select()
      .from(territoryClusters)
      .where(
        and(
          eq(territoryClusters.territoryId, territory.id),
          eq(territoryClusters.slug, clusterData.slug)
        )
      );

    let cluster: TerritoryCluster = clusterRows[0];
    if (!cluster) {
      const inserted = await database
        .insert(territoryClusters)
        .values({
          territoryId: territory.id,
          slug: clusterData.slug,
          name: clusterData.name,
          barrierGroupId: clusterData.barrierGroupId,
          weatherSectorSlug: clusterData.weatherSectorSlug,
        })
        .returning();
      cluster = inserted[0];
    } else {
      await database
        .update(territoryClusters)
        .set({
          name: clusterData.name,
          barrierGroupId: clusterData.barrierGroupId,
          weatherSectorSlug: clusterData.weatherSectorSlug,
        })
        .where(eq(territoryClusters.id, cluster.id));
    }

    clustersCreated[historicalSector] = cluster;

    // 3. Migration rétrocompatible : mise à jour des places existantes associées au secteur historique
    await database
      .update(places)
      .set({
        territoryId: territory.id,
        clusterId: cluster.id,
      })
      .where(eq(places.sector, historicalSector));
  }

  return {
    territory,
    clusters: clustersCreated,
  };
}

/**
 * Alias pour seedMorbihanTerritory respectant l'interface attendue
 */
export const seedTerritories = seedMorbihanTerritory;
