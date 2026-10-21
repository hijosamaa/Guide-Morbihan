# Le Copilote Contextuel du Golfe du Morbihan

Webapp PWA et moteur de décision touristique en temps réel ("Right Here, Right Now") pour le Golfe du Morbihan.

L'application croise en direct la géolocalisation, les horaires et hauteurs de marées (règle des douzièmes), l'orientation du vent et la météo pour recommander instantanément les plages praticables, les passages submersibles (Berder, Tascon), les sentiers côtiers (GR34) et les points d'intérêt abrités.

## Documentation du Projet

- 📄 **Cahier des Charges Complet & PRD Technique :** [CAHIER_DES_CHARGES.md](./CAHIER_DES_CHARGES.md)

## Architecture & Stack

- **Framework :** Next.js 15+ (App Router, TypeScript strict, standalone output)
- **Base de données & Spatial :** PostgreSQL 16 + PostGIS via Drizzle ORM
- **Cartographie :** MapLibre GL JS (WebGL 60 FPS) + Tuiles vectorielles OpenFreeMap / PMTiles
- **Moteur Météo & Marées :** Open-Meteo (modèle AROME Météo-France) + Algorithme interne Règle des Douzièmes
- **Déploiement :** Zéro lock-in (Vercel Hobby en phase 1, VPS Docker / Coolify en phase 2)
