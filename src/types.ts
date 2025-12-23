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
  PING: 'PING',
};

export type ExtensionAction =
  (typeof ExtensionAction)[keyof typeof ExtensionAction];

export type ExtensionMessage =
  | { action: typeof ExtensionAction.ACTIVATE_OVERLAY }
  | { action: typeof ExtensionAction.CAPTURE_SUCCESS; payload: SelectionRect }
  | { action: typeof ExtensionAction.PING };

export interface MessageResponse {
  status: 'ok' | 'error';
  message?: string;
  data?: unknown;
}

export interface StorageSchema {
  capturedImage: string;
  lastSelection?: SelectionRect;
}
