import React from 'react';
import type { PhotoItem } from '../../lib/types/context';

export interface PhotoGalleryProps {
  photos?: PhotoItem[];
  placeName: string;
  className?: string;
}

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80';

export function PhotoGallery({ photos, placeName, className = '' }: PhotoGalleryProps) {
  const items: PhotoItem[] =
    photos && photos.length > 0
      ? photos
      : [{ url: DEFAULT_IMAGE, caption: placeName, isCover: true }];

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl bg-slate-100 shadow-inner ${className}`}
      role="region"
      aria-label={`Galerie photos de ${placeName}`}
    >
      <div className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none touch-pan-x">
        {items.map((photo, idx) => (
          <div
            key={idx}
            className="relative aspect-[16/10] sm:aspect-[16/9] w-full shrink-0 snap-center bg-slate-900/10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.caption || placeName}
              className="h-full w-full object-cover select-none"
              loading={idx === 0 ? 'eager' : 'lazy'}
              decoding={idx === 0 ? 'sync' : 'async'}
            />

            {/* Photo Counter badge when multiple photos */}
            {items.length > 1 && (
              <div className="absolute top-3 right-3 z-10 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 text-[11px] font-semibold text-white/90 select-none shadow-sm">
                {idx + 1} / {items.length}
              </div>
            )}

            {/* Caption & Credit overlay */}
            {(photo.caption || photo.credit) && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-3.5 pt-7 text-white text-xs">
                {photo.caption && <p className="font-medium line-clamp-2">{photo.caption}</p>}
                {photo.credit && (
                  <p className="mt-0.5 text-[11px] text-white/70">
                    © {photo.credit}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PhotoGallery;
