'use client';

import React, { useState, useRef, useCallback, useId } from 'react';
import { calculateElevationScales, findNearestElevationPoint, estimateHikingDuration } from '@/lib/map-utils';
import type { ElevationPoint } from '@/lib/types/map';

/**
 * Props for the `ElevationProfileSvg` component.
 */
export interface ElevationProfileSvgProps {
  /** Array of GPS elevation profile points along the route */
  points: ElevationPoint[];
  /** Total route distance in kilometers */
  totalDistanceKm: number;
  /** Cumulative elevation gain (D+) in meters */
  elevationGainM: number;
  /** Cumulative elevation loss (D-) in meters */
  elevationLossM?: number;
  /** Whether to render top summary statistics cards */
  showStats?: boolean;
  /** Live distance along track in km for real-time hiker position pin */
  liveDistanceKm?: number | null;
  /** Callback fired when user scrubs or moves over a profile point */
  onHoverPoint?: (point: ElevationPoint | null) => void;
  /** Additional CSS class names for outer container */
  className?: string;
}

/**
 * Interactive SVG elevation profile component for hiking routes and GPX tracks.
 * Provides smooth SVG ridge rendering, subtle gradient fill, real-time scrubbing
 * with pointer and touch events, keyboard navigation, and synchronization callback.
 */
export function ElevationProfileSvg({
  points,
  totalDistanceKm,
  elevationGainM,
  showStats = true,
  liveDistanceKm = null,
  onHoverPoint,
  className = '',
}: ElevationProfileSvgProps) {
  const gradientId = useId();
  const [activePoint, setActivePoint] = useState<ElevationPoint | null>(null);
  const [activeX, setActiveX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const svgWidth = 800;
  const svgHeight = 160;

  const scales = calculateElevationScales(points, svgWidth, svgHeight);
  const duration = estimateHikingDuration(totalDistanceKm, elevationGainM);

  const handlePointer = useCallback(
    (clientX: number) => {
      if (!svgRef.current || points.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;

      const relativeX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetDist = relativeX * scales.totalDistanceKm;
      const nearest = findNearestElevationPoint(points, targetDist);

      setActivePoint(nearest);
      setActiveX(relativeX * svgWidth);
      if (onHoverPoint) {
        onHoverPoint(nearest);
      }
    },
    [points, scales.totalDistanceKm, onHoverPoint, svgWidth]
  );

  const handlePointerLeave = useCallback(() => {
    setActivePoint(null);
    setActiveX(null);
    if (onHoverPoint) {
      onHoverPoint(null);
    }
  }, [onHoverPoint]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (points.length === 0) return;

      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const currentIndex = activePoint ? points.indexOf(activePoint) : 0;
        const validCurrent = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex =
          event.key === 'ArrowRight'
            ? Math.min(points.length - 1, validCurrent + 1)
            : Math.max(0, validCurrent - 1);

        const nextPoint = points[nextIndex];
        const nextX = (nextPoint.distanceKm / (scales.totalDistanceKm || 1)) * svgWidth;

        setActivePoint(nextPoint);
        setActiveX(nextX);
        if (onHoverPoint) {
          onHoverPoint(nextPoint);
        }
      } else if (event.key === 'Escape') {
        handlePointerLeave();
      }
    },
    [points, activePoint, scales.totalDistanceKm, svgWidth, onHoverPoint, handlePointerLeave]
  );

  // Compute tooltip position clamped within visible boundaries
  const tooltipLeftPercent =
    activeX !== null ? Math.max(8, Math.min(92, (activeX / svgWidth) * 100)) : 50;

  return (
    <div
      className={`flex flex-col bg-white rounded-xl p-4 shadow-sm border border-slate-100 ${className}`}
      role="region"
      aria-label="Profil altimétrique"
      tabIndex={points.length > 0 ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      {showStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-3 mb-2 border-b border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Distance</span>
            <span className="text-slate-900 font-bold text-sm">{`${totalDistanceKm.toFixed(1)} km`}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Dénivelé D+</span>
            <span className="text-emerald-600 font-bold text-sm">{`+${elevationGainM} m`}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Alt. max</span>
            <span className="text-slate-900 font-bold text-sm">{`${scales.maxElevation} m`}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Temps estimé</span>
            <span className="text-sky-600 font-bold text-sm">{duration.formatted}</span>
          </div>
        </div>
      )}

      <div className="relative w-full overflow-hidden select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto cursor-crosshair touch-none"
          role="img"
          aria-label="Graphique d'élévation altimétrique"
          onPointerDown={(e) => handlePointer(e.clientX)}
          onPointerMove={(e) => handlePointer(e.clientX)}
          onPointerLeave={handlePointerLeave}
          onTouchStart={(e) => {
            if (e.touches[0]) handlePointer(e.touches[0].clientX);
          }}
          onTouchMove={(e) => {
            if (e.touches[0]) handlePointer(e.touches[0].clientX);
          }}
          onTouchEnd={handlePointerLeave}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={scales.pathArea} fill={`url(#${gradientId})`} />

          {/* Ridge line */}
          <path d={scales.pathLine} fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />

          {/* Live GPS Hiker Pin */}
          {liveDistanceKm !== null && liveDistanceKm !== undefined && scales.totalDistanceKm > 0 && (
            (() => {
              const clampedDist = Math.max(0, Math.min(scales.totalDistanceKm, liveDistanceKm));
              const liveX = (clampedDist / scales.totalDistanceKm) * svgWidth;
              const livePoint = findNearestElevationPoint(points, clampedDist);
              const ele = livePoint ? livePoint.elevationM : scales.minElevation;
              const liveY =
                svgHeight -
                20 -
                ((ele - scales.minElevation) / Math.max(5, scales.maxElevation - scales.minElevation)) *
                  (svgHeight - 40);
              return (
                <g data-testid="live-hiker-pin">
                  <circle cx={liveX} cy={liveY} r="7" fill="#0284c7" fillOpacity="0.3" />
                  <circle cx={liveX} cy={liveY} r="4.5" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
                </g>
              );
            })()
          )}

          {/* Active scrubbing cursor */}
          {activeX !== null && activePoint && (
            <g>
              <line
                x1={activeX}
                y1={10}
                x2={activeX}
                y2={svgHeight - 10}
                stroke="#0369a1"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <circle
                cx={activeX}
                cy={
                  svgHeight -
                  20 -
                  ((activePoint.elevationM - scales.minElevation) /
                    Math.max(5, scales.maxElevation - scales.minElevation)) *
                    (svgHeight - 40)
                }
                r="4.5"
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Hover info tooltip */}
        {activePoint && activeX !== null && (
          <div
            className="absolute top-1 pointer-events-none transform -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm text-white px-2 py-1 rounded text-[11px] shadow-md whitespace-nowrap"
            style={{ left: `${tooltipLeftPercent}%` }}
          >
            km {activePoint.distanceKm.toFixed(1)} • {activePoint.elevationM} m
          </div>
        )}
      </div>
    </div>
  );
}
