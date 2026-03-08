/**
 * fal.ai API wrapper for Nano Banana Pro image generation.
 */

import { fal } from '@fal-ai/client';
import { readFileSync, existsSync } from 'fs';

export interface GenerateOptions {
  prompt: string;
  refImage?: string; // URL or local path for nano-banana-pro-edit
}

export interface GenerateResult {
  imageUrl: string;
}

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const { prompt, refImage } = options;

  const input: Record<string, unknown> = { prompt };
  if (refImage) input.image_url = refImage;

  const result = await fal.subscribe('fal-ai/nano-banana-pro', { input });
  const data = result.data as { images: { url: string }[] };
  return { imageUrl: data.images[0].url };
}

/**
 * Ensure a path-or-URL is a URL. If it's a local file, upload to fal storage.
 */
export async function ensureUrl(pathOrUrl: string): Promise<string> {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  if (!existsSync(pathOrUrl)) {
    throw new Error(`File not found: ${pathOrUrl}`);
  }
  console.log('Uploading local file to fal storage...');
  const buf = readFileSync(pathOrUrl);
  const blob = new Blob([buf], { type: 'image/png' });
  const url = await fal.storage.upload(blob);
  console.log(`Uploaded: ${url}`);
  return url;
}

/**
 * Download an image from a URL to a buffer.
 */
export async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
