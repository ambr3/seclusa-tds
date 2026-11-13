/**
 * Deck placement / biome / choke / reach audits for Seclusa TDS.
 * Used by tools/check_decks.mjs and test/placement.test.mjs.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const jsDir = join(here, "..", "static", "js");

export function loadGameMap() {
  const source = readFileSync(join(jsDir, "map.js"), "utf8");
  const win = {};
  new Function("window", source)(win);
  return win.GameMap;
}

const YARD = new Set(["~", "S"]);
const INDOOR_FLOOR = new Set([
  ".", "P", "X", "A", "+", "C", "$", "Y",
  "R", "G", "B", "E", "F", "H", "D", "O",
  "1", "2", "3", "4"
]);

function asciiWantOutdoor(rows, ax, ay) {
  const h = rows.length;
  const w = rows[0].length;
  if (ay < 0 || ax < 0 || ay >= h || ax >= w) return false;
  const ch = rows[ay][ax];
  if (YARD.has(ch)) return true;
  if (ch === "." || ch === "#") return false;
  if (!INDOOR_FLOOR.has(ch) && ch !== "r" && ch !== "g" && ch !== "b") return false;
  /* Props inherit outdoor only from yard neighbours. */
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const nx = ax + dx;
    const ny = ay + dy;
    if (ny < 0 || nx < 0 || ny >= h || nx >= w) continue;
    if (YARD.has(rows[ny][nx])) return true;
  }
  return false;
}

function pickupPoints(map) {
  const out = [];
  function add(list, label) {
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      out.push({ label: label + "[" + i + "]", x: list[i].x, y: list[i].y, item: list[i] });
    }
  }
  add(map.ammoCrates, "ammo");
  add(map.lootCrates, "loot");
  add(map.healthBooths, "booth");
  add(map.gunPickups, "gun");
  add(map.keys, "key");
  add(map.caches, "cache");
  add(map.crates, "crate");
  return out;
}

/** 1 — outdoor grass only where ASCII yard says so; no indoor grass leaks. */
export function auditBiome(GameMap, map, index) {
  const rows = GameMap.sectorRows(index);
  const macro = GameMap.MACRO || 3;
  const issues = [];
  for (let ay = 0; ay < rows.length; ay++) {
    for (let ax = 0; ax < rows[ay].length; ax++) {
      const ch = rows[ay][ax];
      if (ch === "#" || ch === "r" || ch === "g" || ch === "b") continue;
      const want = asciiWantOutdoor(rows, ax, ay);
      for (let ey = 0; ey < macro; ey++) {
        for (let ex = 0; ex < macro; ex++) {
          const tx = ax * macro + ex;
          const ty = ay * macro + ey;
          const tile = map.tiles[ty][tx];
          if (!tile || (tile.kind !== "floor" && tile.kind !== "exit")) continue;
          if (!!tile.outdoor !== want) {
            issues.push({
              kind: "biome",
              deck: index,
              ax, ay, tx, ty, ch,
              got: !!tile.outdoor,
              want,
              msg: "deck " + index + " biome @" + ax + "," + ay +
                " (" + ch + ") fine " + tx + "," + ty +
                " outdoor=" + !!tile.outdoor + " want " + want
            });
          }
        }
      }
    }
  }
  return issues;
}

/** 2 — every floor object circle clears walls / closed doors. */
export function auditPickupClearance(GameMap, map, index) {
  const r = GameMap.PICKUP_CLEAR_R || map.tile * 0.95;
  const issues = [];
  for (const p of pickupPoints(map)) {
    if (GameMap.circleBlocked(map, p.x, p.y, r)) {
      issues.push({
        kind: "clearance",
        deck: index,
        label: p.label,
        x: p.x, y: p.y,
        msg: "deck " + index + " " + p.label + " in wall @ " +
          p.x.toFixed(1) + "," + p.y.toFixed(1)
      });
    }
    const tx = Math.floor(p.x / map.tile);
    const ty = Math.floor(p.y / map.tile);
    const tile = GameMap.tileAt(map, tx, ty);
    if (tile.kind === "wall" || (tile.kind === "door" && !tile.open)) {
      issues.push({
        kind: "clearance",
        deck: index,
        label: p.label,
        x: p.x, y: p.y,
        msg: "deck " + index + " " + p.label + " centre on " + tile.kind
      });
    }
  }
  return issues;
}

function isNarrowPassage(GameMap, map, tx, ty) {
  const t = GameMap.tileAt(map, tx, ty);
  if (!t || (t.kind !== "floor" && t.kind !== "exit" && !(t.kind === "door" && t.open))) {
    return false;
  }
  const wL = GameMap.isBlocking(GameMap.tileAt(map, tx - 1, ty));
  const wR = GameMap.isBlocking(GameMap.tileAt(map, tx + 1, ty));
  const wU = GameMap.isBlocking(GameMap.tileAt(map, tx, ty - 1));
  const wD = GameMap.isBlocking(GameMap.tileAt(map, tx, ty + 1));
  return (wL && wR && !wU && !wD) || (wU && wD && !wL && !wR);
}

