# Spécification de Conception — Bloc 5 : Interfaces Utilisateur Mobile-First

- **Date :** 21 Octobre 2026
- **Projet :** Le Copilote Contextuel du Golfe du Morbihan
- **Sous-Projet :** Bloc 5 — Interfaces Utilisateur Mobile-First (Pilule Flottante, Filtres Réactifs avec URL Shallow, Bottom Sheet Non-Modale Vaul, Cartes Contextuelles, Dashboard & Explorateur Cartographique)
- **Statut :** Validé — Prêt pour revue & plan d'implémentation

---

## 1. Objectifs & Périmètre Fonctionnel

Le Bloc 5 concrétise l'expérience visuelle, tactile et décisionnelle du Copilote Contextuel. Il rassemble les données de fondation (Bloc 1), les calculs du moteur de marée et de score contextuel (Bloc 2), les flux météorologiques (Bloc 3) et le système cartographique WebGL (Bloc 4) au sein d'une interface fluide, intuitive et conçue prioritairement pour une manipulation à une main en situation de mobilité extérieure (plages, sentier GR34, cales et bateaux).

### 1.1. Principes Directeurs d'Ingénierie Design
1. **Économie de surface & Zéro encombrement vertical :**
   - Refus catégorique des bandeaux fixes envahissants qui volent l'espace de la carte.
   - Remplacement par une capsule flottante minimaliste (*Floating Context Pill*) inspirée de Dynamic Island / Apple Maps.
   - Les informations ultra-spécifiques (comme les passages de Berder ou Tascon) ne s'imposent jamais de force : **elles n'apparaissent que lorsqu'elles ont du sens** (fermeture imminente dans $< 45\text{ min}$ ou consultation du secteur géographique concerné).
2. **Bottom Sheet Tactile Non-Modale (`vaul`) :**
   - Sur mobile (`/carte`), la Bottom Sheet fonctionne en mode non-bloquant (`modal={false}`) : l'utilisateur peut interagir avec la carte MapLibre en arrière-plan (pan, zoom, pitch) quel que soit le palier de la sheet (140px, 50%, 92%).
   - Pilotage dynamique du `cameraPadding.bottom` de MapLibre pour maintenir le marqueur sélectionné visible dans la moitié supérieure de l'écran.
3. **Zéro Latence & Synchronisation d'URL 60 FPS (`nuqs`) :**
   - Les filtres modifient l'URL via `history.replaceState` sans aucun aller-retour réseau serveur Next.js RSC Flight (`shallow: true`).
   - L'état reste 100% partageable (deep-linking direct).
4. **Lisibilité Plein Soleil (Contraste Outdoor & Accessibilité) :**
   - Respect strict des ratios de contraste élevés ($> 8.5:1$ à $11:1$, WCAG AAA) pour résister à la réverbération marine et aux lunettes polarisées.
   - Cibles tactiles $\ge 48\text{ px}$.
   - Suppression du flash gris tactile (`-webkit-tap-highlight-color: transparent`) et hauteur dynamique `100dvh`.

---

## 2. Architecture Technique & Découpage des Composants

### 2.1. Arborescence des Fichiers

