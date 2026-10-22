import React from 'react';
import { Navigation, Car, ExternalLink } from 'lucide-react';

export interface ParkingDirectButtonProps {
  parkingLat?: number | null;
  parkingLng?: number | null;
  placeName: string;
  className?: string;
}

export function ParkingDirectButton({
  parkingLat,
  parkingLng,
  placeName,
  className = '',
}: ParkingDirectButtonProps) {
  if (parkingLat == null || parkingLng == null) return null;

  const gmapsUrl = `https://maps.google.com/maps/dir/?api=1&destination=${parkingLat},${parkingLng}`;
  const wazeUrl = `https://waze.com/ul?ll=${parkingLat},${parkingLng}&navigate=yes`;

  return (
    <div
      className={`rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4 shadow-sm ${className}`}
      role="region"
      aria-label={`Stationnement conseillé pour ${placeName}`}
    >
      <div className="flex items-center gap-2.5 font-semibold text-emerald-950 text-sm">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700 shrink-0">
          <Car className="h-4 w-4" aria-hidden="true" />
        </div>
        <span>Stationnement conseillé ({placeName})</span>
      </div>
      <p className="mt-1.5 text-xs text-emerald-800/90 leading-relaxed">
        Accès direct au parking officiel vérifié pour éviter les voies encombrées et préserver les accès riverains.
      </p>
      <div className="mt-3 flex flex-wrap gap-2.5">
        <a
          href={gmapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 font-medium text-white text-xs shadow-sm transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 active:scale-[0.98]"
        >
          <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Itinéraire Google Maps</span>
          <ExternalLink className="h-3 w-3 opacity-70" aria-hidden="true" />
        </a>
        <a
          href={wazeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3.5 py-2 font-medium text-emerald-800 text-xs shadow-sm transition-colors hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 active:scale-[0.98]"
        >
          <Navigation className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          <span>Ouvrir dans Waze</span>
          <ExternalLink className="h-3 w-3 opacity-60" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

export default ParkingDirectButton;
