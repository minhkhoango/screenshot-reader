import { ExtensionAction } from './types';
import type { ExtensionMessage, MessageResponse, StorageSchema } from './types';

// For type safety and easy to change from session -> local
const storage = {
  set: (items: Partial<StorageSchema>) => chrome.storage.session.set(items),
};

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  try {
    const dataUrl: string = await chrome.tabs.captureVisibleTab({
      format: 'png',
    });
    await storage.set({ capturedImage: dataUrl });

    await ensureContentScriptLoaded(tab.id);

    const message: ExtensionMessage = {
      action: ExtensionAction.ACTIVATE_OVERLAY,
    };
    const response = await sendMessageToTab(tab.id, message);

    if (response.status !== 'ok') {
      console.warn('Overlay failed:', response.message);
    }
  } catch (err) {
    console.error('Background workflow error:', err);
  }
});

async function ensureContentScriptLoaded(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { action: ExtensionAction.PING });
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
  (
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
