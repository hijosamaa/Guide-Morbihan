import type {
  OfficialPassageWindow,
  PassageStatus,
  TidalPhase,
  TidePoint,
  TideStatus,
} from './types/context';

const TWELFTHS_CUMULATIVE = [0, 1 / 12, 3 / 12, 6 / 12, 9 / 12, 11 / 12, 1];

/**
 * Calcule la fraction cumulée du marnage selon la règle des douzièmes
 * avec interpolation continue linéaire à l'intérieur de chaque heure marégraphique.
 * @param progress Progression normalisée de la marée entre 0 et 1.
 */
export function calculateTwelfthsFraction(progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;

  const scaled = Math.min(6, Math.max(0, progress * 6));
  const rounded = Math.round(scaled);
  const effectiveScaled = Math.abs(scaled - rounded) < 1e-9 ? rounded : scaled;
  const hourIndex = Math.floor(effectiveScaled);
  const hourFraction = effectiveScaled - hourIndex;

  if (hourIndex >= 6) return 1;

  const startFrac = TWELFTHS_CUMULATIVE[hourIndex];
  const endFrac = TWELFTHS_CUMULATIVE[hourIndex + 1];

  return startFrac + hourFraction * (endFrac - startFrac);
}

/**
 * Interpole la hauteur d'eau à l'instant cible entre deux événements consécutifs.
 */
export function interpolateWaterHeight(
  timestamp: Date,
  prev: TidePoint,
  next: TidePoint
): number {
  const t = timestamp.getTime();
  const tPrev = prev.eventTimestamp.getTime();
  const tNext = next.eventTimestamp.getTime();

  if (tNext <= tPrev) {
    return prev.heightMeters;
  }

  const progress = Math.max(0, Math.min(1, (t - tPrev) / (tNext - tPrev)));
  const fraction = calculateTwelfthsFraction(progress);
  const range = Math.abs(next.heightMeters - prev.heightMeters);

  if (next.heightMeters >= prev.heightMeters) {
    // Montante (Flot)
    return prev.heightMeters + range * fraction;
  } else {
    // Descendante (Jusant)
    return prev.heightMeters - range * fraction;
  }
}

const OUTER_GULF_COMMUNES = new Set([
  'arzon',
  'saint-gildas-de-rhuys',
  'quiberon',
  'saint-pierre-quiberon',
  'plouhinec',
  'etel',
  'belz',
  'erdeven',
  'locmariaquer',
]);

/**
 * Détermine le port de référence marégraphique (Port-Navalo vs Vannes).
 */
export function resolveHarborForCommune(
  communeSlug: string,
  sector?: string
): 'PORT_NAVALO' | 'VANNES' {
  const slug = communeSlug.toLowerCase().trim();
  if (OUTER_GULF_COMMUNES.has(slug)) {
    return 'PORT_NAVALO';
  }
  if (sector === 'Presqu-ile de Quiberon' || sector === 'Ria d-Etel') {
    return 'PORT_NAVALO';
  }
  return 'VANNES';
}

/**
 * Calcule l'état instantané complet de la marée pour un port et un horodatage.
 */