/** 3 — sealed loot / solid crates must not choke doors or 1-wide gaps. */
export function auditChokes(GameMap, map, index) {
  const issues = [];
  const T = map.tile;
  const solids = [];
  for (const c of map.lootCrates || []) {
    if (!c.shootable) solids.push({ label: "sealed-loot", x: c.x, y: c.y });
  }
  for (const c of map.crates || []) {
    solids.push({ label: "crate-C", x: c.x, y: c.y });
  }
  for (const s of solids) {
    const tx = (s.x / T) | 0;
    const ty = (s.y / T) | 0;
    let choked = false;
    for (let dy = -3; dy <= 3 && !choked; dy++) {
      for (let dx = -3; dx <= 3 && !choked; dx++) {
        if (isNarrowPassage(GameMap, map, tx + dx, ty + dy)) choked = true;
      }
    }
    for (let di = 0; di < map.doors.length && !choked; di++) {
      const door = map.doors[di];
      const dx = s.x - (door.x + 0.5) * T;
      const dy = s.y - (door.y + 0.5) * T;
      if (Math.hypot(dx, dy) < T * 4) choked = true;
    }
    if (choked) {
      issues.push({
        kind: "choke",
        deck: index,
        label: s.label,
        x: s.x, y: s.y,
        msg: "deck " + index + " " + s.label + " blocks door/gap @ " +
          s.x.toFixed(1) + "," + s.y.toFixed(1)
      });
    }
  }
  return issues;
}

/**
 * 4 — map solids (C crates, ships) must clear walls; litter rules live in game.js
 * and are checked separately (solid:false on procedural decor).
 */
export function auditMapSolids(GameMap, map, index) {
  const issues = [];
  const r = GameMap.PICKUP_CLEAR_R || map.tile * 0.95;
  for (const c of map.crates || []) {
    if (GameMap.circleBlocked(map, c.x, c.y, r)) {
      issues.push({
        kind: "solid",
        deck: index,
        msg: "deck " + index + " solid crate in wall @ " + c.x.toFixed(1) + "," + c.y.toFixed(1)
      });
    }
  }
  /* Ships sit on outdoor yard — still must not centre inside fortress wall. */
  for (const s of map.ships || []) {
    const tx = Math.floor(s.x / map.tile);
    const ty = Math.floor(s.y / map.tile);
    if (GameMap.tileAt(map, tx, ty).kind === "wall") {
      issues.push({
        kind: "solid",
        deck: index,
        msg: "deck " + index + " ship centre in wall"
      });
    }
  }
  return issues;
}

/** Flood like maps.test — open doors with keys as we go. */
export function reachableTiles(GameMap, map) {
  const inv = { R: false, G: false, B: false };
  const startTX = Math.floor(map.start.x / map.tile);
  const startTY = Math.floor(map.start.y / map.tile);
  const keys = map.keys.map((k) => ({ ...k, taken: false }));

  function flood() {
    const seen = new Set();
    const q = [[startTX, startTY]];
    seen.add(startTX + "," + startTY);
    while (q.length) {
      const [x, y] = q.shift();
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (k.taken) continue;
        if (Math.floor(k.x / map.tile) === x && Math.floor(k.y / map.tile) === y) {
          k.taken = true;
          inv[k.colour] = true;
        }
      }
      const tile = map.tiles[y][x];
      if (tile.kind === "door" && inv[tile.colour]) tile.open = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (ny < 0 || nx < 0 || ny >= map.rows || nx >= map.cols) continue;
        const t = map.tiles[ny][nx];
        if (t.kind === "wall") continue;
        if (t.kind === "door" && !t.open && !inv[t.colour]) continue;
        if (t.kind === "door" && inv[t.colour]) t.open = true;
        const id = nx + "," + ny;
        if (seen.has(id)) continue;
        seen.add(id);
        q.push([nx, ny]);
      }
    }
    return seen;
  }

  let prev = "";
  for (let n = 0; n < 12; n++) {
    const sig = [inv.R, inv.G, inv.B, GameMap.allDoorsOpen(map)].join(",");
    if (sig === prev) break;
    prev = sig;
    flood();
  }
  return flood();
}

