'use client';

import { useEffect, useRef } from 'react';
import { GridView, type StrokeHandler, type ViewName } from './GridView';
import type { Engine } from '../engine/Engine';

interface GridCanvasProps {
  engine: Engine | null;      // create client-side (useEffect/useState)
  view?: ViewName;
  brushRadius?: number;
  onStroke?: StrokeHandler;
  onFrame?: () => void;       // e.g. engine.step()
  className: string,
  scale?: number;             // overlay px per cell
}

export default function GridCanvas({
  engine,
  view = 'material',
  brushRadius = 2,
  onStroke,
  onFrame,
  scale = 4,
  className,
}: GridCanvasProps) {
  const gridRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<GridView | null>(null);

  const strokeRef = useRef(onStroke);
  const frameRef = useRef(onFrame);
  strokeRef.current = onStroke;
  frameRef.current = onFrame;

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

  if (!engine) return null;
  const w = engine.width, h = engine.height;

  return (
    <div style={{ position: 'relative', width: w * scale, height: h * scale }} className={className}>
      <canvas
        ref={gridRef}
        width={w}
        height={h}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated' }}
      />
      <canvas
        ref={overlayRef}
        width={w * scale}
        height={h * scale}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }}
      />
    </div>
  );
}