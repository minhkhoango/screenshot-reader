import { ExtensionAction } from './types';
import type {
  ExtensionMessage,
  MessageResponse,
  Point,
  SelectionRect,
  IslandState,
  IslandSettings,
  OcrResultPayload,
  CropReadyPayload,
} from './types';
import {
  OVERLAY_ID,
  ISLAND_ID,
  ISLAND_STYLES,
  COLORS,
  CONFIG,
  UI,
  ICONS,
  ISLAND,
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
} from './constants';

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

// Screesnshot selection box
class GhostOverlay {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;

  private isDragging = false;
  private startPos: Point = { x: 0, y: 0 };
  private currentPos: Point = { x: 0, y: 0 };

  constructor() {
    this.host = document.createElement('div');
    this.host.id = OVERLAY_ID;
    this.shadow = this.host.attachShadow({ mode: 'closed' });
    this.canvas = document.createElement('canvas');
    this.initStructure();
  }

  private initStructure(): void {
    Object.assign(this.host.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: UI.FULL_WIDTH,
      height: UI.FULL_HEIGHT,
      zIndex: UI.Z_INDEX_MAX,
      pointerEvents: UI.POINTER_EVENTS_DISABLED,
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

  public mount(): void {
    if (!document.getElementById(OVERLAY_ID)) {
      document.body.appendChild(this.host);
    }
  }

  public destroy(): void {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.host.remove();
    activeOverlay = null;
  }

  public activate(): void {
    this.host.style.pointerEvents = UI.POINTER_EVENTS_ENABLED;
    this.host.style.cursor = COLORS.POINTER_CROSSHAIR;

    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('keydown', this.handleKeyDown);
    this.draw();
  }

  private handleMouseDown = (e: MouseEvent): void => {
    this.isDragging = true;
    this.startPos = { x: e.clientX, y: e.clientY };
    this.currentPos = { x: e.clientX, y: e.clientY };
    e.preventDefault();
    this.draw();
  };

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;
    this.currentPos = { x: e.clientX, y: e.clientY };
    this.draw();
  };

  private handleMouseUp = (_e: MouseEvent): void => {
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

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === UI.ESCAPE_KEY) this.destroy();
  };

  private draw(): void {
    if (!this.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
    this.ctx.fillStyle = COLORS.OVERLAY_BG;
    this.ctx.fillRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

    if (this.isDragging || this.startPos.x !== 0) {
      const { x, y, width, height } = this.getSelectionRect();
      this.ctx.clearRect(x, y, width, height);
      this.ctx.strokeStyle = COLORS.SELECTION_BORDER;
      this.ctx.lineWidth = UI.CANVAS_LINE_WIDTH;
      this.ctx.strokeRect(x, y, width, height);
    }
  }

  private getSelectionRect(): SelectionRect {
    return {
      x: Math.min(this.startPos.x, this.currentPos.x),
      y: Math.min(this.startPos.y, this.currentPos.y),
      width: Math.abs(this.startPos.x - this.currentPos.x),
      height: Math.abs(this.startPos.y - this.currentPos.y),
      devicePixelRatio: window.devicePixelRatio || 1,
    };
  }
}

// FloatingIsland - Result Display UI
class FloatingIsland {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private container: HTMLDivElement;
  private settings: IslandSettings = { ...DEFAULT_SETTINGS };

  private state: IslandState;
  private text: string;
  private imageUrl: string;
  private position: Point;
  private isExpanded = false;
  private hasCopied = false;
  private hasAutocopied = false; // Track if autocopy has been triggered

  // Drag state
  private isDragging = false;
  private dragStartPos: Point = { x: 0, y: 0 };
  private dragOffset: Point = { x: 0, y: 0 };

  // Element refs
  private statusEl!: HTMLSpanElement;
  private previewEl!: HTMLDivElement;
  private copyBtn!: HTMLButtonElement;
  private textareaEl!: HTMLTextAreaElement;
  private imageEl!: HTMLImageElement;

  constructor(cursorPosition: Point, imageUrl: string = '') {
    // Initialize in loading state
    this.state = 'loading';
    this.text = '';
    this.imageUrl = imageUrl;
    this.position = this.calculatePosition(cursorPosition);

    this.host = document.createElement('div');
    this.host.id = ISLAND_ID;
    this.shadow = this.host.attachShadow({ mode: 'closed' });
    this.container = document.createElement('div');

    this.loadSettings().then(() => {
      this.build();
    });
  }

