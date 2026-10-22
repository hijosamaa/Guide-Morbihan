import type { Metadata, Viewport } from 'next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import './globals.css';

// Configuration viewport mobile-native conforme aux standards PWA
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export const metadata: Metadata = {
  title: 'Le Copilote Contextuel du Golfe du Morbihan',
  description: 'Moteur de décision touristique en temps réel : marées, météo et passages submersibles.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900">
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
