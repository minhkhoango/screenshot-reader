/**
 * Shared Type Definitions
 */

export interface Point {
  x: number;
  y: number;
}

export interface Dimension {
  width: number;
  height: number;
}

export interface SelectionRect extends Point, Dimension {}

export const ExtensionAction = {
  ACTIVATE_OVERLAY: 'ACTIVATE_OVERLAY',
  CAPTURE_SUCCESS: 'CAPTURE_SUCCESS',
  PING_CONTENT: 'PING_CONTENT',
  PING_OFFSCREEN: 'PING_OFFSCREEN',
  PERFORM_OCR: 'PERFORM_OCR',
} as const;

export type ExtensionAction =
  (typeof ExtensionAction)[keyof typeof ExtensionAction];

export type ExtensionMessage =
  | { action: typeof ExtensionAction.ACTIVATE_OVERLAY }
  | { action: typeof ExtensionAction.CAPTURE_SUCCESS; payload: SelectionRect }
  | { action: typeof ExtensionAction.PING_CONTENT }
  | { action: typeof ExtensionAction.PING_OFFSCREEN }
  | {
      action: typeof ExtensionAction.PERFORM_OCR;
      payload: { imageDataUrl: string; rect: SelectionRect };
    };

export interface MessageResponse {
  status: 'ok' | 'error';
  message?: string;
  data?: SelectionRect;
}

export interface SessionStorage {
  capturedImage: string;
}
