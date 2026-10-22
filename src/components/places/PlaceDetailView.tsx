import React from 'react';
import {
  MapPin,
  Clock,
  Ticket,
  Droplets,
  Car,
  Utensils,
  Trees,
  TreePine,
  Bath,
  Sparkles,
  Waves,
  AlertTriangle,
  ArrowLeft,
  X,
  ExternalLink,
  Compass,
  Sun,
  Info,
} from 'lucide-react';
import type {
  Place,
  ContextEvaluationResult,
  PracticalInfo,
  TideDetails,
} from '../../lib/types/context';
import { ContextBadge } from './ContextBadge';
import { PhotoGallery } from './PhotoGallery';
import { ParkingDirectButton } from './ParkingDirectButton';

export interface PlaceDetailViewProps {
  place: Place;
  context?: ContextEvaluationResult | null;
  onClose?: () => void;
  className?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  BEACH: 'Plage & Crique',
  TRAIL: 'Sentier & Randonnée',
  TIDAL_PASSAGE: 'Passage submersible',
  HERITAGE: 'Patrimoine & Histoire',
  GASTRONOMY: 'Huîtres & Terroir',
  NAUTICAL: 'Nautisme & Cale',
  VIEWPOINT: 'Point de vue panoramique',
};

const AMENITY_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  toilets: { label: 'Toilettes publiques', icon: Bath },
  water: { label: "Point d'eau potable", icon: Droplets },
  parking: { label: 'Parking à proximité', icon: Car },
  food: { label: 'Dégustation / Restauration', icon: Utensils },
  picnic_table: { label: 'Table de pique-nique', icon: TreePine },
  shade: { label: 'Coins ombragés', icon: Trees },
};

const SEASON_LABELS: Record<string, string> = {
  SPRING: 'Printemps',
  SUMMER: 'Été',
  AUTUMN: 'Automne',
  WINTER: 'Hiver',
};

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (remMinutes === 0) {
    return `${hours}h (${minutes} min)`;
  }
  return `${hours}h${remMinutes < 10 ? '0' : ''}${remMinutes} (${minutes} min)`;
}

