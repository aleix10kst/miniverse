# miniverse-generate

AI sprite generator for Miniverse. Create character and props sprites from text prompts or reference images.

Takes a simple description like "young female, pink hair, yellow cardigan" and outputs a clean, game-ready 256x256 sprite sheet with 16 animation frames.

---

## How it works

The pipeline has four stages:

```
prompt enrichment → fal.ai generate → background removal → sprite processing
```

### 1. Prompt enrichment (`src/prompt.ts`)

You provide a short character or props description. The pipeline prepends the full Miniverse base style — lighting, shading, outlining, palette, grid layout — so every generated asset is visually consistent.

```
Input:  "young female, pink hair, yellow cardigan"

Output: "32-bit pixel art, top-down 3/4 view RPG style, consistent top-left
         light source, soft sub-pixel shading with 3-4 value ramps per color,
         selective dark outlines (hue-shifted not black), slight dithering on
         large surfaces, warm muted palette, cozy indie game aesthetic, clean
         readable silhouettes, no anti-aliasing to background, transparent
         background, PNG, character sprite sheet for a pixel RPG, 64x64 pixel
         character, 4 rows x 4 columns grid layout on single image, row 1:
         walking down (toward camera) 4 frames, row 2: walking up (away from
         camera) 4 frames, row 3: walking left 4 frames, row 4: walking right
         4 frames, young female, pink hair, yellow cardigan, subtle walk cycle
         bob, arms swinging, consistent proportions across all frames"
```

Three prompt templates:
- **walk** — 4-direction walk cycle (default)
- **action** — sitting, sleeping, talking, idle
- **props** — office/cafe props set

### 2. Image generation (`src/fal.ts`)

Calls fal.ai's Nano Banana Pro model to generate the sprite sheet image.

