import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Compass, Share2 } from 'lucide-react';
import { getEscapadeBySlug } from '../../api/escapades/share/route';
import { EscapadeView } from '../../../components/escapade/EscapadeView';

interface EscapadePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: EscapadePageProps): Promise<Metadata> {
  const { slug } = await params;
  const plan = await getEscapadeBySlug(slug);

  if (!plan) {
    return {
      title: 'Escapade introuvable | Guide Morbihan',
      description: "Le séjour demandé n'existe pas ou n'est plus disponible.",
    };
  }

  const sector = plan.profile?.baseSector || 'Morbihan';
  const daysCount = plan.profile?.durationDays || plan.days?.length || 1;
  const title = `Escapade ${sector} (${daysCount} jour${daysCount > 1 ? 's' : ''}) | Guide Morbihan`;
  const description = `Découvrez ce programme d'escapade sur-mesure dans le Morbihan (${sector}, ${daysCount} jour${
    daysCount > 1 ? 's' : ''
  }) calibré selon les marées et anti-bouchons.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/escapade/${slug}`,
      images: [
        {
          url: '/images/og-escapade.jpg',
          width: 1200,
          height: 630,
          alt: `Escapade ${sector} - Guide Morbihan`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function EscapadePage({ params }: EscapadePageProps) {
  const { slug } = await params;
  const plan = await getEscapadeBySlug(slug);

  if (!plan) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl bg-white p-8 text-center shadow-sm border border-slate-200">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl text-amber-600">
            🧭
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-slate-900">
            Escapade introuvable
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Ce lien de séjour partagé est introuvable ou a expiré. Vous pouvez composer
            votre propre itinéraire sur-mesure en quelques secondes.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 transition-colors"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>Créer mon escapade personnalisée</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      {/* Barre de navigation & duplication locale */}
      <div className="border-b border-slate-200/90 bg-white/95 backdrop-blur-xs sticky top-0 z-30">
        <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Guide Morbihan</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/#escapade-generator"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-emerald-800 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Personnaliser ou dupliquer</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Bannière d'indication de partage */}
      <div className="mx-auto max-w-4xl px-4 pt-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 px-4 py-2.5 text-xs sm:text-sm text-emerald-950">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>
              <strong>Séjour partagé :</strong> Vous consultez une escapade créée pour le secteur{' '}
              {plan.profile?.baseSector}.
            </span>
          </div>
          <Link
            href="/#escapade-generator"
            className="shrink-0 font-bold text-emerald-800 underline underline-offset-2 hover:text-emerald-950"
          >
            Créer la mienne
          </Link>
        </div>
      </div>

      {/* Vue principale en lecture seule avec interaction tactile */}
      <EscapadeView plan={plan} />

      {/* Appel à l'action en bas de page */}
      <footer className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 text-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
          <h2 className="text-lg sm:text-xl font-bold text-slate-950">
            Envie d&apos;explorer le Morbihan selon vos envies ?
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
            Générez votre propre programme en 3 clics : marées synchronisées, alternatives
            anti-pluie et respect des temps de trajet.
          </p>
          <div className="mt-5">
            <Link
              href="/#escapade-generator"
              className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 transition-all active:scale-[0.98]"
            >
              <Compass className="h-4 w-4" aria-hidden="true" />
              <span>Créer mon escapade sur-mesure</span>
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
