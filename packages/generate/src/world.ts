/**
 * World generation pipeline:
 * prompt/image → LLM plan → generate textures & furniture → assemble scene
 */

import { llmJSON } from './llm.js';
import { generateTexture, generateObject, buildTileset } from './pipeline.js';
import { ensureUrl } from './fal.js';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

// --- Types ---

export interface WorldPlan {
  name: string;
  gridCols: number;
  gridRows: number;
  textures: {
    id: string;
    prompt: string;
    role: 'floor' | 'wall' | 'accent';
  }[];
  furniture: {
    id: string;
    prompt: string;
    count: number;
    w: number;
    h: number;
    layer: 'below' | 'above';
    anchorType?: 'work' | 'rest' | 'social' | 'utility';
  }[];
  layout: {
    floor: number[][];
    placements: {
      furnitureIndex: number;
      x: number;
      y: number;
    }[];
    wanderPoints: { name: string; x: number; y: number }[];
  };
}

export interface GenerateWorldOptions {
  /** Description of the workspace */
  prompt: string;
  /** Reference image URL or path */
  refImage?: string;
  /** Output directory for all generated assets */
  output: string;
  /** Number of residents to assign desks for (default 4) */
  residents?: number;
  /** LLM model to use for planning */
  model?: string;
}

export interface GenerateWorldResult {
  /** Path to generated scene.json */
  scenePath: string;
  /** Path to tileset atlas */
  tilesetPath: string;
  /** Paths to furniture sprite PNGs */
  furniturePaths: string[];
  /** The world plan from the LLM */
  plan: WorldPlan;
}

// --- Planning prompt ---

const PLAN_SYSTEM = `You are a pixel art workspace designer for a top-down RPG-style office simulation game.
You output ONLY valid JSON — no explanation, no markdown, no comments.

CRITICAL ART DIRECTION:
- All furniture and objects are viewed from STRAIGHT TOP-DOWN (bird's eye, 90 degrees).
- NOT 3/4 view, NOT isometric, NOT angled. Like looking at a floor plan.
- Furniture prompts MUST specify "straight top-down bird's eye view" explicitly.

Design rules:
- Grid is tile-based. Each tile is 32x32 pixels.
- WALL PLACEMENT (critical for top-down perspective):
  The TOP TWO rows (row 0 AND row 1) should use the wall texture (index 1). This is the "back wall"
  facing the camera — 2 tiles tall to match character height and create depth.
  The LEFT, RIGHT, and BOTTOM edges should be regular FLOOR (0) — floor bleeds to the edge.
  Also place wall texture (1) on any 2 rows directly below deadspace tiles, as these represent
  south-facing wall faces visible from above.
  Both wall rows are NON-WALKABLE.
- Floor tiles are index 0. Deadspace (void) is -1.
- Furniture has fractional positions and sizes in tile units.
- Each desk MUST have a computer/monitor on it — include "with monitor and keyboard" in every desk prompt.
- Each desk needs a work anchor at offset (1, 2) from its top-left.
- Chairs go near desks at layer "above", everything else "below".
- Leave walkable corridors (at least 2 tiles wide) between furniture.
- Include wander points in open areas for idle movement.
- Room shapes can be non-rectangular using deadspace (-1).
- Furniture IDs are descriptive slugs like "desk", "couch", "plant", etc.
- Grid should be exactly 16x16 tiles. Do not exceed this.
- IMPORTANT: Include wall decorations! Windows, whiteboards, posters, clocks, rugs, etc.
  Wall decorations go on the back wall (rows 0-1) — that's the only visible wall face.
  They use layer "below" and can be up to 2 tiles tall to fill the wall. They make the space feel alive.
- NEVER include ceiling-mounted objects (pendant lights, chandeliers, recessed speakers, ceiling fans, etc.).
  The camera looks straight down so ceilings are not visible. Only include things on the floor or walls.
- Texture prompts must describe SUBTLE, QUIET, single-tone surfaces. Floors should be simple muted flat
  surfaces — not loud, not multicolor, not high-contrast. They should recede into the background.
  Example good: "plain light oak wood planks, muted warm brown, minimal grain detail"
  Example bad: "colorful geometric pattern with bright accents and detailed wood grain"`;

