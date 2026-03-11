/**
 * World generation pipeline:
 * prompt/image → LLM plan → generate textures & props → assemble scene
 */

import { llmJSON } from './llm.js';
import { generateTexture, generateObject } from './pipeline.js';
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
  props: {
    id: string;
    prompt: string;
    count: number;
    w: number;
    h: number;
    layer: 'below' | 'above';
    anchorType?: 'work' | 'rest' | 'social' | 'utility';
  }[];
  layout: {
    floor: string[][];
    placements: {
      propsIndex: number;
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
  /** Number of citizens to assign desks for (default 4) */
  citizens?: number;
  /** LLM model to use for planning */
  model?: string;
}

export interface GenerateWorldResult {
  /** Path to generated scene.json */
  scenePath: string;
  /** Paths to prop sprite PNGs */
  propsPaths: string[];
  /** The world plan from the LLM */
  plan: WorldPlan;
}

// --- Planning prompt ---

const PLAN_SYSTEM = `You are a pixel art workspace designer for a top-down RPG-style office simulation game.
You output ONLY valid JSON — no explanation, no markdown, no comments.

CRITICAL ART DIRECTION:
- All props and objects are viewed from STRAIGHT TOP-DOWN (bird's eye, 90 degrees).
- NOT 3/4 view, NOT isometric, NOT angled. Like looking at a floor plan.
- Prop prompts MUST specify "straight top-down bird's eye view" explicitly.

Design rules:
- Grid is tile-based. Each tile is 32x32 pixels.
- WALL PLACEMENT (critical for top-down perspective):
  The TOP TWO rows (row 0 AND row 1) should use the wall texture ID (e.g. "main_wall"). This is the "back wall"
  facing the camera — 2 tiles tall to match character height and create depth.
  The LEFT, RIGHT, and BOTTOM edges should be the floor texture ID (e.g. "main_floor") — floor bleeds to the edge.
  Also place wall texture on any 2 rows directly below deadspace tiles, as these represent
  south-facing wall faces visible from above.
  Both wall rows are NON-WALKABLE.
- Floor tiles use the texture ID string (e.g. "main_floor"). Deadspace (void) is "" (empty string).
- The floor array uses STRINGS — the texture ID from the textures array. NOT numbers.
- Props have fractional positions and sizes in tile units.
- Each desk MUST have a computer/monitor on it — include "with monitor and keyboard" in every desk prompt.
- Each desk needs a work anchor at offset (1, 2) from its top-left.
- Chairs go near desks at layer "above", everything else "below".
- CHAIR ORIENTATION: Chairs must face AWAY from camera (we see the BACK of the chair, not the front/seat). The prompt for chairs MUST specify "back of chair facing the viewer, seat facing away".
- Leave walkable corridors (at least 2 tiles wide) between props.
- Include wander points in open areas for idle movement.
- Room shapes can be non-rectangular using deadspace ("").
- Prop IDs are descriptive slugs like "desk", "couch", "plant", etc.
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

function buildPlanPrompt(description: string, citizens: number): string {
  return `Design a workspace based on this description: "${description}"

It needs at least ${citizens} work desks (with chairs), plus social/rest/utility props.

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
  "props": [
    {
      "id": "<slug>",
      "prompt": "<detailed visual description for AI image generation — MUST include 'straight top-down bird's eye view' in every prompt>",
      "count": <how many to place>,
      "w": <width in tiles>,
      "h": <height in tiles>,
      "layer": "below" or "above",
      "anchorType": "work"|"rest"|"social"|"utility" (optional, only for interactive props)
    },
    ...include wall decorations like windows, whiteboards, posters, wall clocks etc.
    ...wall decorations are placed ON wall tiles and make the space feel alive
  ],
  "layout": {
    "floor": [<2D array of texture ID strings, row by row. Use the "id" from the textures array. "" for deadspace>],
    "placements": [
      { "propsIndex": <index into props array>, "x": <tile x>, "y": <tile y> },
      ...one entry per prop instance (respect count field)
    ],
    "wanderPoints": [
      { "name": "wander_<area>", "x": <tile x>, "y": <tile y> },
      ...2-4 wander points in open walkable areas
    ]
  }
}

Rules for the floor array:
- It must be exactly gridRows rows, each with gridCols STRING values
- Each value is a texture ID from the textures array (e.g. "main_floor", "main_wall", "carpet_accent")
- Rows 0 and 1 (top two) = wall texture ID — this is the back wall, 2 tiles tall
- Last row, col 0, last col = floor texture ID — floor bleeds full to every edge except the top
- Any 2 rows directly below deadspace should be wall texture ID to show south-facing wall faces
- Use deadspace ("" empty string) creatively for non-rectangular room shapes

Rules for placements:
- Don't overlap props
- Keep at least 1 tile of walkable space around interactive props
- Place desks with chairs: chair at (desk.x + 1, desk.y + desk.h - 0.5), layer "above"
- propsIndex references the props array by index
- Place wall decorations (windows, posters, whiteboards) on the back wall (rows 0-1)
- Wall decorations should be 2 tiles tall to fill the wall height
- Include at least 2-4 wall decorations on the back wall to make the space interesting`;
}

function buildVisionPlanPrompt(citizens: number): string {
  return `Analyze this reference image of a workspace/office. Design a pixel art game version of it.

Identify the key elements: floor type, wall style, props, layout zones.

It needs at least ${citizens} work desks (with chairs), plus any props you see in the image.

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
  "props": [
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
    "floor": [<2D array of texture ID strings matching gridRows x gridCols>],
    "placements": [
      { "propsIndex": <index into props array>, "x": <tile x>, "y": <tile y> },
      ...place wall decorations ON wall tiles (row 0, last row, col 0, last col)
    ],
    "wanderPoints": [
      { "name": "wander_<area>", "x": <tile x>, "y": <tile y> },
      ...
    ]
  }
}

