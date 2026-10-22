# Spécification Technique & Design d'Architecture
## Chantier 2 : Moteur Rando, Vélo & Navigation GPS Active (« Le Copilote du Morbihan »)

**Date :** 22 Octobre 2026  
**Statut :** Validé après revue critique multi-experts (Architecte PWA Géo & Guide Terrain Morbihan)  
**Emplacement :** `docs/superpowers/specs/2026-10-22-chantier-2-navigation-gps-design.md`  

---

## 1. Vision Produit & Objectifs

Le Chantier 2 transforme l'application « Le Copilote du Morbihan » d'un visualiseur cartographique passif en un **compagnon d'itinérance actif, intelligent et sécurisant sur le terrain** pour les marcheurs et cyclotouristes.

### Différenciateurs majeurs face aux applications généralistes (Komoot, AllTrails, Strava) :
1. **Intelligence maritime locale intégrée :** Prédiction en direct de la praticabilité des passages submersibles (Berder, Tascon, Le Bono, Séné) connectée au moteur de marée en mémoire ([`src/lib/tide-engine.ts`](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/src/lib/tide-engine.ts)) avec prise en compte dynamique de la surcote météo.
2. **Respect strict des contraintes réglementaires bretonnes :** Séparation étanche entre randonnée pédestre (le GR34 est **strictement interdit aux vélos** par arrêté préfectoral) et véloroutes/voies vertes sécurisées.
3. **Autonomie totale en zone blanche côtière (Mode Hors-ligne 1-Clic) :** Téléchargement prédictif compact de la trace, des POIs, des commodités OSM (eau, toilettes) et des tuiles vectorielles MapLibre jusqu'au niveau de zoom 16 sans aucune dépendance réseau.
4. **Sécurité & Secours littoral en 1 clic :** Module d'urgence affichant instantanément les coordonnées au format terrestre (SDIS 112/18) et maritime (CROSS Étel 196 / VHF 16).

---

## 2. Architecture Globale & Découpage Modulaire

Le système adopte une architecture **Local-First Reactive Engine**, découplant l'affichage WebGL, le moteur géométrique pur et la couche matérielle PWA.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   1. COCKPIT UI MOBILE (React 19)                      │
│  - ActiveNavigationCockpit.tsx (Plein écran, HUD, boussole, SOS)       │
│  - NavigationStatsBar.tsx (Typographie XXL : distance, allure, temps)  │
│  - NavigationElevationSync.tsx (Réticule synchronisé en temps réel)    │
│  - CoastalSosModal.tsx (Coordonnées SDIS 112 / CROSS 196 en 1 clic)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Commandes & États
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             2. STATE ENGINE & MATÉRIEL (`src/hooks/navigation/`)       │
│  - `useActiveNavigation.ts` (Cycle de vie, FSM boucle, snapshot 5s)    │
│  - `useWakeLock.ts` (Screen Wake Lock avec gestion rejet basse énergie)│
│  - `useDeviceOrientation.ts` (Orientation boussole / cap dynamique)   │
│  - `useNavigationAudio.ts` (AudioContext pré-amorcé pour iOS/Android)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Événements GPS { lat, lng, acc, speed }
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             3. MOTEUR GÉOMÉTRIQUE PUR (`src/lib/geo-navigation/`)      │
│  - `projection.ts` : Projection métrique équirectangulaire clamped     │
│  - `progress-tracker.ts` : Deux niveaux (O(1) glissant + fallback O(N))│
│  - `deviation-detector.ts` : Hystérésis dynamique basée sur accuracy   │
│  - `tide-alert-evaluator.ts` : Évaluation ETA passage + surcote vent   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              4. MODULE HORS-LIGNE (`src/lib/offline-pack/`)            │
│  - `tile-downloader.ts` : Calcul des tuiles z11-z16 (buffer 300m)      │
│  - `cache-manager.ts` : Stockage tuiles + style + sprites + glyphes    │
│  - `offline-storage.ts` : IndexedDB pour GeoJSON, profil et commodités │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Spécifications Détaillées des Algorithmes Géométriques

