import {
  pgTable,
  uuid,
  varchar,
  text,
  doublePrecision,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';

// Énumérations métier
export const categoryEnum = pgEnum('place_category', [
  'BEACH',           // Plages et criques
  'TRAIL',           // Randonnées et sentiers GR34
  'TIDAL_PASSAGE',   // Passages submersibles (Berder, Tascon...)
  'HERITAGE',        // Châteaux, mégalithes, ports historiques
  'GASTRONOMY',      // Chantiers ostréicoles, crêperies, cafés
  'NAUTICAL',        // Cales, clubs nautiques, embarcadères
  'VIEWPOINT',       // Panoramas et points de vue
]);

export const tideConstraintEnum = pgEnum('tide_constraint', [
  'ALL_TIDES',       // Praticable tout le temps
  'HIGH_TIDE_ONLY',  // Baignade à marée haute uniquement
  'LOW_TIDE_ONLY',   // Passages submersibles ou pêche à pied
  'MID_TIDE_FLOW',   // Observation de courants marins (Courant de la Jument)
]);

// Types JSONB contextuels
export interface ContextualRules {
  tideConstraint: 'ALL_TIDES' | 'HIGH_TIDE_ONLY' | 'LOW_TIDE_ONLY' | 'MID_TIDE_FLOW';
  tideOffsetHours?: {
    beforeHigh?: number;
    afterHigh?: number;
    beforeLow?: number;
    afterLow?: number;
  };
  shelteredFromWindDirections?: ('N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW')[];
  minWaterHeightMeters?: number;
  dogsAllowedSummer: boolean;
  strollerFriendly: boolean;
  rainFriendly: boolean;
}

export interface TrailMetadata {
  distanceKm: number;
  elevationGainM: number;
  durationMinutes: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  isLoop: boolean;
  gpxUrl?: string;
  geojsonTrack: GeoJSON.Feature<GeoJSON.LineString>;
  elevationProfile: { distKm: number; altM: number }[];
}

// 1. Table principale des Lieux, Plages et Sentiers
export const places = pgTable(
  'places',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    externalId: varchar('external_id', { length: 128 }).unique(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    shortDescription: varchar('short_description', { length: 300 }).notNull(),
    fullDescription: text('full_description'),
    category: categoryEnum('category').notNull(),
    commune: varchar('commune', { length: 100 }).notNull(),
    communeSlug: varchar('commune_slug', { length: 100 }).notNull(),
    sector: varchar('sector', { length: 100 }).notNull(),
    
    // Coordonnées GPS principales et Parking
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    parkingLat: doublePrecision('parking_lat'),
    parkingLng: doublePrecision('parking_lng'),

    // Règles métier contextuelles
    contextualRules: jsonb('contextual_rules').$type<ContextualRules>().notNull(),

    // Données spécifiques aux randonnées
    trailData: jsonb('trail_data').$type<TrailMetadata>(),

    // Médias & Monétisation
    coverImageUrl: text('cover_image_url'),
    isSponsored: boolean('is_sponsored').default(false).notNull(),
    affiliateBookingUrl: text('affiliate_booking_url'),
    affiliateLabel: varchar('affiliate_label', { length: 100 }),

    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    communeCategoryIdx: index('idx_commune_category').on(table.communeSlug, table.category),
    coordsIdx: index('idx_coords').on(table.latitude, table.longitude),
    sponsoredIdx: index('idx_sponsored').on(table.isSponsored),
  })
);

// 2. Table des Événements de Marée
export const tideEvents = pgTable(
  'tide_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    harbor: varchar('harbor', { length: 50 }).notNull(), // 'PORT_NAVALO' | 'VANNES'
    eventType: varchar('event_type', { length: 10 }).notNull(), // 'HIGH' | 'LOW'
    eventTimestamp: timestamp('event_timestamp', { withTimezone: true }).notNull(),
    heightMeters: doublePrecision('height_meters').notNull(),
    coefficient: integer('coefficient'),
  },
  (table) => ({
    harborTimeIdx: index('idx_harbor_time').on(table.harbor, table.eventTimestamp),
    harborTimeUniqueIdx: uniqueIndex('idx_harbor_time_unique').on(table.harbor, table.eventTimestamp),
  })
);

// 3. Table des Instantanés Météo
export const weatherSnapshots = pgTable('weather_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  sector: varchar('sector', { length: 50 }).notNull().unique(), // 'VANNES', 'ARRADON', 'SARZEAU', 'QUIBERON', 'ETEL'
  tempCelsius: doublePrecision('temp_celsius').notNull(),
  windSpeedKnots: doublePrecision('wind_speed_knots').notNull(),
  windDirectionDeg: integer('wind_direction_deg').notNull(),
  windCardinal: varchar('wind_cardinal', { length: 5 }).notNull(),
  weatherCode: integer('weather_code').notNull(),
  isRaining: boolean('is_raining').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Place = typeof places.$inferSelect;
export type NewPlace = typeof places.$inferInsert;
export type TideEvent = typeof tideEvents.$inferSelect;
export type WeatherSnapshot = typeof weatherSnapshots.$inferSelect;

// Énumération des équipements utilitaires
export const amenityTypeEnum = pgEnum('amenity_type', [
  'DRINKING_WATER',    // Fontaines d'eau potable
  'TOILETS',           // Toilettes publiques
  'PICNIC_TABLE',      // Tables de pique-nique
  'BICYCLE_PARKING',   // Arceaux et abris vélos
  'BEACH_SHOWER',      // Douches de plage
  'DEFIBRILLATOR',     // Défibrillateurs DAE
  'BAKERY',            // Boulangeries sur les sentiers
  'OTHER',             // Extensions futures
]);

// Table des équipements pratiques
export const amenities = pgTable(
  'amenities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    osmId: varchar('osm_id', { length: 64 }).notNull().unique(),
    type: amenityTypeEnum('type').notNull(),
    name: varchar('name', { length: 255 }),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    properties: jsonb('properties').$type<Record<string, unknown>>().default({}).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    coordsIdx: index('idx_amenities_coords').on(table.latitude, table.longitude),
    typeIdx: index('idx_amenities_type').on(table.type),
  })
);

export type Amenity = typeof amenities.$inferSelect;
export type NewAmenity = typeof amenities.$inferInsert;

