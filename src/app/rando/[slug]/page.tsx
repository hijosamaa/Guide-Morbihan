import React from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getPlaceBySlug } from '@/lib/data/places';
import { PlaceTrailSection } from '@/components/places/PlaceTrailSection';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return [
    { slug: 'ile-de-berder' },
    { slug: 'sentier-tour-ile-aux-moines' },
    { slug: 'pointe-du-conguel' },
  ];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);

  if (!place) {
    return { title: 'Randonnée non trouvée | Guide Morbihan' };
  }

  return {
    title: `Navigation GPS : ${place.name} | Guide Morbihan`,
    description: `Suivi en direct du tracé et profil d'altitude pour ${place.name}.`,
  };
}

export default async function RandoPage({ params }: PageProps) {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);

  if (!place) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href={`/lieu/${place.slug}`}
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Fiche lieu</span>
          </Link>
          <div className="text-right">
            <h1 className="text-sm font-bold truncate max-w-[200px] sm:max-w-xs">{place.name}</h1>
            <p className="text-[11px] text-slate-400">{place.commune}</p>
          </div>
        </div>
      </header>

      {/* Main Track Viewer Section */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col justify-center">
        <div className="bg-slate-800 rounded-2xl p-4 sm:p-6 border border-slate-700 shadow-xl">
          <PlaceTrailSection placeSlug={place.slug} trailName={place.name} />
        </div>
      </main>
    </div>
  );
}