export function getTideStatus(
  timestamp: Date,
  harbor: 'PORT_NAVALO' | 'VANNES',
  events: TidePoint[]
): TideStatus {
  const harborEvents = events
    .filter((e) => e.harbor === harbor)
    .sort((a, b) => a.eventTimestamp.getTime() - b.eventTimestamp.getTime());

  if (harborEvents.length < 2) {
    throw new Error(`Insufficient tide events for harbor ${harbor}. Minimum 2 events required.`);
  }

  const targetTime = timestamp.getTime();
  let prevEventIndex = -1;

  for (let i = 0; i < harborEvents.length - 1; i++) {
    const current = harborEvents[i].eventTimestamp.getTime();
    const next = harborEvents[i + 1].eventTimestamp.getTime();
    if (targetTime >= current && targetTime <= next) {
      prevEventIndex = i;
      break;
    }
  }

  let prevEvent: TidePoint;
  let nextEvent: TidePoint;

  if (prevEventIndex !== -1) {
    prevEvent = harborEvents[prevEventIndex];
    nextEvent = harborEvents[prevEventIndex + 1];
  } else if (targetTime < harborEvents[0].eventTimestamp.getTime()) {
    prevEvent = harborEvents[0];
    nextEvent = harborEvents[1];
  } else {
    prevEvent = harborEvents[harborEvents.length - 2];
    nextEvent = harborEvents[harborEvents.length - 1];
  }

  const waterHeightMeters = Math.round(interpolateWaterHeight(timestamp, prevEvent, nextEvent) * 100) / 100;
  const tidalRangeMeters = Math.round(Math.abs(nextEvent.heightMeters - prevEvent.heightMeters) * 100) / 100;

  // Détection de phase et étales (fenêtre de 20 minutes)
  const diffToPrevMinutes = Math.abs(targetTime - prevEvent.eventTimestamp.getTime()) / 60000;
  const diffToNextMinutes = Math.abs(nextEvent.eventTimestamp.getTime() - targetTime) / 60000;

  let phase: TidalPhase;
  if (diffToPrevMinutes <= 20) {
    phase = prevEvent.eventType === 'HIGH' ? 'SLACK_HIGH' : 'SLACK_LOW';
  } else if (diffToNextMinutes <= 20) {
    phase = nextEvent.eventType === 'HIGH' ? 'SLACK_HIGH' : 'SLACK_LOW';
  } else {
    phase = nextEvent.heightMeters > prevEvent.heightMeters ? 'FLOOD' : 'EBB';
  }

  const coefficient = nextEvent.coefficient ?? prevEvent.coefficient ?? 70;
  const minutesToNextEvent = Math.max(0, Math.round((nextEvent.eventTimestamp.getTime() - targetTime) / 60000));

  return {
    harbor,
    timestamp,
    waterHeightMeters,
    phase,
    coefficient,
    previousEvent: prevEvent,
    nextEvent,
    minutesToNextEvent,
    tidalRangeMeters,
  };
}

export interface PassageEvaluationOptions {
  officialWindows?: OfficialPassageWindow[];
  tideEvents?: TidePoint[];
  harbor?: 'PORT_NAVALO' | 'VANNES';
}

const PASSAGE_CONFIGS: Record<
  string,
  {
    name: string;
    defaultHarbor: 'PORT_NAVALO' | 'VANNES';
    maxHeightMeters: number;
    hoursAroundLow: number;
    hazardNoticeFlood?: string;
  }
> = {
  'passage-ile-de-berder': {
    name: "Chaussée de l'Île de Berder",
    defaultHarbor: 'VANNES',
    maxHeightMeters: 1.4,
    hoursAroundLow: 2,
    hazardNoticeFlood:
      'Attention : violent courant de la Jument au flot. Ne traversez sous aucun prétexte avec de l’eau sur la chaussée.',
  },
  'passage-ile-tascon': {
    name: "Passage de l'Île Tascon",
    defaultHarbor: 'VANNES',
    maxHeightMeters: 1.5,
    hoursAroundLow: 2,
    hazardNoticeFlood:
      'Attention : marée montante rapide sur les vasières. Respectez les créneaux au sec.',
  },
};

/**
 * Évalue l'état de praticabilité d'un passage submersible (Berder, Tascon).
 * Priorité absolue aux créneaux officiels, avec calcul hydrographique de secours.
 */
