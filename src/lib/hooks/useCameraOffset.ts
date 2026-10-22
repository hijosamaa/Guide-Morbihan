import { useEffect } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';

export function calculateCameraPadding(
  activeSnapPoint: string | number | null,
  windowHeight: number
): { top: number; bottom: number; left: number; right: number } {
  let bottom = 140;

  if (typeof activeSnapPoint === 'string' && activeSnapPoint.endsWith('px')) {
    bottom = parseInt(activeSnapPoint, 10);
  } else if (typeof activeSnapPoint === 'number') {
    bottom = Math.round(windowHeight * activeSnapPoint);
  }

  return {
    top: 60,
    bottom,
    left: 0,
    right: 0,
  };
}

export function useCameraOffset(
  map: MapLibreMap | null,
  activeSnapPoint: string | number | null
) {
  useEffect(() => {
    if (!map || typeof window === 'undefined') return;

    const updatePadding = () => {
      const padding = calculateCameraPadding(activeSnapPoint, window.innerHeight);
      map.easeTo({
        padding,
        duration: 250,
        easing: (t) => 1 - Math.pow(1 - t, 3), // cubic ease-out
      });
    };

    updatePadding();
    window.addEventListener('resize', updatePadding);
    return () => window.removeEventListener('resize', updatePadding);
  }, [map, activeSnapPoint]);
}
