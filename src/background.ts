chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || tab.url.startsWith('chrome://')) return;

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab();
    await chrome.storage.session.set({ lastCapture: dataUrl });
    console.log('Snapshot secured in storage');

    // Try sending message first; only inject if content.js not loaded
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'Qm_ACTIVATE_OVERLAY' });
      console.log('Content script already loaded');
    } catch {
      // Content script not loaded yet, inject it
      console.log('Injecting content script');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
      // Try again
      await chrome.tabs.sendMessage(tab.id, { action: 'Qm_ACTIVATE_OVERLAY' });
    }
  } catch (err) {
    console.error('Pixel Pipeline Failed:', err);
  }
});
