import { ExtensionAction } from './types';
import type {
  ExtensionMessage,
  MessageResponse,
  CropReadyPayload,
  OcrResultPayload,
} from './types';
import { GhostOverlay } from './overlay';
import { FloatingIsland } from './island';

// State Management
let activeOverlay: GhostOverlay | null = null;
let activeIsland: FloatingIsland | null = null;

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    switch (message.action) {
      case ExtensionAction.PING_CONTENT:
        if (activeIsland) activeIsland.destroy();
        sendResponse({ status: 'ok' });
        break;

      case ExtensionAction.ACTIVATE_OVERLAY:
        if (activeOverlay) activeOverlay.destroy();
        if (activeIsland) activeIsland.destroy();
        activeOverlay = new GhostOverlay();
        activeOverlay.mount();
        activeOverlay.activate();
        sendResponse({ status: 'ok' });
        break;

      case ExtensionAction.CROP_READY:
        handleCropReady(message.payload);
        sendResponse({ status: 'ok' });
        break;

      case ExtensionAction.OCR_RESULT:
        handleOcrResult(message.payload);
        sendResponse({ status: 'ok' });
        break;
    }
    return false;
  }
);

function handleCropReady(payload: CropReadyPayload): void {
  if (activeIsland) activeIsland.destroy();

  activeIsland = new FloatingIsland(
    payload.cursorPosition,
    payload.croppedImageUrl
  );
  activeIsland.mount();
}

function handleOcrResult(payload: OcrResultPayload): void {
  if (activeIsland) {
    // Update existing island with result (preserves position/drag state)
    activeIsland.updateWithResult(payload);
  } else {
    // Fallback: create island if somehow missing
    activeIsland = new FloatingIsland(
      payload.cursorPosition,
      payload.croppedImageUrl
    );
    activeIsland.mount();
    activeIsland.updateWithResult(payload);
  }
}