export function evaluatePassageStatus(
  passageSlug: string,
  timestamp: Date,
  options: PassageEvaluationOptions = {}
): PassageStatus {
  const config = PASSAGE_CONFIGS[passageSlug] ?? {
    name: passageSlug,
    defaultHarbor: 'VANNES' as const,
    maxHeightMeters: 1.4,
    hoursAroundLow: 2,
  };

  const targetTime = timestamp.getTime();

  // 1. Recherche d'un créneau officiel englobant ou proche (dans les 12h)
  if (options.officialWindows && options.officialWindows.length > 0) {
    const matchingWindow =
      options.officialWindows.find(
        (w) =>
          w.passageSlug === passageSlug &&
          targetTime >= w.openAt.getTime() &&
          targetTime <= w.closeAt.getTime()
      ) ??
      options.officialWindows
        .filter((w) => w.passageSlug === passageSlug)
        .sort(
          (a, b) =>
            Math.min(
              Math.abs(targetTime - a.openAt.getTime()),
              Math.abs(targetTime - a.closeAt.getTime())
            ) -
            Math.min(
              Math.abs(targetTime - b.openAt.getTime()),
              Math.abs(targetTime - b.closeAt.getTime())
            )
        )
        .find(
          (w) => Math.abs(targetTime - w.openAt.getTime()) <= 12 * 3600 * 1000
        );

    if (matchingWindow) {
      const openTime = matchingWindow.openAt.getTime();
      const closeTime = matchingWindow.closeAt.getTime();
      const isOpen = targetTime >= openTime && targetTime <= closeTime;

      let status: 'OPEN' | 'CLOSING_SOON' | 'CLOSED' | 'OPENING_SOON';
      let minutesRemaining: number;

      if (isOpen) {
        minutesRemaining = Math.max(0, Math.round((closeTime - targetTime) / 60000));
        status = minutesRemaining <= 30 ? 'CLOSING_SOON' : 'OPEN';
      } else if (targetTime < openTime) {
        minutesRemaining = Math.max(0, Math.round((openTime - targetTime) / 60000));
        status = minutesRemaining <= 30 ? 'OPENING_SOON' : 'CLOSED';
      } else {
        minutesRemaining = 0;
        status = 'CLOSED';
      }

      return {
        slug: passageSlug,
        name: config.name,
        isOpen,
        status,
        minutesRemaining,
        source: 'OFFICIAL',
        window: {
          start: matchingWindow.openAt,
          end: matchingWindow.closeAt,
        },
        hazardNotice: config.hazardNoticeFlood,
      };
    }
  }

  // 2. Fallback hydrodynamique via marées
  if (!options.tideEvents || options.tideEvents.length === 0) {
    throw new Error(
      `Cannot evaluate passage ${passageSlug}: neither official windows nor tide events provided.`
    );
  }

  const harbor = options.harbor ?? config.defaultHarbor;
  const tideStatus = getTideStatus(timestamp, harbor, options.tideEvents);

  // Recherche de la basse mer la plus proche
  const nearestLow =
    tideStatus.previousEvent.eventType === 'LOW'
      ? tideStatus.previousEvent
      : tideStatus.nextEvent.eventType === 'LOW'
      ? tideStatus.nextEvent
      : options.tideEvents
          .filter((e) => e.harbor === harbor && e.eventType === 'LOW')
          .sort(
            (a, b) =>
              Math.abs(a.eventTimestamp.getTime() - targetTime) -
              Math.abs(b.eventTimestamp.getTime() - targetTime)
          )[0];

  if (!nearestLow) {
    throw new Error(`No low tide event found for harbor ${harbor}.`);
  }

  const lowTime = nearestLow.eventTimestamp.getTime();
  const halfWindowMs = config.hoursAroundLow * 3600 * 1000;
  const startTime = new Date(lowTime - halfWindowMs);
  const endTime = new Date(lowTime + halfWindowMs);

  const isOpen = targetTime >= startTime.getTime() && targetTime <= endTime.getTime();
  let status: 'OPEN' | 'CLOSING_SOON' | 'CLOSED' | 'OPENING_SOON';
  let minutesRemaining: number;

  if (isOpen) {
    minutesRemaining = Math.max(0, Math.round((endTime.getTime() - targetTime) / 60000));
    status = minutesRemaining <= 30 ? 'CLOSING_SOON' : 'OPEN';
  } else if (targetTime < startTime.getTime()) {
    minutesRemaining = Math.max(0, Math.round((startTime.getTime() - targetTime) / 60000));
    status = minutesRemaining <= 30 ? 'OPENING_SOON' : 'CLOSED';
  } else {
    minutesRemaining = 0;
    status = 'CLOSED';
  }

  const isFloodOrRising = tideStatus.phase === 'FLOOD' || targetTime >= lowTime;

  return {
    slug: passageSlug,
    name: config.name,
    isOpen,
    status,
    minutesRemaining,
    source: 'CALCULATED_FALLBACK',
    window: {
      start: startTime,
      end: endTime,
    },
    hazardNotice: isFloodOrRising ? config.hazardNoticeFlood : undefined,
  };
}
