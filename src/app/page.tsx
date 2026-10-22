import React from 'react';
import Link from 'next/link';
import { Map, ArrowRight, Waves } from 'lucide-react';
import { PlaceCard } from '@/components/places/PlaceCard';
import { TidalAlertChip } from '@/components/context/TidalAlertChip';
import type { PlaceMarkerData } from '@/lib/types/map';

const TOP_PLACES: PlaceMarkerData[] = [
  {
    id: 'fogeo',
    slug: 'plage-fogeo',
    name: 'Plage du Fogeo (Arzon)',
    latitude: 47.5367,
    longitude: -2.8953,
    category: 'BEACH',
    status: 'IDEAL',
    label: 'Idéal marée haute',
    score: 95,
  },
  {
    id: 'saint-goustan',
    slug: 'port-saint-goustan',
    name: 'Port Saint-Goustan (Auray)',
    latitude: 47.6669,
    longitude: -2.9772,
    category: 'HERITAGE',
    status: 'IDEAL',
    label: 'Terrasses au soleil',
    score: 90,
  },
  {
    id: 'suscinio',
    slug: 'domaine-suscinio',
    name: 'Château de Suscinio',
    latitude: 47.5144,
    longitude: -2.7297,
    category: 'HERITAGE',
    status: 'IDEAL',
    score: 88,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-16">
      {/* Header Contextuel & Hero */}
      <header className="relative bg-white border-b border-slate-200/80 pt-8 pb-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
          {/* Alerte Submersion Juste-à-Temps (apparaît uniquement si urgence) */}
          <div className="mb-4">
            <TidalAlertChip
              passageName="Passage de Berder"
              minutesRemaining={35}
              isOpen={true}
            />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold mb-4">
            <Waves className="w-3.5 h-3.5" />
            <span>Marée montante · Pleine mer à 17h42 (Coeff 78)</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Le Copilote Contextuel du Golfe du Morbihan
          </h1>

          <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-xl">
            Praticabilité des plages à marée haute, sentiers côtiers ouverts et criques abritées du vent en temps réel.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link
              href="/carte"
              className="h-12 px-6 rounded-full bg-slate-900 text-white font-semibold flex items-center justify-center gap-2 shadow-md transition-transform duration-100 active:scale-95 touch-manipulation hover:bg-slate-800"
            >
              <Map className="w-4 h-4" />
              <span>Ouvrir la Carte en Direct</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Sélecteur d'Intention Immédiate */}
      <section className="max-w-4xl mx-auto w-full px-4 mt-8">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Que souhaitez-vous faire maintenant ?
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/carte?cat=BEACH&maree=IDEAL_NOW"
            className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col items-center text-center transition-transform duration-100 active:scale-95"
          >
            <span className="text-3xl mb-1.5 select-none">🏖️</span>
            <span className="font-semibold text-sm text-slate-800">Baignade idéale</span>
            <span className="text-xs text-slate-500 mt-0.5">Marée haute</span>
          </Link>

          <Link
            href="/carte?cat=TRAIL"
            className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col items-center text-center transition-transform duration-100 active:scale-95"
          >
            <span className="text-3xl mb-1.5 select-none">🥾</span>
            <span className="font-semibold text-sm text-slate-800">Sentiers ouverts</span>
            <span className="text-xs text-slate-500 mt-0.5">GR34 praticable</span>
          </Link>

          <Link
            href="/carte?cat=HERITAGE"
            className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col items-center text-center transition-transform duration-100 active:scale-95"
          >
            <span className="text-3xl mb-1.5 select-none">🏰</span>
            <span className="font-semibold text-sm text-slate-800">Patrimoine</span>
            <span className="text-xs text-slate-500 mt-0.5">Châteaux & Ports</span>
          </Link>

          <Link
            href="/carte?cat=GASTRONOMY"
            className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col items-center text-center transition-transform duration-100 active:scale-95"
          >
            <span className="text-3xl mb-1.5 select-none">🦪</span>
            <span className="font-semibold text-sm text-slate-800">Huîtres & Terrasses</span>
            <span className="text-xs text-slate-500 mt-0.5">Vue mer</span>
          </Link>
        </div>
      </section>

      {/* Pépites du Moment */}
      <section className="max-w-4xl mx-auto w-full px-4 mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">
            Pépites du moment dans le Golfe
          </h2>
          <Link
            href="/carte"
            className="text-sm font-semibold text-emerald-700 flex items-center gap-1 hover:underline"
          >
            <span>Voir la carte</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TOP_PLACES.map((place) => (
            <PlaceCard key={place.id} place={place} variant="rich" />
          ))}
        </div>
      </section>
    </div>
  );
}
