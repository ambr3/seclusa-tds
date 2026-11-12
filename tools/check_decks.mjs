#!/usr/bin/env node
/**
 * Run deck audits 1–6. Optionally dump ASCII + PPM previews.
 *
 *   node tools/check_decks.mjs
 *   node tools/check_decks.mjs --preview
 *   node tools/check_decks.mjs --deck 1
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadGameMap,
  auditAll,
  auditDeck,
  asciiPreview,
  writePpm
} from "./deck_audit.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const wantPreview = args.includes("--preview");
const deckArg = args.indexOf("--deck");
const onlyDeck = deckArg >= 0 ? Number(args[deckArg + 1]) : null;

const GameMap = loadGameMap();
let issues;
if (onlyDeck != null && Number.isFinite(onlyDeck)) {
  issues = auditDeck(GameMap, onlyDeck);
} else {
  issues = auditAll(GameMap);
}

const byKind = {};
for (const issue of issues) {
  byKind[issue.kind] = (byKind[issue.kind] || 0) + 1;
  console.error("FAIL [" + issue.kind + "] " + issue.msg);
}

if (wantPreview) {
  const outDir = join(here, "deck-previews");
  mkdirSync(outDir, { recursive: true });
  const n = GameMap.sectorCount();
  const from = onlyDeck != null ? onlyDeck : 0;
  const to = onlyDeck != null ? onlyDeck : n - 1;
  for (let i = from; i <= to; i++) {
    const base = join(outDir, "deck-" + String(i).padStart(2, "0"));
    writeFileSync(base + ".txt", asciiPreview(GameMap, i));
    writePpm(GameMap, i, base + ".ppm", writeFileSync);
  }
  console.log("previews → " + outDir);
}

if (issues.length) {
  console.error(
    "deck audit: " + issues.length + " issue(s) " + JSON.stringify(byKind)
  );
  process.exit(1);
}

console.log(
  "deck audit: OK — biome, clearance, choke, solids, reach, walls, spawns (" +
    GameMap.sectorCount() +
    " decks)"
);
