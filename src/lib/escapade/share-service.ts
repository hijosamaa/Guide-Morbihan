import { eq } from 'drizzle-orm';
import { db as defaultDb } from '../../db';
import { itineraries } from '../../db/schema';
import type { EscapadePlan } from './types';

// Cache en mémoire pour fonctionnement hors-ligne / fallback CI & tests
const fallbackEscapades = new Map<string, EscapadePlan>();

/**
 * Mappage normalisé des secteurs vers leurs identifiants courts d'URL.
 */
const SECTOR_SLUG_MAP: Record<string, string> = {
  'Golfe': 'golfe',
  'Presqu-ile de Rhuys': 'rhuys',
  "Presqu'île de Rhuys": 'rhuys',
  'Presqu-ile de Quiberon': 'quiberon',
  "Presqu'île de Quiberon": 'quiberon',
  'Ria d-Etel': 'ria-etel',
  "Ria d'Étel": 'ria-etel',
  'Etel': 'ria-etel',
  'Étel': 'ria-etel',
};

/**
 * Génère un suffixe aléatoire lisible de n caractères alphanumériques [a-z0-9].
 */
function getRandomSuffix(length = 5): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Génère un slug humainement lisible pour le partage d'escapade.
 * Format : `escapade-[secteur]-[durée]j-[5 caractères]`
 * Exemple : `escapade-rhuys-2j-a7b2c`
 */
export function generateEscapadeSlug(baseSector: string, durationDays: number): string {
  let sectorPart = SECTOR_SLUG_MAP[baseSector];

  if (!sectorPart) {
    const lower = (baseSector || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (lower.includes('rhuys')) {
      sectorPart = 'rhuys';
    } else if (lower.includes('quiberon')) {
      sectorPart = 'quiberon';
    } else if (lower.includes('etel')) {
      sectorPart = 'ria-etel';
    } else if (lower.includes('golfe')) {
      sectorPart = 'golfe';
    } else {
      sectorPart = lower
        .replace(/presqu[-']?ile[-_ ](de[-_ ]|d[-_ ])?/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'morbihan';
    }
  }

  // Borner sectorPart à 14 caractères max pour garantir que le slug total n'excède jamais varchar(32)
  if (sectorPart.length > 14) {
    sectorPart = sectorPart.slice(0, 14).replace(/-+$/, '');
  }

  const days = Math.max(1, durationDays || 1);
  const suffix = getRandomSuffix(5);

  return `escapade-${sectorPart}-${days}j-${suffix}`;
}

/**
 * Sauvegarde un plan d'escapade en base de données avec fallback mémoire immédiat.
 */
export async function saveEscapade(
  plan: EscapadePlan,
  customDb?: any
): Promise<{ slug: string; url: string }> {
  const slug = generateEscapadeSlug(
    plan.profile?.baseSector || 'Morbihan',
    plan.profile?.durationDays || plan.days?.length || 1
  );

  const title = `Escapade ${plan.profile?.baseSector || 'Morbihan'} • ${
    plan.profile?.durationDays || plan.days?.length || 1
  } jour${(plan.profile?.durationDays || plan.days?.length || 1) > 1 ? 's' : ''}`;

  // Toujours mettre en cache mémoire pour accès instantané
  fallbackEscapades.set(slug, plan);

  const activeDb = customDb || defaultDb;
  if (activeDb) {
    let timeoutId: NodeJS.Timeout | undefined;
    try {
      // Timeout défensif de 1500ms pour ne jamais bloquer si la base est inaccessible
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('DB Timeout')), 1500);
      });

      const insertPromise = activeDb.insert(itineraries).values({
        slug,
        title,
        baseSector: plan.profile?.baseSector || 'Morbihan',
        durationDays: plan.profile?.durationDays || plan.days?.length || 1,
        escapadeData: plan,
      });

      await Promise.race([insertPromise, timeoutPromise]);
    } catch {
      // Échec DB ignoré : l'escapade est sécurisée dans le fallback mémoire
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  return {
    slug,
    url: `/escapade/${slug}`,
  };
}

/**
 * Récupère un plan d'escapade par son slug (cache mémoire ou base de données).
 */
export async function getEscapadeBySlug(
  slug: string,
  customDb?: any
): Promise<EscapadePlan | null> {
  if (!slug) return null;

  // 1. Recherche en mémoire prioritaire (0 ms)
  const cached = fallbackEscapades.get(slug);
  if (cached) {
    return cached;
  }

  // 2. Recherche en base de données PostgreSQL
  const activeDb = customDb || defaultDb;
  if (activeDb) {
    let timeoutId: NodeJS.Timeout | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('DB Timeout')), 1500);
      });

      const queryPromise = activeDb
        .select()
        .from(itineraries)
        .where(eq(itineraries.slug, slug));

      const rows: any = await Promise.race([queryPromise, timeoutPromise]);
      if (rows && rows.length > 0) {
        const plan = (rows[0].escapadeData || rows[0].itineraryData) as EscapadePlan;
        if (plan) {
          fallbackEscapades.set(slug, plan);
          return plan;
        }
      }
    } catch {
      // Échec DB ignoré
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  return null;
}