```text
src/
├── app/
│   ├── page.tsx                             # Dashboard Accueil "Now & Around Me"
│   └── carte/
│       └── page.tsx                         # Explorateur cartographique WebGL plein écran
├── components/
│   ├── context/
│   │   ├── FloatingContextPill.tsx          # Capsule flottante compacte (météo + marée + alerte conditionnelle)
│   │   └── TidalAlertChip.tsx               # Pastille d'alerte submersible (affichée uniquement si urgence)
│   ├── filters/
│   │   ├── FilterBar.tsx                    # Piste de filtres horizontaux tactiles (touch-pan-x)
│   │   └── FilterPill.tsx                   # Bouton pilule tactile (h-11, active:scale-95, aria-pressed)
│   ├── places/
│   │   ├── PlaceCard.tsx                    # Carte de lieu adaptative (variantes: compacte / riche)
│   │   ├── ContextBadge.tsx                 # Badge d'évaluation contextuelle (🟢/🟠/⚪/🟡)
│   │   └── PlaceCardSkeleton.tsx            # Placeholders shimmer anti-layout-shift (CLS = 0)
│   └── explorer/
│       ├── MobileExplorerSheet.tsx          # Bottom Sheet tactile non-modale Vaul (3 paliers)
│       └── DesktopSplitExplorer.tsx         # Layout Master-Detail fixe (sidebar 440px + carte)
└── lib/
    ├── search-params.ts                     # Schéma de validation d'URL et parsers nuqs
    └── hooks/
        ├── useFilteredPlaces.ts             # Hook mémoïsé de filtrage client en mémoire
        └── useCameraOffset.ts               # Hook de calcul du décalage de caméra MapLibre
```

### 2.2. Nouvelles Dépendances

```json
{
  "dependencies": {
    "vaul": "^1.1.2",
    "nuqs": "^2.3.2"
  }
}
```

- **`vaul`** : Bibliothèque headless de Drawer créée par Emil Kowalski. Fournit les équations physiques d'Apple WWDC 2018 (amortissement critique, résistance élastique, détection d'inertie de relâchement, confinement de scroll interne). Compatible React 19 et Next.js 15.
- **`nuqs`** : Gestionnaire de paramètres d'URL pour Next.js App Router avec support natif de `shallow: true` et `useTransition`.

---

## 3. La Pilule Flottante Contextuelle (`FloatingContextPill.tsx`)

### 3.1. Rôle & Emplacement
En lieu et place d'un bandeau fixe invasif, une capsule élégante et discrète flotte en haut d'écran sur la carte et le dashboard :
- **Sur mobile :** Placée sous la safe-area haute (`top-[max(0.75rem,env(safe-area-inset-top))] right-4`), hauteur $36\text{ px}$.
- **Sur desktop :** Intégrée en en-tête de la colonne latérale d'exploration.

### 3.2. Contenu & Comportement Conditionnel

La capsule n'affiche par défaut qu'une synthèse épurée des conditions maritimes globales :

```text
┌──────────────────────────────────────────────┐
│  🌊 PM 17h42 (Coeff 78)  ·  🌤️ 19°C (NO 12nd) │
└──────────────────────────────────────────────┘
```

#### Règle d'Affichage Juste-à-Temps pour Berder et Tascon :
- **Cas normal (Passage ouvert pour $> 60\text{ min}$ ou fermé depuis longtemps) :**  
  Aucune alerte n'encombre la capsule. L'état du passage reste consultable sur la fiche du lieu dans la liste ou sur la carte.
- **Cas d'urgence (Fermeture dans $\le 45\text{ min}$) :**  
  La capsule se métamorphose ou déploie une pastille d'alerte ambre/rouge vibrante :  
  `⚠️ Berder : Submersion dans 32 min`
- **Cas de localisation :**  
  Si la caméra de la carte est centrée sur le secteur de Larmor-Baden / Tascon, une puce d'état du passage s'insère automatiquement dans la barre d'information.

### 3.3. Dépliement au Tap
Un tap sur la pilule (`active:scale-[0.97] transition-transform duration-100`) ouvre un popover translucide ancré à la capsule (`transform-origin: top right`) détaillant :
- La courbe sinusoïdale des marées sur 24h avec repère de l'heure courante.
- L'orientation exacte du vent et la vitesse des rafales.
- L'horaire précis de réouverture du gué submersible.

---

## 4. La Barre de Filtres Contextuels (`FilterBar.tsx`)

### 4.1. Schéma d'URL (`src/lib/search-params.ts`)