/** 6 — every pickup tile is reachable and the stand-circle is clear. */
export function auditReachPickups(GameMap, map, index) {
  const issues = [];
  const clone = GameMap.cloneSector(index);
  const reach = reachableTiles(GameMap, clone);
  const r = GameMap.PICKUP_CLEAR_R || map.tile * 0.95;
  for (const p of pickupPoints(map)) {
    const tx = Math.floor(p.x / map.tile);
    const ty = Math.floor(p.y / map.tile);
    if (!reach.has(tx + "," + ty)) {
      issues.push({
        kind: "reach",
        deck: index,
        label: p.label,
        msg: "deck " + index + " " + p.label + " unreachable @" + tx + "," + ty
      });
    }
    if (GameMap.circleBlocked(map, p.x, p.y, r)) {
      issues.push({
        kind: "reach",
        deck: index,
        label: p.label,
        msg: "deck " + index + " " + p.label + " stand circle blocked"
      });
    }
  }
  return issues;
}

/**
 * 7 — wall sense: doors sit in wall runs; no orphan indoor pillars;
 * no sealed floor pockets (every walkable fine tile reachable after keys).
 */
export function auditWallSense(GameMap, map, index) {
  const issues = [];
  const rows = GameMap.sectorRows(index);
  const h = rows.length;
  const w = rows[0].length;
  const isDoor = (ch) => ch === "r" || ch === "g" || ch === "b";

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (isDoor(ch)) {
        let walls = 0;
        let floors = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (ny < 0 || nx < 0 || ny >= h || nx >= w) continue;
          const n = rows[ny][nx];
          if (n === "#" || isDoor(n)) walls++;
          else floors++;
        }
        if (walls < 1) {
          issues.push({
            kind: "walls",
            deck: index,
            msg: "deck " + index + " floating door " + ch + " @" + x + "," + y
          });
        }
        if (floors < 2) {
          issues.push({
            kind: "walls",
            deck: index,
            msg: "deck " + index + " dead-end door " + ch + " @" + x + "," + y
          });
        }
      }
      if (ch === "#" && x > 0 && y > 0 && x < w - 1 && y < h - 1) {
        let wn = 0;
        let fn = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = rows[y + dy][x + dx];
          if (n === "#" || isDoor(n)) wn++;
          else fn++;
        }
        if (wn === 0 && fn >= 3) {
          issues.push({
            kind: "walls",
            deck: index,
            msg: "deck " + index + " orphan pillar @" + x + "," + y
          });
        }
      }
    }
  }

  const clone = GameMap.cloneSector(index);
  const reach = reachableTiles(GameMap, clone);
  let sealed = 0;
  let sealedSample = null;
  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx = 0; tx < map.cols; tx++) {
      const t = map.tiles[ty][tx];
      if (t.kind !== "floor" && t.kind !== "exit") continue;
      /* Outdoor yard on deck 0 can include fringe; still must be reachable. */
      if (reach.has(tx + "," + ty)) continue;
      sealed++;
      if (!sealedSample) sealedSample = tx + "," + ty;
    }
  }
  if (sealed > 0) {
    issues.push({
      kind: "walls",
      deck: index,
      msg: "deck " + index + " sealed floor tiles=" + sealed + " e.g. @" + sealedSample
    });
  }
  return issues;
}

/**
 * 8 — enemies: no retired crawler mark (F); every spawn reachable + clear of walls.
 */
export function auditSpawns(GameMap, map, index) {
  const issues = [];
  const rows = GameMap.sectorRows(index);
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x] === "F") {
        issues.push({
          kind: "spawn",
          deck: index,
          msg: "deck " + index + " retired crawler mark F @" + x + "," + y + " — use E or D"
        });
      }
    }
  }
  const clone = GameMap.cloneSector(index);
  const reach = reachableTiles(GameMap, clone);
  const r = (GameMap.PICKUP_CLEAR_R || map.tile * 0.95) * 0.85;
  for (let i = 0; i < map.spawns.length; i++) {
    const s = map.spawns[i];
    if (s.kind === "tower") continue;
    const tx = Math.floor(s.x / map.tile);
    const ty = Math.floor(s.y / map.tile);
    if (!reach.has(tx + "," + ty)) {
      issues.push({
        kind: "spawn",
        deck: index,
        msg: "deck " + index + " " + s.kind + "[" + i + "] unreachable @" + tx + "," + ty
      });
    }
    if (GameMap.circleBlocked(map, s.x, s.y, r)) {
      issues.push({
        kind: "spawn",
        deck: index,
        msg: "deck " + index + " " + s.kind + "[" + i + "] in wall @ " +
          s.x.toFixed(1) + "," + s.y.toFixed(1)
      });
    }
  }
  return issues;
}

