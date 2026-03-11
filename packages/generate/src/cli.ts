#!/usr/bin/env node

import { generateCharacter, generateProps, generateObject, generateTexture, processExistingImage } from './pipeline.js';
import { generateWorld } from './world.js';

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

/** Collect all values after --name until the next --flag or end of args */
function getMultiFlag(name: string): string[] {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return [];
  const values: string[] = [];
  for (let i = idx + 1; i < args.length; i++) {
    if (args[i].startsWith('--')) break;
    values.push(args[i]);
  }
  return values;
}

function printUsage() {
  console.log(`
miniverse-generate — AI sprite generator for Miniverse

Usage:
  miniverse-generate character --prompt "description" [options]
  miniverse-generate object --prompt "description" --output path
  miniverse-generate props --prompt "description" [options]
  miniverse-generate texture --prompt "description" --output path
  miniverse-generate world --prompt "description" --output ./my-world/
  miniverse-generate world --image reference.jpg --output ./my-world/
  miniverse-generate process --input file.png --type character|props --output path

Commands:
  character   Generate a character walk/action sprite sheet
  object      Generate a single object/prop piece
  props       Generate prop pieces (multi-item set)
  texture     Generate a seamless tileable texture (floor, wall, etc.)
  world       Generate an entire workspace (textures, props, layout)
  process     Process an existing raw image (skip generation)

Options:
  --prompt      Character or prop description (required for generate)
  --image       Reference image URL or path (for fal edit mode)
  --type        Sheet type: 'walk' or 'action' (default: walk)
  --output      Output file path (character/texture) or directory (props)
  --size        Tile size for textures (default: 32)
  --citizens    Number of work desks/citizens for world command (default: 4)
  --model       LLM model for world planning (default: google/gemini-2.5-flash)
  --input       Input image path (for process command)
  --skip-bg     Skip background removal
  --help        Show this help

Environment:
  FAL_KEY       fal.ai API key (required for generation)

Examples:
  miniverse-generate character \\
    --prompt "young female, pink hair, yellow cardigan" \\
    --output sprites/nova_walk.png

  miniverse-generate character \\
    --prompt "male developer, red hoodie" \\
    --image reference.png \\
    --output sprites/morty_walk.png

  miniverse-generate props \\
    --prompt "cozy cafe props set" \\
    --output sprites/cafe/

  miniverse-generate texture \\
    --prompt "warm wooden floor planks" \\
    --output tiles/floor.png

  miniverse-generate texture \\
    --prompt "stone brick wall" \\
    --output tiles/wall.png

  miniverse-generate world \\
    --prompt "cozy startup office with lots of plants" \\
    --output ./my-world/

  miniverse-generate world \\
    --image office-photo.jpg \\
    --output ./my-world/ --citizens 6

  miniverse-generate process \\
    --input raw_sprite.png \\
    --type character \\
    --output clean_sprite.png
  `);
}

async function main() {
  if (!command || command === '--help' || command === '-h') {
    printUsage();
    process.exit(0);
  }

  if (command === 'process') {
    const input = getFlag('input');
    const type = getFlag('type') as 'character' | 'props';
    const output = getFlag('output');
    if (!input || !type || !output) {
      console.error('Error: --input, --type, and --output are required for process command');
      process.exit(1);
    }
    await processExistingImage(input, type, output, { skipBgRemoval: hasFlag('skip-bg') });
    return;
  }

  if (command === 'world') {
    const prompt = getFlag('prompt') ?? '';
    const image = getFlag('image');
    const output = getFlag('output') ?? './world-output/';
    const citizens = getFlag('citizens') ? parseInt(getFlag('citizens')!, 10) : 4;
    const model = getFlag('model');
    if (!prompt && !image) {
      console.error('Error: --prompt or --image is required for world command');
      process.exit(1);
    }
    if (!process.env.FAL_KEY) {
      console.error('Error: FAL_KEY environment variable is required');
      process.exit(1);
    }
    const result = await generateWorld({
      prompt: prompt || 'modern office workspace',
      refImage: image,
      output,
      citizens,
      model: model,
    });
    console.log(`\nWorld generated in: ${output}`);
    console.log(`  Scene:   ${result.scenePath}`);
    console.log(`  Sprites: ${result.propsPaths.length} prop pieces`);
    console.log('Done!');
    return;
  }

  const prompt = getFlag('prompt');
  if (!prompt) {
    console.error('Error: --prompt is required');
    process.exit(1);
  }

  if (!process.env.FAL_KEY) {
    console.error('Error: FAL_KEY environment variable is required');
    console.error('Get your key at https://fal.ai/dashboard/keys');
    process.exit(1);
  }

  if (command === 'character') {
    const output = getFlag('output') ?? 'character_walk.png';
    await generateCharacter({
      prompt,
      refImage: getFlag('image'),
      type: (getFlag('type') as 'walk' | 'action') ?? 'walk',
      output,
      skipBgRemoval: hasFlag('skip-bg'),
    });
  } else if (command === 'object') {
    const output = getFlag('output') ?? 'object.png';
    await generateObject({
      prompt,
      refImage: getFlag('image'),
      output,
      skipBgRemoval: hasFlag('skip-bg'),
    });
  } else if (command === 'props') {
    const output = getFlag('output') ?? 'props/';
    await generateProps({
      prompt,
      refImage: getFlag('image'),
      output,
      skipBgRemoval: hasFlag('skip-bg'),
    });
  } else if (command === 'texture') {
    const output = getFlag('output') ?? 'texture.png';
    const size = getFlag('size') ? parseInt(getFlag('size')!, 10) : 32;
    await generateTexture({
      prompt,
      refImage: getFlag('image'),
      output,
      size,
    });
  } else {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }

  console.log('Done!');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
