import { fillView, centreVelocity, type RGB, type View } from './colors';
import { KIND, type Engine } from '../engine/Engine';

// Arrow sizes in overlay pixels at 4 pixels per cell; they scale with the cell.
const ARROW_EVERY = 6;
const ARROW_SCALE = 90;
const ARROW_MAX = 22;
const ARROW_MIN_SPEED = 0.003;
const DESIGN_SCALE = 4;

export type ViewName = View;

export interface Cell { x: number; y: number }
export type StrokeHandler = (x: number, y: number, erase: boolean, first: boolean) => void;

interface Stroke { erase: boolean; x: number; y: number }

export class GridView {
  readonly engine: Engine;
  readonly overlayCanvas: HTMLCanvasElement;
  private readonly grid: CanvasRenderingContext2D;
  private readonly overlay: CanvasRenderingContext2D;
  private readonly image: ImageData;
  private readonly abort = new AbortController();
  private stroke: Stroke | null = null;

  view: ViewName = 'material';
  /** Empty cells in the material view take this colour (the dashboard's background). */
  airColour: RGB | null = null;
  /** The theme's air is light (light themes): the brush outline is drawn dark in the Material view. */
  lightAir = false;
  /** Camera view exposure (display only; colors.ts fillView). */
  exposure = 1;
  hover: Cell | null = null;
  brushRadius = 2;
  onStroke: StrokeHandler = () => {};

  constructor(engine: Engine, gridCanvas: HTMLCanvasElement, overlayCanvas: HTMLCanvasElement) {
    const grid = gridCanvas.getContext('2d');
    const overlay = overlayCanvas.getContext('2d');
    if (!grid || !overlay) throw new Error('2D canvas context unavailable');
    this.engine = engine;
    this.grid = grid;
    this.overlay = overlay;
    this.overlayCanvas = overlayCanvas;
    this.image = grid.createImageData(engine.width, engine.height);
    this.listen(overlayCanvas);
  }

  dispose(): void { this.abort.abort(); }

  get scale(): number { return this.overlayCanvas.width / this.engine.width; }

  draw(): void {
    fillView(this.engine, this.view, this.image.data, this.airColour, this.exposure);
    this.grid.putImageData(this.image, 0, 0);
    const o = this.overlay, s = this.scale;
    o.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    if (this.view === 'flow') this.drawArrows();
    if (this.hover) {
      // Every data view is dark; only the Material view's air follows a light theme.
      o.strokeStyle = this.lightAir && this.view === 'material' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.75)';
      o.lineWidth = Math.max(1, s / DESIGN_SCALE);
      o.beginPath();
      o.arc((this.hover.x + 0.5) * s, (this.hover.y + 0.5) * s, (this.brushRadius + 0.5) * s, 0, 2 * Math.PI);
      o.stroke();
    }
  }

  private drawArrows(): void {
    const e = this.engine, o = this.overlay, s = this.scale, unit = s / DESIGN_SCALE;
    o.strokeStyle = 'rgba(255,255,255,0.7)';
    o.lineWidth = Math.max(1, unit);
    o.beginPath();
    for (let y = ARROW_EVERY / 2; y < e.height; y += ARROW_EVERY) {
      for (let x = ARROW_EVERY / 2; x < e.width; x += ARROW_EVERY) {
        if (e.materials[e.grid.material[y * e.width + x]].kind !== KIND.GAS) continue;
        const { u, v } = centreVelocity(e, x, y);
        const speed = Math.hypot(u, v);
        if (speed < ARROW_MIN_SPEED) continue;
        const len = Math.min(ARROW_MAX, speed * ARROW_SCALE) * unit;
        const cx = (x + 0.5) * s, cy = (y + 0.5) * s;
        const dx = (u / speed) * len, dy = (v / speed) * len;
        o.moveTo(cx, cy);
        o.lineTo(cx + dx, cy + dy);
        o.lineTo(cx + dx - 0.35 * dx - 0.25 * dy, cy + dy - 0.35 * dy + 0.25 * dx);
      }
    }
    o.stroke();
  }

  private cellAt(event: PointerEvent): Cell | null {
    const r = this.overlayCanvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - r.left) / r.width) * this.engine.width);
    const y = Math.floor(((event.clientY - r.top) / r.height) * this.engine.height);
    if (x < 0 || y < 0 || x >= this.engine.width || y >= this.engine.height) return null;
    return { x, y };
  }

  private listen(canvas: HTMLCanvasElement): void {
    const opts: AddEventListenerOptions = { signal: this.abort.signal };

    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), opts);

    canvas.addEventListener('pointerdown', (e) => {
      const c = this.cellAt(e);
      if (!c) return;
      canvas.setPointerCapture(e.pointerId);
      this.stroke = { erase: e.button === 2, x: c.x, y: c.y };
      this.onStroke(c.x, c.y, this.stroke.erase, true);
    }, opts);

    canvas.addEventListener('pointermove', (e) => {
      this.hover = this.cellAt(e);
      if (!this.stroke || !this.hover) return;
      const { x: x0, y: y0, erase } = this.stroke;
      const { x: x1, y: y1 } = this.hover;
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 1; k <= n; k++) {
        this.onStroke(
          Math.round(x0 + ((x1 - x0) * k) / n),
          Math.round(y0 + ((y1 - y0) * k) / n),
          erase,
          false,
        );
      }
      this.stroke.x = x1;
      this.stroke.y = y1;
    }, opts);

    const end = () => { this.stroke = null; };
    canvas.addEventListener('pointerup', end, opts);
    canvas.addEventListener('pointercancel', end, opts);
    canvas.addEventListener('pointerleave', () => { this.hover = null; }, opts);
  }
}