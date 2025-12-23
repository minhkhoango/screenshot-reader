/**
 * Global Constants
 * Single source of truth for magic strings, colors, and configuration.
 */

export const OVERLAY_ID = 'xr-screenshot-reader-host';

// Ensures we are on top of almost everything.
export const Z_INDEX_MAX = '2147483647';

export const COLORS = {
  OVERLAY_BG: 'rgba(0, 0, 0, 0.3)',
  SELECTION_BORDER: '#ffffff',
  CROSSHAIR: 'crosshair',
} as const;

// Minimum pixels to trigger a captur
export const CONFIG = {
  MIN_SELECTION_ZX: 5,
  MIN_SELECTION_ZY: 5,
} as const;
