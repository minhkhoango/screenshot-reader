// Inject a div with closed ShadowRoot
class GhostOverlay {
  private host: HTMLDivElement;
  private shadow: ShadowRoot; // hidden dom subtree, have html, css, js
  private canvas: HTMLCanvasElement; // rectangular area

  constructor() {
    this.host = document.createElement('div');
    this.host.id = 'xr-screenshot-reader-host';

    // Use try-catch block for CSP blocking
    try {
      this.shadow = this.host.attachShadow({ mode: 'closed' });
    } catch (err) {
      console.warn('Shadow DOM blocked by host CSP. Fallback needed');
      throw err;
    }

    this.canvas = document.createElement('canvas');
    this.initStructure();
  }

  private initStructure() {
    // Reset styles to prevent host page bleed-through
    this.host.style.position = 'fixed';
    this.host.style.top = '0';
    this.host.style.left = '0';
    this.host.style.width = '100vw';
    this.host.style.height = '100vh';
    this.host.style.zIndex = '2147483647'; // Top-level UI
    this.host.style.pointerEvents = 'none'; // Allow clicks to pass through initially

    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';

    this.shadow.appendChild(this.canvas);
  }

  public mount() {
    if (!document.getElementById(this.host.id)) {
      document.body.appendChild(this.host);
      console.log('Ghost Overlay injected');
    }
  }

  public activate() {
    this.host.style.pointerEvents = 'auto'; // enable interaction
    this.host.style.cursor = 'crosshair'; // turn mouse to + sign
    // Draw smi-transparent background
    const ctx = this.canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // dim screen slightly
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); // everything
    }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.action === 'Qm_ACTIVATE_OVERLAY') {
    const overlay = new GhostOverlay();
    console.log('Hello!');

    overlay.mount();
    overlay.activate();
  }
});
