/**
 * @fileoverview Moteur de suivi de progression le long d'une trace GPX.
 *
 * Implémente une recherche à deux niveaux (Two-Tier Search) :
 * 1. Étage 1 (rapide / O(1) amorti) : fenêtre glissante locale autour du dernier segment connu [i - 3, i + 10].
 * 2. Étage 2 (robuste / O(N)) : fallback global sur tous les segments si l'écart orthogonal dépasse 60 mètres.
 *
 * Gère également le verrouillage au départ (departure locking) pour les parcours en boucle fermée,
 * empêchant l'accrochage prématuré aux segments d'arrivée lorsque l'utilisateur se trouve sur la ligne de départ.
 */

import { projectPointOnSegment } from './projection';
import { haversineDistanceKm } from '../utils/geo';

/**
 * Options de configuration pour le suivi de progression.
 */
export interface ProgressTrackerOptions {
  /** Indique si le tracé forme une boucle fermée (départ ≈ arrivée) */
  isLoop?: boolean;
}

/**
 * Instantané de l'état de progression de l'utilisateur sur le tracé.
 */
export interface ProgressSnapshot {
  /** Index du segment actif le plus proche [0 .. segmentCount - 1] */
  currentSegmentIndex: number;
  /** Coordonnées projetées [longitude, latitude] sur le tracé */
  nearestPoint: [number, number];
  /** Écart orthogonal en mètres entre la position de l'utilisateur et la trace */
  crossTrackDistanceMeters: number;
  /** Distance cumulée parcourue le long du tracé en kilomètres */
  distanceAlongTrackKm: number;
  /** Distance restante jusqu'à l'arrivée en kilomètres */
  remainingDistanceKm: number;
  /** Ratio d'avancement normalisé entre 0 et 1 */
  progressRatio: number;
  /** Indique si l'utilisateur a franchi l'arrivée (>85% tracé et <25m de la fin) */
  isCompleted: boolean;
}

/**
 * Moteur de calcul de progression le long d'une polyligne GPX.
 */
export class TrackProgressTracker {
  private readonly coords: readonly [number, number][];
  private readonly isLoop: boolean;
  private readonly cumulativeDistancesKm: number[] = [0];
  private totalDistanceKm = 0;
  private lastSegmentIndex = 0;
  private isCompleted = false;

  /**
   * Initialise le traqueur avec la suite de points de la trace.
   *
   * @param coords - Liste ordonnée de coordonnées [longitude, latitude] (au moins 2 points)
   * @param options - Options de configuration (ex: isLoop)
   * @throws Error si coords contient moins de 2 points
   */
  constructor(coords: [number, number][], options: ProgressTrackerOptions = {}) {
    if (coords.length < 2) {
      throw new Error('Track must contain at least 2 points');
    }
    this.coords = coords;
    this.isLoop = options.isLoop ?? false;

    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      const segmentDist = haversineDistanceKm(prev[1], prev[0], curr[1], curr[0]);
      this.totalDistanceKm += segmentDist;
      this.cumulativeDistancesKm.push(this.totalDistanceKm);
    }
  }

  /**
   * Retourne le nombre total de segments composant le tracé (coords.length - 1).
   */
  public getSegmentCount(): number {
    return this.coords.length - 1;
  }

  /**
   * Retourne la longueur totale du tracé en kilomètres.
   */
  public getTotalDistanceKm(): number {
    return this.totalDistanceKm;
  }

  /**
   * Met à jour la position de l'utilisateur et calcule l'instantané de progression.
   *
   * @param userCoord - Position GPS actuelle de l'utilisateur [longitude, latitude]
   * @returns Instantané de progression incluant distances, projection et ratio
   */
  public updatePosition(userCoord: [number, number]): ProgressSnapshot {
    const segCount = this.getSegmentCount();

    // Étage 1 : Fenêtre glissante locale [last - 3, last + 10]
    const minStart = Math.max(0, this.lastSegmentIndex - 3);
    let maxEnd = Math.min(segCount - 1, this.lastSegmentIndex + 10);

    // Garde-fou boucle : si on vient de partir (< 20% du tracé), interdire les 20 derniers %
    if (this.isLoop && this.lastSegmentIndex < segCount * 0.2) {
      maxEnd = Math.min(maxEnd, Math.floor(segCount * 0.8));
    }

    let bestSegment = this.lastSegmentIndex;
    let bestProj = projectPointOnSegment(
      userCoord,
      this.coords[bestSegment] as [number, number],
      this.coords[bestSegment + 1] as [number, number]
    );

    for (let i = minStart; i <= maxEnd; i++) {
      const proj = projectPointOnSegment(
        userCoord,
        this.coords[i] as [number, number],
        this.coords[i + 1] as [number, number]
      );
      if (proj.crossTrackDistanceMeters < bestProj.crossTrackDistanceMeters) {
        bestProj = proj;
        bestSegment = i;
      }
    }

    // Étage 2 : Fallback global si l'écart dépasse 60m
    if (bestProj.crossTrackDistanceMeters > 60) {
      for (let i = 0; i < segCount; i++) {
        // En boucle de départ, ignorer la fin pour éviter d'accrocher l'arrivée
        if (this.isLoop && this.lastSegmentIndex < segCount * 0.2 && i > segCount * 0.8) {
          continue;
        }
        const proj = projectPointOnSegment(
          userCoord,
          this.coords[i] as [number, number],
          this.coords[i + 1] as [number, number]
        );
        if (proj.crossTrackDistanceMeters < bestProj.crossTrackDistanceMeters) {
          bestProj = proj;
          bestSegment = i;
        }
      }
    }

    this.lastSegmentIndex = bestSegment;

    // Calcul de la distance le long du tracé
    const segmentStartDistKm = this.cumulativeDistancesKm[bestSegment];
    const segmentTotalDistKm = this.cumulativeDistancesKm[bestSegment + 1] - segmentStartDistKm;
    const distanceAlongTrackKm = segmentStartDistKm + bestProj.t * segmentTotalDistKm;
    const remainingDistanceKm = Math.max(0, this.totalDistanceKm - distanceAlongTrackKm);
    const progressRatio =
      this.totalDistanceKm > 0
        ? Math.min(1, Math.max(0, distanceAlongTrackKm / this.totalDistanceKm))
        : 0;

    // Arrivée détectée si on est à moins de 25m de la fin et au moins 85% de la trace faite
    if (remainingDistanceKm < 0.025 && progressRatio > 0.85) {
      this.isCompleted = true;
    }

    return {
      currentSegmentIndex: bestSegment,
      nearestPoint: bestProj.projected,
      crossTrackDistanceMeters: Math.round(bestProj.crossTrackDistanceMeters * 10) / 10,
      distanceAlongTrackKm: Math.round(distanceAlongTrackKm * 100) / 100,
      remainingDistanceKm: Math.round(remainingDistanceKm * 100) / 100,
      progressRatio: Math.round(progressRatio * 1000) / 1000,
      isCompleted: this.isCompleted,
    };
  }
}
