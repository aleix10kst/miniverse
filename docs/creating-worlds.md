# Creating Worlds

A world is a theme pack that defines the look, feel, and layout of a Miniverse scene.

## Directory Structure

```
worlds/my-world/
  world.json              # World metadata
  tilesets/
    tiles.png             # Tileset spritesheet
  scenes/
    main.json             # Room layout
  objects/
    intercom.json         # Interactive object configs
  citizens/
    default.json          # Default citizen animation mappings
    sprites/              # Sprite sheets
  effects/
    particles.json        # Particle effect definitions
```

## world.json

```json
{
  "name": "my-world",
  "description": "A custom world",
  "tileSize": 16,
  "canvasWidth": 256,
  "canvasHeight": 192,
  "defaultScale": 2,
  "scenes": ["main"],
  "defaultScene": "main"
}
```

## Scene Layout

Scenes define the tile grid, walkable areas, and named locations.

Named locations are where citizens sit, walk to, and interact with. They map to `CitizenConfig.position` values.

## Tilesets

Tilesets are standard spritesheets. Each tile is referenced by a numeric ID (left-to-right, top-to-bottom). Tile 0 is the top-left tile.

Compatible with LimeZu-style Modern Interiors packs and similar pixel art tilesets.

## Citizen Animations

Each citizen has named animation states mapped to rows in a sprite sheet:

```json
{
  "idle_down": { "sheet": "base", "row": 0, "frames": 2, "speed": 0.5 },
  "walk_left": { "sheet": "base", "row": 2, "frames": 4, "speed": 0.15 }
}
```

- `sheet`: which sprite sheet image to use
- `row`: which row in the sheet
- `frames`: number of frames in the animation
- `speed`: seconds per frame
