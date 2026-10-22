'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { GOLFE_MAP_CONFIG } from '@/lib/map-config';
import { calculateBoundingBox } from '@/lib/map-utils';
import { ElevationProfileSvg } from './ElevationProfileSvg';
import { TrackProgressTracker, type ProgressSnapshot } from '@/lib/geo-navigation/progress-tracker';
import type { GpxTrackViewerProps, ElevationPoint } from '@/lib/types/map';

if (typeof window !== 'undefined') {
  // @ts-expect-error - CSS module declaration
  import('maplibre-gl/dist/maplibre-gl.css');
}

/**
 * Synchronized GPX track viewer component with live GPS tracking & tidal alerts.
 * Renders GeoJSON line with halo styling on WebGL MapLibre map,
 * live hiker position with synchronized elevation profile chart,
 * and tidal submersion alert banner for Morbihan passages.
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
  enableLiveTracking = true,
  tideAlert,
}: GpxTrackViewerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const trackPinMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userGpsMarkerRef = useRef<maplibregl.Marker | null>(null);
  const trackerRef = useRef<TrackProgressTracker | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const [isLiveTrackingActive, setIsLiveTrackingActive] = useState(false);
  const [liveProgress, setLiveProgress] = useState<ProgressSnapshot | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Initialize progress tracker when coordinates change
  useEffect(() => {
    const coords = (geojson.geometry?.coordinates as [number, number][]) || [];
    if (coords.length >= 2) {
      trackerRef.current = new TrackProgressTracker(coords);
    }
  }, [geojson]);

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

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

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

      // Live user GPS blue dot marker
      const userDotEl = document.createElement('div');
      userDotEl.className = 'relative flex items-center justify-center';
      userDotEl.innerHTML = `
        <span class="absolute w-6 h-6 rounded-full bg-sky-400 opacity-75 animate-ping"></span>
        <span class="relative w-4 h-4 rounded-full bg-sky-600 border-2 border-white shadow-lg"></span>
      `;
      userDotEl.style.display = 'none';

      const userMarker = new maplibregl.Marker({ element: userDotEl })
        .setLngLat([0, 0])
        .addTo(map);
      userGpsMarkerRef.current = userMarker;
    });

    mapInstanceRef.current = map;

    // Resize observer
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.resize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (trackPinMarkerRef.current) {
        trackPinMarkerRef.current.remove();
        trackPinMarkerRef.current = null;
      }
      if (userGpsMarkerRef.current) {
        userGpsMarkerRef.current.remove();
        userGpsMarkerRef.current = null;
      }
      if (watchIdRef.current !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [geojson]);

  const toggleLiveTracking = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('Géolocalisation non supportée sur cet appareil.');
      return;
    }

    if (isLiveTrackingActive) {
      // Stop tracking
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (userGpsMarkerRef.current) {
        userGpsMarkerRef.current.getElement().style.display = 'none';
      }
      setIsLiveTrackingActive(false);
      setLiveProgress(null);
    } else {
      // Start tracking
      setGpsError(null);
      setIsLiveTrackingActive(true);

      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;

          // Update blue dot marker on map
          if (userGpsMarkerRef.current) {
            userGpsMarkerRef.current.setLngLat([lon, lat]);
            userGpsMarkerRef.current.getElement().style.display = 'flex';
          }

          // Project user position onto track
          if (trackerRef.current) {
            const snapshot = trackerRef.current.updatePosition([lon, lat]);
            setLiveProgress(snapshot);
          }
        },
        (err) => {
          setGpsError(err.message || 'Position GPS indisponible.');
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 10000,
        }
      );

      watchIdRef.current = id;
    }
  }, [isLiveTrackingActive]);

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
      {/* Title */}
      {title && <h3 className="font-semibold text-slate-900 text-base">{title}</h3>}

      {/* Tidal Submersion Alert Banner */}
      {tideAlert && (
        <div
          data-testid="tidal-submersion-banner"
          className={`flex items-center gap-2.5 p-3 rounded-2xl text-xs font-semibold shadow-sm border ${
            tideAlert.status === 'SUBMERGED'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : tideAlert.status === 'WARNING_CLOSING'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
          role="alert"
        >
          <span className="text-base">
            {tideAlert.status === 'SUBMERGED' ? '🚨' : tideAlert.status === 'WARNING_CLOSING' ? '⚠️' : '🌊'}
          </span>
          <p className="flex-1">{tideAlert.message}</p>
        </div>
      )}

      {/* Map Canvas Container */}
      <div
        className="relative w-full h-72 sm:h-80 rounded-2xl overflow-hidden shadow-sm border border-slate-100"
        role="region"
        aria-label={title ? `Tracé cartographique : ${title}` : 'Tracé cartographique de randonnée'}
      >
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Live GPS tracking button overlay */}
        {enableLiveTracking && (
          <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
            <button
              data-testid="live-gps-toggle"
              type="button"
              onClick={toggleLiveTracking}
              className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-md flex items-center gap-1.5 transition-colors ${
                isLiveTrackingActive
                  ? 'bg-sky-600 text-white ring-2 ring-sky-300'
                  : 'bg-white/95 text-slate-700 hover:bg-white border border-slate-200'
              }`}
              aria-pressed={isLiveTrackingActive}
              aria-label="Activer la localisation GPS en direct"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isLiveTrackingActive ? 'bg-white animate-pulse' : 'bg-slate-400'
                }`}
              />
              {isLiveTrackingActive ? 'Suivi GPS actif' : 'Suivi GPS'}
            </button>

            {/* Live on-track status indicator */}
            {isLiveTrackingActive && liveProgress && (
              <div
                data-testid="live-status-pill"
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold shadow-sm backdrop-blur-md ${
                  liveProgress.crossTrackDistanceMeters <= 35
                    ? 'bg-emerald-900/90 text-white'
                    : 'bg-amber-900/90 text-white'
                }`}
              >
                {liveProgress.crossTrackDistanceMeters <= 35
                  ? `🟢 Sur le sentier • ${liveProgress.remainingDistanceKm} km restants`
                  : `⚠️ Écart de ${Math.round(liveProgress.crossTrackDistanceMeters)} m`}
              </div>
            )}

            {gpsError && (
              <div className="bg-rose-900/90 text-white px-2.5 py-1 rounded-xl text-[10px] font-medium shadow-sm">
                {gpsError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Synchronized Elevation Profile */}
      <ElevationProfileSvg
        points={elevationProfile}
        totalDistanceKm={totalDistanceKm}
        elevationGainM={elevationGainM}
        elevationLossM={elevationLossM}
        showStats={showStats}
        liveDistanceKm={liveProgress?.distanceAlongTrackKm ?? null}
        onHoverPoint={handleHoverPoint}
      />
    </div>
  );
}
