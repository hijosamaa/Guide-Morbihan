/**
 * Détecteur dynamique de déviation avec filtrage d'accuracy et hystérésis.
 * Conçu pour la navigation GPS outdoor (randonnée GR34, sentiers côtiers).
 */

export interface DeviationStatus {
  /** Indique si l'utilisateur est confirmé hors sentier (> seuil pendant au moins 10s) */
  isOffTrack: boolean;
  /** Indique si le signal GPS est trop incertain (> 40m) pour déclencher une alerte fiable */
  isDegradedGps: boolean;
  /** Seuil actuel de déviation en mètres (max(35m, 1.5 * accuracy)) */
  currentThresholdMeters: number;
  /** Message d'état informatif ou d'avertissement */
  message: string;
}

export class DeviationDetector {
  private isCurrentlyOffTrack = false;
  private offTrackStartTimeMs: number | null = null;
  private readonly defaultBaseThresholdMeters = 35;
  private readonly resetHysteresisThresholdMeters = 20;
  private readonly requiredDurationMs = 10000;
  private readonly accuracyDegradedCutoffMeters = 40;

  /**
   * Évalue l'état de déviation par rapport à la trace.
   *
   * @param crossTrackMeters Distance orthogonale calculée par rapport au tracé (en mètres).
   * @param accuracyMeters Précision GPS rapportée par l'appareil (en mètres).
   * @param nowMs Horodatage de la mesure (en millisecondes).
   * @returns L'état de déviation actuel et les métriques associées.
   */
  public evaluate(crossTrackMeters: number, accuracyMeters: number, nowMs: number): DeviationStatus {
    // Si la précision GPS est dégradée au-delà de 40m, inhiber l'alerte
    if (accuracyMeters > this.accuracyDegradedCutoffMeters) {
      this.offTrackStartTimeMs = null;
      return {
        isOffTrack: false,
        isDegradedGps: true,
        currentThresholdMeters: Math.max(this.defaultBaseThresholdMeters, 1.5 * accuracyMeters),
        message: 'Signal GPS dégradé (±' + Math.round(accuracyMeters) + 'm). Alerte suspendue.',
      };
    }

    const effectiveThreshold = Math.max(this.defaultBaseThresholdMeters, 1.5 * accuracyMeters);

    if (this.isCurrentlyOffTrack) {
      // Hystérésis : ne s'éteint que sous 20m
      if (crossTrackMeters <= this.resetHysteresisThresholdMeters) {
        this.isCurrentlyOffTrack = false;
        this.offTrackStartTimeMs = null;
        return {
          isOffTrack: false,
          isDegradedGps: false,
          currentThresholdMeters: effectiveThreshold,
          message: 'De retour sur le tracé.',
        };
      } else {
        return {
          isOffTrack: true,
          isDegradedGps: false,
          currentThresholdMeters: effectiveThreshold,
          message: `Écart du sentier : ${Math.round(crossTrackMeters)} m`,
        };
      }
    }

    // Pas encore en alerte confirmée
    if (crossTrackMeters > effectiveThreshold) {
      if (this.offTrackStartTimeMs === null) {
        this.offTrackStartTimeMs = nowMs;
      } else if (nowMs - this.offTrackStartTimeMs >= this.requiredDurationMs) {
        this.isCurrentlyOffTrack = true;
      }
    } else {
      this.offTrackStartTimeMs = null;
    }

    return {
      isOffTrack: this.isCurrentlyOffTrack,
      isDegradedGps: false,
      currentThresholdMeters: effectiveThreshold,
      message: this.isCurrentlyOffTrack
        ? `Écart du sentier : ${Math.round(crossTrackMeters)} m`
        : 'Sur le tracé',
    };
  }

  /**
   * Réinitialise complètement l'état du détecteur (ex: changement d'itinéraire).
   */
  public reset(): void {
    this.isCurrentlyOffTrack = false;
    this.offTrackStartTimeMs = null;
  }
}
