'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { GOLFE_MAP_CONFIG } from '@/lib/map-config';
import { isPointInBounds } from '@/lib/map-utils';
import { createPlaceMarkerElement } from './MapMarkers';
import { MapControls } from './MapControls';
import type { GolfeMapProps, MapViewportBounds } from '@/lib/types/map';

if (typeof window !== 'undefined') {
  // @ts-expect-error - CSS module declaration
  import('maplibre-gl/dist/maplibre-gl.css');
}

/**
 * Interactive WebGL map component for Golfe du Morbihan.
 * Locked to Gulf viewport bounds with custom status-coded markers,
 * user geolocation dot, raster fallback, and responsive controls.
 */
export function GolfeMap({
  places = [],
  selectedPlaceId = null,
  onSelectPlace,
  onBoundsChange,
  initialCenter = GOLFE_MAP_CONFIG.defaultCenter,
  initialZoom = GOLFE_MAP_CONFIG.defaultZoom,
  interactive = true,
  className = 'w-full h-full min-h-[400px]',
  showControls = true,
  enableUserLocation = true,
}: GolfeMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const placesRef = useRef(places);
  placesRef.current = places;
  const onBoundsChangeRef = useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: GOLFE_MAP_CONFIG.styles.liberty,
      center: initialCenter,
      zoom: initialZoom,
      minZoom: GOLFE_MAP_CONFIG.minZoom,
      maxZoom: GOLFE_MAP_CONFIG.maxZoom,
      maxBounds: GOLFE_MAP_CONFIG.maxBounds,
      interactive,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('error', (e) => {
      // Fallback raster if vector style fails
      if (e.error && !map.isStyleLoaded()) {
        try {
          map.setStyle(GOLFE_MAP_CONFIG.styles.fallbackRaster);
        } catch {
          // ignore fallback errors
        }
      }
    });

    // Notify bounds on move / zoom
    const handleMoveEnd = () => {
      if (!onBoundsChangeRef.current) return;
      const b = map.getBounds();
      const bounds: MapViewportBounds = {
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      };
      const placesInView = placesRef.current.filter((p) => isPointInBounds(p.latitude, p.longitude, bounds));
      onBoundsChangeRef.current(placesInView, bounds);
    };

    map.on('moveend', handleMoveEnd);
    mapInstanceRef.current = map;

    // Resize observer
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.resize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [initialCenter, initialZoom, interactive]);

  // Update markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers not in new places
    const newPlaceIds = new Set(places.map((p) => p.id));
    markersRef.current.forEach((marker, id) => {
      if (!newPlaceIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add or update markers
    places.forEach((place) => {
      const isSelected = place.id === selectedPlaceId;
      const existing = markersRef.current.get(place.id);
      if (existing) {
        existing.remove();
      }

      const el = createPlaceMarkerElement(place, isSelected, (clickedPlace) => {
        if (onSelectPlace) onSelectPlace(clickedPlace);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map);

      markersRef.current.set(place.id, marker);
    });
  }, [places, selectedPlaceId, onSelectPlace]);

  // Controls Handlers
  const handleZoomIn = useCallback(() => {
    mapInstanceRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapInstanceRef.current?.zoomOut();
  }, []);

  const handleResetCenter = useCallback(() => {
    mapInstanceRef.current?.flyTo({
      center: GOLFE_MAP_CONFIG.defaultCenter,
      zoom: GOLFE_MAP_CONFIG.defaultZoom,
      essential: true,
    });
  }, []);

  const handleLocateUser = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation || !mapInstanceRef.current) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const map = mapInstanceRef.current;
        if (!map) return;
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];

        if (!userMarkerRef.current) {
          const el = document.createElement('div');
          el.className = 'w-4 h-4 bg-sky-500 rounded-full ring-4 ring-white shadow-lg animate-pulse';
          userMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(coords).addTo(map);
        } else {
          userMarkerRef.current.setLngLat(coords);
        }

        map.flyTo({ center: coords, zoom: 13, essential: true });
      },
      () => {
        setIsLocating(false);
      },
      { timeout: 8000 }
    );
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      role="region"
      aria-label="Carte interactive du Golfe du Morbihan"
    >
      <div ref={mapContainerRef} className="w-full h-full" />
      {showControls && (
        <MapControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetCenter={handleResetCenter}
          onLocateUser={enableUserLocation ? handleLocateUser : undefined}
          isLocating={isLocating}
        />
      )}
    </div>
  );
}
