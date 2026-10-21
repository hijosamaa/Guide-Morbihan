import React from 'react';
import { MapPin } from 'lucide-react';

export interface MapSkeletonProps {
  message?: string;
  height?: string;
  className?: string;
}

export function MapSkeleton({
  message = 'Chargement de la carte interactive...',
  height = 'h-96 min-h-[350px]',
  className = '',
}: MapSkeletonProps) {
  return (
    <div
      className={`w-full ${height} bg-slate-100 rounded-2xl animate-pulse flex flex-col items-center justify-center text-slate-400 gap-3 border border-slate-200/60 ${className}`}
      role="status"
      aria-label={message}
    >
      <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
        <MapPin className="w-6 h-6 animate-bounce" />
      </div>
      <p className="text-xs font-medium text-slate-500 tracking-wide">{message}</p>
    </div>
  );
}