function buildPlanPrompt(description: string, residents: number): string {
  return `Design a workspace based on this description: "${description}"

It needs at least ${residents} work desks (with chairs), plus social/rest/utility furniture.

Output a JSON object with this exact structure:
{
  "name": "workspace-name",
  "gridCols": <number>,
  "gridRows": <number>,
  "textures": [
    { "id": "main_floor", "prompt": "<texture description>", "role": "floor" },
    { "id": "main_wall", "prompt": "<texture description>", "role": "wall" },
    ...more textures (2-6 total, include accent textures for interesting areas)
  ],
  "furniture": [
    {
      "id": "<slug>",
      "prompt": "<detailed visual description for AI image generation — MUST include 'straight top-down bird's eye view' in every prompt>",
      "count": <how many to place>,
      "w": <width in tiles>,
      "h": <height in tiles>,
      "layer": "below" or "above",
      "anchorType": "work"|"rest"|"social"|"utility" (optional, only for interactive furniture)
    },
    ...include wall decorations like windows, whiteboards, posters, wall clocks etc.
    ...wall decorations are placed ON wall tiles and make the space feel alive
  ],
  "layout": {
    "floor": [<2D array of tile indices, row by row. 0=floor, 1=wall, -1=deadspace, 2+=accent textures>],
    "placements": [
      { "furnitureIndex": <index into furniture array>, "x": <tile x>, "y": <tile y> },
      ...one entry per furniture instance (respect count field)
    ],
    "wanderPoints": [
      { "name": "wander_<area>", "x": <tile x>, "y": <tile y> },
      ...2-4 wander points in open walkable areas
    ]
  }
}

Rules for the floor array:
- It must be exactly gridRows rows, each with gridCols values
- Rows 0 and 1 (top two) = wall texture (1) — this is the back wall, 2 tiles tall
- Last row, col 0, last col = floor (0) — floor bleeds full to every edge except the top
- Any 2 rows directly below deadspace should be wall (1) to show south-facing wall faces
- Texture indices: 0 = first texture, 1 = second texture, etc. (matching textures array order)
- Use deadspace (-1) creatively for non-rectangular room shapes

Rules for placements:
- Don't overlap furniture pieces
- Keep at least 1 tile of walkable space around interactive furniture
- Place desks with chairs: chair at (desk.x + 1, desk.y + desk.h - 0.5), layer "above"
- furnitureIndex references the furniture array by index
- Place wall decorations (windows, posters, whiteboards) on the back wall (rows 0-1)
- Wall decorations should be 2 tiles tall to fill the wall height
- Include at least 2-4 wall decorations on the back wall to make the space interesting`;
}

function buildVisionPlanPrompt(residents: number): string {
  return `Analyze this reference image of a workspace/office. Design a pixel art game version of it.

Identify the key elements: floor type, wall style, furniture pieces, layout zones.

It needs at least ${residents} work desks (with chairs), plus any furniture you see in the image.

Output a JSON object with this exact structure:
{
  "name": "workspace-name",
  "gridCols": <number>,
  "gridRows": <number>,
  "textures": [
    { "id": "main_floor", "prompt": "<texture description matching the image>", "role": "floor" },
    { "id": "main_wall", "prompt": "<texture description matching the image>", "role": "wall" },
    ...more textures
  ],
  "furniture": [
    {
      "id": "<slug>",
      "prompt": "<detailed visual description — MUST include 'straight top-down bird's eye view' in every prompt>",
      "count": <how many to place>,
      "w": <width in tiles>,
      "h": <height in tiles>,
      "layer": "below" or "above",
      "anchorType": "work"|"rest"|"social"|"utility" (optional)
    },
    ...include wall decorations like windows, whiteboards, posters
  ],
  "layout": {
    "floor": [<2D array matching gridRows x gridCols>],
    "placements": [
      { "furnitureIndex": <index into furniture array>, "x": <tile x>, "y": <tile y> },
      ...place wall decorations ON wall tiles (row 0, last row, col 0, last col)
    ],
    "wanderPoints": [
      { "name": "wander_<area>", "x": <tile x>, "y": <tile y> },
      ...
    ]
  }
}

Match the style and layout of the reference image as closely as possible in a tile-based grid.
CRITICAL: All furniture prompts must specify "straight top-down bird's eye view" — NOT 3/4 view, NOT isometric.
Include wall decorations (windows, posters, etc.) on the TOP wall (row 0) only.
Rows 0-1 = wall (1), 2 tiles tall. Left/right/bottom edges = floor (0), full bleed. Accent textures are 2+.`;
}

// --- Pipeline ---