  /** Update island with OCR result, transitioning from loading to success/error */
  public updateWithResult(payload: OcrResultPayload): void {
    this.state = payload.success ? 'success' : 'error';
    this.text = payload.text;
    if (payload.croppedImageUrl) {
      this.imageUrl = payload.croppedImageUrl;
    }

    // Update image if present
    if (this.imageEl && this.imageUrl) {
      this.imageEl.src = this.imageUrl;
    }

    // Update status text and class
    if (this.statusEl) {
      const statusText =
        this.state === 'success'
          ? this.settings.autoCopy
            ? 'Copied!'
            : 'Extracted:'
          : 'Error';
      this.statusEl.textContent = statusText;
      this.statusEl.className = `island-status ${
        this.state === 'success' ? 'success' : 'error'
      }`;
    }

    // Update preview text
    if (this.previewEl) {
      this.previewEl.textContent =
        this.truncateText(this.text, ISLAND.TEXT_MAXLENGTH_COLLAPSED) ||
        'No text detected';
    }

    // Update textarea
    if (this.textareaEl) {
      this.textareaEl.value = this.text;
    }

    // Update copy button: remove spinner, show clipboard icon, re-enable button
    if (this.copyBtn) {
      this.copyBtn.classList.remove('loading');
      this.copyBtn.disabled = false;
      this.copyBtn.title = 'Copy to clipboard';
      const svg = this.copyBtn.querySelector('svg');
      if (svg) {
        svg.outerHTML = ICONS.clipboard;
      }
    }

    // Trigger autocopy on first success
    if (
      this.state === 'success' &&
      this.settings.autoCopy &&
      !this.hasAutocopied
    ) {
      this.hasAutocopied = true;
      this.copyToClipboard();
    }

    // Wiggle on error
    if (this.state === 'error') {
      this.wiggle();
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(
        STORAGE_KEYS.ISLAND_SETTINGS
      );
      const savedSettings = stored[STORAGE_KEYS.ISLAND_SETTINGS] as
        | Partial<IslandSettings>
        | undefined;
      if (savedSettings) {
        this.settings = {
          ...DEFAULT_SETTINGS,
          ...savedSettings,
        };
      }
    } catch {
      // Use defaults
    }
  }

