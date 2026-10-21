'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { GOLFE_MAP_CONFIG } from '@/lib/map-config';
import { calculateBoundingBox } from '@/lib/map-utils';
import { ElevationProfileSvg } from './ElevationProfileSvg';
import type { GpxTrackViewerProps, ElevationPoint } from '@/lib/types/map';

if (typeof window !== 'undefined') {
  // @ts-expect-error - CSS module declaration
  import('maplibre-gl/dist/maplibre-gl.css');
}

/**
 * Synchronized GPX track viewer component.
 * Renders GeoJSON line with halo styling on WebGL MapLibre map,
 * and synchronized dynamic elevation profile chart with interactive scrubbing.
 */
export function GpxTrackViewer({
  geojson,
  elevationProfile,
  totalDistanceKm,
  elevationGainM,
  elevationLossM = 0,
  title,
  className = '',
  showStats = true,
}: GpxTrackViewerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const trackPinMarkerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const coords = (geojson.geometry?.coordinates as [number, number][]) || [];
    const bbox = calculateBoundingBox(coords);

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: GOLFE_MAP_CONFIG.styles.liberty,
      center: coords[0] || GOLFE_MAP_CONFIG.defaultCenter,
      zoom: 11,
      attributionControl: false,
    });

    map.on('load', () => {
      // Add track GeoJSON
      map.addSource('gpx-track', {
        type: 'geojson',
        data: geojson,
      });

      // Halo layer for legibility
      map.addLayer({
        id: 'gpx-track-casing',
        type: 'line',
        source: 'gpx-track',
        paint: {
          'line-color': '#ffffff',
          'line-width': 7,
          'line-opacity': 0.85,
        },
      });

      // Main line layer
      map.addLayer({
        id: 'gpx-track-line',
        type: 'line',
        source: 'gpx-track',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#0284c7',
          'line-width': 4,
        },
      });

      // Fit bounds
      if (coords.length > 0) {
        map.fitBounds(bbox, {
          padding: { top: 30, bottom: 30, left: 30, right: 30 },
          maxZoom: 15,
        });
      }

      // Start & Finish markers
      if (coords.length >= 2) {
        const startEl = document.createElement('div');
        startEl.className =
          'w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center ring-2 ring-white shadow-md';
        startEl.textContent = 'D';
        new maplibregl.Marker({ element: startEl }).setLngLat(coords[0]).addTo(map);

        const endEl = document.createElement('div');
        endEl.className =
          'w-6 h-6 rounded-full bg-rose-600 text-white font-bold text-xs flex items-center justify-center ring-2 ring-white shadow-md';
        endEl.textContent = 'A';
        new maplibregl.Marker({ element: endEl }).setLngLat(coords[coords.length - 1]).addTo(map);
      }

      // Synchronized scrubbing marker
      const pinEl = document.createElement('div');
      pinEl.className =
        'w-4 h-4 rounded-full bg-sky-500 ring-2 ring-white shadow-lg pointer-events-none transition-opacity duration-150';
      pinEl.style.opacity = '0';
      const marker = new maplibregl.Marker({ element: pinEl })
        .setLngLat(coords[0] || [0, 0])
        .addTo(map);
      trackPinMarkerRef.current = marker;
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [geojson]);

  const handleHoverPoint = useCallback((point: ElevationPoint | null) => {
    const marker = trackPinMarkerRef.current;
    if (!marker) return;

    const el = marker.getElement();
    if (!point) {
      el.style.opacity = '0';
    } else {
      marker.setLngLat([point.lon, point.lat]);
      el.style.opacity = '1';
    }
  }, []);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {title && <h3 className="font-semibold text-slate-900 text-base">{title}</h3>}
      <div className="relative w-full h-72 sm:h-80 rounded-2xl overflow-hidden shadow-sm border border-slate-100">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>
      <ElevationProfileSvg
        points={elevationProfile}
        totalDistanceKm={totalDistanceKm}
        elevationGainM={elevationGainM}
        elevationLossM={elevationLossM}
        showStats={showStats}
        onHoverPoint={handleHoverPoint}
      />
    </div>
  );
}