Match the style and layout of the reference image as closely as possible in a tile-based grid.
CRITICAL: All prop prompts must specify "straight top-down bird's eye view" — NOT 3/4 view, NOT isometric.
Include wall decorations (windows, posters, etc.) on the TOP wall (row 0) only.
Rows 0-1 = wall texture ID, 2 tiles tall. Left/right/bottom edges = floor texture ID, full bleed. "" for deadspace.`;
}

// --- Pipeline ---

export async function generateWorld(options: GenerateWorldOptions): Promise<GenerateWorldResult> {
  const { prompt, output, citizens = 4, model } = options;
  // Upload local image to fal storage if needed
  const refImage = options.refImage ? await ensureUrl(options.refImage) : undefined;

  const spritesDir = path.join(output, 'world_assets', 'props');
  const tilesDir = path.join(output, 'world_assets', 'tiles');
  mkdirSync(spritesDir, { recursive: true });
  mkdirSync(tilesDir, { recursive: true });

  // Step 1: LLM plans the world
  console.log('Planning world layout...');
  const plan = await llmJSON<WorldPlan>({
    prompt: refImage
      ? buildVisionPlanPrompt(citizens)
      : buildPlanPrompt(prompt, citizens),
    systemPrompt: PLAN_SYSTEM,
    imageUrl: refImage,
    model,
  });
  console.log(`Plan: "${plan.name}" — ${plan.gridCols}x${plan.gridRows}, ${plan.textures.length} textures, ${plan.props.length} prop types`);

  // Save plan for debugging
  writeFileSync(path.join(output, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');

  // Step 2: Generate textures (parallel) — pass refImage for style matching
  console.log(`Generating ${plan.textures.length} textures...`);
  await Promise.all(
    plan.textures.map(async (tex, i) => {
      const outPath = path.join(tilesDir, `${tex.id}.png`);
      console.log(`  [${i}] ${tex.id}: ${tex.prompt.slice(0, 60)}...`);
      await generateTexture({
        prompt: tex.prompt,
        refImage,
        output: outPath,
        size: 32,
      });
    }),
  );

  // Step 3: Generate prop sprites (parallel, one per unique type)
  console.log(`Generating ${plan.props.length} prop types...`);
  const propsPaths: string[] = [];
  await Promise.all(
    plan.props.map(async (prop, i) => {
      const outPath = path.join(spritesDir, `prop_${i}_${prop.id}.png`);
      console.log(`  [${i}] ${prop.id}: ${prop.prompt.slice(0, 60)}...`);
      await generateObject({
        prompt: prop.prompt,
        refImage,
        output: outPath,
      });
      propsPaths[i] = outPath;
    }),
  );

  // Step 5: Build scene.json
  console.log('Assembling scene...');
  const scene = buildScene(plan, citizens);
  const scenePath = path.join(output, 'world.json');
  writeFileSync(scenePath, JSON.stringify(scene, null, 2) + '\n');
  console.log(`Scene saved: ${scenePath}`);

  return { scenePath, propsPaths, plan };
}

// --- Scene assembly ---

interface SceneJSON {
  gridCols: number;
  gridRows: number;
  floor: string[][];
  props: {
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
  /** Maps prop ID → sprite path (relative to world dir) */
  propImages: Record<string, string>;
  /** Maps tile key → tile image path (relative to world dir) */
  tiles: Record<string, string>;
}

function buildScene(plan: WorldPlan, citizenCount: number): SceneJSON {
  const props: SceneJSON['props'] = [];
  const workAnchors: string[] = [];
  let pieceIndex = 0;

  for (const placement of plan.layout.placements) {
    const prop = plan.props[placement.propsIndex];
    if (!prop) continue;

    const piece: SceneJSON['props'][0] = {
      id: prop.id,
      x: placement.x,
      y: placement.y,
      w: prop.w,
      h: prop.h,
      layer: prop.layer,
    };

    // Add anchors for interactive props
    if (prop.anchorType) {
      const anchorName = `${prop.id}_${pieceIndex}_0`;
      const ox = prop.anchorType === 'work' ? 1 : prop.w / 2;
      const oy = prop.anchorType === 'work' ? 2 : prop.h;
      piece.anchors = [{
        name: anchorName,
        ox,
        oy,
        type: prop.anchorType,
      }];
      if (prop.anchorType === 'work') {
        workAnchors.push(anchorName);
      }
    }

    props.push(piece);
    pieceIndex++;
  }

  // Assign citizens to work anchors
  const defaultNames = ['morty', 'dexter', 'nova', 'rio', 'sage', 'ember', 'flux', 'pixel'];
  const characters: Record<string, string> = {};
  for (let i = 0; i < citizenCount && i < workAnchors.length; i++) {
    characters[defaultNames[i] ?? `agent_${i}`] = workAnchors[i];
  }

  // Build prop images map: prop ID → sprite path
  const propImages: Record<string, string> = {};
  for (let i = 0; i < plan.props.length; i++) {
    const prop = plan.props[i];
    propImages[prop.id] = `/world_assets/props/prop_${i}_${prop.id}.png`;
  }

  // Build tiles map: texture ID → relative path to tile PNG
  const tiles: Record<string, string> = {};
  for (const tex of plan.textures) {
    tiles[tex.id] = `/world_assets/tiles/${tex.id}.png`;
  }

  return {
    gridCols: plan.gridCols,
    gridRows: plan.gridRows,
    floor: plan.layout.floor,
    props,
    characters,
    wanderPoints: plan.layout.wanderPoints,
    propImages,
    tiles,
  };
}
