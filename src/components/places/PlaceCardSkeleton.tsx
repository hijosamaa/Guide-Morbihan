import React from 'react';

export interface PlaceCardSkeletonProps {
  variant?: 'compact' | 'rich';
  className?: string;
}

export function PlaceCardSkeleton({ variant = 'compact', className }: PlaceCardSkeletonProps) {
  if (variant === 'rich') {
    return (
      <div className={`flex flex-col rounded-2xl bg-white border border-slate-200/80 p-3 shadow-sm animate-pulse ${className || ''}`}>
        <div className="w-full aspect-video bg-slate-200 rounded-xl" />
        <div className="mt-3 h-5 bg-slate-200 rounded w-3/4" />
        <div className="mt-2 h-4 bg-slate-200 rounded w-1/2" />
        <div className="mt-4 flex gap-2">
          <div className="h-6 bg-slate-200 rounded-full w-24" />
          <div className="h-6 bg-slate-200 rounded-full w-20" />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 animate-pulse ${className || ''}`}>
      <div className="w-20 h-20 bg-slate-200 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="mt-2 h-3 bg-slate-200 rounded w-1/2" />
        <div className="mt-3 h-5 bg-slate-200 rounded-full w-28" />
      </div>
    </div>
  );
}
