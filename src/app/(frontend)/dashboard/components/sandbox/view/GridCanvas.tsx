'use client';

import { useEffect, useRef, useState } from 'react';
import { GridView, type StrokeHandler, type ViewName } from './GridView';
import type { RGB } from './colors';
import type { Engine } from '../engine/Engine';

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
}

export default function GridCanvas({
  engine,
  view = 'material',
  brushRadius = 2,
  onStroke,
  onFrame,
  cell = 4,
  airColour = null,
  className,
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
  useEffect(() => { if (viewRef.current) viewRef.current.airColour = airColour; }, [airColour]);

  if (!engine) return null;
  const w = engine.width, h = engine.height;
  // The overlay (brush circle, flow arrows) is drawn at device resolution so its
  // lines stay sharp; GridView reads its pixels per cell from the canvas width.
  const overlayW = Math.max(w, Math.round(w * cell * dpr));
  const overlayH = Math.max(h, Math.round(h * cell * dpr));

  return (
    <div style={{ position: 'relative', width: w * cell, height: h * cell }} className={className}>
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
  );
}
