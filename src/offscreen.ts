import { ExtensionAction } from './types';
import type { ExtensionMessage, MessageResponse } from './types';

chrome.runtime.onMessage.addListener(
  async (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    if (message.action === ExtensionAction.PING_OFFSCREEN) {
      sendResponse({ status: 'ok', message: 'pong' });
    }
  }
);
