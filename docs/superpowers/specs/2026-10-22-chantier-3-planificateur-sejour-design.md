# Spécification Technique & Fonctionnelle Allégée
# Chantier 3 : Générateur d'Escapades & Séjours Intelligents (Morbihan)
**Statut :** Recadrage pragmatique validé  
**Date :** 2026-10-22  
**Focus :** 100 % Morbihan, zéro sur-ingénierie, valeur d'usage immédiate

---

## 1. Vision Produit & Proposition de Valeur

L'objectif n'est pas de concevoir un planning militaire heure par heure (9h30, 11h15, etc.) sur 7 jours, mais un **générateur d'escapades de vacances réaliste (1 à 3 jours)** qui résout les 3 vraies contraintes du Morbihan :

```
┌─────────────────────────────────────────────────────────────────┐
│        LES 3 CONTRAINTES DURES DU MOTEUR D'ESCAPADE             │
├─────────────────────────────────────────────────────────────────┤
│ 1. 🚗 ANTI-BOUCHONS  : 1 jour = 1 seul secteur géographique    │
│    (ex: J1 Presqu'île de Rhuys, J2 Cœur de Golfe Nord).         │
│    Ne JAMAIS faire traverser le goulet d'est en ouest le même   │
│    jour sous peine de 2h de bouchons.                           │
│                                                                 │
│ 2. 🌊 ANCRAGE MARÉE : Synchronisation obligatoire avec          │
│    tide-engine.ts.                                              │
│    • Marée basse l'après-midi ➔ passage de Berder ou pêche      │
│      à pied à ce moment exact.                                  │
│    • Marée haute ➔ baignade en fond de golfe ou crique abritée. │
│                                                                 │
│ 3. ☀️ BLOCS DE VIE SOUPLES : Pas d'horaires stressants.         │
│    Découpage de chaque journée en 4 temps naturels :            │
│    • Matinée iodée (balade / visite)                            │
│    • Pause Déjeuner (huîtres au chantier ou crêperie de port)   │
│    • Après-midi Marée (activité phare selon marée haute/basse)  │
│    • Fin de journée (terrasse abritée ou coucher de soleil)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Ce qui est abandonné vs Ce qui est conservé

| Éléments abandonnés (Sur-ingénierie) | Choix retenu (Pragmatisme) |
| :--- | :--- |
| ❌ Tables `territories` et `territory_clusters` | ✅ **0 modification disruptive** de la table `places`. On utilise directement le champ existant `sector` (`'Golfe'`, `'Presqu-ile de Rhuys'`, `'Presqu-ile de Quiberon'`, `'Ria d-Etel'`). |
| ❌ Planning rigide 09h30, 11h15, etc. | ✅ **4 blocs de vie naturels** : Matinée, Déjeuner, Après-midi, Fin de journée. |
| ❌ Séjours longs 7 jours | ✅ **Escapades 1 à 3 jours** (le cœur de cible week-end / court séjour du Morbihan). |
| ❌ Algorithmes de graphe complexes | ✅ **Moteur déterministe pur** en mémoire (< 15 ms), testable unitairement, zéro coût API. |

---

## 3. Données & Sources

Le moteur s'appuie directement sur les données déjà présentes dans le codebase :
* **Catalogue de Lieux** : table `places` et [`src/data/curated-spots.json`](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/src/data/curated-spots.json).
* **Moteur de Marée** : [`src/lib/tide-engine.ts`](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/src/lib/tide-engine.ts) (calcul des heures de PM/BM et état des passages de Berder/Tascon).
* **Évaluation Contextuelle** : [`src/lib/context-matcher.ts`](file:///Users/Moulitos/Documents/antigravity/Guide%20Morbihan/src/lib/context-matcher.ts) (`rainFriendly`, `strollerFriendly`, abri au vent).

---

## 4. Les 3 Fonctionnalités Clés

### 4.1. Wizard Express (3 questions / 15 secondes)
Composant mobile minimaliste sans friction :
1. **Point de chute / Hébergement** : Vannes & Golfe Nord, Presqu'île de Rhuys, Pays d'Auray, Quiberon & Carnac.
2. **Durée** : `1 jour` (escapade journée) ou `2-3 jours` (week-end prolongé).
3. **Profil** :
   * 👨‍👩‍👧 *Famille / Poussette* (`strollerFriendly: true`)
   * 🥾 *Balade & Nature sauvage* (chemins côtiers GR34, réserves)
   * 🦪 *Patrimoine, Huîtres & Flânerie* (mégalithes, chantiers ostréicoles, vieux ports)

### 4.2. Moteur d'Assemblage Déterministe (`src/lib/escapade-engine.ts`)
* **Attribution des jours** :
  * Jour 1 : Le secteur de l'hébergement choisi.
  * Jours 2 et 3 : Secteurs adjacents cohérents (ex: J1 Vannes $\rightarrow$ J2 Rhuys $\rightarrow$ J3 Auray). Jamais de saut Quiberon $\leftrightarrow$ Rhuys dans la même journée.
* **Ordonnancement des 4 blocs journaliers** :
  * `MOMENT_MATIN` : Balade ou site patrimonial adapté au profil.
  * `MOMENT_DEJEUNER` : Chantier ostréicole ou crêperie locale typique dans le secteur.
  * `MOMENT_APRES_MIDI` :
    * Si la marée basse tombe entre 13h et 17h $\rightarrow$ passage submersible (Berder/Tascon) ou pêche à pied.
    * Si la marée haute tombe l'après-midi $\rightarrow$ baignade en crique abritée du vent dominant.
  * `MOMENT_FIN_JOURNEE` : Coucher de soleil panoramique ou terrasse de port abritée.
* **Pool d'alternatives immédiates** : Chaque bloc conserve 2 spots alternatifs du même secteur pour le remplacement instantané.

### 4.3. Mode Météo 1-Clic (« ☔ Il pleut »)
* Un tap sur le bouton bascule instantanément tous les spots extérieurs de la journée vers des alternatives abritées (`rainFriendly: true`) : Château de Suscinio, Cairn de Gavrinis, Musée de Carnac, chantiers couverts, etc.

### 4.4. Bouton « 🔀 Remplacer ce spot »
* Ouvre un tiroir bas (`vaul`) présentant 2 alternatives éligibles dans le même secteur et créneau. La substitution est instantanée (0 ms).

---

## 5. Schéma de Persistance & Partage (`itineraries`)

Une seule table légère ajoutée à `src/db/schema.ts` uniquement pour le partage public par lien :

```typescript
export const itineraries = pgTable('itineraries', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 32 }).notNull().unique(), // ex: "escapade-rhuys-3j-a8f"
  title: varchar('title', { length: 255 }).notNull(),
  baseSector: varchar('base_sector', { length: 100 }).notNull(),
  durationDays: integer('duration_days').notNull(),
  escapadeData: jsonb('escapade_data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

* **Local par défaut** : Séjour stocké dans `localStorage` (`copilote_escapade`).
* **Partage externe** : Un clic génère `/escapade/[slug]` partageable sur WhatsApp/SMS.
