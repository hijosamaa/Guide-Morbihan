import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Map } from 'lucide-react';
import { getPlaceBySlug, getLocalFallbackPlaces } from '@/lib/data/places';
import { PlaceDetailView } from '@/components/places/PlaceDetailView';
import type { Place } from '@/lib/types/context';

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const spots = getLocalFallbackPlaces();
  return spots.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const spot = await getPlaceBySlug(slug);
  if (!spot) return { title: 'Lieu non trouvé | Guide Morbihan' };

  return {
    title: `${spot.name} (${spot.commune}) | Guide Morbihan`,
    description: spot.shortDescription,
    openGraph: {
      title: `${spot.name} - Guide Morbihan`,
      description: spot.shortDescription,
      images: spot.photoGallery?.[0]?.url ? [{ url: spot.photoGallery[0].url }] : [],
    },
  };
}

export default async function LieuPage({ params }: PageProps) {
  const { slug } = await params;
  const spot = await getPlaceBySlug(slug);
  if (!spot) notFound();

  const placeEntity: Place = {
    ...spot,
    id: spot.id || spot.slug,
    isSponsored: spot.isSponsored ?? false,
    updatedAt: new Date(),
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: spot.name,
    description: spot.shortDescription,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: spot.latitude,
      longitude: spot.longitude,
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: spot.commune,
      addressRegion: 'Morbihan',
      addressCountry: 'FR',
    },
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md">
        <Link
          href={`/carte?spot=${spot.slug}`}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-slate-700 text-sm font-medium hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voir sur la carte</span>
        </Link>
        <Link
          href={`/carte?spot=${spot.slug}`}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-white text-xs font-medium shadow-sm hover:bg-emerald-800"
        >
          <Map className="h-3.5 w-3.5" />
          <span>Ouvrir la Carte</span>
        </Link>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-4">
        <PlaceDetailView place={placeEntity} />
      </div>
    </main>
  );
}
