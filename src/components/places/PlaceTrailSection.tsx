'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Footprints, Navigation, Sparkles } from 'lucide-react';
import { parseGpxTrack } from '@/lib/gpx-parser';
import { GpxTrackViewer } from '@/components/map/GpxTrackViewer';
import type { ElevationPoint } from '@/lib/types/map';

export interface PlaceTrailSectionProps {
  gpxUrl?: string;
  trailName?: string;
  placeSlug: string;
}

export function PlaceTrailSection({
  gpxUrl,
  trailName = 'Itinéraire de randonnée',
  placeSlug,
}: PlaceTrailSectionProps) {
  const [trackData, setTrackData] = useState<{
    geojson: GeoJSON.Feature<GeoJSON.LineString>;
    elevationProfile: ElevationPoint[];
    totalDistanceKm: number;
    elevationGainM: number;
    estimatedDurationMinutes: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Détermine l'URL de trace appropriée si non explicite
  const resolvedGpxUrl =
    gpxUrl ||
    (placeSlug.includes('berder')
      ? '/tracks/berder.gpx'
      : placeSlug.includes('moines')
      ? '/tracks/ile-aux-moines.gpx'
      : placeSlug.includes('conguel')
      ? '/tracks/conguel.gpx'
      : null);

  useEffect(() => {
    if (!resolvedGpxUrl) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    fetch(resolvedGpxUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((xml) => {
        if (!isMounted) return;
        const parsed = parseGpxTrack(xml);

        // Adaptation des points d'élévation
        const coords = (parsed.track.geometry.coordinates as [number, number][]) || [];
        const mappedProfile: ElevationPoint[] = parsed.elevationProfile.map((p, idx) => ({
          distanceKm: p.distKm,
          elevationM: p.altM,
          lat: coords[idx]?.[1] ?? 0,
          lon: coords[idx]?.[0] ?? 0,
        }));

        setTrackData({
          geojson: parsed.track,
          elevationProfile: mappedProfile,
          totalDistanceKm: parsed.distanceKm,
          elevationGainM: parsed.elevationGainM,
          estimatedDurationMinutes: parsed.estimatedDurationMinutes,
        });
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message);
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [resolvedGpxUrl]);

  if (!resolvedGpxUrl) return null;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 animate-pulse space-y-4">
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-48 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  if (error || !trackData) {
    return null;
  }

  return (
    <section className="space-y-4 pt-2" aria-label="Visualiseur de parcours et profil altimétrique">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Footprints className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <span>Tracé & Profil Altimétrique</span>
        </h2>
        <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
          {trackData.totalDistanceKm.toFixed(1)} km · +{Math.round(trackData.elevationGainM)}m
        </span>
      </div>

      {/* Visualiseur de Trace GPX avec profil altimétrique SVG synchronisé */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
        <GpxTrackViewer
          geojson={trackData.geojson}
          elevationProfile={trackData.elevationProfile}
          totalDistanceKm={trackData.totalDistanceKm}
          elevationGainM={trackData.elevationGainM}
          title={trailName}
          className="h-[360px]"
          showStats={true}
          enableLiveTracking={false}
        />
      </div>

      {/* CTA Démarrer la navigation GPS active */}
      <div className="pt-1">
        <Link
          href={`/rando/${placeSlug}`}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white shadow-md transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 active:scale-[0.99]"
        >
          <Navigation className="h-4 w-4" aria-hidden="true" />
          <span>Démarrer le Guidage GPS sur le terrain</span>
        </Link>
      </div>
    </section>
  );
}