  private async saveSettings(): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.ISLAND_SETTINGS]: this.settings,
    });
  }

  private calculatePosition(cursor: Point): Point {
    const width = ISLAND.WIDTH_COLLAPSED;
    const height = ISLAND.HEIGHT_COLLAPSED;

    let x = cursor.x;
    let y = cursor.y;

    // Boundary checks - keep widget within viewport
    if (x + width > window.innerWidth) {
      x = window.innerWidth - width;
    }
    if (y + height > window.innerHeight) {
      y = window.innerHeight - height;
    }

    return { x, y };
  }

  private constrainToViewport(pos: Point): Point {
    const padding = ISLAND.PADDING;
    const containerRect = this.container.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    let x = Math.max(padding, pos.x);
    let y = Math.max(padding, pos.y);

    x = Math.min(x, window.innerWidth - width - padding);
    y = Math.min(y, window.innerHeight - height - padding);

    return { x, y };
  }

  private isDraggableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;

    // Reject if clicking interactive elements
    if (target.closest('.island-btn')) return false;
    if (target.closest('.toggle')) return false;
    if (target.closest('.island-preview')) return false;
    if (target.closest('.island-textarea')) return false;

    // Accept if clicking draggable areas
    if (target.closest('.island-image')) return true;
    if (target.classList.contains('island-status')) return true;
    if (target === this.container) return true;

    return false;
  }

  private build(): void {
    // Inject styles
    const style = document.createElement('style');
    style.textContent = ISLAND_STYLES;
    this.shadow.appendChild(style);

    // Build container
    this.container.className = 'island entering';
    this.container.style.left = `${this.position.x}px`;
    this.container.style.top = `${this.position.y}px`;

    this.container.innerHTML = this.renderCollapsed();
    this.shadow.appendChild(this.container);

    // Cache refs
    this.statusEl = this.container.querySelector('.island-status')!;
    this.previewEl = this.container.querySelector('.island-preview')!;
    this.copyBtn = this.container.querySelector('.copy-btn')!;
    this.imageEl = this.container.querySelector('.island-image')!;

    // Bind events
    this.bindEvents();

    // Update UI based on initial state
    this.updateUI();
  }

  private renderCollapsed(): string {
    const truncatedText = this.truncateText(
      this.text,
      ISLAND.TEXT_MAXLENGTH_COLLAPSED
    );
    const isLoading = this.state === 'loading';

    // Status text and class based on state
    let statusText: string;
    let statusClass: string;
    if (isLoading) {
      statusText = 'Processing…';
      statusClass = '';
    } else if (this.state === 'success') {
      statusText = this.settings.autoCopy ? 'Copied!' : 'Extracted:';
      statusClass = 'success';
    } else {
      statusText = 'Error';
      statusClass = 'error';
    }

    // Show spinner icon during loading, clipboard otherwise
    const actionIcon = isLoading ? ICONS.spinner : ICONS.clipboard;
    const buttonClass = isLoading
      ? 'island-btn copy-btn loading'
      : 'island-btn copy-btn';

    return `
      <div class="island-row">
        <img class="island-image" src="${this.imageUrl}" alt="Captured region"/>
        <div class="island-content">
          <span class="island-status ${statusClass}">${statusText}</span>
          <div class="island-preview" title="Click to expand">${
            isLoading ? '' : truncatedText || 'No text detected'
          }</div>
        </div>
        <div class="island-actions">
          <button class="${buttonClass}" title="${
      isLoading ? 'Processing...' : 'Copy to clipboard'
    }" ${isLoading ? 'disabled' : ''}>
            ${
              isLoading
                ? ''
                : `<svg class="progress-ring" viewBox="0 0 36 36">
              <circle class="bg" cx="18" cy="18" r="15"/>
              <circle class="fg" cx="18" cy="18" r="15"/>
            </svg>`
            }
            ${actionIcon}
          </button>
          <button class="island-btn settings-btn" title="Settings">${
            ICONS.settings
          }</button>
        </div>
      </div>
      <textarea class="island-textarea" style="display:none">${this.escapeHtml(
        this.text
      )}</textarea>
      <div class="island-settings">
        <div class="setting-row">
          <span>Auto-copy to clipboard</span>
          <div class="toggle ${
            this.settings.autoCopy ? 'active' : ''
          }" data-setting="autoCopy"></div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    // Drag functionality
    this.container.addEventListener('mousedown', this.handleDragStart);

    // Preview click → expand
    this.previewEl?.addEventListener('click', () => this.toggleExpand());

    // Copy button
    this.copyBtn?.addEventListener('click', () => this.copyToClipboard());

    // Settings toggle
    const settingsBtn = this.container.querySelector('.settings-btn');
    settingsBtn?.addEventListener('click', () => this.toggleSettings());

    // Toggle switches
    const toggles = this.container.querySelectorAll('.toggle');
    toggles.forEach((toggle) => {
      toggle.addEventListener('click', (e) => this.handleToggle(e));
    });

    // Textarea changes
    this.textareaEl = this.container.querySelector('.island-textarea')!;
    this.textareaEl?.addEventListener('input', (e) => {
      this.text = (e.target as HTMLTextAreaElement).value;
      this.hasCopied = false; // Reset copy state on edit
      this.updateCopyButton(false);
    });

    // Click outside to dismiss
    document.addEventListener('click', this.handleClickOutside);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  private handleDragStart = (e: MouseEvent): void => {
    if (!this.isDraggableTarget(e.target)) return;

    this.isDragging = true;
    this.dragStartPos = { x: e.clientX, y: e.clientY };
    this.dragOffset = {
      x: e.clientX - this.position.x,
      y: e.clientY - this.position.y,
    };

    e.preventDefault();
    e.stopPropagation(); // Prevent handleClickOutside

    document.addEventListener('mousemove', this.handleDragMove);
    document.addEventListener('mouseup', this.handleDragEnd);
    this.container.style.cursor = 'grabbing';
  };

  private handleDragMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;

    // Check for minimum drag threshold (3px)
    const deltaX = Math.abs(e.clientX - this.dragStartPos.x);
    const deltaY = Math.abs(e.clientY - this.dragStartPos.y);
    if (deltaX < ISLAND.DRAG_THRESHOLD && deltaY < ISLAND.DRAG_THRESHOLD)
      return;

    const newX = e.clientX - this.dragOffset.x;
    const newY = e.clientY - this.dragOffset.y;

    // Apply viewport constraints
    this.position = this.constrainToViewport({ x: newX, y: newY });

    this.container.style.left = `${this.position.x}px`;
    this.container.style.top = `${this.position.y}px`;
  };

  private handleDragEnd = (): void => {
    this.isDragging = false;
    this.container.style.cursor = '';

    document.removeEventListener('mousemove', this.handleDragMove);
    document.removeEventListener('mouseup', this.handleDragEnd);
  };

  private handleClickOutside = (e: MouseEvent): void => {
    if (!this.host.contains(e.target as Node)) {
      this.destroy();
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.destroy();
  };

  private handleToggle(e: Event): void {
    const toggle = e.target as HTMLElement;
    const setting = toggle.dataset.setting as keyof IslandSettings;

    if (setting === 'autoCopy') {
      this.settings[setting] = !this.settings[setting];
      toggle.classList.toggle('active', this.settings[setting]);
      this.saveSettings();
    }
  }

  private toggleExpand(): void {
    // Don't allow expansion during loading
    if (this.state === 'loading') return;

    this.isExpanded = !this.isExpanded;
    this.container.classList.toggle('expanded', this.isExpanded);

    if (this.textareaEl) {
      this.textareaEl.style.display = this.isExpanded ? 'block' : 'none';
      if (this.isExpanded) {
        this.textareaEl.focus();

        // Calculate width difference and shift position left
        const widthDiff = ISLAND.WIDTH_EXPANDED - ISLAND.WIDTH_COLLAPSED;
        this.position.x -= widthDiff;

        this.container.style.width = `${ISLAND.WIDTH_EXPANDED}px`;

        // Update preview to show more text when expanded
        if (this.previewEl) {
          this.previewEl.textContent =
            this.truncateText(this.text, ISLAND.TEXT_MAXLENGTH_EXPANDED) ||
            'No text detected';
        }

        // Reposition to ensure island stays within viewport
        this.position = this.constrainToViewport(this.position);
        this.container.style.left = `${this.position.x}px`;
        this.container.style.top = `${this.position.y}px`;
      } else {
        // Calculate width difference and shift position right
        const widthDiff = ISLAND.WIDTH_EXPANDED - ISLAND.WIDTH_COLLAPSED;
        this.position.x += widthDiff;

        // Reset to minimum width when collapsed
        this.container.style.width = `${ISLAND.WIDTH_COLLAPSED}px`;

        // Restore preview to shorter text when collapsed
        if (this.previewEl) {
          this.previewEl.textContent =
            this.truncateText(this.text, ISLAND.TEXT_MAXLENGTH_COLLAPSED) ||
            'No text detected';
        }

        // Reposition after width change
        this.position = this.constrainToViewport(this.position);
        this.container.style.left = `${this.position.x}px`;
        this.container.style.top = `${this.position.y}px`;
      }
    }
  }

  private toggleSettings(): void {
    this.container.classList.toggle('show-settings');
    // Expand if showing settings
    if (
      this.container.classList.contains('show-settings') &&
      !this.isExpanded
    ) {
      this.isExpanded = true;
      this.container.classList.add('expanded');
    }
  }

  private async copyToClipboard(): Promise<void> {
    // Don't copy during loading state
    if (this.state === 'loading') return;

    if (!this.text) {
      this.wiggle();
      return;
    }

    try {
      await navigator.clipboard.writeText(this.text);
      this.hasCopied = true;
      this.updateCopyButton(true);
      this.updateStatus('Copied!', true);
    } catch (err) {
      console.error('Clipboard write failed:', err);
      this.wiggle();
    }
  }

  private updateCopyButton(success: boolean): void {
    if (!this.copyBtn) return;

    const svg = this.copyBtn.querySelector('svg:last-child');
    if (svg) {
      svg.outerHTML = success ? ICONS.check : ICONS.clipboard;
    }
    this.copyBtn.classList.toggle('success', success);
  }

  private updateStatus(text: string, success: boolean): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    this.statusEl.className = `island-status ${success ? 'success' : 'error'}`;
  }

  private updateUI(): void {
    if (this.state === 'error') {
      this.wiggle();
    }
    if (this.state === 'success' && this.settings.autoCopy && this.hasCopied) {
      this.updateCopyButton(true);
    }
  }

  private wiggle(): void {
    this.container.classList.add('wiggle');
    setTimeout(() => this.container.classList.remove('wiggle'), 150);
  }

  private truncateText(text: string, maxlength: number): string {
    if (!text) return '';
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return cleaned.length > maxlength
      ? cleaned.slice(0, maxlength) + '...'
      : cleaned;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  public mount(): void {
    if (!document.getElementById(ISLAND_ID)) {
      document.body.appendChild(this.host);
    }
  }

  public destroy(): void {
    // Clean up drag listeners
    document.removeEventListener('mousemove', this.handleDragMove);
    document.removeEventListener('mouseup', this.handleDragEnd);

    document.removeEventListener('click', this.handleClickOutside);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.host.remove();
    activeIsland = null;
  }
}