### 3.1. Correction de distorsion géodésique à 47.5°N
Dans le Golfe du Morbihan ($47.5^\circ\text{N}$), $1^\circ$ de longitude équivaut à seulement $\approx 75.1\text{ km}$ contre $111.18\text{ km}$ pour $1^\circ$ de latitude (écart de 32.4%).  
Tout calcul géométrique de projection est donc converti en repère métrique local équirectangulaire :
$$x = (\lambda - \lambda_0) \times \frac{\pi}{180} \times R \times \cos(\phi_{moy})$$
$$y = (\phi - \phi_0) \times \frac{\pi}{180} \times R$$
où $R = 6\,371\,000\text{ m}$ et $\phi_{moy}$ est la latitude moyenne du segment.

### 3.2. Projection orthogonale bornée (Clamped Segment Projection)
Pour un segment $[A, B]$ et une position utilisateur $P$ :
$$t = \frac{\vec{AP} \cdot \vec{AB}}{\|\vec{AB}\|^2}$$
$$t_{clamped} = \max(0, \min(1, t))$$
$$H = A + t_{clamped} \cdot \vec{AB}$$
La **Cross-Track Distance** est la distance euclidienne métrique $\|P - H\|$.

### 3.3. Algorithme de recherche à deux niveaux (Two-Tier Search)
* **Étage 1 ($O(1)$ amorti) :** Recherche du segment le plus proche dans une fenêtre glissante $[i_{last} - 3, i_{last} + 10]$.
* **Étage 2 (Fallback global $O(N)$) :** Si la distance minimale dans la fenêtre dépasse $60\text{ mètres}$, déclenchement d'un scan complet de la trace pour raccrocher immédiatement si le randonneur a coupé à travers bois ou pris une variante.

### 3.4. Détection de déviation avec hystérésis & corrélation de précision GPS
Pour éliminer les faux positifs sous les pins maritimes ou au pied des falaises :
1. **Seuil dynamique d'alerte :**
   $$\text{SeuilAlerte} = \max\left(35\text{ m},\, 1.5 \times \text{position.coords.accuracy}\right)$$
2. **Neutralisation automatique :** Si `position.coords.accuracy > 40 m`, l'alerte de déviation est inhibée et le badge d'état indique *"Signal GPS dégradé"*.
3. **Condition de déclenchement :** Écart $> \text{SeuilAlerte}$ pendant au moins **10 secondes consécutives** (ou 3 points GPS consécutifs).
4. **Condition d'extinction (Hystérésis) :** L'alerte ne s'éteint que lorsque l'écart repasse sous **20 mètres**.

### 3.5. Machine à États Finis (FSM) pour circuits en boucle
Sur les boucles (où départ = arrivée), la projection initiale est verrouillée :
* `START_LOCKED` : Pendant les premiers 300 mètres parcourus, la projection est confinée aux 20 premiers pourcents de la trace.
* `NAVIGATING` : Fenêtre glissante normale.
* `APPROACHING_FINISH` : Déverrouillage des 10 derniers pourcents uniquement si au moins 70 % de la trace a été parcourue.
* `ARRIVED` : Distance restante $< 25\text{ m}$.

---

## 4. Spécifications de l'Intelligence Maritime & Sécurité