```typescript
import {
  parseAsString,
  parseAsBoolean,
  parseAsArrayOf,
  createSearchParamsCache,
} from 'nuqs/server';

export const filterParsers = {
  // Catégorie principale (optionnelle)
  cat: parseAsString.withDefault('ALL'),
  // Filtre contextuel de marée : 'ALL' | 'HIGH_TIDE' | 'LOW_TIDE'
  maree: parseAsString.withDefault('ALL'),
  // Filtre abri au vent
  vent: parseAsBoolean.withDefault(false),
  // Critères d'accessibilité et commodités
  pmr: parseAsBoolean.withDefault(false),
  chiens: parseAsBoolean.withDefault(false),
  pluie: parseAsBoolean.withDefault(false),
  // Spot actuellement mis en évidence
  spot: parseAsString.withDefault(''),
};

export const searchParamsCache = createSearchParamsCache(filterParsers);
```

### 4.2. Liste des Pilules Tactiles

```text
[ 🏖️ Baignade idéale ] [ 💨 Abrité du vent ] [ 🥾 Sentiers & Balades ] [ 🏰 Patrimoine ] [ 🦪 Huîtres & Terroir ] [ 👶 Poussette ] [ 🐕 Chiens ]
```

- **Météo adaptative :** Si la météo locale (Bloc 3) remonte de la pluie (`isRaining === true`), la pilule `🌧️ À l'abri de la pluie` s'injecte automatiquement en première position.
- **Cible tactile :** Hauteur $44\text{ px}$, `padding-inline: 1rem`, `user-select: none`, `touch-action: manipulation`.
- **Micro-interaction :** Réduction instantanée sur contact `:active { transform: scale(0.96); }` avec rebond rapide (durée $100\text{ ms}$, courbe `cubic-bezier(0.23, 1, 0.32, 1)`).
- **Synchronisation Shallow :** Utilisation de `useQueryState(key, { shallow: true, history: 'replace' })` couplée à `useTransition` de React 19 pour éviter toute interruption d'animation lors du filtrage en mémoire.

---

## 5. Les Cartes de Lieux (`PlaceCard.tsx`) & Badges Contextuels

### 5.1. Variante Compacte (Mobile Bottom Sheet & Sidebar Desktop)
Conçue pour un défilement rapide au pouce :
- **Layout :** Flexbox horizontal, hauteur $96\text{ px}$.
- **Miniature :** Bloc carré $80 \times 80\text{ px}$ à gauche (`rounded-xl overflow-hidden object-cover`).
- **Zone descriptive :**
  - Nom du spot en gras (16px, `truncate`).
  - Ligne métadonnée : icône catégorie + commune + distance relative (`📍 2.3 km`).
  - Badge de statut contextuel compact.
- **État Sélectionné :** Si le marqueur est actif sur la carte, la carte reçoit `ring-2 ring-emerald-500 bg-emerald-50/20 shadow-sm`.
- **Comportement tactile :** `:active { transform: scale(0.98); }` en 120ms.

### 5.2. Variante Riche (Dashboard Accueil & Grille Découverte)
Format carte d'inspiration verticale :
- **Image :** Ratio 16:9 (`rounded-2xl`) avec dégradé semi-transparent en base.
- **Badges superposés :** Catégorie en haut à gauche, badge contextuel en haut à droite.
- **Corps :** Titre, description courte (2 lignes max `line-clamp-2`), statistiques (ex: distance, dénivelé pour sentiers), et bouton d'action d'itinéraire parking.

### 5.3. `ContextBadge.tsx` : Tokens de Visibilité & Itération Esthétique

> [!NOTE]
> Les badges sont encapsulés de manière totalement modulaire dans le composant `ContextBadge.tsx`. Ils utilisent temporairement la palette de contraste ci-dessous pour valider la robustesse fonctionnelle avant une passe de raffinement graphique ultérieure (micro-capsules minimalistes / typographie épurée).

