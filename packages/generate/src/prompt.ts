/**
 * Prompt enrichment — prepends base style and sprite sheet structure
 * so users only need to provide character/object descriptions.
 */

const BASE_STYLE = [
  '32-bit pixel art',
  'top-down RPG style',
  'consistent subtle top-left shading',
  'soft sub-pixel shading with 3-4 value ramps per color',
  'selective dark outlines (hue-shifted not black)',
  'slight dithering on large surfaces',
  'warm muted palette',
  'cozy indie game aesthetic',
  'clean readable silhouettes',
  'no anti-aliasing to background',
  'transparent background',
  'PNG',
].join(', ');

const WALK_SHEET_STRUCTURE = [
  'character sprite sheet for a pixel RPG',
  '64x64 pixel character',
  '4 rows x 4 columns grid layout on single image',
  'row 1: walking down (toward camera) 4 frames',
  'row 2: walking up (away from camera) 4 frames',
  'row 3: walking left 4 frames',
  'row 4: walking right 4 frames',
].join(', ');

const WALK_SHEET_SUFFIX = [
  'subtle walk cycle bob',
  'arms swinging',
  'consistent proportions across all frames',
  'character fills about 80% of each cell height',
].join(', ');

const ACTION_SHEET_STRUCTURE = [
  'character action sprite sheet for a pixel RPG',
  '64x64 pixel character',
  '4 rows x 4 columns grid layout on single image',
  'CHARACTER ONLY no furniture no desk no chair no props in any frame',
  'row 1: sitting pose facing directly up (away from camera back fully to viewer) centered not angled typing gesture 4 frames',
  'row 2: sleeping pose curled up or head drooping facing down 2 frames then same pose still 2 frames',
  'row 3: talking with hand gestures facing camera 4 frames',
  'row 4: standing idle facing camera with subtle breathing animation 4 frames',
].join(', ');

const FURNITURE_STRUCTURE = [
  'furniture sprites for a pixel RPG modern office',
  'straight top-down bird\'s eye view looking directly down at 90 degrees',
  'NOT 3/4 view NOT isometric NOT angled — perfectly flat top-down like a floor plan',
  'each item on transparent background arranged in a single image with spacing between items',
  'no characters no people',
  'all items must share the same straight top-down perspective and lighting direction',
].join(', ');

const OBJECT_STRUCTURE = [
  'single object sprite for a pixel RPG',
  'straight top-down bird\'s eye view looking directly down at 90 degrees',
  'NOT 3/4 view NOT isometric NOT angled — perfectly flat top-down like a floor plan',
  'single item centered on transparent background',
  'no characters no people',
].join(', ');

const TEXTURE_STRUCTURE = [
  'seamless tileable texture for a pixel RPG',
  'top-down view',
  'single square tile that repeats perfectly in all directions',
  'no visible seams when tiled',
  'no objects no characters no furniture',
  'the texture pattern must fill the ENTIRE image edge to edge with absolutely NO border NO frame NO margin NO padding NO outline',
  'solid opaque background',
  'full bleed pattern only',
  'SUBTLE and QUIET — use a single base color with very minor tonal variation',
  'low contrast only — no loud patterns no bright multicolor no high contrast details',
  'the floor should recede into the background and not compete with furniture or characters',
  'think simple muted flat surface not decorative',
].join(', ');

export type SheetType = 'walk' | 'action' | 'furniture' | 'object' | 'texture';

export function buildPrompt(description: string, type: SheetType): string {
  switch (type) {
    case 'walk':
      return `${BASE_STYLE}, ${WALK_SHEET_STRUCTURE}, ${description}, ${WALK_SHEET_SUFFIX}`;
    case 'action':
      return `${BASE_STYLE}, ${ACTION_SHEET_STRUCTURE}, ${description}, consistent with walking sheet style, character fills about 80% of each cell height`;
    case 'furniture':
      return `${BASE_STYLE}, ${FURNITURE_STRUCTURE}, ${description}, consistent style across all items`;
    case 'object':
      return `${BASE_STYLE}, ${OBJECT_STRUCTURE}, ${description}`;
    case 'texture':
      return `${BASE_STYLE}, ${TEXTURE_STRUCTURE}, ${description}`;
  }
}