### 4.1. Alertes de submersion prédictives avec surcote météo
Les passages submersibles (Berder, Tascon, Gué du Bono, 7 Îles, digues de Séné) disposent d'un jalon kilométrique sur la trace.
1. **Calcul de l'ETA au passage :**
   $$\text{ETA} = \text{Heure actuelle} + \frac{\text{Distance jusqu'au passage}}{\text{Vitesse lissée}}$$
2. **Marge de sécurité dynamique (Surcote hydrographique) :**
   $$\text{Marge (min)} = 15 + (\text{Coeff} > 80 \ ? \ 10 : 0) + (\text{Vent W/SW} > 20\text{ kts} \ ? \ 15 : 0)$$
3. **Trois états prédictifs :**
   * 🟢 **Praticable :** $\text{ETA} < \text{Heure fermeture} - \text{Marge}$.
   * 🟡 **Créneau juste :** Passage praticable mais fermeture dans moins de 30 min.
   * 🔴 **Submergé / Danger :** $\text{ETA} \ge \text{Heure fermeture} - \text{Marge}$. Alerte sonore et proposition d'activer la trace de repli (`highTideBypassGeojson`).

### 4.2. Randonnée vs Vélo : Respect de la loi littoral sur le GR34
* Les fiches d'itinéraires et le catalogue séparent strictement les catégories :
  * `activity: 'HIKE'` : Tracés pédestres incluant le GR34. Badge d'avertissement permanent : *"🚫 Vélos formellement interdits (Arrêté préfectoral sentier des douaniers)"*.
  * `activity: 'BIKE'` : Voies vertes, pistes cyclables en site propre et voies partagées sécurisées (ex: Voie 3 de Bretagne, boucles de Rhuys).
* Taggage précis des obstacles dans les métadonnées de trace :
  * `stairsCount` : Nombre de marches (avertissement poussettes et genoux fragiles).
  * `chicaneWidth` : Largeur des chicanes en bois anti-quad (alerte remorques enfants).

### 4.3. Module d'Urgence "Secours Littoral" (1-Tap SOS)
Un bouton rouge permanent `SOS Secours` ouvre une modale contrastée :
* **Format Terrestre SDIS 56 (112 / 18) :** Coordonnées WGS84 décimales (ex: `47.53421° N, 2.95112° W`) + toponyme/cap le plus proche.
* **Format Maritime CROSS Étel (196 / VHF 16) :** Coordonnées Degrés Minutes Décimales (ex: `47° 32.052' N, 002° 57.067' W`).
* **Bouton 1-clic :** « Copier & Générer SMS d'alerte pré-rempli ».

---

## 5. Spécifications du Cockpit Mobile & Contraintes Matérielles (iOS / Android)

### 5.1. Lisibilité plein soleil marin (High Glare)
* Trace active sur la carte : Ligne **Jaune Signalétique (`#FFD600`) ou Magenta (`#E11D48`) de 5 px de large**, avec un liseré protecteur noir opaque de 9 px (`line-casing`).
* Métriques en vue compacte (hauteur 85 px) : Chiffres XXL (28 à 36 px) sur fond de tuile contrasté blanc ou ardoise sombre.

### 5.2. Gestion du son et des retours physiques (Contraintes iOS WebKit)
* **Vibrations :** `navigator.vibrate` n'existe pas sur iOS Safari. Le retour physique est conditionné : `if ('vibrate' in navigator) navigator.vibrate(...)`.
* **Audio WebKit :** L'`AudioContext` est instancié et déverrouillé (`resume()`) dès le clic utilisateur sur *"Démarrer la sortie"* via un buffer muet de 1 ms. Le bip sonore d'alerte de déviation est ainsi garanti sur iPhone même 30 minutes après le départ.

### 5.3. Préservation de batterie & Screen Wake Lock
* Deux modes proposés dans l'interface :
  1. **Mode Guidage Continu :** Wake Lock actif (`navigator.wakeLock.request('screen')`). Rejet géré silencieusement si mode économie d'énergie activé (`NotAllowedError`).
  2. **Mode Éco-Poche :** Écran s'éteint normalement. Réveil automatique et resynchronisation GPS instantanée sur événement `document.visibilitychange`.
* **Résilience Tab Discard (Appareil photo) :** Sauvegarde d'un snapshot compact de session (`trackId`, `distanceWalkedM`, `elapsedSeconds`, `lastSegmentIndex`) dans `localStorage` toutes les 5 secondes. En cas de fermeture de l'onglet par iOS/Android suite à la prise de photo, la session redémarre instantanément sans perte au réaffichage.

---

## 6. Architecture du Pack Hors-Ligne (Zones Blanches Côtières)

### 6.1. Dimensionnement & Niveaux de Zoom
Pour garantir la visibilité des moindres sentiers et escaliers côtiers, le pack couvre les niveaux de zoom **z11 à z16** avec un tampon resserré à **300 mètres** autour de la trace :
* **Nombre de tuiles vectorielles :** $\approx 180$ à 210 tuiles pour une rando de 15 km.
* **Poids des tuiles MVT PBF :** $\approx 6.0\text{ Mo}$.
* **Assets cartographiques obligatoires (CacheStorage) :**
  * Style JSON OpenFreeMap Liberty ($\approx 100\text{ Ko}$).
  * 4 fichiers Sprites (`sprite.json`, `sprite.png`, `sprite@2x.json`, `sprite@2x.png` $\approx 350\text{ Ko}$).
  * Glyphes latins essentiels (plage `0-255.pbf` pour Roboto et Noto Sans $\approx 450\text{ Ko}$).
* **Données métier (IndexedDB) :** GeoJSON, profil altimétrique, événements de marée et commodités OSM ($\approx 200\text{ Ko}$).
* **Poids total du pack : $\approx 7.2\text{ Mo}$** (téléchargé en moins de 4 secondes en 4G).

### 6.2. Contrôle de quota de stockage
* Interrogation préalable de `navigator.storage.estimate()`. Si l'espace libre est $< 25\text{ Mo}$, alerte préventive.
* Demande de persistance permanente via `navigator.storage.persist()` pour empêcher iOS de purger le cache après 7 jours.

---

## 7. Plan de Curation du Catalogue (Les "Tracés d'Or" du Morbihan)

Le catalogue initial comportera une sélection rigoureusement vérifiée de **35 à 45 tracés** :
1. **GR34 & Boucles Pédestres Emblématiques :**
   * Côte Sauvage de Quiberon (Portivy ➔ Pointe du Percho ➔ Le Vivier) - *Strictement piéton, pas d'eau, sentier escarpé*.
   * Tour de l'Île-aux-Moines (Boucle Nord 8 km et Tour Complet 17 km).
   * Tour de l'Île d'Arz (14 km) - *Plat, exposé vent*.
   * Circuit de Berder & Pointes de Larmor-Baden (8.5 km) - *Passage submersible*.
   * Presqu'île de Rhuys : De Port-Navalo au Grand Mont (16 km).
   * Le Bono & Rivière d'Auray (9 km).
   * Ria d'Étel & Îlot Saint-Cado (7.5 km).
   * Sentier d'Arradon & Moulin de Penboch (10 km).
2. **Vélo & Voies Vertes Sécurisées :**
   * Voie 3 de Bretagne (Tronçon Questembert ➔ Vannes / Mauron) - *Voie ferrée bitumée 100% sécurisée famille*.
   * La Vélodyssée EV1 le long du Canal de Nantes à Brest.
   * La Boucle Cyclable de Rhuys (Sarzeau ➔ Arzon).
   * La Voie Verte de Quiberon le long du Tire-Bouchon.
3. **Pièges formellement exclus :**
   * Pas de "Tour du golfe à vélo" fictif sans intégrer la navette maritime Port-Navalo / Locmariaquer.
   * Aucune trace vélo empruntant le GR34 littoral.

---

## 8. Stratégie de Tests & Validation

1. **Tests unitaires mathématiques (`vitest`) :**
   * Projection métrique équirectangulaire et clamping $t \in [0, 1]$.
   * Détecteur de déviation avec hystérésis (rejet des sauts de 2s, alerte à $> 10$s, extinction à $< 20$m).
   * Évaluateur de marée avec surcote météo simulée (vent SW 25 kts).
   * Conversion coordonnées $\rightarrow$ tuiles Slippy Map $(x, y, z)$.
2. **Tests d'intégration des hooks React :**
   * `useActiveNavigation` : transitions d'états, sauvegarde snapshot `localStorage`, restauration automatique.
   * `useWakeLock` : acquisition, libération et tolérance aux erreurs `NotAllowedError`.
3. **Tests de bout en bout (E2E / Scénarios terrain simulés) :**
   * Simulation GPX playback le long du tracé de Berder avec passage sous l'eau déclenchant l'alerte.
   * Coupure réseau simulée (Offline mode) avec vérification de l'affichage WebGL depuis CacheStorage.
