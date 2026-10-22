# Spécification d'Intégration : Transformation en « Produit Vivant »
## Guide du Morbihan

- **Date :** 2026-10-22
- **Statut :** Validé par l'utilisateur
- **Branche cible :** main

---

## 1. Contexte & Problématique

L'application possédait des briques unitaires robustes (201 tests passants) mais souffrait de 4 ruptures majeures empêchant son utilisation en tant que produit réel :
1. **Écran `/carte` factice :** 4 lieux mockés en dur dans le code (`INITIAL_PLACES`).
2. **Base Supabase inutilisée :** Les 34 lieux, marées et météo étaient absents ou non requêtés par le frontend.
3. **Fiche `PlaceDetailView` orpheline :** Invisible sur Desktop (le panneau 440px restait figé sur la liste), et route `/lieu/[slug]` inexistante.
4. **Visualiseur GPX inactif :** Aucun fichier GPX réel et aucune page ou section ne connectait `GpxTrackViewer` à l'utilisateur.

---

## 2. Objectifs Produit & Découpage

Le chantier se découpe en 3 volets cohérents :

### Volet 1 : Couche de Données Résiliente & API `/api/places`
- **Data Repository (`src/lib/data/places.ts`)** :
  - Interroge Supabase / PostGIS via Drizzle ORM (`db.select().from(places)`).
  - En cas d'erreur réseau ou hors-ligne, bascule de façon transparente sur `data/curated-spots.json` + `seedPlaces`.
  - Calcule en temps réel le statut maritime / météo de chaque lieu via `evaluatePlaceContext`.
- **API Endpoint (`src/app/api/places/route.ts`)** :
  - Supporte le filtrage par catégorie (`?category=`), marée (`?maree=`), vent (`?vent=`), pluie (`?pluie=`).
  - Retourne la liste complète des lieux enrichis et contextualisés.
- **Raccordement de `/carte`** :
  - Suppression définitive du tableau en dur de 4 éléments.
  - La carte charge tous les lieux réels du Golfe du Morbihan (34 lieux).

### Volet 2 : Fiche Lieu Raccordée (`PlaceDetailView`)
- **Desktop (`DesktopSplitExplorer.tsx`)** :
  - Lorsque `selectedPlace` est actif, le panneau gauche (440px) permute de la liste vers la fiche `PlaceDetailView`.
  - En-tête avec bouton `[← Retour aux spots]` qui réinitialise la sélection et synchronise l'URL.
  - La carte à droite reste active et centrée sur le lieu sélectionné.
- **Mobile (`MobileExplorerSheet.tsx`)** :
  - Maintien du tiroir tactile gestuel à 3 crans avec ouverture en grand à 0.92 sur sélection.
  - Résolution des slugs (recherche unifiée slug/id).
- **Route Dédiée SEO (`src/app/lieu/[slug]/page.tsx`)** :
  - Rendu serveur statique / ISR (`generateStaticParams`).
  - Balise Schema.org `TouristAttraction` JSON-LD.
  - Métadonnées OpenGraph avec image de couverture et description.
  - Bouton `[← Explorer sur la carte]` renvoyant vers `/carte?spot=${slug}`.

### Volet 3 : Traces GPX Réelles & Visualiseur Actif
- **Fichiers GPX réels (`public/tracks/`)** :
  - `berder.gpx` : boucle côtière de l'Île de Berder (2,6 km).
  - `ile-aux-moines.gpx` : sentier côtier complet de l'Île-aux-Moines (17,2 km).
  - `conguel.gpx` : boucle maritime de la Pointe du Conguel (Quiberon, 3,4 km).
- **Intégration dans `PlaceDetailView`** :
  - Pour les lieux disposant d'une trace (`place.trailData` ou catégorie `TRAIL`), affichage du composant `GpxTrackViewer` avec profil altimétrique SVG synchronisé.
  - Bouton CTA *"Démarrer la navigation terrain"*.
- **Route Immersive (`src/app/rando/[slug]/page.tsx`)** :
  - Affichage plein écran de la trace GPX avec profil altimétrique en pied de page.
  - Suivi GPS en direct (`navigator.geolocation.watchPosition`) avec alerte de déviation de trajectoire.

---

## 3. Schéma de Données & Contraintes Techniques

- **Compatibilité 100% avec les 201 tests existants.**
- **Zéro dépendance réseau obligatoire pour le build :** le repository doit pouvoir pré-rendre les pages même si Supabase est temporairement hors ligne.
- **Performance :** Cibles tactiles $\ge 48\text{px}$, responsive mobile-first, zéro décalage de mise en page (CLS).
