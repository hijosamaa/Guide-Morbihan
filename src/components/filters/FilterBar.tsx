'use client';

import React, { useTransition } from 'react';
import { useQueryState, parseAsString, parseAsBoolean } from 'nuqs';
import { FilterPill } from './FilterPill';

export interface FilterBarProps {
  /** Indique si des précipitations sont détectées localement pour remonter le filtre pluie */
  isRaining?: boolean;
  /** Classes CSS supplémentaires optionnelles */
  className?: string;
  /** Callback optionnel déclenché lors d'un changement de filtre */
  onFilterChange?: () => void;
}

/**
 * Piste de filtres tactiles à défilement horizontal (touch-pan-x, overflow-x-auto).
 * Synchronise les états de filtrage dans les paramètres d'URL via `nuqs` (shallow: true, history: replace)
 * enveloppés dans un `useTransition` React pour garantir une fluidité à 60 FPS sans bloquer l'UI.
 */
export function FilterBar({ isRaining = false, className = '', onFilterChange }: FilterBarProps) {
  const [, startTransition] = useTransition();

  const [selectedCat, setSelectedCat] = useQueryState(
    'cat',
    parseAsString.withDefault('ALL').withOptions({
      shallow: true,
      history: 'replace',
      startTransition,
    })
  );

  const [tideFilter, setTideFilter] = useQueryState(
    'maree',
    parseAsString.withDefault('ALL').withOptions({
      shallow: true,
      history: 'replace',
      startTransition,
    })
  );

  const [shelteredFromWind, setShelteredFromWind] = useQueryState(
    'vent',
    parseAsBoolean.withDefault(false).withOptions({
      shallow: true,
      history: 'replace',
      startTransition,
    })
  );

  const [rainFriendly, setRainFriendly] = useQueryState(
    'pluie',
    parseAsBoolean.withDefault(false).withOptions({
      shallow: true,
      history: 'replace',
      startTransition,
    })
  );

  const handleToggleRain = () => {
    setRainFriendly((prev) => !prev);
    onFilterChange?.();
  };

  const handleToggleTideAndBeach = () => {
    if (selectedCat === 'BEACH' && tideFilter === 'IDEAL_NOW') {
      setSelectedCat('ALL');
      setTideFilter('ALL');
    } else {
      setSelectedCat('BEACH');
      setTideFilter('IDEAL_NOW');
    }
    onFilterChange?.();
  };

  const handleToggleWind = () => {
    setShelteredFromWind((prev) => !prev);
    onFilterChange?.();
  };

  const handleToggleTrail = () => {
    setSelectedCat((prev) => (prev === 'TRAIL' ? 'ALL' : 'TRAIL'));
    onFilterChange?.();
  };

  const handleToggleHeritage = () => {
    setSelectedCat((prev) => (prev === 'HERITAGE' ? 'ALL' : 'HERITAGE'));
    onFilterChange?.();
  };

  const handleToggleGastronomy = () => {
    setSelectedCat((prev) => (prev === 'GASTRONOMY' ? 'ALL' : 'GASTRONOMY'));
    onFilterChange?.();
  };

  return (
    <div
      className={`flex items-center gap-2.5 overflow-x-auto no-scrollbar py-2 px-1 touch-pan-x ${className}`}
      role="toolbar"
      aria-label="Filtres contextuels"
    >
      {/* Si pluie détectée, suggérer en premier */}
      {isRaining && (
        <FilterPill
          icon="🌧️"
          label="À l'abri de la pluie"
          isActive={rainFriendly}
          onClick={handleToggleRain}
        />
      )}

      <FilterPill
        icon="🏖️"
        label="Baignade idéale"
        isActive={selectedCat === 'BEACH' && tideFilter === 'IDEAL_NOW'}
        onClick={handleToggleTideAndBeach}
      />

      <FilterPill
        icon="💨"
        label="Abrité du vent"
        isActive={shelteredFromWind}
        onClick={handleToggleWind}
      />

      <FilterPill
        icon="🥾"
        label="Sentiers ouverts"
        isActive={selectedCat === 'TRAIL'}
        onClick={handleToggleTrail}
      />

      <FilterPill
        icon="🏰"
        label="Patrimoine"
        isActive={selectedCat === 'HERITAGE'}
        onClick={handleToggleHeritage}
      />

      <FilterPill
        icon="🦪"
        label="Déguster & Huîtres"
        isActive={selectedCat === 'GASTRONOMY'}
        onClick={handleToggleGastronomy}
      />
    </div>
  );
}
