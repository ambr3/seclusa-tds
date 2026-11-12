#!/usr/bin/env node
/**
 * Write one review PNG per deck into ../level images/
 *   node tools/export_level_images.mjs
 */
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { loadGameMap, ppmPreview, asciiPreview } from "./deck_audit.mjs";

const here = dirname(fileURLToPath(import.meta.url));
/* Review-only output — gitignored; regenerate when needed. */
const outDir = join(here, "..", "level images");
const SCALE = 10; /* pixels per fine tile — readable for review */

const GameMap = loadGameMap();
mkdirSync(outDir, { recursive: true });

function upscalePpm(header, pixels, srcW, srcH, scale) {
  const w = srcW * scale;
  const h = srcH * scale;
  const out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const si = (y * srcW + x) * 3;
      const r = pixels[si];
      const g = pixels[si + 1];
      const b = pixels[si + 2];
      for (let oy = 0; oy < scale; oy++) {
        for (let ox = 0; ox < scale; ox++) {
          const di = ((y * scale + oy) * w + (x * scale + ox)) * 3;
          out[di] = r;
          out[di + 1] = g;
          out[di + 2] = b;
        }
      }
    }
  }
  return {
    header: "P6\n" + w + " " + h + "\n255\n",
    pixels: out,
    width: w,
    height: h
  };
}

const n = GameMap.sectorCount();
const written = [];
for (let i = 0; i < n; i++) {
  const meta = GameMap.sectorMeta(i);
  const { header, pixels, width, height } = ppmPreview(GameMap, i);
  const big = upscalePpm(header, pixels, width, height, SCALE);
  const stem = "deck-" + String(i + 1).padStart(2, "0");
  const ppmPath = join(outDir, stem + ".ppm");
  const pngPath = join(outDir, stem + ".png");
  const txtPath = join(outDir, stem + ".txt");
  writeFileSync(ppmPath, Buffer.concat([Buffer.from(big.header, "ascii"), big.pixels]));
  writeFileSync(txtPath, asciiPreview(GameMap, i));

  const label = meta.name.replace(/[\\"]/g, "");
  const conv = spawnSync(
    "convert",
    [
      ppmPath,
      "-bordercolor", "#1a1a1e",
      "-border", "24x40",
      "-gravity", "North",
      "-fill", "#f5f5f5",
      "-pointsize", "18",
      "-annotate", "+0+10", label,
      "-gravity", "SouthWest",
      "-pointsize", "11",
      "-fill", "#a0a0a8",
      "-annotate", "+12+10",
      "cyan=start  R/G/B keys  orange=exit  purple=spawn  | wall door grass floor loot",
      pngPath
    ],
    { encoding: "utf8" }
  );
  if (conv.status !== 0) {
    console.error(conv.stderr || conv.stdout || "convert failed for " + stem);
    process.exit(1);
  }
  unlinkSync(ppmPath);
  written.push(pngPath);
  console.log("wrote " + pngPath);
}

console.log("level-images: " + written.length + " PNGs → " + outDir);
