import { ExtensionAction } from './types';

import type {
  ExtensionMessage,
  MessageResponse,
  Point,
  SelectionRect,
} from './types';

import { OVERLAY_ID, Z_INDEX_MAX, COLORS, CONFIG } from './constants';

class GhostOverlay {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;

  private isDragging: boolean = false;
  private startPos: Point = { x: 0, y: 0 };
  private currentPos: Point = { x: 0, y: 0 };

  constructor() {
    this.host = document.createElement('div');
    this.host.id = OVERLAY_ID;
    this.shadow = this.host.attachShadow({ mode: 'closed' });
    this.canvas = document.createElement('canvas');
    this.initStructure();
  }

  private initStructure() {
    Object.assign(this.host.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: Z_INDEX_MAX,
      pointerEvents: 'none',
    });

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';

    this.ctx = this.canvas.getContext('2d');
    if (this.ctx) this.ctx.scale(dpr, dpr);
    this.shadow.appendChild(this.canvas);
  }

  public mount() {
    if (!document.getElementById(OVERLAY_ID)) {
      document.body.appendChild(this.host);
    }
  }

  public destroy() {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.host.remove();
  }

  public activate() {
    this.host.style.pointerEvents = 'auto'; // Allow clicks
    this.host.style.cursor = 'crosshair'; // pointer to '+' sign

    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('keydown', this.handleKeyDown);
    this.draw();
  }

  private handleMouseDown = (e: MouseEvent) => {
    this.isDragging = true;
    this.startPos = { x: e.clientX, y: e.clientY };
    this.currentPos = { x: e.clientX, y: e.clientY };
    e.preventDefault(); // stop text selection
    this.draw();
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    this.currentPos = { x: e.clientX, y: e.clientY };
    this.draw();
  };

  private handleMouseUp = (_e: MouseEvent) => {
    this.isDragging = false;
    const rect = this.getSelectionRect();

    if (
      rect.width > CONFIG.MIN_SELECTION_ZX &&
      rect.height > CONFIG.MIN_SELECTION_ZY
    ) {
      console.log('Image captured:', rect);
      chrome.runtime.sendMessage<ExtensionMessage>({
        action: ExtensionAction.CAPTURE_SUCCESS,
        payload: rect,
      });
    }
    this.destroy();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.destroy();
  };

  private draw() {
    if (!this.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
    this.ctx.fillStyle = COLORS.OVERLAY_BG;
    this.ctx.fillRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

    if (this.isDragging || this.startPos.x !== 0) {
      // Cut the rectangular hole & polish border
      const { x, y, width, height } = this.getSelectionRect();
      this.ctx.clearRect(x, y, width, height);
      this.ctx.strokeStyle = COLORS.SELECTION_BORDER;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, width, height);
    }
  }

  private getSelectionRect(): SelectionRect {
    return {
      x: Math.min(this.startPos.x, this.currentPos.x),
      y: Math.min(this.startPos.y, this.currentPos.y),
      width: Math.abs(this.startPos.x - this.currentPos.x),
      height: Math.abs(this.startPos.y - this.currentPos.y),
    };
  }
}

let activeOverlay: GhostOverlay | null = null;

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    switch (message.action) {
      case ExtensionAction.PING_CONTENT:
        sendResponse({ status: 'ok' });
        break;

      case ExtensionAction.ACTIVATE_OVERLAY:
        if (activeOverlay) activeOverlay.destroy();
        activeOverlay = new GhostOverlay();
        activeOverlay.mount();
        activeOverlay.activate();
        sendResponse({ status: 'ok' });
        break;
    }
    return false;
  }
);
