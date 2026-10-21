'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { MapSkeleton } from './MapSkeleton';
import type { GolfeMapProps, GpxTrackViewerProps } from '@/lib/types/map';

export const DynamicGolfeMap = dynamic<GolfeMapProps>(
  () => import('./GolfeMap').then((mod) => mod.GolfeMap),
  {
    ssr: false,
    loading: () => <MapSkeleton message="Chargement de la carte interactive..." />,
  }
);

export const DynamicGpxTrackViewer = dynamic<GpxTrackViewerProps>(
  () => import('./GpxTrackViewer').then((mod) => mod.GpxTrackViewer),
  {
    ssr: false,
    loading: () => <MapSkeleton message="Chargement du tracé de randonnée..." height="h-80" />,
  }
);
