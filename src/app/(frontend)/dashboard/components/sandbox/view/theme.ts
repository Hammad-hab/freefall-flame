// theme.ts - the sandbox's one link to the dashboard palette (ui/themes).
// Empty (air) cells take the theme's panel colour ink2, on the canvas and in
// the Build palette's Air swatch alike. No material or data colour changes:
// those show values and are the same in every theme (view/colors.ts).

import { hexToRgb, type Tokens } from '../../ui/themes';
import type { RGB } from './colors';

/** The air colour of the Material view in a theme. */
export function airColourFor(t: Tokens): RGB {
  return hexToRgb(t.ink2);
}