- **`fal-ai/nano-banana-pro`** — text-to-image, used when only a prompt is given
- **`fal-ai/nano-banana-pro-edit`** — image-to-image, used when a reference image is provided (useful for generating action sheets that match an existing character's walk sheet)

Requires a `FAL_KEY` environment variable. Get one at https://fal.ai/dashboard/keys.

### 3. Background removal (`src/background.ts`)

Nano Banana Pro doesn't generate true transparent backgrounds. When asked for a transparent background, it renders a checker pattern instead. This stage uses [fal.ai's Bria RMBG 2.0](https://fal.ai/models/fal-ai/bria/background/remove) to remove that checker pattern and produce actual transparency.

Since both generation and bg removal run on fal.ai, the pipeline passes the image URL directly between stages — no unnecessary download/upload round-trip.

**Tip:** Always ask for "transparent background" in the prompt anyway. The checker pattern is much easier for the background remover to handle than a solid color that might match parts of the sprite.

### 4. Sprite processing (`src/process.ts`)

AI generators don't output clean grids. Characters are irregularly spaced, not pixel-aligned, and at arbitrary resolutions. This stage fixes all of that.

**For character sheets:**

1. **Flood fill background removal** — BFS from image edges inward, removing white pixels connected to the border. This preserves white pixels inside objects while removing the actual background.
2. **Trim** — crop to content bounds.
3. **Grid division** — divide trimmed image into 4×4 cells.
4. **Per-frame trim** — trim each cell to its character bounds.
5. **Scale** — resize each frame to fill 64px height using nearest-neighbor interpolation (preserves pixel art crispness). Center horizontally within 64×64.
6. **Assemble** — composite all 16 frames onto a clean 256×256 transparent PNG.

**For props:**

1. **Flood fill background removal** — same edge-based approach.
2. **Connected component detection** — scan for groups of adjacent non-transparent pixels. Each connected group is one props piece.
3. **Filter** — discard components under 500px area (noise/artifacts).
4. **Sort** — order by position (top-to-bottom, left-to-right).
5. **Extract** — save each piece as a separate PNG.

**Why flood fill instead of just removing all white?** Light-colored items like whiteboards, chair seats, and water coolers contain near-white pixels. A simple threshold approach destroys them. Flood fill only removes white that's reachable from the image border — white surrounded by non-white (inside an object) is preserved.

---

## Usage

### CLI

```bash
# Generate a character walk sheet (full pipeline)
FAL_KEY=xxx npx miniverse-generate character \
  --prompt "young female, pink hair, yellow cardigan" \
  --output sprites/nova_walk.png

# Generate with a reference image (fal edit mode)
FAL_KEY=xxx npx miniverse-generate character \
  --prompt "same character, purple sweater, buzz cut" \
  --image reference.png \
  --output sprites/rio_walk.png

# Generate an action sheet
FAL_KEY=xxx npx miniverse-generate character \
  --prompt "young male developer, red hoodie, dark jeans" \
  --type action \
  --output sprites/morty_actions.png

# Generate props
FAL_KEY=xxx npx miniverse-generate props \
  --prompt "cozy cafe props, tables, espresso machine, bar stools, pastry case" \
  --output sprites/cafe/

# Process an existing raw image (no API key needed)
npx miniverse-generate process \
  --input raw_sprite.png \
  --type character \
  --output clean_sprite.png

# Process with bg removal already done
npx miniverse-generate process \
  --input already_transparent.png \
  --type character \
  --output clean.png \
  --skip-bg
```

### Programmatic

```typescript
import { generateCharacter, generateProps } from 'miniverse-generate';

// Generate a character
const { buffer } = await generateCharacter({
  prompt: 'young female, pink hair, yellow cardigan',
  output: 'sprites/nova_walk.png',
});

// Generate with reference image
const { buffer: editBuffer } = await generateCharacter({
  prompt: 'same character, action poses',
  refImage: './nova_walk_reference.png',
  type: 'action',
  output: 'sprites/nova_actions.png',
});

// Generate props
const { pieces } = await generateProps({
  prompt: 'modern office props set',
  output: 'sprites/office/',
});
// pieces[0].buffer, pieces[0].width, pieces[0].height, etc.
```

### Processing only (no generation)

If you already have raw images (e.g. from a manual fal.ai session), use the processing functions directly:

```typescript
import { processCharacterSheet, processPropsSheet } from 'miniverse-generate';
import sharp from 'sharp';

// Process a raw character sprite sheet
const raw = await sharp('raw_sprite.png').png().toBuffer();
const clean = await processCharacterSheet(raw);
// clean is a 256x256 Buffer with 4x4 grid of 64x64 frames

// Process raw props image
const rawProps = await sharp('raw_props.png').png().toBuffer();
const pieces = await processPropsSheet(rawProps);
// pieces is an array of { buffer, width, height }
```

---

## Output formats

| Type | Output | Dimensions |
|------|--------|-----------|
| Character walk sheet | Single PNG | 256×256 (4×4 grid, 64×64 frames) |
| Character action sheet | Single PNG | 256×256 (4×4 grid, 64×64 frames) |
| Props set | Individual PNGs per piece | Varies per piece |

### Character sheet layout

| Row | Frames | Content |
|-----|--------|---------|
| 0 | 4 | Walking down (toward camera) |
| 1 | 4 | Walking up (away from camera) |
| 2 | 4 | Walking left |
| 3 | 4 | Walking right |

### Action sheet layout

| Row | Frames | Content |
|-----|--------|---------|
| 0 | 4 | Sitting at desk, typing |
| 1 | 2+2 | Sleeping, then idle |
| 2 | 4 | Talking with hand gestures |
| 3 | 4 | Standing idle, breathing |

---

## Architecture

```
src/
  index.ts          Public API exports
  cli.ts            CLI entry point
  pipeline.ts       Orchestrates the four stages
  prompt.ts         Prompt enrichment with base style
  fal.ts            fal.ai API wrapper (create + edit)
  background.ts     fal.ai Bria RMBG 2.0 wrapper
  process.ts        Flood fill + grid processing + component detection
```

Each module is independent and testable. The pipeline wires them together, but you can use any stage individually (e.g. just the processing, just the prompt builder).

---

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `FAL_KEY` | For generation | fal.ai API key (https://fal.ai/dashboard/keys) |

Not required for the `process` command or when using processing functions directly.
