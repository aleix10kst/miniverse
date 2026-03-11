#!/usr/bin/env node
/**
 * Auto-detect and extract individual prop pieces from the raw image.
 * 1. Remove pure white background
 * 2. Find connected regions of non-transparent pixels
 * 3. Extract each as a separate PNG
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, '..', 'assets', 'raw');
const OUT = path.join(__dirname, '..', 'assets', 'processed', 'props');

async function main() {
  mkdirSync(OUT, { recursive: true });

  const inputPath = path.join(RAW, 'office-props.png');
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width, h = info.height;
  const pixels = Buffer.from(data);
  console.log(`Input: ${w}x${h}`);

  // Remove pure white and near-white background
  // Use flood fill from edges to only remove connected white background,
  // preserving white pixels inside objects (like whiteboard surface)
  const isWhite = (i) => pixels[i] >= 250 && pixels[i+1] >= 250 && pixels[i+2] >= 250;
  const visited = new Uint8Array(w * h);
  const bgMask = new Uint8Array(w * h); // 1 = background white

  // BFS flood fill from all edge pixels that are white
  const queue = [];
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const idx = y * w + x;
      if (isWhite(idx * 4) && !visited[idx]) {
        visited[idx] = 1;
        bgMask[idx] = 1;
        queue.push(idx);
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const idx = y * w + x;
      if (isWhite(idx * 4) && !visited[idx]) {
        visited[idx] = 1;
        bgMask[idx] = 1;
        queue.push(idx);
      }
    }
  }

  // Flood fill
  while (queue.length > 0) {
    const idx = queue.pop();
    const x = idx % w, y = Math.floor(idx / w);
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const ni = ny * w + nx;
      if (!visited[ni] && isWhite(ni * 4)) {
        visited[ni] = 1;
        bgMask[ni] = 1;
        queue.push(ni);
      }
    }
  }

  // Apply mask: set background white pixels to transparent
  for (let i = 0; i < w * h; i++) {
    if (bgMask[i]) {
      pixels[i * 4 + 3] = 0;
    }
  }

  // Now find connected components of non-transparent pixels
  const labels = new Int32Array(w * h).fill(-1);
  let nextLabel = 0;
  const components = []; // { label, minX, minY, maxX, maxY }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (pixels[idx * 4 + 3] === 0 || labels[idx] >= 0) continue;

      // BFS to find this component
      const label = nextLabel++;
      let minX = x, minY = y, maxX = x, maxY = y;
      const bfsQueue = [idx];
      labels[idx] = label;

      while (bfsQueue.length > 0) {
        const ci = bfsQueue.pop();
        const cx = ci % w, cy = Math.floor(ci / w);
        minX = Math.min(minX, cx);
        minY = Math.min(minY, cy);
        maxX = Math.max(maxX, cx);
        maxY = Math.max(maxY, cy);

        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const ni = ny * w + nx;
          if (pixels[ni * 4 + 3] > 0 && labels[ni] < 0) {
            labels[ni] = label;
            bfsQueue.push(ni);
          }
        }
      }

      components.push({ label, minX, minY, maxX, maxY });
    }
  }

  // Filter out tiny noise components (less than 100px area)
  const significant = components.filter(c => {
    const area = (c.maxX - c.minX) * (c.maxY - c.minY);
    return area > 500;
  });

  // Sort by position: top-to-bottom, left-to-right
  significant.sort((a, b) => {
    const rowA = Math.floor(a.minY / 150);
    const rowB = Math.floor(b.minY / 150);
    if (rowA !== rowB) return rowA - rowB;
    return a.minX - b.minX;
  });

  console.log(`Found ${significant.length} prop pieces:`);

  // Save the cleaned image as atlas too
  const cleanBuf = await sharp(pixels, {
    raw: { width: w, height: h, channels: 4 },
  }).png().toBuffer();

  await sharp(cleanBuf).toFile(path.join(OUT, '..', 'prop_atlas.png'));

  // Extract and compress each component
  for (let i = 0; i < significant.length; i++) {
    const c = significant[i];
    const cw = c.maxX - c.minX + 1;
    const ch = c.maxY - c.minY + 1;

    let pieceBuf = await sharp(cleanBuf)
      .extract({ left: c.minX, top: c.minY, width: cw, height: ch })
      .png()
      .toBuffer();

    // Compress: resize longest edge to 128px max, nearest-neighbor
    const maxSize = 128;
    if (cw > maxSize || ch > maxSize) {
      const scale = maxSize / Math.max(cw, ch);
      const nw = Math.max(1, Math.round(cw * scale));
      const nh = Math.max(1, Math.round(ch * scale));
      pieceBuf = await sharp(pieceBuf)
        .resize(nw, nh, { kernel: sharp.kernel.nearest })
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer();
      console.log(`  piece_${i}: ${cw}x${ch} → ${nw}x${nh} at (${c.minX},${c.minY})`);
    } else {
      pieceBuf = await sharp(pieceBuf)
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer();
      console.log(`  piece_${i}: ${cw}x${ch} at (${c.minX},${c.minY})`);
    }

    writeFileSync(path.join(OUT, `piece_${i}.png`), pieceBuf);
  }

  // Also write a JSON manifest with piece info
  const manifest = significant.map((c, i) => ({
    file: `piece_${i}.png`,
    sx: c.minX, sy: c.minY,
    sw: c.maxX - c.minX + 1,
    sh: c.maxY - c.minY + 1,
  }));
  const { writeFileSync } = await import('fs');
  writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log('\nDone! Check assets/processed/props/ for individual pieces');
}

main().catch(console.error);
