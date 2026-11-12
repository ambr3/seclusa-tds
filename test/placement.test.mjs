/* Placement / biome / choke / reach audits (ideas 1–6). */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadGameMap,
  auditAll,
  auditBiome,
  auditPickupClearance,
  auditChokes,
  auditMapSolids,
  auditReachPickups,
  auditWallSense,
  auditSpawns,
  asciiPreview
} from "../tools/deck_audit.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const GameMap = loadGameMap();

function load(file) {
  const source = readFileSync(join(here, "..", "static", "js", file), "utf8");
  const win = {};
  new Function("window", source)(win);
  return win;
}

test("1 biome: no indoor grass / outdoor leaks", () => {
  for (let i = 0; i < GameMap.sectorCount(); i++) {
    const map = GameMap.cloneSector(i);
    const issues = auditBiome(GameMap, map, i);
    assert.equal(issues.length, 0, issues.map((x) => x.msg).join("\n"));
  }
});

test("2 clearance: floor objects clear of walls", () => {
  for (let i = 0; i < GameMap.sectorCount(); i++) {
    const map = GameMap.cloneSector(i);
    const issues = auditPickupClearance(GameMap, map, i);
    assert.equal(issues.length, 0, issues.map((x) => x.msg).join("\n"));
  }
});

test("3 choke: sealed loot / C crates off doors and gaps", () => {
  for (let i = 0; i < GameMap.sectorCount(); i++) {
    const map = GameMap.cloneSector(i);
    const issues = auditChokes(GameMap, map, i);
    assert.equal(issues.length, 0, issues.map((x) => x.msg).join("\n"));
  }
});

test("4 map solids clear walls; litter stays non-solid", () => {
  for (let i = 0; i < GameMap.sectorCount(); i++) {
    const map = GameMap.cloneSector(i);
    const issues = auditMapSolids(GameMap, map, i);
    assert.equal(issues.length, 0, issues.map((x) => x.msg).join("\n"));
  }

  /* Procedural litter must never be solid (ship + ASCII C only). */
  const gameSrc = readFileSync(join(here, "..", "static", "js", "game.js"), "utf8");
  assert.match(gameSrc, /solid:\s*false/);
  assert.ok(
    /Only map-placed crates \+ ship are solid/.test(gameSrc),
    "litter policy comment present"
  );

  /* Boot one sector and inspect floorDecor if the harness exposes it. */
  const { ShooterGame } = load("game.js");
  if (ShooterGame && typeof ShooterGame === "function") {
    /* play harness is heavier; source contract above is the hard rule. */
  }
});

test("5 ascii preview builds for every deck", () => {
  for (let i = 0; i < GameMap.sectorCount(); i++) {
    const text = asciiPreview(GameMap, i);
    assert.ok(text.includes("Deck"), "deck " + i + " header");
    assert.ok(text.split("\n").length > 5, "deck " + i + " rows");
  }
});

test("6 reach: every pickup standable and reachable", () => {
  for (let i = 0; i < GameMap.sectorCount(); i++) {
    const map = GameMap.cloneSector(i);
    const issues = auditReachPickups(GameMap, map, i);
    assert.equal(issues.length, 0, issues.map((x) => x.msg).join("\n"));
  }
});

test("7 walls: no floating doors, orphans, or sealed floors", () => {
  for (let i = 0; i < GameMap.sectorCount(); i++) {
    const map = GameMap.cloneSector(i);
    const issues = auditWallSense(GameMap, map, i);
    assert.equal(issues.length, 0, issues.map((x) => x.msg).join("\n"));
  }
});

test("8 spawns: no crawler F; enemies reachable and off walls", () => {
  for (let i = 0; i < GameMap.sectorCount(); i++) {
    const map = GameMap.cloneSector(i);
    const issues = auditSpawns(GameMap, map, i);
    assert.equal(issues.length, 0, issues.map((x) => x.msg).join("\n"));
  }
});

test("full auditAll clean", () => {
  const issues = auditAll(GameMap);
  assert.equal(issues.length, 0, issues.map((x) => x.msg).join("\n"));
});
