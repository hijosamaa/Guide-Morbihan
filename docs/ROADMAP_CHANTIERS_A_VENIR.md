# Roadmap & Cadrage des Chantiers Parallèles
## Super-App « Le Copilote du Morbihan »

> **Document de transition pour brainstorming :** Ce document résume l'état du projet, les briques existantes et les spécifications cibles des chantiers 2 et 3 afin d'alimenter directement de nouvelles conversations de brainstorming sans perte de contexte.

---

## 🗺️ Vision Globale du Produit

L'application unifie en un seul endroit fluide, mobile-first et intelligent ce que les visiteurs et locaux cherchent aujourd'hui à travers 4 ou 5 outils distincts :
1. **Chantier 1 (En cours) : Hub Découverte & Fiches Lieux Riches**  
   Fiches descriptives complètes, photos, accès parking direct (Waze/Google Maps), commodités OSM (eau, toilettes) et curation locale non-plagiée.
2. **Chantier 2 : Moteur Rando, Vélo & Navigation GPS Active**  
   Parcours vérifiés (GR34, voies vertes), profil altimétrique, suivi en direct de la position sur la trace GPX et alertes de submersion maritime.
3. **Chantier 3 : Planificateur Intelligent de Séjour Multi-Jours**  
   Générateur d'itinéraires sur X jours calibré selon le profil voyageur (famille, sportif, couple, retraités) et optimisé géographiquement (anti-bouchons) et maritimement (marées/météo).

---

## 🧱 Ce qui est déjà développé dans le Codebase (Socle Actuel)

Toute nouvelle réflexion peut s'appuyer sur des bases techniques solides déjà testées (119 tests unitaires passants) :
* **Stack :** Next.js 15 (App Router, TypeScript strict), PostgreSQL 16 + PostGIS via Drizzle ORM, Tailwind CSS.
* **Moteur de marée local en mémoire ([`src/lib/tide-engine.ts`](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/src/lib/tide-engine.ts)) :** Calcul de la règle des douzièmes à la minute près, statut et compte à rebours précis des passages de Berder et Tascon sans appel API externe.
* **Météo marine ([`src/lib/open-meteo.ts`](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/src/lib/open-meteo.ts)) :** Ingestion AROME sur 5 secteurs côtiers (vent, pluie, rafales).
* **Cartographie WebGL ([`src/components/map/GolfeMap.tsx`](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/src/components/map/GolfeMap.tsx)) :** MapLibre GL JS + tuiles vectorielles OpenFreeMap.
* **Lecteur GPX & Profil altimétrique ([`src/components/map/GpxTrackViewer.tsx`](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/src/components/map/GpxTrackViewer.tsx)) :** Parser XML vers GeoJSON ([`src/lib/gpx-parser.ts`](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/src/lib/gpx-parser.ts)) et graphique SVG interactif synchronisé ([`src/components/map/ElevationProfileSvg.tsx`](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/src/components/map/ElevationProfileSvg.tsx)).
* **Interface mobile ([`src/components/explorer/MobileExplorerSheet.tsx`](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/src/components/explorer/MobileExplorerSheet.tsx)) :** Bottom sheet tactile gestuelle à 3 crans (fermé, mi-hauteur, plein écran).

---

## 🥾 CHANTIER 2 : Moteur Rando, Vélo & Navigation GPS Active

### 1. Objectif Produit
Passer du visualiseur GPX passif actuel à un véritable **compagnon d'itinérance sur le terrain** pour les marcheurs et cyclistes.

### 2. Fonctionnalités Clés à Brainstormer
* **Catalogue d'itinéraires :**
  * Randonnée pédestre : Tronçons emblématiques du GR34, boucles insulaires (Île-aux-Moines, Arz), sentiers côtiers de la presqu'île de Rhuys et Quiberon.
  * Vélo & VTT : Voies vertes sécurisées, boucles du Golfe, itinéraires familiaux balisés.
  * Filtres dédiés : Distance (km), dénivelé, difficulté (*Facile, Moyen, Sportif*), type de surface (*Poussette/PMR friendly*, *VTC*, *VTT*), boucle vs aller-simple.
* **Mode « Navigation GPS Active » sur smartphone :**
  * Bouton tactile *"Démarrer la sortie"*.
  * Suivi de position en temps réel (`navigator.geolocation.watchPosition`) matérialisé par un point bleu dynamique avec flèche d'orientation.
  * Recadrage automatique de la carte sur l'utilisateur en mouvement.
  * Réticule synchronisé sur le profil altimétrique (savoir où on se situe dans la montée/descente).
  * Métriques en direct : Distance restante, temps estimé restant, vitesse moyenne.
  * Alerte de déviation de trajectoire (notification visuelle ou sonore si l'utilisateur s'écarte de plus de 30-40 mètres du tracé).