export async function generateWorld(options: GenerateWorldOptions): Promise<GenerateWorldResult> {
  const { prompt, output, residents = 4, model } = options;
  // Upload local image to fal storage if needed
  const refImage = options.refImage ? await ensureUrl(options.refImage) : undefined;

  const spritesDir = path.join(output, 'sprites');
  const tilesetsDir = path.join(output, 'tilesets');
  mkdirSync(spritesDir, { recursive: true });
  mkdirSync(tilesetsDir, { recursive: true });

  // Step 1: LLM plans the world
  console.log('Planning world layout...');
  const plan = await llmJSON<WorldPlan>({
    prompt: refImage
      ? buildVisionPlanPrompt(residents)
      : buildPlanPrompt(prompt, residents),
    systemPrompt: PLAN_SYSTEM,
    imageUrl: refImage,
    model,
  });
  console.log(`Plan: "${plan.name}" — ${plan.gridCols}x${plan.gridRows}, ${plan.textures.length} textures, ${plan.furniture.length} furniture types`);

  // Save plan for debugging
  writeFileSync(path.join(output, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');

  // Step 2: Generate textures (parallel) — pass refImage for style matching
  console.log(`Generating ${plan.textures.length} textures...`);
  const textureResults = await Promise.all(
    plan.textures.map(async (tex, i) => {
      const outPath = path.join(tilesetsDir, `${tex.id}.png`);
      console.log(`  [${i}] ${tex.id}: ${tex.prompt.slice(0, 60)}...`);
      await generateTexture({
        prompt: tex.prompt,
        refImage,
        output: outPath,
        size: 32,
      });
      return outPath;
    }),
  );

  // Step 3: Assemble tileset atlas
  console.log('Assembling tileset...');
  const tilesetPath = path.join(tilesetsDir, 'tileset.png');
  await buildTileset({
    tiles: textureResults,
    output: tilesetPath,
    columns: 16,
  });

  // Step 4: Generate furniture sprites (parallel, one per unique type)
  console.log(`Generating ${plan.furniture.length} furniture types...`);
  const furniturePaths: string[] = [];
  await Promise.all(
    plan.furniture.map(async (furn, i) => {
      const outPath = path.join(spritesDir, `furniture_${i}_${furn.id}.png`);
      console.log(`  [${i}] ${furn.id}: ${furn.prompt.slice(0, 60)}...`);
      await generateObject({
        prompt: furn.prompt,
        refImage,
        output: outPath,
      });
      furniturePaths[i] = outPath;
    }),
  );

  // Step 5: Build scene.json
  console.log('Assembling scene...');
  const scene = buildScene(plan, residents);
  const scenePath = path.join(output, 'scene.json');
  writeFileSync(scenePath, JSON.stringify(scene, null, 2) + '\n');
  console.log(`Scene saved: ${scenePath}`);

  return { scenePath, tilesetPath, furniturePaths, plan };
}

// --- Scene assembly ---

interface SceneJSON {
  gridCols: number;
  gridRows: number;
  floor: number[][];
  furniture: {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    layer: 'below' | 'above';
    anchors?: { name: string; ox: number; oy: number; type: string }[];
  }[];
  characters: Record<string, string>;
  wanderPoints: { name: string; x: number; y: number }[];
  /** Maps furniture ID → sprite path (relative to public/) */
  spriteMap: Record<string, string>;
  /** Maps tile index → display name for editor */
  tileNames: Record<number, string>;
}

function buildScene(plan: WorldPlan, residentCount: number): SceneJSON {
  const furniture: SceneJSON['furniture'] = [];
  const workAnchors: string[] = [];
  let pieceIndex = 0;

  for (const placement of plan.layout.placements) {
    const furn = plan.furniture[placement.furnitureIndex];
    if (!furn) continue;

    const piece: SceneJSON['furniture'][0] = {
      id: furn.id,
      x: placement.x,
      y: placement.y,
      w: furn.w,
      h: furn.h,
      layer: furn.layer,
    };

    // Add anchors for interactive furniture
    if (furn.anchorType) {
      const anchorName = `${furn.id}_${pieceIndex}_0`;
      const ox = furn.anchorType === 'work' ? 1 : furn.w / 2;
      const oy = furn.anchorType === 'work' ? 2 : furn.h;
      piece.anchors = [{
        name: anchorName,
        ox,
        oy,
        type: furn.anchorType,
      }];
      if (furn.anchorType === 'work') {
        workAnchors.push(anchorName);
      }
    }

    furniture.push(piece);
    pieceIndex++;
  }

  // Assign residents to work anchors
  const defaultNames = ['morty', 'dexter', 'nova', 'rio', 'sage', 'ember', 'flux', 'pixel'];
  const characters: Record<string, string> = {};
  for (let i = 0; i < residentCount && i < workAnchors.length; i++) {
    characters[defaultNames[i] ?? `agent_${i}`] = workAnchors[i];
  }

  // Build sprite map: furniture ID → sprite path
  const spriteMap: Record<string, string> = {};
  for (let i = 0; i < plan.furniture.length; i++) {
    const furn = plan.furniture[i];
    spriteMap[furn.id] = `/sprites/furniture_${i}_${furn.id}.png`;
  }

  // Build tile names from textures
  const tileNames: Record<number, string> = {};
  for (let i = 0; i < plan.textures.length; i++) {
    tileNames[i] = plan.textures[i].id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  return {
    gridCols: plan.gridCols,
    gridRows: plan.gridRows,
    floor: plan.layout.floor,
    furniture,
    characters,
    wanderPoints: plan.layout.wanderPoints,
    spriteMap,
    tileNames,
  };
}