| Statut contextuel | Fond / Bordure / Texte | Libellé & Icône explicite | Ratio de contraste |
| :--- | :--- | :--- | :--- |
| 🟢 **`IDEAL`** | `#ECFDF5` / `#059669` / `#064E3B` | `[CheckCircle] Idéal en ce moment` | **> 9.5:1** (AAA) |
| 🟠 **`WARNING`** | `#FFFBEB` / `#D97706` / `#78350F` | `[AlertTriangle] Fin de créneau praticable` | **> 8.5:1** (AAA) |
| ⚪ **`DISCOURAGED`** | `#F1F5F9` / `#64748B` / `#0F172A` | `[Ban] Déconseillé à cette heure` | **> 11:1** (AAA) |
| 🟡 **`SPONSORED`** | `#FEFCE8` / `#CA8A04` / `#713F12` | `[Sparkles] Coup de cœur rédaction` | **> 9:1** (AAA) |

---

## 6. L'Explorateur Cartographique (`/carte`)

### 6.1. Mobile (< 1024px) : Carte MapLibre + Bottom Sheet Vaul Non-Modale

#### Configuration du Drawer
```tsx
<Drawer.Root
  open={true}
  modal={false} // Crucial : Carte interactive en arrière-plan sans overlay bloquant
  dismissible={false} // Reste toujours ancré au moins au palier bas (140px)
  snapPoints={['140px', 0.5, 0.92]}
  activeSnapPoint={activeSnap}
  setActiveSnapPoint={setActiveSnap}
>
  <Drawer.Portal>
    <Drawer.Content
      className="fixed bottom-0 left-0 right-0 z-30 flex flex-col rounded-t-[24px] bg-white/95 backdrop-blur-md shadow-2xl border-t border-slate-200/80 outline-none select-none"
      style={{ height: '92dvh' }}
    >
      {/* Poignée de drag */}
      <Drawer.Handle className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto my-3" />
      
      {/* Piste de filtres tactiles intégrée en crête */}
      <div className="px-4 pb-2">
        <FilterBar />
      </div>

      {/* Conteneur de scroll interne isolé */}
      <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* Liste des PlaceCard (variante compacte) */}
      </div>
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>
```

#### Gestion du Padding de Caméra MapLibre (`useCameraOffset.ts`)
Pour que le spot sélectionné ne disparaisse jamais sous la Bottom Sheet à mi-hauteur ($50\%$), un hook surveille le `activeSnapPoint` et ajuste dynamiquement le cadrage de la carte :

$$\text{paddingBottom} = 
\begin{cases} 
140\text{ px} & \text{si snap} = \text{'140px'} \\
\text{window.innerHeight} \times 0.5 & \text{si snap} = 0.5 \\
\text{window.innerHeight} \times 0.92 & \text{si snap} = 0.92
\end{cases}$$

```typescript
map.easeTo({
  padding: { top: 60, bottom: paddingBottom, left: 0, right: 0 },
  duration: 250,
  easing: (t) => 1 - Math.pow(1 - t, 3), // cubic ease-out
});
```

#### Synchronisation Bidirectionnelle
1. **Sélection Marqueur sur Carte :**
   - La Bottom Sheet monte au palier 50% (`setActiveSnap(0.5)`).
   - La carte scroll jusqu'au conteneur : `element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`.
   - La carte reçoit l'anneau de surbrillance.
2. **Défilement dans la Sheet :**
   - Un `IntersectionObserver` léger avec débourrage (150ms) détecte la carte la plus centrée.
   - La carte applique un `panTo(coordinates, { duration: 350 })` sans re-zoomer pour maintenir le repère spatial.

---

### 6.2. Desktop ($\ge$ 1024px) : Split-View Master-Detail
Sur grand écran, la Bottom Sheet est masquée et remplacée par un layout à double panneau :
- **Panneau latéral gauche fixe ($440\text{ px}$) :**
  - Header avec recherche et capsule météo/marée.
  - Barre de filtres contextuels.
  - Liste scrollable des lieux (`PlaceCard` compactes) avec compteur de résultats.
