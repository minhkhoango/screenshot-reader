import { OCR } from './constants';
import { ExtensionAction } from './types';
import type { ExtensionMessage, MessageResponse, SelectionRect } from './types';

chrome.runtime.onMessage.addListener(
  async (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    switch (message.action) {
      case ExtensionAction.PING_OFFSCREEN:
        sendResponse({ status: 'ok', message: 'pong' });
        break;

      case ExtensionAction.PERFORM_OCR:
        const { imageDataUrl, rect } = message.payload;
        console.log(
          `[Offscreen] Processing ${rect.width}x${rect.height} region`
        );

        try {
          // TO DO LIST HERE
        } catch (err) {
          console.error('[Offscreen] Error:', err);
          sendResponse({ status: 'error', message: (err as Error).message });
        }
        break;
    }

    return true; // Keep channel open
  }
);

// Previous cropImage from tesseract engine, useful?
async function cropImage(
  dataUrl: string,
  rect: SelectionRect
): Promise<string> {
  const img = new Image();

  // wait for image to load from dataUrl
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context failed');
  }

  canvas.width = rect.width;
  canvas.height = rect.height;

  ctx.drawImage(
    img, // source image
    // 1-4: what to copy
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    // where & how to draw it
    0,
    0,
    rect.width,
    rect.height
  );

  return canvas.toDataURL(OCR.CROP_MIME);
}