* **Intelligence Maritime & Terrain :**
  * Alerte submersion sur le tracé : si le sentier franchit une digue ou un passage submersible (Berder, Tascon, fond de ria submersible aux gros coefficients), affichage du créneau de praticabilité.
  * Commodités le long du parcours : affichage sur la trace des points d'eau potable, toilettes publiques et cales issus d'OpenStreetMap.

### 3. Questions Techniques & Stratégiques pour le Brainstorming
1. **Gestion de l'écran & batterie :** Utilisation de la `Screen Wake Lock API` pour empêcher l'écran de s'éteindre quand le marcheur consulte la trace.
2. **Mode hors-ligne en zone blanche :** Comment mettre en cache le tracé GPX et les dalles de carte pour que la navigation fonctionne même sans 4G (ex: au fond de certaines criques) ?
3. **Sources de données des traces :** Open Data Départemental (PDIPR Morbihan 56), relations OpenStreetMap `route=hiking`/`route=bicycle`, ou curation de fichiers GPX vérifiés.

---

## 🗓️ CHANTIER 3 : Le Planificateur Intelligent de Séjour Multi-Jours

### 1. Objectif Produit
Remplacer les plannings artisanaux sur bloc-notes par un **générateur automatique de programme de visite sur 1 à 7 jours**, adapté au profil de l'utilisateur et conscient des contraintes du Morbihan (marées et géographie).

### 2. Fonctionnalités Clés à Brainstormer
* **Formulaire d'Onboarding Express (Le Profil Voyageur) :**
  * *Qui êtes-vous ?* Famille avec jeunes enfants/poussette, Couple contemplatif, Groupe d'amis sportifs, Retraités adeptes de patrimoine.
  * *Durée du séjour :* 1 jour (escapade), 2-3 jours (week-end), ou 4-7 jours (semaine).
  * *Lieu de base / Hébergement :* Ville de départ (ex: Vannes, Auray, Sarzeau, Carnac, Quiberon).
  * *Centres d'intérêt prioritaires :* Plages & farniente, Randonnée & nature sauvage, Mégalithes & châteaux, Gastronomie & huîtres, Sorties en mer & îles.
  * *Mobilité :* Véhicule personnel, vélos uniquement, ou transports collectifs/passeurs maritimes.
* **Le Moteur d'Assemblage Intelligent (L'Algorithme de Séjour) :**
  * **Optimisation spatiale (Anti-bouchons) :** Regroupement des activités par zone géographique cohérente pour chaque journée (ne jamais faire traverser deux fois le goulet du Golfe dans la même journée).
  * **Ordonnancement chronologique par journée :**
    * Matin : Balade ou visite culturelle.
    * Déjeuner : Suggestion de spot pique-nique panoramique ou chantier ostréicole local.
    * Après-midi : Activité principale ou plage synchronisée avec la marée haute.
    * Fin de journée : Spot coucher de soleil ou terrasse abritée du vent.
  * **Prise en compte de la marée et de la météo :**
    * Si marée basse de fort coefficient $\rightarrow$ Programmation de Berder ou pêche à pied à l'heure exacte.
    * Si météo pluvieuse détectée sur un jour $\rightarrow$ Remplacement automatique des plages par le Château de Suscinio, le Musée de Carnac ou l'Aquarium.
* **Expérience & Restitution :**
  * Vue chronologique "Jour par Jour" avec timeline heure par heure et carte interactive du trajet du jour.
  * Bouton "Remplacer cette activité" (permettre à l'utilisateur d'échanger un spot qui ne lui plaît pas contre une alternative proche).
  * Sauvegarde locale sans compte (LocalStorage) + Partage du programme par lien unique ou export PDF compact.

### 3. Questions Techniques & Stratégiques pour le Brainstorming
1. **Technologie du moteur de génération :** Algorithme déterministe de résolution de contraintes (rapide, gratuit, 100% prévisible) OU appel à un LLM avec prompt système calibré sur nos données de lieux ?
2. **Niveau de flexibilité :** L'utilisateur peut-il glisser-déposer pour réordonner les activités manuellement ?
3. **Persistance :** Stockage d'un token d'itinéraire en base ou encodage compact dans l'URL ?

---

## 💡 Comment Lancer ces Brainstormings en Parallèle ?

Vous pouvez ouvrir une nouvelle session de chat et démarrer par exemple en collant :
> *"Je veux brainstormer sur le **Chantier 2 (Navigation GPS Rando & Vélo)** de l'application Guide Morbihan en utilisant `/brainstorming`. Référencer les briques techniques et les objectifs décrits dans `@ROADMAP_CHANTIERS_A_VENIR.md`."*

Et de même pour le **Chantier 3 (Planificateur de séjour)** !
