import { getMarkerStyleTokens } from '@/lib/map-utils';
import type { PlaceMarkerData } from '@/lib/types/map';

export interface MarkerDescriptor {
  role: string;
  tabIndex: number;
  ariaLabel: string;
  className: string;
  title: string;
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'IDEAL':
      return 'Idéal aux marées actuelles';
    case 'WARNING':
      return 'Vigilance marée ou météo';
    case 'DISCOURAGED':
      return 'Déconseillé actuellement';
    case 'SPONSORED':
      return 'Recommandation partenaire';
    default:
      return status;
  }
}

export function createMarkerDescriptor(place: PlaceMarkerData, isSelected = false): MarkerDescriptor {
  const tokens = getMarkerStyleTokens(place.status, place.isSponsored);
  const statusLabel = getStatusLabel(place.isSponsored ? 'SPONSORED' : place.status);

  const baseClasses =
    'relative cursor-pointer transition-all duration-200 transform select-none rounded-full flex items-center justify-center p-2 focus:outline-none';
  const selectionClasses = isSelected
    ? 'scale-125 z-50 ring-4 ring-sky-500 shadow-xl'
    : 'hover:scale-110 shadow-md';

  const fullClasses = `${baseClasses} ${tokens.badgeClass} ${selectionClasses}`;

  return {
    role: 'button',
    tabIndex: 0,
    ariaLabel: `${place.name} — Statut : ${statusLabel}`,
    title: place.name,
    className: fullClasses,
  };
}

/**
 * Creates an actual DOM Element to pass into maplibregl.Marker({ element })
 */
export function createPlaceMarkerElement(
  place: PlaceMarkerData,
  isSelected: boolean,
  onClick: (place: PlaceMarkerData) => void
): HTMLDivElement {
  const descriptor = createMarkerDescriptor(place, isSelected);

  const el = document.createElement('div');
  el.className = descriptor.className;
  el.setAttribute('role', descriptor.role);
  el.setAttribute('tabindex', descriptor.tabIndex.toString());
  el.setAttribute('aria-label', descriptor.ariaLabel);
  el.title = descriptor.title;

  // Inner pin icon or dot
  const dot = document.createElement('span');
  dot.className = 'w-3 h-3 rounded-full bg-white shadow-sm block';
  el.appendChild(dot);

  const trigger = (e: Event) => {
    e.stopPropagation();
    onClick(place);
  };

  el.addEventListener('click', trigger);
  el.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      trigger(e);
    }
  });

  return el;
}
