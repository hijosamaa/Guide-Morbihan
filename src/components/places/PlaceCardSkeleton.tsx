import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface PlaceCardSkeletonProps {
  variant?: 'compact' | 'rich';
  className?: string;
}

export function PlaceCardSkeleton({ variant = 'compact', className }: PlaceCardSkeletonProps) {
  if (variant === 'rich') {
    return (
      <div
        className={twMerge(
          clsx(
            'flex flex-col rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden animate-pulse',
            className
          )
        )}
      >
        <div className="w-full aspect-video bg-slate-200" />
        <div className="p-4 flex flex-col flex-1 space-y-2">
          <div className="h-5 bg-slate-200 rounded w-3/4" />
          <div className="h-4 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={twMerge(
        clsx(
          'flex items-center gap-3.5 p-3 rounded-xl bg-white border border-slate-200/80 shadow-sm animate-pulse',
          className
        )
      )}
    >
      <div className="w-20 h-20 bg-slate-200 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="mt-2 h-3 bg-slate-200 rounded w-1/2" />
        <div className="mt-3 h-5 bg-slate-200 rounded-full w-28" />
      </div>
    </div>
  );
}
