# Pixel Art Guide

How to create or generate consistent, high-quality pixel art assets for Miniverse.

---

## Resolution

Miniverse uses a two-tier resolution system:

- **32x32** for tiles (floors, walls, props, objects)
- **64x64** for character sprites

This 2:1 ratio is intentional. Characters sit on top of the world, so having more detail on them looks natural. Every character pixel aligns cleanly with the tile grid (no sub-pixel misalignment).

## Art style

All assets should follow these conventions:

- **Top-down 3/4 view** (RPG-style isometric-ish perspective, like Stardew Valley or Pokemon)
- **Top-left light source** -- consistent across every asset, every tile, every sprite
- **Sub-pixel shading** -- 3-4 value ramps per color (highlight, base, shadow, deep shadow)
- **Selective outlining** -- outlines are hue-shifted dark versions of the fill color, not pure black. Blue shirt gets dark navy outline, skin gets dark brown outline.
- **Slight dithering** on large flat surfaces for texture
- **Warm muted palette** -- cozy indie game aesthetic
- **Clean readable silhouettes** -- characters should be identifiable at small sizes
- **Transparent backgrounds** -- all sprites and tiles on transparent PNG
- **No anti-aliasing to background** -- keep edges crisp pixel-to-pixel

---

## Base prompt

Prepend this to all generation prompts for consistency:

```
32-bit pixel art, top-down 3/4 view RPG style, consistent top-left light source,
soft sub-pixel shading with 3-4 value ramps per color, selective dark outlines
(hue-shifted not black), slight dithering on large surfaces, warm muted palette,
cozy indie game aesthetic, clean readable silhouettes, no anti-aliasing to
background, transparent background, PNG
```

---

## Character sprite sheets

Characters are 64x64 pixels per frame. Sprite sheets are organized as grids where each row is a direction or action and each column is an animation frame.

### Walking sprite sheet (required for every character)

```
[BASE PROMPT], character sprite sheet for a pixel RPG, 64x64 pixel character,
4 rows x 4 columns grid layout on single image,
row 1: walking down (toward camera) 4 frames,
row 2: walking up (away from camera) 4 frames,
row 3: walking left 4 frames,
row 4: walking right 4 frames,
young professional office worker, casual modern clothing, [CHARACTER DESCRIPTION],
subtle walk cycle bob, arms swinging, consistent proportions across all frames
```

### Action sprite sheet (extends a character)

```
[BASE PROMPT], character action sprite sheet for a pixel RPG, 64x64 pixel character,
same character as reference, 4 rows x 4 columns grid layout on single image,
row 1: sitting at desk typing on computer 4 frames,
row 2: sleeping head down or on couch 2 frames then idle 2 frames,
row 3: talking with hand gestures 4 frames,
row 4: standing idle facing camera with subtle breathing animation 4 frames,
[CHARACTER DESCRIPTION], consistent with walking sheet style
```

### Alert/intercom pose (single frame)

```
[BASE PROMPT], single 64x64 pixel character sprite, facing directly toward camera,
alert attentive pose, eyes wide looking at viewer, slight lean forward,
[CHARACTER DESCRIPTION], same style as sprite sheet
```

### Character description tokens

Swap `[CHARACTER DESCRIPTION]` for any of these (or make your own):

- `short brown hair, red hoodie, jeans`
- `long black hair, blue blazer, dark pants`
- `curly orange hair, green t-shirt, khakis`
- `buzz cut, purple sweater, gray pants`
- `messy blonde hair, white button-up, rolled sleeves`
- `pink pixie cut, yellow cardigan, black skirt`
- `silver hair in bun, teal turtleneck, dark slacks`
- `dark braids, orange flannel shirt, cargo pants`

---

## Tilesets

Tiles are 32x32 pixels. Tilesets are grids of tiles in a single image. Tiles must be seamless -- edges match up when placed next to each other.

### Office floor and walls

```
[BASE PROMPT], tileset grid for a pixel RPG office room, 32x32 tiles,
8 columns x 8 rows on single image, seamless tiling,
include: hardwood floor planks (4 variations),
dark blue-gray wall (top face and side face),
wall-floor transition tiles,
corner pieces (inner and outer),
carpet/rug tile (2 variations),
floor shadow edge tiles for props,
consistent warm office lighting, all tiles align perfectly at edges
```

