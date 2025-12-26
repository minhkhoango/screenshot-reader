/**
 * Global Constants
 * Single source of truth for magic strings, colors, and configuration.
 */

export const OVERLAY_ID = 'xr-screenshot-reader-host';

export const COLORS = {
  OVERLAY_BG: 'rgba(0, 0, 0, 0.3)',
  SELECTION_BORDER: '#ffffff',
  POINTER_CROSSHAIR: 'crosshair',
} as const;

// Minimum pixels to trigger a captur
export const CONFIG = {
  MIN_SELECTION_ZX: 5,
  MIN_SELECTION_ZY: 5,
} as const;

// Shared file and storage identifiers
export const FILES = {
  CONTENT_SCRIPT: 'content.js',
  OFFSCREEN_HTML: 'offscreen.html',
  OCR_WORKER: 'tesseract_engine/worker.min.js',
  OCR_CORE: 'tesseract_engine/tesseract-core-simd-lstm.wasm.js',
} as const;

export const STORAGE_KEYS = {
  CAPTURED_IMAGE: 'capturedImage',
} as const;

// OCR-related defaults
export const OCR = {
  CAPTURE_FORMAT: 'png',
  CROP_MIME: 'image/png',
  LANG: 'eng',
  OEM: 1,
  JUSTIFICATION: 'Processing screenshot image data for OCR',
  CACHE_METHOD: 'none',
  PROGRESS_STATUS: 'recognizing text',
} as const;

// UI control flags
export const UI = {
  CANVAS_LINE_WIDTH: 2,
  ESCAPE_KEY: 'Escape',
  POINTER_EVENTS_DISABLED: 'none',
  POINTER_EVENTS_ENABLED: 'auto',
  FULL_WIDTH: '100vw',
  FULL_HEIGHT: '100vh',
  Z_INDEX_MAX: '2147483647',
} as const;