export function PlaceDetailView({
  place,
  context,
  onClose,
  className = '',
}: PlaceDetailViewProps) {
  const categoryLabel = CATEGORY_LABELS[place.category] || place.category;
  const practicalInfo: PracticalInfo | null | undefined = place.practicalInfo;
  const tideDetails: TideDetails | null | undefined = place.tideDetails;

  return (
    <article
      className={`relative w-full max-w-3xl mx-auto flex flex-col bg-white text-slate-900 pb-12 ${className}`}
      aria-label={`Détails de ${place.name}`}
    >
      {/* Top action header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur-md z-30">
        <div className="flex items-center gap-2 min-w-0">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              aria-label="Fermer la fiche"
            >
              <ArrowLeft className="h-5 w-5 sm:hidden" aria-hidden="true" />
              <X className="h-5 w-5 hidden sm:block" aria-hidden="true" />
              <span className="sr-only">Retour</span>
            </button>
          )}
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 truncate">
            {categoryLabel}
          </span>
        </div>

        {context && (
          <div className="shrink-0">
            <ContextBadge status={context.status} customLabel={context.badgeLabel} />
          </div>
        )}
      </div>

      <div className="px-4 py-4 sm:px-6 space-y-6">
        {/* Title and Commune */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 leading-tight">
            {place.name}
          </h1>
          {place.commune && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-500">
              <MapPin className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <span>{place.commune}</span>
              {place.sector && <span className="text-slate-400">• Secteur {place.sector}</span>}
            </p>
          )}
        </div>

        {/* Media Photo Gallery */}
        <PhotoGallery photos={place.photoGallery} placeName={place.name} />

        {/* Real-time passage alert if present */}
        {context?.passageContext && (
          <div
            className={`rounded-xl border p-4 ${
              context.passageContext.isOpen
                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                : 'border-amber-200 bg-amber-50 text-amber-950'
            }`}
            role="status"
          >
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Waves className="h-4 w-4" aria-hidden="true" />
              <span>
                {context.passageContext.isOpen
                  ? `Passage ouvert — encore ${context.passageContext.minutesRemaining} min`
                  : 'Passage actuellement submergé par la marée'}
              </span>
            </div>
            {context.passageContext.hazardNotice && (
              <p className="mt-1 text-xs opacity-90">{context.passageContext.hazardNotice}</p>
            )}
          </div>
        )}

        {/* Contextual evaluation reason badge */}
        {context && context.reasons && context.reasons.length > 0 && !context.passageContext && (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-slate-900">{context.titleReason}</p>
              <p className="mt-0.5 text-slate-600">{context.reasons.join(' • ')}</p>
            </div>
          </div>
        )}

        {/* Descriptions */}
        <div className="space-y-3">
          {place.shortDescription && (
            <p className="text-base text-slate-800 font-medium leading-relaxed">
              {place.shortDescription}
            </p>
          )}
          {place.fullDescription && place.fullDescription !== place.shortDescription && (
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {place.fullDescription}
            </p>
          )}
        </div>

        {/* Non-plagiarized Insider Tip Callout Box (Avis de la rédaction) */}
        {practicalInfo?.insiderTip && (
          <div
            className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/90 to-amber-100/40 p-4 sm:p-5 shadow-sm"
            role="region"
            aria-label="Conseil d'initié de la rédaction"
          >
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <Sparkles className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
              <span>Conseil d&apos;initié • L&apos;Avis de la rédaction</span>
            </div>
            <p className="mt-2 text-sm text-amber-950/90 leading-relaxed font-normal">
              {practicalInfo.insiderTip}
            </p>
          </div>
        )}

        {/* Tide details section */}
        {tideDetails &&
          (tideDetails.highTideAdvantage ||
            tideDetails.lowTideAdvantage ||
            tideDetails.warningNote) && (
            <section
              className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 space-y-3"
              aria-label="Rythme des marées sur ce site"
            >
              <div className="flex items-center gap-2 font-semibold text-sky-950 text-sm">
                <Waves className="h-4 w-4 text-sky-600" aria-hidden="true" />
                <span>Rythme des marées</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {tideDetails.highTideAdvantage && (
                  <div className="rounded-xl bg-white p-3 border border-sky-100/80 shadow-2xs">
                    <span className="font-semibold text-sky-900 block mb-1">À pleine mer</span>
                    <span className="text-slate-700 leading-relaxed">
                      {tideDetails.highTideAdvantage}
                    </span>
                  </div>
                )}
                {tideDetails.lowTideAdvantage && (
                  <div className="rounded-xl bg-white p-3 border border-sky-100/80 shadow-2xs">
                    <span className="font-semibold text-sky-900 block mb-1">À basse mer</span>
                    <span className="text-slate-700 leading-relaxed">
                      {tideDetails.lowTideAdvantage}
                    </span>
                  </div>
                )}
              </div>
              {tideDetails.warningNote && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{tideDetails.warningNote}</span>
                </div>
              )}
            </section>
          )}

        {/* Practical Information */}
        {practicalInfo && (
          <section className="space-y-4" aria-label="Informations pratiques">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Compass className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <span>Infos pratiques</span>
            </h2>

            {/* Quick stats pills: Duration, Pricing, Season */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {practicalInfo.recommendedDurationMinutes != null && (
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <Clock className="h-4 w-4 text-slate-500 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">
                      Durée conseillée
                    </p>
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {formatDuration(practicalInfo.recommendedDurationMinutes)}
                    </p>
                  </div>
                </div>
              )}

              {practicalInfo.pricing && (
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <Ticket className="h-4 w-4 text-slate-500 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">
                      Accès & Tarif
                    </p>
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {practicalInfo.pricing}
                    </p>
                  </div>
                </div>
              )}

              {practicalInfo.bestSeason && practicalInfo.bestSeason.length > 0 && (
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3 col-span-2 sm:col-span-1">
                  <Sun className="h-4 w-4 text-amber-500 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">
                      Meilleure saison
                    </p>
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {practicalInfo.bestSeason.map((s) => SEASON_LABELS[s] || s).join(', ')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Amenities on-site */}
            {practicalInfo.amenities && practicalInfo.amenities.length > 0 && (
              <div className="pt-1">
                <p className="text-xs font-semibold text-slate-700 mb-2">Commodités sur place</p>
                <div className="flex flex-wrap gap-2">
                  {practicalInfo.amenities.map((amenity) => {
                    const config = AMENITY_CONFIG[amenity] || {
                      label: amenity,
                      icon: Info,
                    };
                    const IconComponent = config.icon;
                    return (
                      <span
                        key={amenity}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs"
                      >
                        <IconComponent className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                        <span>{config.label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Good to know */}
            {practicalInfo.goodToKnow && (
              <p className="rounded-xl bg-slate-100/70 p-3 text-xs text-slate-600 leading-relaxed">
                <span className="font-semibold text-slate-800">Bon à savoir : </span>
                {practicalInfo.goodToKnow}
              </p>
            )}
          </section>
        )}

        {/* Direct Parking GPS Access */}
        <ParkingDirectButton
          parkingLat={place.parkingLat}
          parkingLng={place.parkingLng}
          placeName={place.name}
        />

        {/* Affiliate Booking CTA if applicable */}
        {place.affiliateBookingUrl && (
          <div className="pt-2">
            <a
              href={place.affiliateBookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-3 font-semibold text-white shadow-md transition-colors hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 active:scale-[0.99]"
            >
              <span>{place.affiliateLabel || 'Réserver cette activité'}</span>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

export default PlaceDetailView;
