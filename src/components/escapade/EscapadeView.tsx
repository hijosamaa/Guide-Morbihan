'use client';

import React, { useState } from 'react';
import { Drawer } from 'vaul';
import {
  CloudRain,
  Share2,
  Calendar,
  Waves,
  MapPin,
  X,
  Check,
  Sparkles,
  Umbrella,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type {
  EscapadePlan,
  EscapadeMoment,
  MomentType,
  EscapadePlace,
} from '../../lib/escapade/types';
import { EscapadeMomentCard } from './EscapadeMomentCard';

export interface EscapadeViewProps {
  /** Plan d'escapade généré */
  plan: EscapadePlan;
  /** Callback déclenché pour intervertir un spot avec une alternative */
  onSwap?: (dayIndex: number, momentType: MomentType, placeId: string) => void;
  /** Callback déclenché pour basculer le mode météo pluvieuse */
  onToggleRain?: (dayIndex: number) => void;
  /** Callback déclenché lors du partage de l'escapade */
  onShare?: () => void;
  /** Classes CSS supplémentaires */
  className?: string;
}

/**
 * Vue principale d'un séjour d'escapade intelligente dans le Morbihan.
 * Propose :
 * - Un en-tête d'actions rapides (Mode « ☔ Il pleut » et « 🔗 Partager »)
 * - Le bandeau des jours (J1, J2, J3) avec mémo des marées
 * - Les 4 cartes des moments de vie empilées (sans horaires rigides)
 * - Le tiroir tactile Vaul pour remplacer un lieu par l'une de ses alternatives
 */
export function EscapadeView({
  plan,
  onSwap,
  onToggleRain,
  onShare,
  className,
}: EscapadeViewProps) {
  const [activeDayIndex, setActiveDayIndex] = useState<number>(
    plan.days?.[0]?.dayIndex ?? 1
  );
  const [swapMoment, setSwapMoment] = useState<EscapadeMoment | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const currentDay =
    plan.days?.find((d) => d.dayIndex === activeDayIndex) ?? plan.days?.[0];

  const isRainActive = Boolean(currentDay?.isRainMode);

  // Gestion du partage sécurisé (Web Share API avec fallback vers le presse-papiers)
  const handleShare = async () => {
    onShare?.();
    const shareData = {
      title: 'Mon Escapade Morbihan',
      text: `Découvrez mon programme d'escapade sur-mesure dans le Morbihan (${plan.profile?.baseSector}) !`,
      url: typeof window !== 'undefined' ? window.location.href : '',
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // Annulation utilisateur ou non supporté
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareData.url);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2500);
      } catch (err) {
        // Fallback passif
      }
    }
  };

  const handleSelectAlternative = (place: EscapadePlace) => {
    if (!currentDay || !swapMoment) return;
    const placeId = place.id || place.slug || place.name;
    onSwap?.(currentDay.dayIndex, swapMoment.momentType, placeId);
    setSwapMoment(null);
  };

  const formatTideSummary = (summary: any): string => {
    if (!summary) return '';
    if (typeof summary === 'string') return summary;
    if (summary.waterState && summary.harbor) {
      return `Marée à ${summary.harbor} : ${summary.waterState}`;
    }
    return 'Marée surveillée en temps réel';
  };

  const tideNotice = currentDay?.tideSummary
    ? formatTideSummary(currentDay.tideSummary)
    : null;

  return (
    <div className={twMerge('mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8', className)}>
      {/* En-tête : Titre & Boutons d'action */}
      <header className="mb-6 rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span>Escapade Morbihan Sur-Mesure</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
              Votre Programme d’Escapade
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {plan.profile?.baseSector} • {plan.days?.length ?? 1} jour
              {(plan.days?.length ?? 1) > 1 ? 's' : ''} sans contrainte horaire
            </p>
          </div>

          {/* Boutons d'actions rapides : Mode Pluie & Partage */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Bouton Pluie */}
            <button
              type="button"
              onClick={() => currentDay && onToggleRain?.(currentDay.dayIndex)}
              aria-pressed={isRainActive}
              className={clsx(
                'inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 active:scale-[0.98]',
                isRainActive
                  ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-400 hover:bg-sky-700 focus:ring-sky-500'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus:ring-sky-500'
              )}
            >
              <CloudRain
                className={clsx('h-4 w-4', isRainActive ? 'text-sky-200' : 'text-slate-500')}
                aria-hidden="true"
              />
              <span>{isRainActive ? '☔ Il pleut (Actif)' : '☔ Il pleut'}</span>
            </button>

            {/* Bouton Partager */}
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 active:scale-[0.98]"
              aria-label="Partager mon escapade"
            >
              {copyFeedback ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  <span className="text-emerald-700">Lien copié !</span>
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  <span>🔗 Partager</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Bandeau d'onglets des jours (J1, J2, J3) */}
      {plan.days && plan.days.length > 1 && (
        <nav
          className="mb-5 flex overflow-x-auto pb-1 gap-2 border-b border-slate-200/80"
          role="tablist"
          aria-label="Jours du séjour"
        >
          {plan.days.map((day) => {
            const isSelected = day.dayIndex === activeDayIndex;
            return (
              <button
                key={day.dayIndex}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={`day-panel-${day.dayIndex}`}
                id={`day-tab-${day.dayIndex}`}
                onClick={() => setActiveDayIndex(day.dayIndex)}
                className={clsx(
                  'inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500',
                  isSelected
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
                )}
              >
                <Calendar className="h-4 w-4" aria-hidden="true" />
                <span>
                  Jour {day.dayIndex} • {day.sector}
                </span>
                {day.isRainMode && (
                  <span className="rounded-full bg-sky-200/80 text-sky-900 px-1.5 py-0.2 text-[11px] font-extrabold">
                    ☔
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* Rappel marée du jour */}
      {tideNotice && (
        <div
          className="mb-5 flex items-center gap-2.5 rounded-2xl border border-cyan-200/90 bg-cyan-50/80 px-4 py-3 text-xs sm:text-sm text-cyan-950 shadow-xs"
          role="status"
        >
          <Waves className="h-4 w-4 text-cyan-700 shrink-0" aria-hidden="true" />
          <p className="font-medium">
            <strong className="font-bold text-cyan-900">Marée du jour : </strong>
            {tideNotice}
          </p>
        </div>
      )}

      {/* Liste des 4 moments de vie de la journée */}
      {currentDay ? (
        <div
          id={`day-panel-${currentDay.dayIndex}`}
          role="tabpanel"
          aria-labelledby={`day-tab-${currentDay.dayIndex}`}
          className="space-y-4 sm:space-y-5"
        >
          {currentDay.moments.map((moment) => (
            <EscapadeMomentCard
              key={`${currentDay.dayIndex}-${moment.momentType}`}
              moment={moment}
              dayIndex={currentDay.dayIndex}
              onOpenSwap={(m) => setSwapMoment(m)}
            />
          ))}
        </div>
      ) : (
        <p className="text-center py-12 text-slate-500">Aucun programme pour ce jour.</p>
      )}

      {/* Tiroir tactile de remplacement d'un lieu (Vaul Drawer) */}
      {typeof window === 'undefined' ? (
        /* Rendu statique de repli en environnement serveur / test sans DOM */
        swapMoment ? (
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`Remplacer ${swapMoment.place.name}`}
            className="fixed inset-0 z-50 bg-black/40 flex items-end"
          >
            <div className="w-full rounded-t-3xl bg-white p-6 max-h-[85vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-slate-900">
                Remplacer « {swapMoment.place.name} »
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Alternatives pour le moment {swapMoment.title}
              </p>
              <div className="mt-4 space-y-3">
                {swapMoment.alternatives.map((alt, idx) => (
                  <button
                    key={alt.id || alt.slug || idx}
                    type="button"
                    onClick={() => handleSelectAlternative(alt)}
                    className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{alt.name}</div>
                      <div className="text-xs text-slate-500">{alt.commune}</div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700">Choisir</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        ) : null
      ) : (
        <Drawer.Root
          open={Boolean(swapMoment)}
          onOpenChange={(open) => {
            if (!open) setSwapMoment(null);
          }}
        >
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity" />
            <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[88dvh] flex-col rounded-t-[28px] border-t border-slate-200 bg-white shadow-2xl outline-none select-none">
              {/* Poignée tactile */}
              <div className="py-3 flex justify-center cursor-grab active:cursor-grabbing">
                <div className="h-1.5 w-12 rounded-full bg-slate-300" />
              </div>

              {swapMoment && (
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-8 sm:px-6">
                  {/* En-tête du tiroir */}
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <Drawer.Title className="text-lg sm:text-xl font-bold text-slate-950">
                        Remplacer « {swapMoment.place.name} »
                      </Drawer.Title>
                      <Drawer.Description className="mt-1 text-xs sm:text-sm text-slate-600">
                        Choisissez parmi les alternatives sélectionnées pour votre{' '}
                        {swapMoment.title.toLowerCase()}.
                      </Drawer.Description>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSwapMoment(null)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                      aria-label="Fermer le panneau"
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Liste des alternatives */}
                  <div className="mt-4 space-y-3">
                    {swapMoment.alternatives?.length > 0 ? (
                      swapMoment.alternatives.map((alt, idx) => {
                        const isAltSheltered = Boolean(alt.contextualRules?.rainFriendly);
                        return (
                          <div
                            key={alt.id || alt.slug || idx}
                            className="group flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs transition-all hover:border-emerald-300 hover:shadow-sm"
                          >
                            <div className="flex items-center gap-3.5">
                              {/* Miniature */}
                              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                                {alt.coverImageUrl ? (
                                  <img
                                    src={alt.coverImageUrl}
                                    alt={alt.name}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-emerald-50 text-emerald-600 font-bold text-lg">
                                    ⚓
                                  </div>
                                )}
                              </div>

                              {/* Infos spot */}
                              <div>
                                <h4 className="font-bold text-slate-950 text-sm sm:text-base">
                                  {alt.name}
                                </h4>
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                                  <MapPin className="h-3 w-3 text-slate-400" aria-hidden="true" />
                                  <span>{alt.commune}</span>
                                </p>
                                {isAltSheltered && (
                                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800 border border-sky-200">
                                    <Umbrella className="h-2.5 w-2.5 text-sky-600" aria-hidden="true" />
                                    <span>Abrité de la pluie</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Bouton de sélection */}
                            <button
                              type="button"
                              onClick={() => handleSelectAlternative(alt)}
                              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 active:scale-[0.98]"
                            >
                              <span>Choisir ce lieu</span>
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <p className="py-6 text-center text-sm text-slate-500">
                        Aucune alternative disponible pour ce moment.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}
    </div>
  );
}

export default EscapadeView;
