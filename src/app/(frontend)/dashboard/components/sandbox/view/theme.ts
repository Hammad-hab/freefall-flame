// theme.ts - the sandbox's one link to the dashboard palette (ui/chart-theme).
// Empty (air) cells take the panel colour C.ink2, on the canvas and in the
// Build palette's Air swatch alike. No material or data colour changes.

import { C } from '../../ui/chart-theme';
import type { RGB } from './colors';

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const AIR_COLOUR: RGB = hexToRgb(C.ink2);