- **Panneau cartographique droit (`flex-1`) :**
  - Canevas MapLibre plein cadre avec contrôles flottants intégrés (géoloc, boussole, plein écran).
  - Centrage standard avec `padding: 24px`.

---

## 7. Le Dashboard d'Accueil (`/`)

### 7.1. Composition des Blocs
1. **Hero Contextuel Épuré :**
   - Accroche : *"Le Copilote Contextuel du Golfe du Morbihan"*.
   - Sous-titre : *"Où aller maintenant selon la marée, le vent et les sentiers ouverts"*.
   - **Pilule Flottante Météo & Marée** intégrée dans l'en-tête.
   - Bouton d'action principal bien visible : **[ 🗺️ Ouvrir la Carte en Direct ]** ($48\text{ px}$, `bg-slate-900 text-white`).
2. **Sélecteur d'Intention Immédiate (Carrousel horizontal tactile) :**
   - Boutons larges cliquables :
     - 🏖️ *Baignade idéale* $\rightarrow$ redirige vers `/carte?cat=BEACH&maree=HIGH_TIDE`
     - 🥾 *Sentiers praticables* $\rightarrow$ redirige vers `/carte?cat=TRAIL`
     - 🏰 *Patrimoine & Histoire* $\rightarrow$ redirige vers `/carte?cat=HERITAGE`
     - 🦪 *Huîtres & Terrasses* $\rightarrow$ redirige vers `/carte?cat=GASTRONOMY`
     - 🌧️ *À l'abri de la pluie* (si pluie en cours)
3. **Module Conditionnel d'Alerte Submersion :**
   - **Règle stricte :** N'apparaît sur l'accueil **que si** un passage submersible (Berder ou Tascon) risque d'être coupé dans les 45 prochaines minutes.
   - Affiche un carton d'avertissement bienveillant avec le compte à rebours précis.
   - Si les passages sont praticables sans urgence ou submergés pour plusieurs heures, ce bloc s'efface complètement pour ne pas polluer l'écran.
4. **Section "Le Golfe en ce moment" :**
   - Grille de 4 à 6 fiches en variante riche (`variant="rich"`), triées par score contextuel décroissant (les spots `IDEAL` apparaissent en premier).
   - Lien vers l'explorateur : *"Voir les spots sur la carte →"*.

---

## 8. Performance Mobile-Native, Accessibilité & Tests

### 8.1. Déclarations CSS Fondamentales (`globals.css`)
```css
/* Suppression du halo tactile natif */
html {
  -webkit-tap-highlight-color: transparent;
}

/* Élimination du délai 300ms */
button, a, [role="button"] {
  touch-action: manipulation;
}

/* Empêcher le pull-to-refresh involontaire sur la carte */
html, body {
  overscroll-behavior-y: none;
}

/* Confinement de scroll interne dans la Bottom Sheet */
.overscroll-contain {
  overscroll-behavior-y: contain;
}
```

### 8.2. Critères de Validation & Recette
1. **Fluidité d'interaction :**
   - Drag de la Bottom Sheet à 60 FPS sans saccade ni blocage du canevas MapLibre.
   - Réaction tactile sous les 120ms (`:active { transform: scale(0.96); }`).
2. **Robustesse de l'état URL :**
   - L'activation d'un filtre met à jour l'URL sans requête serveur RSC observable dans l'onglet Réseau des DevTools.
   - Le rechargement direct d'une URL pré-filtrée restaure fidèlement la sélection.
3. **Ergonomie Outdoor :**
   - Zéro cible tactile $< 44\text{ px}$.
   - Contraste validé sur les badges et la capsule flottante ($> 8.5:1$).
   - Pas de chevauchement avec l'encoche (Notch/Dynamic Island) ou la barre Home Indicator d'iOS.
4. **Zéro Erreur d'Hydratation :**
   - Les composants reposant sur la taille d'écran ou le WebGL sont isolés avec gestion propre du montage client.
