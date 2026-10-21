# Spécification de Conception — Bloc 2 : Moteur Mathématique des Marées & Évaluation Contextuelle

- **Date :** 21 Octobre 2026
- **Projet :** Le Copilote Contextuel du Golfe du Morbihan
- **Sous-Projet :** Bloc 2 — Moteur Mathématique des Marées, Modèle Hybride des Passages Submersibles & Évaluation Contextuelle
- **Statut :** Validé — Prêt pour implémentation

---

## 1. Objectifs & Périmètre

Le Bloc 2 constitue le cœur décisionnel du copilote ("Right Here, Right Now"). Il produit des fonctions métier 100 % pures, déterministes, ultra-performantes (< 0.1 ms par calcul) et sans dépendance externe, exécutables indifféremment côté serveur (RSC, Route Handlers, Cron) ou côté client (PWA, Web Workers, composants React).

Ses responsabilités principales sont :
1. **Moteur mathématique des marées (`src/lib/tide-engine.ts`)** :
   - Interpolation continue de la hauteur d'eau à la minute près par la **Règle des Douzièmes** entre deux marées successives officielles du SHOM (Pleine Mer / Basse Mer).
   - Détection des phases marégraphiques : Flot (`FLOOD`), Jusant (`EBB`), Étales (`SLACK_HIGH`, `SLACK_LOW`).
   - Gestion des ports de référence du Golfe : `PORT_NAVALO` (façade océanique et entrée) et `VANNES` (fond de golfe avec retard d'environ 1h30 à 2h).
2. **Modèle hybride pour les passages submersibles (Berder & Tascon)** :
   - **Priorité aux horaires officiels** : Si un créneau publié par une autorité locale (ex. Mairie de Larmor-Baden) est fourni, le moteur l'utilise directement.
   - **Calcul de repli (Fallback)** : En l'absence d'horaires officiels enregistrés, le moteur calcule la fenêtre de passage à partir des marées SHOM et du seuil altimétrique de submersion.
   - Calcul du statut (`OPEN`, `CLOSING_SOON`, `CLOSED`, `OPENING_SOON`), du compte à rebours dynamique, et émission des alertes de sécurité (ex. courant de la Jument au début du flot).
3. **Moteur d'évaluation contextuelle (`src/lib/context-matcher.ts`)** :
   - Croisement en mémoire des caractéristiques d'un lieu avec l'état de marée instantané et les conditions météo (vent, pluie).
   - Génération d'un score (0 à 100), d'un badge de recommandation (`IDEAL`, `WARNING`, `UNSUITABLE`), et de justifications textuelles lisibles pour l'utilisateur.

---

## 2. Architecture Technique & Types de Données

### 2.1 Organisation des Fichiers

```text
src/
├── lib/
│   ├── tide-engine.ts           # Règle des douzièmes, phases, compte à rebours & passages
│   ├── context-matcher.ts       # Évaluation contextuelle, pondération du score, badges
│   └── types/
│       └── context.ts           # Types TypeScript partagés pour marées, météo et évaluation
tests/
├── tide-engine.test.ts          # Tests unitaires marées, interpolation, cas Berder officiel/fallback
└── context-matcher.test.ts      # Tests unitaires scoring contextuel, baignade, vent, pluie
```

### 2.2 Définition des Types (`src/lib/types/context.ts`)

```typescript
export type TidalPhase = 'FLOOD' | 'EBB' | 'SLACK_HIGH' | 'SLACK_LOW';
export type PassageStatusKind = 'OPEN' | 'CLOSING_SOON' | 'CLOSED' | 'OPENING_SOON';
export type ContextBadge = 'IDEAL' | 'WARNING' | 'UNSUITABLE';

/** Données d'un événement marégraphique officiel SHOM */
export interface TidePoint {
  harbor: 'PORT_NAVALO' | 'VANNES';
  eventType: 'HIGH' | 'LOW';
  eventTimestamp: Date;
  heightMeters: number;
  coefficient?: number | null;
}

/** État instantané de la marée calculé pour un port */
export interface TideStatus {
  harbor: 'PORT_NAVALO' | 'VANNES';
  timestamp: Date;
  waterHeightMeters: number;
  phase: TidalPhase;
  coefficient: number;
  previousEvent: TidePoint;
  nextEvent: TidePoint;
  minutesToNextEvent: number;
  tidalRangeMeters: number; // Marnage M
}

/** Créneau officiel de praticabilité d'un passage submersible */
export interface OfficialPassageWindow {
  passageSlug: string;
  openAt: Date;
  closeAt: Date;
  source?: string;
}

/** Statut temps réel d'un passage submersible */
export interface PassageStatus {
  slug: string;
  name: string;
  isOpen: boolean;
  status: PassageStatusKind;
  minutesRemaining: number;
  source: 'OFFICIAL' | 'CALCULATED_FALLBACK';
  window: {
    start: Date;
    end: Date;
  };
  hazardNotice?: string;
}

/** Instantané météo d'un secteur */
export interface WeatherContext {
  sector: string;
  tempCelsius: number;
  windSpeedKnots: number;
  windDirectionDeg: number;
  windCardinal: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
  weatherCode: number;
  isRaining: boolean;
}

/** Résultat de l'évaluation contextuelle d'un lieu */
export interface ContextEvaluationResult {
  placeSlug: string;
  badge: ContextBadge;
  score: number; // Normalisé entre 0 et 100
  titleReason: string;
  reasons: string[];
  isSheltered: boolean;
  tideContext?: {
    harbor: 'PORT_NAVALO' | 'VANNES';
    waterHeightMeters: number;
    phase: TidalPhase;
  };
  passageContext?: PassageStatus;
}
```

---

## 3. Spécification Mathématique du Moteur de Marée (`tide-engine.ts`)

### 3.1 La Règle des Douzièmes continue

Soit une marée encadrée par deux extrema consécutifs $P_1(t_1, H_1)$ et $P_2(t_2, H_2)$ :
- **Durée totale de la marée :** $T = t_2 - t_1$ (en millisecondes ou minutes).
- **Marnage :** $M = |H_2 - H_1|$.
- **Progression temporelle normalisée :** $p = \frac{t - t_1}{T}$, avec $p \in [0, 1]$.
- **Heure marégraphique :** $h(p) = p \times 6$, indice d'intervalle $k = \lfloor h(p) \rfloor \in \{0, 1, 2, 3, 4, 5\}$.
- **Fraction intra-intervalle :** $\delta = h(p) - k \in [0, 1)$.

La fraction cumulée des douzièmes $F(k)$ aux bornes d'heures marégraphiques est :
- $F(0) = 0$
- $F(1) = 1/12 \approx 0.0833$
- $F(2) = 3/12 = 0.25$
- $F(3) = 6/12 = 0.50$
- $F(4) = 9/12 = 0.75$
- $F(5) = 11/12 \approx 0.9167$
- $F(6) = 12/12 = 1.00$

Par interpolation linéaire continue entre $F(k)$ et $F(k+1)$ :
$$F(h) = F(k) + \delta \times (F(k+1) - F(k))$$

La hauteur d'eau à l'instant $t$ vaut :
- **Si Flot (Montante, $H_1 < H_2$) :** $H(t) = H_1 + M \times F(h)$
- **Si Jusant (Descendante, $H_1 > H_2$) :** $H(t) = H_1 - M \times F(h)$

### 3.2 Détection des Phases & Étales

- Si $|t - t_{\text{HIGH}}| \le 20\text{ min}$ $\to$ `SLACK_HIGH` (Étale de pleine mer).
- Si $|t - t_{\text{LOW}}| \le 20\text{ min}$ $\to$ `SLACK_LOW` (Étale de basse mer).
- Hors période d'étale :
  - Si marée entre BM et PM $\to$ `FLOOD`.
  - Si marée entre PM et BM $\to$ `EBB`.

### 3.3 Résolution des Ports de Référence

Le port de marée est attribué selon la commune ou le secteur géographique :
- **`PORT_NAVALO`** : Arzon, Port-Navalo, Saint-Gildas-de-Rhuys, Quiberon, Saint-Pierre-Quiberon, Plouhinec, Étel, Belz, Erdeven, Locmariaquer.
- **`VANNES`** : Vannes, Séné, Arradon, Baden, Larmor-Baden, Saint-Armel, Sarzeau côté Golfe, Île-aux-Moines, Île d'Arz.

---

## 4. Spécification des Passages Submersibles (Berder & Tascon)

### 4.1 Logique Hybride (Priorité Officielle + Fallback)

1. **Recherche de créneau officiel :**
   La fonction `evaluatePassageStatus` reçoit optionnellement une liste de créneaux officiels `officialWindows`.
   Si un créneau existe pour le passage et englobe ou borde la date cible :
   - Source = `'OFFICIAL'`.
   - `isOpen` = $t \in [\text{openAt}, \text{closeAt}]$.
   - `minutesRemaining` = temps avant fermeture si ouvert, ou temps avant ouverture si fermé.
2. **Fallback algorithmique :**
   Si aucun créneau officiel n'est fourni :
   - Source = `'CALCULATED_FALLBACK'`.
   - Utilisation des règles hydrographiques de référence :
     - **Île de Berder** : Seuil critique de chaussée $H_{\text{seuil}} = 1.30\text{ m}$. Le passage est ouvert tant que $H(t) \le 1.30\text{ m}$ (ou dans la plage $\text{BM} \pm 2\text{h}$ pondérée par le coefficient si seule la plage horaire est disponible).
     - **Île Tascon** : Seuil critique $H_{\text{seuil}} = 1.50\text{ m}$ ($\text{BM} \pm 2\text{h}$).
   - Les heures précises d'ouverture $t_{\text{open}}$ et fermeture $t_{\text{close}}$ sont calculées par inversion de la règle des douzièmes sur le seuil $H_{\text{seuil}}$.

### 4.2 Découpage des Statuts & Alertes

- **`OPEN`** : Ouvert et praticable au sec, avec plus de 30 minutes avant fermeture.
- **`CLOSING_SOON`** : Ouvert mais fermeture dans moins de 30 minutes $\to$ alerte de vigilance immédiate requérant de regagner le continent.
- **`CLOSED`** : Chaussée submergée par les eaux, plus de 30 minutes avant réouverture.
- **`OPENING_SOON`** : Fermé mais ouverture imminente dans moins de 30 minutes.
- **Alerte de sécurité Courant de la Jument (Berder)** :
  Dès que la marée passe en phase montante (`FLOOD`), une mention de danger est ajoutée :
  > *"Attention : violent courant de la Jument au flot. Ne traversez sous aucun prétexte avec de l'eau sur la chaussée."*

---

## 5. Spécification de l'Évaluation Contextuelle (`context-matcher.ts`)

### 5.1 Barème de Pondération (0 à 100)

Score de base : **50 points**.

1. **Contraintes de Marée :**
   - **`HIGH_TIDE_ONLY`** (ex: Toulindac) :
     - Si à $\le 2\text{h}30$ de la PM : **+35 pts** (*"Baignade optimale — marée haute"*).
     - Si entre $2\text{h}30$ et $3\text{h}30$ de la PM : **+10 pts** (*"Baignade praticable"*).
     - Si marée basse (> $3\text{h}30$ de la PM) : **-35 pts** (*"Baignade déconseillée — estran découvert / vase"*).
   - **`LOW_TIDE_ONLY`** (ex: Berder, Tascon, pêche à pied) :
     - Si passage ouvert (`OPEN`) : **+40 pts** (*"Passage ouvert au sec"*).
     - Si fermeture imminente (`CLOSING_SOON`) : **0 pt** et badge `WARNING` forcé (*"⚠️ Fermeture imminente du passage"*).
     - Si submergé (`CLOSED`) : **-50 pts** et badge `UNSUITABLE` forcé (*"Passage submergé"*).
   - **`MID_TIDE_FLOW`** (Courant de la Jument) :
     - Si à mi-marée (entre 1h30 et 4h30 après la PM ou la BM) : **+35 pts** (*"Courant marin spectaculaire"*).
     - Si étale de marée : **-20 pts** (*"Courant calme / peu visible"*).
   - **`ALL_TIDES`** : **+20 pts** (praticable en toute circonstance).

2. **Vent et Abri :**
   - Si la direction actuelle du vent figure dans `shelteredFromWindDirections` : **+15 pts**, `isSheltered = true` (*"Abrité du vent de [secteur]"*).
   - Si vent > 20 nœuds et site exposé : **-20 pts** (*"Zone exposée au vent fort"*).

3. **Pluie et Intempéries :**
   - Si `isRaining === true` :
     - Si `rainFriendly === true` : **+30 pts** (*"Idéal par temps de pluie (visite abritée)"*).
     - Si `rainFriendly === false` : **-30 pts** (*"Activité de plein air déconseillée sous la pluie"*).

### 5.2 Seuil des Badges
- **`IDEAL`** : Score $\ge 70$, aucune condition d'exclusion.
- **`WARNING`** : Score entre 40 et 69, OU fermeture imminente de passage, OU vent fort non abrité.
- **`UNSUITABLE`** : Score $< 40$, OU passage submersible submergé, OU marée basse sur site `HIGH_TIDE_ONLY`.

---

## 6. Plan de Test & Vérification

La suite de tests unitaires exécutée via `npm test` testera rigoureusement :
1. **Marées & Interpolation (`tests/tide-engine.test.ts`) :**
   - Précision mathématique aux bornes des 6 heures marégraphiques.
   - Monotonie stricte de la fonction de hauteur d'eau pendant le flot et le jusant.
   - Respect des marées de vives-eaux (coefficient 115) et de mortes-eaux (coefficient 35).
   - Décalage horaire Vannes vs Port-Navalo.
   - Chevauchement de minuit et transitions cycliques 48h.
2. **Passages Submersibles :**
   - Détection prioritaire du créneau officiel.
   - Bascule automatique en mode calculé si absence d'horaire officiel.
   - Compte à rebours exact et transition des statuts.
3. **Context Matcher (`tests/context-matcher.test.ts`) :**
   - Évaluation de Toulindac (Haute mer vs Basse mer).
   - Évaluation de Berder (Ouvert vs Fermé).
   - Abri au vent (Nord-Ouest à Arradon).
   - Journée de pluie (Suscinio promu vs sentier pénalisé).
   - Temps d'exécution : 1 000 évaluations en moins de 10 ms.
