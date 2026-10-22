'use client';

import React from 'react';
import {
  Sunrise,
  UtensilsCrossed,
  Waves,
  Sunset,
  Navigation,
  RefreshCw,
  Umbrella,
  Sparkles,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { EscapadeMoment, MomentType } from '../../lib/escapade/types';

export interface EscapadeMomentCardProps {
  /** Le bloc de vie à afficher */
  moment: EscapadeMoment;
  /** Index du jour (1, 2 ou 3) */
  dayIndex?: number;
  /** Déclenché lors du clic sur le bouton remplacer */
  onOpenSwap?: (moment: EscapadeMoment) => void;
  /** Classes CSS supplémentaires */
  className?: string;
}

interface MomentVisualConfig {
  label: string;
  defaultTitle: string;
  emoji: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  borderAccent: string;
}

const MOMENT_CONFIGS: Record<MomentType, MomentVisualConfig> = {
  MATIN: {
    label: 'Matin',
    defaultTitle: 'Matinée iodée',
    emoji: '🌅',
    icon: Sunrise,
    accentColor: 'text-amber-600',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800 border-amber-200',
    borderAccent: 'border-l-amber-500',
  },
  DEJEUNER: {
    label: 'Midi',
    defaultTitle: 'Pause dégustation',
    emoji: '🦪',
    icon: UtensilsCrossed,
    accentColor: 'text-emerald-600',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800 border-emerald-200',
    borderAccent: 'border-l-emerald-500',
  },
  APRES_MIDI: {
    label: 'Après-midi',
    defaultTitle: 'Après-midi marée',
    emoji: '🌊',
    icon: Waves,
    accentColor: 'text-cyan-600',
    badgeBg: 'bg-cyan-50',
    badgeText: 'text-cyan-800 border-cyan-200',
    borderAccent: 'border-l-cyan-500',
  },
  FIN_JOURNEE: {
    label: 'Fin de journée',
    defaultTitle: 'Coucher de soleil',
    emoji: '🌇',
    icon: Sunset,
    accentColor: 'text-indigo-600',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-800 border-indigo-200',
    borderAccent: 'border-l-indigo-500',
  },
};

/**
 * Carte visuelle d'un moment de vie (Matin, Midi, Après-midi, Fin de journée).
 * Affiche l'icône, le nom du spot, la commune, la photo, le badge contextuel
 * et les boutons d'action rapide : « 🚗 Y aller » et « 🔀 Remplacer ».
 */
export function EscapadeMomentCard({
  moment,
  onOpenSwap,
  className,
}: EscapadeMomentCardProps) {
  const config = MOMENT_CONFIGS[moment.momentType] || MOMENT_CONFIGS.MATIN;
  const MomentIcon = config.icon;
  const place = moment.place;

  // Calcul des coordonnées cibles (priorité au parking officiel conseillé)
  const destLat = place.parkingLat ?? place.latitude;
  const destLng = place.parkingLng ?? place.longitude;

  const mapsUrl =
    destLat != null && destLng != null
      ? `https://maps.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`
      : place.slug
      ? `/lieu/${place.slug}`
      : '#';

  const wazeUrl =
    destLat != null && destLng != null
      ? `https://waze.com/ul?ll=${destLat},${destLng}&navigate=yes`
      : null;

  const alternativesCount = moment.alternatives?.length ?? 0;
  const isSheltered = Boolean(place.contextualRules?.rainFriendly);

  return (
    <article
      className={twMerge(
        clsx(
          'group relative flex flex-col sm:flex-row overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-all hover:shadow-md border-l-4',
          config.borderAccent,
          className
        )
      )}
      aria-label={`${config.label} : ${moment.title} à ${place.name}`}
    >
      {/* Vignette Photo / Visuel */}
      <div className="relative h-44 sm:h-auto sm:w-52 shrink-0 overflow-hidden bg-slate-100">
        {place.coverImageUrl ? (
          <img
            src={place.coverImageUrl}
            alt={`Photo de ${place.name}`}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
            <span className="text-4xl" role="img" aria-hidden="true">
              {config.emoji}
            </span>
          </div>
        )}

        {/* Badge Moment flottant sur la photo */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-md px-3 py-1 shadow-sm border border-slate-200/60">
          <MomentIcon className={twMerge('h-3.5 w-3.5', config.accentColor)} aria-hidden="true" />
          <span className="text-xs font-bold text-slate-800 tracking-wide uppercase">
            {config.label}
          </span>
        </div>
      </div>

      {/* Contenu textuel & actions */}
      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        <div>
          {/* En-tête du moment */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900 text-base sm:text-lg flex items-center gap-1.5">
              <span>{moment.title || config.defaultTitle}</span>
            </h3>

            {/* Badges de contexte (Marée / Abri / Coup de cœur) */}
            <div className="flex flex-wrap items-center gap-1.5">
              {isSheltered && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800"
                  title="Spot couvert ou adapté en cas de pluie"
                >
                  <Umbrella className="h-3 w-3 text-sky-600" aria-hidden="true" />
                  <span>Abrité de la pluie</span>
                </span>
              )}

              {moment.tideNotice && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-xs font-medium text-cyan-800"
                  title="Indication marée pour ce créneau"
                >
                  <Waves className="h-3 w-3 text-cyan-600" aria-hidden="true" />
                  <span>{moment.tideNotice}</span>
                </span>
              )}

              {place.isSponsored && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                  <Sparkles className="h-3 w-3 text-amber-600" aria-hidden="true" />
                  <span>Coup de cœur</span>
                </span>
              )}
            </div>
          </div>

          {/* Informations sur le lieu */}
          <div className="mt-2">
            <h4 className="text-lg sm:text-xl font-bold text-slate-950 leading-snug">
              {place.name}
            </h4>

            {place.commune && (
              <p className="mt-1 flex items-center gap-1 text-sm font-medium text-slate-600">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                <span>{place.commune}</span>
                {place.category && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500 capitalize">{place.category.toLowerCase()}</span>
                  </>
                )}
              </p>
            )}

            {place.shortDescription && (
              <p className="mt-2 text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                {place.shortDescription}
              </p>
            )}
          </div>
        </div>

        {/* Barre d'actions : 🚗 Y aller & 🔀 Remplacer */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Bouton Y aller */}
            <a
              href={mapsUrl}
              target={mapsUrl.startsWith('http') ? '_blank' : '_self'}
              rel={mapsUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 active:scale-[0.98]"
              aria-label={`Y aller en voiture vers ${place.name}`}
            >
              <Navigation className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <span>🚗 Y aller</span>
              {mapsUrl.startsWith('http') && (
                <ExternalLink className="h-3 w-3 opacity-60 ml-0.5" aria-hidden="true" />
              )}
            </a>

            {/* Lien secondaire fiche lieu si slug disponible */}
            {place.slug && (
              <a
                href={`/lieu/${place.slug}`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <span>Fiche spot</span>
              </a>
            )}
          </div>

          {/* Bouton Remplacer */}
          <button
            type="button"
            onClick={() => onOpenSwap?.(moment)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 active:scale-[0.98]"
            aria-label={`Remplacer ${place.name}`}
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
            <span>🔀 Remplacer</span>
            {alternativesCount > 0 && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">
                {alternativesCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

export default EscapadeMomentCard;