### Office props

```
[BASE PROMPT], props sprite set for a pixel RPG office, 32x32 grid aligned,
top-down 3/4 view, each item on transparent background, single image layout,
include: modern desk with computer monitor (2 tiles wide),
office chair (occupied and empty),
coffee machine on counter,
couch/sofa (3 tiles wide),
bookshelf, potted plant,
whiteboard on wall,
wall-mounted intercom/speaker,
desk lamp, water cooler,
warm office lighting from top-left, consistent style across all items
```

### Cafe props

```
[BASE PROMPT], props sprite set for a pixel RPG cozy cafe, 32x32 grid aligned,
top-down 3/4 view, each item on transparent background, single image layout,
include: small round cafe table,
bar counter (3 tiles wide),
espresso machine,
bar stool, cafe chair,
hanging pendant light,
menu board on wall,
coffee cup (on table), pastry display case,
warm amber lighting, exposed brick feeling
```

### Lab / server room

```
[BASE PROMPT], props sprite set for a pixel RPG server room/tech lab,
32x32 grid aligned, top-down 3/4 view, transparent background, single image,
include: server rack with blinking LEDs (green and blue),
workbench with monitor,
terminal station with glowing screen,
cable runs on floor,
tech equipment rack,
rolling chair,
cool blue-tinted lighting mixed with warm monitor glow
```

---

## Effects and UI elements

Small pixel elements for particles, bubbles, and status indicators. These are 16x16 or smaller.

```
[BASE PROMPT], small pixel art UI elements and particles, transparent background,
single sheet, include:
Zzz sleep bubbles (3 sizes),
thought bubble with dots,
red exclamation mark,
speech bubble (empty, pointing down-left),
yellow star sparkle (3 frame animation),
small heart,
coffee steam wisps (3 frames),
monitor screen glow effect,
all elements at 16x16 or smaller, crisp and readable at small size
```

---

## Tips for generation

### Grid alignment

AI generators don't always produce clean grids. After generating, you may need to:
1. Verify each cell is exactly 32x32 or 64x64
2. Cut the output into individual frames
3. Re-assemble on a clean grid if alignment is off

A tool like Aseprite, LibreSprite, or even a script can help automate this.

### Consistency between sheets

Generate all characters in one session if possible. If you generate them across multiple sessions, the style will drift. At minimum, always use the same base prompt and reference the same style words.

### Test at render size

64x64 sprites look amazing zoomed in. Always check them at the actual size they appear on screen (usually 2x or 3x CSS scale). Some details blur together or become noise at small sizes.

### Transparent backgrounds

Always request transparent PNG. If the generator produces a colored background, you need to remove it. Most generators support this natively. If not, use a background removal tool before importing.

### Outline color

If the generator uses pure black (#000000) outlines, it will look harsh. The best pixel art uses dark versions of the fill color as the outline. You can specify "no pure black outlines, use hue-shifted dark outlines" in the prompt, or fix this in post by replacing #000 with contextual dark colors.

### Frame count

For smooth animation at the small sizes we render:
- Walk cycles: 4 frames per direction is standard
- Idle: 2-4 frames (subtle breathing or shifting)
- Actions (typing, sleeping): 2-4 frames
- More frames = smoother but more work. 4 is the sweet spot.

---

## File naming convention

```
citizens/sprites/
  morty_walk.png      # 4x4 grid, 64x64 frames (256x256 total)
  morty_actions.png   # 4x4 grid, 64x64 frames
  dexter_walk.png
  dexter_actions.png

tilesets/
  office_floor.png    # 8x8 grid, 32x32 tiles (256x256 total)
  office_walls.png
  office_props.png

effects/
  particles.png       # Mixed sizes, 16x16 grid
```

---

## Contributing art

If you're contributing pixel art to the project:

1. Follow the resolution and style guidelines above
2. Use the base prompt or match its aesthetic if drawing by hand
3. Include all required animation frames (walk 4-dir is minimum for characters)
4. Export as PNG with transparent background
5. Name files according to the convention above
6. Test your sprites in the demo before submitting (`npm run dev`)
