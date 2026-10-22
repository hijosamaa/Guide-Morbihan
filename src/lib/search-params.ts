import {
  parseAsString,
  parseAsBoolean,
  createSearchParamsCache,
} from 'nuqs/server';

export const filterParsers = {
  // Catégorie sélectionnée : 'ALL' | 'BEACH' | 'TRAIL' | 'HERITAGE' | 'GASTRONOMY' | 'NAUTICAL' | 'VIEWPOINT'
  cat: parseAsString.withDefault('ALL'),
  // Filtre contextuel marée : 'ALL' | 'IDEAL_NOW'
  maree: parseAsString.withDefault('ALL'),
  // Filtre protection vent
  vent: parseAsBoolean.withDefault(false),
  // Filtres commodités & accessibilité
  pmr: parseAsBoolean.withDefault(false),
  chiens: parseAsBoolean.withDefault(false),
  pluie: parseAsBoolean.withDefault(false),
  // Spot sélectionné (slug ou id)
  spot: parseAsString.withDefault(''),
};

export const searchParamsCache = createSearchParamsCache(filterParsers);

export type FilterState = {
  cat: string;
  maree: string;
  vent: boolean;
  pmr: boolean;
  chiens: boolean;
  pluie: boolean;
  spot: string;
};
