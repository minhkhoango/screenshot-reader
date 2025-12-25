import { ExtensionAction } from './types';
import type { ExtensionMessage, MessageResponse } from './types';

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;
  if (tab.url.startsWith('chrome://')) {
    console.log('Protected site, backup method needed');
    return;
  }

  try {
    // Capture a full screenshot
    const dataUrl: string = await chrome.tabs.captureVisibleTab({
      format: 'png',
    });
    await chrome.storage.session.set({ capturedImage: dataUrl });

    // start the UI
    await ensureContentScriptLoaded(tab.id);
    const overlayMessage: ExtensionMessage = {
      action: ExtensionAction.ACTIVATE_OVERLAY,
    };
    const overlayResponse = await sendMessageToTab(tab.id, overlayMessage);
    if (overlayResponse.status !== 'ok') {
      console.warn('Overlay failed:', overlayResponse.message);
    }

    // warm up the offscreen engine
    await setupOffscreenDocument('offscreen.html');
  } catch (err) {
    console.error('Background workflow error:', err);
  }
});

// Routing messages across scripts
chrome.runtime.onMessage.addListener(
  async (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    _sendResponse: (response: MessageResponse) => void
  ) => {
    switch (message.action) {
      case ExtensionAction.CAPTURE_SUCCESS: {
        console.log('Captured selection:', message.payload);

        const raw = await chrome.storage.session.get('capturedImage');
        const capturedImage =
          typeof raw.capturedImage === 'string' ? raw.capturedImage : undefined;

        if (!capturedImage) {
          console.error('No image found in storage');
          return;
        }

        try {
          const ocrResult = await chrome.runtime.sendMessage<
            ExtensionMessage,
            MessageResponse
          >({
            action: ExtensionAction.PERFORM_OCR,
            payload: {
              imageDataUrl: capturedImage,
              rect: message.payload,
            },
          });

          console.log('Background received OCR result:', ocrResult);
        } catch (err) {
          console.error('Offscreen communication failed:', err);
        }
        break;
      }
    }
    return true; // keep chanel open
  }
);

async function ensureContentScriptLoaded(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: ExtensionAction.PING_CONTENT,
    });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  }
}

async function sendMessageToTab(
  tabId: number,
  message: ExtensionMessage
): Promise<MessageResponse> {
  try {
    return await chrome.tabs.sendMessage<ExtensionMessage, MessageResponse>(
      tabId,
      message
    );
  } catch (err) {
    return { status: 'error', message: (err as Error).message };
  }
}

let creatingOffscreenPromise: Promise<void> | null = null;

async function setupOffscreenDocument(path: string): Promise<void> {
  // Check if offscreen document exists
  const offscreenDocConext = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(path)],
  });

  if (offscreenDocConext.length > 0) return;

  if (creatingOffscreenPromise) {
    await creatingOffscreenPromise;
    return;
  }

  // Creating the document if doesn't exist
  creatingOffscreenPromise = chrome.offscreen.createDocument({
    url: path,
    reasons: [chrome.offscreen.Reason.BLOBS],
    justification: 'Processing screenshot image data for OCR',
  });

  await creatingOffscreenPromise;
  creatingOffscreenPromise = null;
}
