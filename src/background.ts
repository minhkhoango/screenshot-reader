import { ExtensionAction } from './types';
import type { ExtensionMessage, MessageResponse, StorageSchema } from './types';

// For type safety and easy to change from session -> local
const storage = {
  set: (items: Partial<StorageSchema>) => chrome.storage.session.set(items),
};

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
    await storage.set({ capturedImage: dataUrl });

    // start the UI
    await ensureContentScriptLoaded(tab.id);
    const overlayMessage: ExtensionMessage = {
      action: ExtensionAction.ACTIVATE_OVERLAY,
    };

    const overlayResponse = await sendMessageToTab(tab.id, overlayMessage);

    if (overlayResponse.status !== 'ok') {
      console.warn('Overlay failed:', overlayResponse.message);
    } else {
      console.log('Overlay sucess');
    }

    // warm up the offscreen engine
    await setupOffscreenDocument('offscreen.html');

    try {
      const response = await chrome.runtime.sendMessage({
        action: ExtensionAction.PING_OFFSCREEN,
      });
      console.log('Offscreen engine ready:', response);
    } catch (e) {
      console.warn('Offscreen engine not responding:', e);
    }
  } catch (err) {
    console.error('Background workflow error:', err);
  }
});

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

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener(
  async (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    _sendResponse: (response: MessageResponse) => void
  ) => {
    if (
      message.action === ExtensionAction.CAPTURE_SUCCESS &&
      'payload' in message
    ) {
      console.log('Captured selection:', message.payload);
    }
    return false;
  }
);

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
