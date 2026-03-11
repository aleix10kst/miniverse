# Asset Processing

How to go from AI-generated images to game-ready sprites and props.

---

## Tools

The `miniverse-generate` package (`packages/generate/`) handles the full pipeline: prompt enrichment → fal.ai image generation → background removal → sprite processing. See `packages/generate/README.md` for full details.

For manual processing, scripts are in `scripts/`. Both use [sharp](https://sharp.pixelplumbing.com/) for image manipulation.

### Background removal

Background removal uses [fal.ai's Bria RMBG 2.0](https://fal.ai/models/fal-ai/bria/background/remove) (`fal-ai/bria/background/remove`). Since image generation also runs on fal.ai, the pipeline passes the image URL directly between stages — no unnecessary download/upload round-trip. Requires a `FAL_KEY` environment variable.

---

## Character Sprites

**Script:** `scripts/process-sprites.mjs`

**Problem:** AI generators (Nano Banana Pro, etc.) output sprite sheets at arbitrary resolutions (e.g. 1280x698) with characters loosely arranged on a grid. Characters aren't perfectly aligned, spacing is irregular, and frames aren't the exact 64x64 we need.

**Solution:**

1. Remove background via fal.ai Bria RMBG 2.0 (or flood fill from edges for local processing)
2. Trim the entire image to its content bounds
3. Divide into a 4x4 grid based on the trimmed dimensions
4. Extract each cell, trim individually to character bounds
5. Scale each frame to fill 64px height (nearest-neighbor to preserve pixel art)
6. Center horizontally within 64x64, assemble into clean 256x256 sheet

**Usage:**

```bash
# Drop raw sprite sheet in assets/raw/
cp ~/Downloads/morty-walk.png assets/raw/

# Process it
node scripts/process-sprites.mjs

# Output: assets/processed/morty_walk.png (256x256, 4x4 grid of 64x64 frames)
```

**Output format:** 256x256 PNG, 4 rows x 4 columns, 64x64 per frame, transparent background.

| Row | Direction |
|-----|-----------|
| 0 | Walking down (toward camera) |
| 1 | Walking up (away from camera) |
| 2 | Walking left |
| 3 | Walking right |

---

## Props / Objects

**Script:** `scripts/process-props.mjs`

**Problem:** AI generators output prop pieces scattered on a white background at irregular positions. Items are different sizes and close together, making manual coordinate-based slicing unreliable.

**Solution: flood fill + connected component detection.**

1. **Flood fill from edges** — BFS from all border pixels inward, marking white pixels connected to the edge as "background." This removes only the actual background while preserving white pixels inside objects (like the whiteboard surface).

2. **Connected component analysis** — scan for groups of adjacent non-transparent pixels. Each connected group is one prop piece. Extract its bounding box automatically.

3. **Filter noise** — discard components smaller than 500px area (stray pixels, artifacts).

4. **Sort and export** — sort pieces by position (top-to-bottom, left-to-right), save each as a separate PNG, and write a `manifest.json` with coordinates.

**Why not just remove all white pixels?** Light-colored items (whiteboard, water cooler, chair seats) contain near-white pixels that would get destroyed. Flood fill only removes white that's reachable from the image border — white surrounded by non-white (inside an object) is preserved.

**Why not manually define bounding boxes?** AI generators don't place items on a perfect grid. Manual coordinates always overlap neighboring items. Auto-detection finds the exact bounds of each piece.

**Usage:**

```bash
# Drop raw prop image in assets/raw/
cp ~/Downloads/office-props.png assets/raw/

# Process it
node scripts/process-props.mjs

# Output:
#   assets/processed/props/piece_0.png  (desk)
#   assets/processed/props/piece_1.png  (chair)
#   assets/processed/props/piece_2.png  (chair side)
#   ...
#   assets/processed/props/manifest.json
#   assets/processed/prop_atlas.png    (full image, transparent bg)
```

**manifest.json** contains the original position and size of each piece in the source image, useful if you want to use the atlas approach instead of individual files.

---

## Adding New Assets

### Using the generate pipeline (recommended)

```bash
# Character sprite sheet (full pipeline: prompt → generate → bg remove → process)
FAL_KEY=xxx npx miniverse-generate character \
  --prompt "young female, pink hair, yellow cardigan" \
  --output sprites/nova_walk.png

# Prop set
FAL_KEY=xxx npx miniverse-generate props \
  --prompt "cozy cafe props" \
  --output sprites/cafe/

# Process an existing raw image (no generation, just processing)
npx miniverse-generate process \
  --input raw_sprite.png --type character --output clean.png
```

### Manual workflow

1. Generate the image using prompts from `docs/example-prompts.md`
2. Save the raw output to `assets/raw/`
3. Run the appropriate processing script
4. Copy processed files to `demo/public/sprites/` (for the demo) or `worlds/pixel-office/` (for the engine)
5. Reference them in your scene config or demo code

---

## Resolutions

| Asset | Frame size | Sheet size |
|-------|-----------|------------|
| Character walk/action | 64x64 | 256x256 (4x4) |
| Tiles (floor, walls) | 32x32 | varies |
| Props | varies per piece | individual PNGs |
| Effects/particles | 16x16 | varies |

Characters are 2x tile resolution (64 vs 32) so they have more detail and stand taller than a single tile — standard for top-down RPGs.
