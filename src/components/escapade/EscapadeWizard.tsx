'use client';

import React, { useState } from 'react';
import { Sparkles, Check, Clock, Compass, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { BaseSector, EscapadeProfile, ProfileType } from '../../lib/escapade/types';

export interface SectorOption {
  id: BaseSector;
  name: string;
  badge: string;
  description: string;
  emoji: string;
}

export interface DurationOption {
  value: number;
  label: string;
  badge: string;
  sublabel: string;
}

export interface ProfileOption {
  type: ProfileType;
  title: string;
  badge: string;
  description: string;
  emoji: string;
}

export const SECTOR_OPTIONS: SectorOption[] = [
  {
    id: 'Golfe',
    name: 'Vannes & Golfe Nord',
    badge: 'Golfe Nord',
    description: 'Vannes, Arradon, Séné, Baden & sentiers côtiers',
    emoji: '⛵',
  },
  {
    id: 'Presqu-ile de Rhuys',
    name: "Presqu’île de Rhuys",
    badge: 'Rhuys',
    description: 'Sarzeau, Port-Navalo, Château de Suscinio & océan',
    emoji: '🏰',
  },
  {
    id: 'Ria d-Etel',
    name: "Pays d'Auray & Ria d'Étel",
    badge: 'Auray / Ria',
    description: 'Saint-Goustan, Saint-Cado, Belz & rias sauvages',
    emoji: '🌊',
  },
  {
    id: 'Presqu-ile de Quiberon',
    name: 'Quiberon & Carnac',
    badge: 'Quiberon / Carnac',
    description: 'Côte Sauvage, alignements mégalithiques & grandes plages',
    emoji: '🪨',
  },
];

export const DURATION_OPTIONS: DurationOption[] = [
  {
    value: 1,
    label: '1 jour',
    badge: 'Escapade 1 jour',
    sublabel: 'Une journée intense & 100% sans bouchon',
  },
  {
    value: 2,
    label: '2-3 jours',
    badge: 'Court séjour',
    sublabel: 'Week-end prolongé avec rotation géographique fluide',
  },
];

export const PROFILE_OPTIONS: ProfileOption[] = [
  {
    type: 'FAMILY',
    title: 'Famille / Poussette',
    badge: 'Famille & Enfants',
    description: 'Parcours faciles, accès poussettes, plages abritées & pauses ludiques',
    emoji: '👶',
  },
  {
    type: 'NATURE',
    title: 'Balade & Nature sauvage',
    badge: 'Randonnée & Vues',
    description: 'Sentier côtier GR34, pointes rocheuses & criques secrètes',
    emoji: '🌿',
  },
  {
    type: 'HERITAGE_GOURMET',
    title: "Patrimoine & Dégustation d'huîtres",
    badge: 'Terroir & Histoire',
    description: 'Chantiers ostréicoles, dégustation face au Golfe & trésors historiques',
    emoji: '🦪',
  },
];

export interface EscapadeWizardProps {
  /** Callback déclenché avec le profil choisi */
  onGenerate: (profile: EscapadeProfile) => void;
  /** Profil initial optionnel */
  initialProfile?: Partial<EscapadeProfile>;
  /** État de génération / chargement */
  isGenerating?: boolean;
  /** Classes CSS supplémentaires optionnelles */
  className?: string;
}

/**
 * Composant de formulaire tactile ultra-rapide (< 15 secondes de complétion).
 * 3 étapes simples : Secteur de départ, Durée (1j / 2-3j), et Profil voyageur.
 * Optimisé mobile-first avec des cibles tactiles >= 44px et une accessibilité WCAG stricte.
 */
export function EscapadeWizard({
  onGenerate,
  initialProfile,
  isGenerating = false,
  className,
}: EscapadeWizardProps) {
  const [baseSector, setBaseSector] = useState<BaseSector>(
    initialProfile?.baseSector ?? 'Presqu-ile de Rhuys'
  );
  const [durationDays, setDurationDays] = useState<number>(
    initialProfile?.durationDays ?? 1
  );
  const [profileType, setProfileType] = useState<ProfileType>(
    initialProfile?.profileType ?? 'FAMILY'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating) return;
    onGenerate({
      baseSector,
      durationDays,
      profileType,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={twMerge(
        clsx(
          'w-full max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200/90 p-4 sm:p-6 space-y-6 touch-manipulation',
          className
        )
      )}
      aria-label="Configuration de votre escapade personnalisée"
    >
      {/* En-tête express */}
      <div className="space-y-1.5 border-b border-slate-100 pb-4">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Wizard Express • 15 secondes</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Votre Escapade Morbihan sur-mesure
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Calibrée sur les marées réelles et sans bouchons d’été.
        </p>
      </div>

      {/* Étape 1 : Secteur hébergement */}
      <fieldset className="space-y-3">
        <legend className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold shrink-0">
            1
          </span>
          <span>Où logez-vous ?</span>
        </legend>
        <p className="text-xs text-slate-500 ml-8 -mt-2">
          Rayonnez facilement sans traverser le goulet ni subir les embouteillages.
        </p>

        <div
          role="radiogroup"
          aria-label="Secteur de votre hébergement"
          className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1"
        >
          {SECTOR_OPTIONS.map((sector) => {
            const isSelected = baseSector === sector.id;
            return (
              <button
                key={sector.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setBaseSector(sector.id)}
                className={twMerge(
                  clsx(
                    'min-h-[58px] p-3 rounded-xl text-left border flex items-start gap-3 transition-all duration-150 touch-manipulation active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
                    isSelected
                      ? 'bg-blue-50/80 border-blue-600 text-slate-900 ring-1 ring-blue-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/60'
                  )
                )}
              >
                <span className="text-2xl shrink-0 mt-0.5 select-none" aria-hidden="true">
                  {sector.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-semibold text-sm leading-tight text-slate-900">
                      {sector.name}
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                    {sector.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Étape 2 : Durée */}
      <fieldset className="space-y-3">
        <legend className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold shrink-0">
            2
          </span>
          <span>Combien de temps ?</span>
        </legend>
        <p className="text-xs text-slate-500 ml-8 -mt-2">
          1 jour concentré ou un week-end prolongé de 2 à 3 jours.
        </p>

        <div
          role="radiogroup"
          aria-label="Durée du séjour"
          className="flex flex-wrap gap-2.5 pt-1"
        >
          {DURATION_OPTIONS.map((duration) => {
            // S'adapte aux durées 1 jour ou 2-3 jours (2 ou 3)
            const isSelected =
              duration.value === 1
                ? durationDays === 1
                : durationDays >= 2;
            return (
              <button
                key={duration.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setDurationDays(duration.value)}
                className={twMerge(
                  clsx(
                    'min-h-[48px] h-12 px-5 rounded-full border text-sm font-semibold flex items-center gap-2.5 transition-all duration-150 touch-manipulation active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900',
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                  )
                )}
              >
                <span>{duration.label}</span>
                <span
                  className={clsx(
                    'text-[11px] px-2 py-0.5 rounded-full font-medium',
                    isSelected
                      ? 'bg-slate-800 text-slate-200'
                      : 'bg-slate-100 text-slate-600'
                  )}
                >
                  {duration.badge}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Étape 3 : Profil voyageur */}
      <fieldset className="space-y-3">
        <legend className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold shrink-0">
            3
          </span>
          <span>Votre style d’escapade</span>
        </legend>
        <p className="text-xs text-slate-500 ml-8 -mt-2">
          Priorise les coefficients de marée, la marche et les pauses gourmandes.
        </p>

        <div
          role="radiogroup"
          aria-label="Profil de voyage"
          className="space-y-2.5 pt-1"
        >
          {PROFILE_OPTIONS.map((profile) => {
            const isSelected = profileType === profile.type;
            return (
              <button
                key={profile.type}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setProfileType(profile.type)}
                className={twMerge(
                  clsx(
                    'min-h-[60px] w-full p-3.5 rounded-xl text-left border flex items-center justify-between gap-3 transition-all duration-150 touch-manipulation active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
                    isSelected
                      ? 'bg-blue-50/80 border-blue-600 text-slate-900 ring-1 ring-blue-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/60'
                  )
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl shrink-0 select-none" aria-hidden="true">
                    {profile.emoji}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 leading-tight">
                        {profile.title}
                      </span>
                      <span
                        className={clsx(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
                          isSelected
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {profile.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                      {profile.description}
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <Check className="w-5 h-5 text-blue-600 shrink-0 ml-2" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Bouton d'action final */}
      <div className="pt-2 space-y-2">
        <button
          type="submit"
          disabled={isGenerating}
          aria-busy={isGenerating}
          aria-label="Générer mon escapade en Morbihan"
          className={twMerge(
            clsx(
              'w-full min-h-[52px] h-14 rounded-xl font-bold text-base text-white shadow-md transition-all duration-150 touch-manipulation flex items-center justify-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
              isGenerating
                ? 'bg-blue-400 cursor-not-allowed opacity-90'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
            )
          )}
        >
          {isGenerating ? (
            <>
              <div
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"
                aria-hidden="true"
              />
              <span>Création de votre escapade...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-amber-300 shrink-0" aria-hidden="true" />
              <span>Générer mon escapade</span>
            </>
          )}
        </button>
        <p className="text-center text-[11px] text-slate-400">
          ⚡ Prêt en 1 seconde • 4 moments de vie calibrés marée & anti-bouchons
        </p>
      </div>
    </form>
  );
}
