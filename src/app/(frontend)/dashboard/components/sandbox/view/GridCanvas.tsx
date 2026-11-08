'use client';

import { useEffect, useRef, useState } from 'react';
import { GridView, type StrokeHandler, type ViewName } from './GridView';
import type { RGB } from './colors';
import type { Engine } from '../engine/Engine';
import { zoomOffset } from './fit';

interface GridCanvasProps {
  engine: Engine | null;      // create client-side (useEffect/useState)
  view?: ViewName;
  brushRadius?: number;
  onStroke?: StrokeHandler;
  onFrame?: () => void;       // runs before each draw (the sandbox's clock)
  className: string,
  /** CSS pixels per cell; the canvas is cell x width by cell x height (sandbox.tsx fits it). */
  cell?: number;
  /** Empty cells in the material view take this colour. */
  airColour?: RGB | null;
  /** The air colour is light (a light theme): the brush outline is drawn dark over it. */
  lightAir?: boolean;
  /** Camera view exposure (display only). */
  exposure?: number;
  /** Display zoom (1, 2 or 3) and the cell it centres on (fit.ts zoomOffset). */
  zoom?: number;
  focus?: { x: number; y: number };
}

export default function GridCanvas({
  engine,
  view = 'material',
  brushRadius = 2,
  onStroke,
  onFrame,
  cell = 4,
  airColour = null,
  lightAir = false,
  className,
  zoom = 1,
  focus,
  exposure = 1,
}: GridCanvasProps) {
  const gridRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<GridView | null>(null);
  const [dpr, setDpr] = useState(1);

  const strokeRef = useRef(onStroke);
  const frameRef = useRef(onFrame);
  strokeRef.current = onStroke;
  frameRef.current = onFrame;

  useEffect(() => { setDpr(window.devicePixelRatio || 1); }, [cell]);

  useEffect(() => {
    if (!engine || !gridRef.current || !overlayRef.current) return;
    const gv = new GridView(engine, gridRef.current, overlayRef.current);
    gv.onStroke = (...a) => strokeRef.current?.(...a);
    viewRef.current = gv;

    let raf = 0;
    const loop = () => {
      frameRef.current?.();
      gv.draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      gv.dispose();
      viewRef.current = null;
    };
  }, [engine]);

  useEffect(() => { if (viewRef.current) viewRef.current.view = view; }, [view]);
  useEffect(() => { if (viewRef.current) viewRef.current.brushRadius = brushRadius; }, [brushRadius]);
  useEffect(() => { if (viewRef.current) viewRef.current.airColour = airColour; }, [airColour, engine]);
  useEffect(() => { if (viewRef.current) viewRef.current.lightAir = lightAir; }, [lightAir, engine]);
  useEffect(() => { if (viewRef.current) viewRef.current.exposure = exposure; }, [exposure]);

  if (!engine) return null;
  const w = engine.width, h = engine.height;
  // The overlay (brush circle, flow arrows) is drawn at device resolution so its
  // lines stay sharp; GridView reads its pixels per cell from the canvas width.
  // Zoomed, the canvases are `zoom` times bigger inside a box of the normal size;
  // the mouse is read against the canvas's real rectangle, so painting stays exact.
  const z = zoom > 1 ? zoom : 1;
  const overlayDpr = Math.min(dpr, 2);
  const overlayW = Math.max(w, Math.round(w * cell * z * overlayDpr));
  const overlayH = Math.max(h, Math.round(h * cell * z * overlayDpr));
  const off = z > 1 && focus ? zoomOffset(focus, z, cell, w, h) : { left: 0, top: 0 };

  return (
    <div style={{ position: 'relative', width: w * cell, height: h * cell, overflow: 'hidden' }} className={className} data-canvas-zoom={z}>
      <div style={{ position: 'absolute', left: off.left, top: off.top, width: w * cell * z, height: h * cell * z }}>
        <canvas
          ref={gridRef}
          width={w}
          height={h}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated' }}
        />
        <canvas
          ref={overlayRef}
          width={overlayW}
          height={overlayH}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }}
        />
      </div>
    </div>
  );
}