export function auditDeck(GameMap, index) {
  const map = GameMap.cloneSector(index);
  return [
    ...auditBiome(GameMap, map, index),
    ...auditPickupClearance(GameMap, map, index),
    ...auditChokes(GameMap, map, index),
    ...auditMapSolids(GameMap, map, index),
    ...auditReachPickups(GameMap, map, index),
    ...auditWallSense(GameMap, map, index),
    ...auditSpawns(GameMap, map, index)
  ];
}

export function auditAll(GameMap) {
  const issues = [];
  const n = GameMap.sectorCount();
  for (let i = 0; i < n; i++) {
    issues.push(...auditDeck(GameMap, i));
  }
  return issues;
}

/** 5 — coloured ASCII grid (one char per MACRO cell). */
export function asciiPreview(GameMap, index) {
  const rows = GameMap.sectorRows(index);
  const meta = GameMap.sectorMeta(index);
  const map = GameMap.cloneSector(index);
  const macro = GameMap.MACRO || 3;
  const lines = ["# " + meta.name + " (deck " + index + ")"];
  for (let ay = 0; ay < rows.length; ay++) {
    let line = "";
    for (let ax = 0; ax < rows[ay].length; ax++) {
      const ch = rows[ay][ax];
      const tx = ax * macro + ((macro / 2) | 0);
      const ty = ay * macro + ((macro / 2) | 0);
      const tile = map.tiles[ty] && map.tiles[ty][tx];
      if (ch === "#") line += "#";
      else if (ch === "r" || ch === "g" || ch === "b") line += ch;
      else if (tile && tile.outdoor) line += ch === "~" || ch === "S" ? ch : ",";
      else line += ch === "." ? "." : ch;
    }
    lines.push(line);
  }
  return lines.join("\n") + "\n";
}

/** 5 — tiny PPM (no deps): grey indoor, green outdoor, yellow $, blue wall. */
export function ppmPreview(GameMap, index) {
  const map = GameMap.cloneSector(index);
  const w = map.cols;
  const h = map.rows;
  const macro = GameMap.MACRO || 3;
  const rgb = [];
  function put(r, g, b) {
    rgb.push(r, g, b);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = map.tiles[y][x];
      let r, g, b;
      if (t.kind === "wall") { r = 70; g = 78; b = 96; }
      else if (t.kind === "door") { r = 180; g = 90; b = 40; }
      else if (t.kind === "exit") { r = 240; g = 140; b = 40; }
      else if (t.outdoor) { r = 48; g = 140; b = 52; }
      else { r = 128; g = 128; b = 132; }
      /* Faint MACRO grid for review. */
      if (x % macro === 0 || y % macro === 0) {
        r = Math.max(0, r - 14);
        g = Math.max(0, g - 14);
        b = Math.max(0, b - 12);
      }
      put(r, g, b);
    }
  }
  function stamp(list, r, g, b) {
    if (!list) return;
    for (const p of list) {
      const tx = Math.floor(p.x / map.tile);
      const ty = Math.floor(p.y / map.tile);
      if (ty < 0 || tx < 0 || ty >= h || tx >= w) continue;
      const i = (ty * w + tx) * 3;
      rgb[i] = r;
      rgb[i + 1] = g;
      rgb[i + 2] = b;
    }
  }
  function stampAt(x, y, r, g, b) {
    const tx = Math.floor(x / map.tile);
    const ty = Math.floor(y / map.tile);
    if (ty < 0 || tx < 0 || ty >= h || tx >= w) return;
    const i = (ty * w + tx) * 3;
    rgb[i] = r;
    rgb[i + 1] = g;
    rgb[i + 2] = b;
  }
  stamp(map.lootCrates, 220, 190, 40);
  stamp(map.ammoCrates, 240, 120, 40);
  stamp(map.caches, 220, 60, 60);
  stamp(map.healthBooths, 80, 200, 220);
  stamp(map.gunPickups, 160, 80, 220);
  stamp(map.crates, 120, 80, 40);
  /* Keys by colour, start, exits — review markers. */
  for (const k of map.keys || []) {
    if (k.colour === "R") stampAt(k.x, k.y, 240, 48, 72);
    else if (k.colour === "G") stampAt(k.x, k.y, 40, 200, 90);
    else stampAt(k.x, k.y, 50, 120, 240);
  }
  stampAt(map.start.x, map.start.y, 80, 240, 255);
  for (const ex of map.exits || []) stampAt(ex.x, ex.y, 255, 170, 40);
  for (const s of map.spawns || []) stampAt(s.x, s.y, 200, 60, 200);

  let body = "P6\n" + w + " " + h + "\n255\n";
  return { header: body, pixels: Buffer.from(rgb), width: w, height: h };
}

export function writePpm(GameMap, index, path, writeFileSync) {
  const { header, pixels } = ppmPreview(GameMap, index);
  writeFileSync(path, Buffer.concat([Buffer.from(header, "ascii"), pixels]));
}
