/*
 * Multi-deck tile maps for Seclusa Lockdown.
 *
 * Story: crash → breach the fortress → push inward → salvage ship parts.
 *
 * # wall  . indoor floor  ~ outdoor floor  P start  X exit  A ammo
 * + health booth  1–4 gun pickups (Plasma/Pulse/Beam/Lance)
 * S crashed ship  C solid crate  $ loot crate (shoot)  Y armed tower
 * R/G/B keys  r/g/b doors  E grunt  D drone  H fortress  O boss
 * (F crawler mark retired — do not place)
 */

(function () {
  "use strict";

  /* Fine grid. ASCII expands by MACRO; each # is a thick concrete block
   * (floor-plan warehouse walls), not a thin pipe or metal pad. */
  var TILE = 16;
  var MACRO = 3;

  var KEY_COLOURS = {
    R: "#e11d48", G: "#16a34a", B: "#2563eb",
    r: "#e11d48", g: "#16a34a", b: "#2563eb"
  };

  /* 32-wide decks. Key order must stay reachable: R→r→G→g→B→b→X */
  var SECTORS = [
    {
      name: "Deck 1 — Crash site",
      rows: [
        "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
        "~~~~P~~~~S~~~~~~~~~~~~~~~~~~~~~~",
        "~~~~~~R~~~~$~~~~~~~~~~~~~~~~~~~~",
        "~~~~~~~~$~~~~~~~$~~~~~~~~~~~~~~~",
        "~~~~~~~~~~~~$~~~~~~~~C~~~~~~~~~~",
        "~~~~~~~~~~~$~~~~~~~~~~~~~~~~~~~~",
        "##############r#################",
        "#........1........A............#",
        "#...E..............E...........#",
        "#..............G...............#",
        "##############g#################",
        "#...E..............E...........#",
        "#..............B...............#",
        "##############b#################",
        "#..............X...............#",
        "#....A....+.........E....$.....#",
        "################################"
      ]
    },
    {
      name: "Deck 2 — Breach wall",
      /* Keep corridor walls solid — auto wall-cache carve punched a hole
       * under the green-door column that looked like a missing wall. */
      noWallCache: true,
      rows: [
        "################################",
        "#P..R.....#..........#.........#",
        "#.........#....$.....#....A....#",
        "#....E....r....E.....g....D....#",
        "#.........#..........#.........#",
        "#..$......#....G.....#....B....#",
        "#####.##########.#####.#########",
        "#.........#..........#.........#",
        "#....E....#........E.#....E....#",
        "#....+....#..........#.........#",
        "#.........#..........#####b#####",
        "#.........#..........#.........#",
        "#.........#....E.....#....X....#",
        "#.........#..........#.........#",
        "#....A....#....$.....#....E....#",
        "################################"
      ]
    },
    {
      name: "Deck 3 — Dust yard",
      rows: [
        "################################",
        "#P.R...........................#",
        "#......................E.......#",
        "#........###############.......#",
        "#...E....#......G......#...$...#",
        "#........r.............#...A...#",
        "#....+...#......E......g.......#",
        "#........###############.......#",
        "#......................E.......#",
        "#...E..............B...........#",
        "#..............#####b###########",
        "#..............#....X..........#",
        "#....A....$....#...............#",
        "#..............#....E..........#",
        "#..............#...............#",
        "################################"
      ]
    },
    {
      name: "Deck 4 — Gatehouse",
      rows: [
        "################################",
        "#P.R.#.........#.........#.A...#",
        "#....#....E....#....E....#.....#",
        "#....r.........#.........#.....#",
        "#....#....G....#....B....b.X...#",
        "#.$..#.........#.........#.....#",
        "##.###....#....#....#....#######",
        "#....#....#....#....#..........#",
        "#.E..#....E....g....E....D.....#",
        "#....#.........#...............#",
        "#.A..#....E....#....D..........#",
        "#.+..#.........#...............#",
        "#....#....E....#....E..........#",
        "#.2..#.........#..........$....#",
        "#....#....E....#....E..........#",
        "################################"
      ]
    },
    {
      name: "Deck 5 — Patrol ring",
      rows: [
        "################################",
        "#P.R........................A..#",
        "#..##########################..#",
        "#..#........................#..#",
        "#..#..E....$....E....D......#..#",
        "#..#........................#..#",
        "#..r....G..............B....b..#",
        "#..#........................#..#",
        "#..#..D..............D......#..#",
        "#..#............+...........#..#",
        "#..#################g########..#",
        "#......................X.......#",
        "#....E....................E....#",
        "#..............A..........$....#",
        "#..............................#",
        "################################"
      ]
    },
    {
      name: "Deck 6 — Barracks",
      rows: [
        "################################",
        "#P..R.#....E....#....E....#....#",
        "#.....#.........#.........#.A..#",
        "#..E..r....G....g....B....b.X..#",
        "#.....#.........#.........#....#",
        "#..$..#....E....#....D....#....#",
        "###.###....#....#....#....######",
        "#.....#....#....#....#.........#",
        "#..E..#....E....#....E....D....#",
        "#.....#.........#..............#",
        "#..A..#....E....#....E.........#",
        "#.+...#.........#..............#",
        "#.....#....D....#....D.........#",
        "#.....#.........#.........$....#",
        "#.....#....E....#....E.........#",
        "################################"
      ]
    },
    {
      name: "Deck 7 — Armoury spur",
      rows: [
        "################################",
        "#P.R..........#........A.......#",
        "#.............#....E...........#",
        "#......E......r................#",
        "#.............#....G...........#",
        "#......3......#........D.......#",
        "#######.#######................#",
        "#.............#....E...........#",
        "#......E......g................#",
        "#.............#....B...........#",
        "#......A......#........D.......#",
        "###########b###................#",
        "#.............#....X...........#",
        "#......D......#....$...........#",
        "#......+......#....E...........#",
        "################################"
      ]
    },
    {
      name: "Deck 8 — Vent crawl",
      rows: [
        "################################",
        "#P.R...........................#",
        "#......................E.......#",
        "#.........##########...........#",
        "#...E.....#..$....A#...........#",
        "#.........#........#....E......#",
        "#.........r...G....g...........#",
        "#.........#........#...........#",
        "#.........#..D.....#....D......#",
        "#.........##########...........#",
        "#..............B...............#",
        "#..............................#",
        "##############b#################",
        "#..............X...............#",
        "#....A....+...............E.$..#",
        "################################"
      ]
    },
    {
      name: "Deck 9 — Med bay",
      rows: [
        "################################",
        "#P.R.....#.........#...........#",
        "#........#....A....#....+......#",
        "#...E....r.........#....E......#",
        "#........#....G....g...........#",
        "#........#.........#....D......#",
        "#........#.........#...........#",
        "#...E....#....B....#....D......#",
        "#........#.........#...........#",
        "#...A....#....$....b....X......#",
        "#........#.........#...........#",
        "####################...........#",
        "#..............................#",
        "#...E......................E...#",
        "#..............................#",
        "################################"
      ]
    },
    {
      name: "Deck 10 — Mess hall",
      rows: [
        "################################",
        "#P.R.A.........................#",
        "#..............................#",
        "#...E......#####......E........#",
        "#..........#...#...............#",
        "#..........#.$+#......D........#",
        "#..........##r##...............#",
        "#............G.................#",
        "#...E...................H......#",
        "##############g#################",
        "#............B.................#",
        "#...E...................E......#",
        "##############b#################",
        "#............X.................#",
        "#....A....E...............E.$..#",
        "################################"
      ]
    },
    {
      name: "Deck 11 — Power spine",
      rows: [
        "################################",
        "#P..R.#........................#",
        "#.....#....H.........A.........#",
        "#..E..r........................#",
        "#.....#....G.........$.........#",
        "##.####........................#",
        "#.....#....E.........D.........#",
        "#..D..g........................#",
        "#.....#....B.........H.........#",
        "##.####........................#",
        "#.....#....D.........E.........#",
        "#..A..b........................#",
        "#.....#....X.........D.........#",
        "#.+...#........................#",
        "#.....#....E.............$.....#",
        "################################"
      ]
    },
    {
      name: "Deck 12 — Coolant run",
      rows: [
        "################################",
        "#P.R########################A..#",
        "#...#......................#...#",
        "#.E.#..E....D....E....D....#...#",
        "#...r......................b.X.#",
        "#.$+#..........G...........#...#",
        "#...########################...#",
        "#..............................#",
        "#...E......#####......E........#",
        "#..........#...#...............#",
        "#...A......#.B.g......D........#",
        "#..........#...#...............#",
        "#...D......#####......H........#",
        "#..............................#",
        "#...E.................E...$....#",
        "################################"
      ]
    },
    {
      name: "Deck 13 — Server vault",
      rows: [
        "################################",
        "#..............P.R.............#",
        "#..............................#",
        "#......################........#",
        "#......#....D....D....#........#",
        "#......#..............#....A...#",
        "#......r....G....$....g........#",
        "#......#..............#........#",
        "#......#....D....D....#........#",
        "#......################........#",
        "#..............B...............#",
        "#...D.....D...........H........#",
        "###############b################",
        "#..............X...............#",
        "#....A....+...............E.$..#",
        "################################"
      ]
    },
    {
      name: "Deck 14 — Lift shaft",
      rows: [
        "################################",
        "#..............P.R.A...........#",
        "#............................E.#",
        "#######.########.########.######",
        "#.....#.#......#.#......#.#....#",
        "#..E..#.#..$...#.#..D...#.#.D..#",
        "#.....r....G...#g...B...b..X...#",
        "#..A..#.#......#.#......#......#",
        "#.....#.#..D...#.#..H...#..E...#",
        "#.....#.#......#.#......#......#",
        "#######.########.########......#",
        "#............................D.#",
        "#...E......................H...#",
        "#...+........................E.#",
        "#.........................$....#",
        "################################"
      ]
    },
    {
      name: "Deck 15 — Inner keep",
      rows: [
        "################################",
        "#P.R.A...#..........#..........#",
        "#........#....H.....#....$.A...#",
        "#...D....r..........g....D.....#",
        "#........#....G.....#....B.....#",
        "#####.##########.#####.#########",
        "#........#..........#..........#",
        "#...H....#........D.#....H.....#",
        "#........#..........#..........#",
        "#...A....#..........#####b######",
        "#........#..........#..........#",
        "#...D....#....E.....#....O.....#",
        "#........#..........#..........#",
        "#...+....#..........#....X.....#",
        "#........#....$.....#....4.....#",
        "################################"
      ]
    },
    {
      name: "Deck 16 — Command deck",
      rows: [
        "################################",
        "#..............P.R.............#",
        "#..............................#",
        "#....#####............#####....#",
        "#....#...#....E.......#...#....#",
        "#....#...r............#...#....#",
        "#....#.+.#......G......A..#....#",
        "#....#####............#####....#",
        "#..............E...............#",
        "#....#####............#####....#",
        "#....#...g......B.....#...b....#",
        "#....#.H.#............#.D.#....#",
        "#....#...#......D.....#.$.#....#",
        "#....#####............#####....#",
        "#..............X...............#",
        "################################"
      ]
    },
    {
      name: "Deck 17 — Reactor lock",
      rows: [
        "################################",
        "#P.R..........A................#",
        "#.........##########...........#",
        "#...H.....#....G...#....D......#",
        "#.........r........g...........#",
        "#...$.....#....E...#....B......#",
        "#.........#####.#####..........#",
        "#...D.....................H....#",
        "#..............................#",
        "#...D.....E.....D.....D........#",
        "###############b################",
        "#...............X..............#",
        "#...A..........................#",
        "#...+...........H.........$....#",
        "#...E..........................#",
        "################################"
      ]
    },
    {
      name: "Deck 18 — Scrap corridor",
      rows: [
        "################################",
        "#P##############################",
        "#.R..E..D..E..D..E..H..E..A....#",
        "#..............................#",
        "#######r########################",
        "#......G.......................#",
        "#..E......D......D......E......#",
        "#######g########################",
        "#......B.......................#",
        "#..H......D......D......H......#",
        "#######b########################",
        "#......X.......................#",
        "#..A......E......$......E......#",
        "#..............................#",
        "#..+......................$....#",
        "################################"
      ]
    },
    {
      name: "Deck 19 — Hangar approach",
      rows: [
        "################################",
        "#P.R.A.........................#",
        "#..............................#",
        "#...D.....H.....D.....D........#",
        "#..............................#",
        "#............$.................#",
        "########r#######################",
        "#..............G...............#",
        "#...D.....D...........H........#",
        "########g#######################",
        "#..............B...............#",
        "#...H.....D...........D........#",
        "########b#######################",
        "#..............X...............#",
        "#....E....+...............E.$..#",
        "################################"
      ]
    },
    {
      name: "Deck 20 — Salvage bay",
      rows: [
        "################################",
        "#P.R....#..........#....A......#",
        "#.......#....H.....#...........#",
        "#...D...r..........g....D......#",
        "#.......#....G.....#....B......#",
        "#...$...#..........#...........#",
        "####.#########.#########.#######",
        "#.......#..........#...........#",
        "#...H...#....D.....#....H......#",
        "#.......#..........#...........#",
        "#...A...#..........#####b#######",
        "#.......#..........#...........#",
        "#...D...#....H.....#....O......#",
        "#...+...#..........#...........#",
        "#.......#....D.....#....X......#",
        "################################"
      ]
    }
  ];



  function spawnKind(ch) {
    if (ch === "H") return "fortress";
    if (ch === "D") return "drone";
    if (ch === "O") return "boss";
    if (ch === "E") return "grunt";
    /* F = retired crawler — ignored if an old ASCII still has one. */
    return null;
  }

  function asciiBlocking(rows, ax, ay) {
    if (ay < 0 || ax < 0 || ay >= rows.length || ax >= rows[0].length) return true;
    var c = rows[ay].charAt(ax);
    return c === "#" || c === "r" || c === "g" || c === "b";
  }

  /* Neighbour test for strip direction — OOB is not a wall, or edge walls grow crosses. */
  function asciiWallNeighbour(rows, ax, ay) {
    if (ay < 0 || ax < 0 || ay >= rows.length || ax >= rows[0].length) return false;
    var c = rows[ay].charAt(ax);
    return c === "#" || c === "r" || c === "g" || c === "b";
  }

  function asciiOutdoor(rows, ax, ay) {
    if (ay < 0 || ax < 0 || ay >= rows.length || ax >= rows[0].length) return false;
    var ch = rows[ay].charAt(ax);
    /* Only yard marks are outdoor. Scrap ($) / towers (Y) inherit like other props. */
    if (ch === "~" || ch === "S") return true;
    if (ch === "." || ch === "#") return false;
    /* Letters / props inherit from outdoor neighbours (yard only). */
    var dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    var i;
    for (i = 0; i < dirs.length; i++) {
      var nx = ax + dirs[i][0];
      var ny = ay + dirs[i][1];
      if (ny < 0 || nx < 0 || ny >= rows.length || nx >= rows[0].length) continue;
      var nc = rows[ny].charAt(nx);
      if (nc === "~" || nc === "S") return true;
    }
    return false;
  }

  function fillFloorBlock(tiles, baseX, baseY, outdoor) {
    var my;
    for (my = 0; my < MACRO; my++) {
      var mx;
      for (mx = 0; mx < MACRO; mx++) {
        tiles[baseY + my][baseX + mx] = { kind: "floor", outdoor: outdoor };
      }
    }
  }

  function paintWallStrip(tiles, rows, ax, ay, baseX, baseY, doorColour) {
    var my;
    var mx;
    if (!doorColour) {
      /* Floor-plan style: thick concrete — whole ASCII cell is solid wall. */
      for (my = 0; my < MACRO; my++) {
        for (mx = 0; mx < MACRO; mx++) {
          tiles[baseY + my][baseX + mx] = { kind: "wall" };
        }
      }
      return;
    }
    /* 0.1.3-style door: the whole MACRO block is the door (same footprint as
     * a # wall cell). Thin floor-bay gates looked like missing walls on
     * decks 2+. */
    for (my = 0; my < MACRO; my++) {
      for (mx = 0; mx < MACRO; mx++) {
        tiles[baseY + my][baseX + mx] = {
          kind: "door",
          colour: doorColour,
          open: false
        };
      }
    }
  }

  function parseLevel(rows, name, index, opts) {
    opts = opts || {};
    var ah = rows.length;
    var aw = rows[0].length;
    var h = ah * MACRO;
    var w = aw * MACRO;
    var tiles = [];
    var keys = [];
    var doors = [];
    var spawns = [];
    var ammoCrates = [];
    var lootCrates = [];
    var healthBooths = [];
    var gunPickups = [];
    var exits = [];
    var ships = [];
    var crates = [];
    var towers = [];
    var start = { x: TILE * MACRO * 1.5, y: TILE * MACRO * 1.5 };
    var y;
    var x;
    var GUN_MARK = { "1": "shotgun", "2": "smg", "3": "rifle", "4": "lance" };

    for (y = 0; y < h; y++) {
      tiles[y] = [];
      for (x = 0; x < w; x++) tiles[y][x] = { kind: "floor", outdoor: false };
    }

    var ay;
    for (ay = 0; ay < ah; ay++) {
      var row = rows[ay];
      if (row.length !== aw) throw new Error("map row width mismatch at " + ay + " in " + name);
      var ax;
      for (ax = 0; ax < aw; ax++) {
        var ch = row.charAt(ax);
        var baseX = ax * MACRO;
        var baseY = ay * MACRO;
        var cx = (ax + 0.5) * MACRO * TILE;
        var cy = (ay + 0.5) * MACRO * TILE;

        if (ch === "#") {
          paintWallStrip(tiles, rows, ax, ay, baseX, baseY, null);
        } else if (ch === "r" || ch === "g" || ch === "b") {
          paintWallStrip(tiles, rows, ax, ay, baseX, baseY, ch.toUpperCase());
          var mid = (MACRO / 2) | 0;
          doors.push({ x: baseX + mid, y: baseY + mid, colour: ch.toUpperCase() });
        } else {
          var outdoor = asciiOutdoor(rows, ax, ay);
          if ((ch === "$" || ch === "Y" || ch === "+" || GUN_MARK[ch]) && ay > 0 && ax > 0 && ax < aw - 1) {
            var sample = rows[ay].charAt(ax - 1);
            if (sample === "." || sample === "A" || sample === "+" || sample === "E" || sample === "X" ||
                sample === "1" || sample === "2" || sample === "3" || sample === "4") {
              outdoor = false;
            }
          }
          fillFloorBlock(tiles, baseX, baseY, outdoor);
          if (ch === "P") start = { x: cx, y: cy };
          if (ch === "R" || ch === "G" || ch === "B") {
            keys.push({ x: cx, y: cy, colour: ch, taken: false });
          }
          var kind = spawnKind(ch);
          if (kind) spawns.push({ x: cx, y: cy, kind: kind });
          if (ch === "A") ammoCrates.push({ x: cx, y: cy, taken: false });
          if (ch === "$") {
            var seed = ax * 3 + ay * 5 + (index || 0) * 11;
            /* Only some scrap boxes crack open — sealed ones are just clutter. */
            lootCrates.push({
              x: cx, y: cy, taken: false,
              seed: seed,
              shootable: (seed % 2) === 0
            });
          }
          if (ch === "+") healthBooths.push({ x: cx, y: cy, used: false });
          if (GUN_MARK[ch]) {
            gunPickups.push({ x: cx, y: cy, gun: GUN_MARK[ch], taken: false });
          }
          if (ch === "Y") towers.push({ x: cx, y: cy });
          if (ch === "S") ships.push({ x: cx, y: cy });
          if (ch === "C") crates.push({ x: cx, y: cy });
          if (ch === "X") {
            var midX = baseX + ((MACRO / 2) | 0);
            var midY = baseY + ((MACRO / 2) | 0);
            var ey;
            for (ey = 0; ey < MACRO; ey++) {
              var ex;
              for (ex = 0; ex < MACRO; ex++) {
                tiles[baseY + ey][baseX + ex] = { kind: "exit", outdoor: false };
              }
            }
            exits.push({
              x: cx, y: cy,
              tx: midX, ty: midY
            });
          }
        }
      }
    }

    var level = {
      name: name || "Deck",
      index: index || 0,
      tile: TILE,
      macro: MACRO,
      cols: w,
      rows: h,
      width: w * TILE,
      height: h * TILE,
      tiles: tiles,
      keys: keys,
      doors: doors,
      spawns: spawns,
      ammoCrates: ammoCrates,
      lootCrates: lootCrates,
      creditCrates: lootCrates,
      healthBooths: healthBooths,
      gunPickups: gunPickups,
      exits: exits,
      ships: ships,
      crates: crates,
      towers: towers,
      caches: [],
      start: start
    };
    if (lootCrates.length) {
      var hasShot = false;
      var li;
      for (li = 0; li < lootCrates.length; li++) {
        if (lootCrates[li].shootable) hasShot = true;
      }
      if (!hasShot) lootCrates[0].shootable = true;
    }
    placeCornerTowers(level);
    if (!opts.noWallCache) carveCache(level);
    if (!level.caches.length) dropCache(level);
    /* Sealed crates on door gaps soft-lock the run — force those shootable. */
    clearLootChokes(level);
    /* Nudge every floor object clear of walls so sprites/badges never sit in metal. */
    clearFloorObjects(level);
    return level;
  }

  function tileLooksOpen(tile) {
    return !!(tile && (tile.kind === "floor" || tile.kind === "exit" ||
      (tile.kind === "door" && tile.open)));
  }

  /* Floor cell with walls on both sides = a one-tile gap you must walk through. */
  function isNarrowPassage(map, tx, ty) {
    if (!tileLooksOpen(tileAt(map, tx, ty))) return false;
    var wL = isBlocking(tileAt(map, tx - 1, ty));
    var wR = isBlocking(tileAt(map, tx + 1, ty));
    var wU = isBlocking(tileAt(map, tx, ty - 1));
    var wD = isBlocking(tileAt(map, tx, ty + 1));
    return (wL && wR) || (wU && wD);
  }

  function clearLootChokes(map) {
    var crates = map.lootCrates || [];
    if (!crates.length) return;
    var T = map.tile;
    var i;
    for (i = 0; i < crates.length; i++) {
      var c = crates[i];
      if (c.shootable) continue;
      var tx = (c.x / T) | 0;
      var ty = (c.y / T) | 0;
      var dx;
      var dy;
      for (dy = -4; dy <= 4; dy++) {
        for (dx = -4; dx <= 4; dx++) {
          if (isNarrowPassage(map, tx + dx, ty + dy)) {
            c.shootable = true;
            break;
          }
        }
        if (c.shootable) break;
      }
      if (c.shootable) continue;
      for (var di = 0; di < map.doors.length; di++) {
        var door = map.doors[di];
        if (Math.hypot(c.x - (door.x + 0.5) * T, c.y - (door.y + 0.5) * T) < T * 4.5) {
          c.shootable = true;
          break;
        }
      }
    }
  }

  /* Wall colliders are the fine cell itself — already thin. */
  var WALL_THICK = TILE;

  function wallRectsForTile(map, tx, ty) {
    var tile = tileAt(map, tx, ty);
    if (!isBlocking(tile)) return [];
    var T = map.tile;
    return [{ x: tx * T, y: ty * T, w: T, h: T }];
  }

  function touchesOutdoor(map, tx, ty) {
    /* Ortho + diagonal — join cells sit inside the cross and only see walls ortho. */
    var dirs = [[0, -1], [0, 1], [1, 0], [-1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    var i;
    for (i = 0; i < dirs.length; i++) {
      var t = tileAt(map, tx + dirs[i][0], ty + dirs[i][1]);
      if (t && t.kind === "floor" && t.outdoor) return true;
    }
    return false;
  }

  function wallNeighbourInMap(map, tx, ty) {
    if (ty < 0 || tx < 0 || ty >= map.rows || tx >= map.cols) return false;
    return isBlocking(map.tiles[ty][tx]);
  }

  function isCornerTowerCell(map, tx, ty) {
    if (tileAt(map, tx, ty).kind !== "wall") return false;
    if (!touchesOutdoor(map, tx, ty)) return false;
    /* OOB is not a wall arm — edge-of-map corners must still count as L joins. */
    var n = wallNeighbourInMap(map, tx, ty - 1);
    var s = wallNeighbourInMap(map, tx, ty + 1);
    var e = wallNeighbourInMap(map, tx + 1, ty);
    var w = wallNeighbourInMap(map, tx - 1, ty);
    var walls = (n ? 1 : 0) + (s ? 1 : 0) + (e ? 1 : 0) + (w ? 1 : 0);
    /* Outer L only — thick wall edges are T-junctions (3 neighbours), not corners. */
    if (walls !== 2) return false;
    if ((n && s) || (e && w)) return false;
    return true;
  }

  /* Whole MACRO pad is the gun mount — shots/LOS may pass it (360° fire). */
  function markTowerMacro(map, tx, ty) {
    var ax = Math.floor(tx / MACRO) * MACRO;
    var ay = Math.floor(ty / MACRO) * MACRO;
    var ey;
    for (ey = 0; ey < MACRO; ey++) {
      var ex;
      for (ex = 0; ex < MACRO; ex++) {
        var tile = tileAt(map, ax + ex, ay + ey);
        if (tile && tile.kind === "wall") tile.tower = true;
      }
    }
  }

  function placeCornerTowers(map) {
    var seen = {};
    var i;
    for (i = 0; i < map.towers.length; i++) {
      var existing = map.towers[i];
      seen[Math.round(existing.x) + "," + Math.round(existing.y)] = 1;
      markTowerMacro(map, Math.floor(existing.x / map.tile), Math.floor(existing.y / map.tile));
    }
    var y;
    for (y = 0; y < map.rows; y++) {
      var x;
      for (x = 0; x < map.cols; x++) {
        if (!isCornerTowerCell(map, x, y)) continue;
        var cx = (x + 0.5) * map.tile;
        var cy = (y + 0.5) * map.tile;
        var key = Math.round(cx) + "," + Math.round(cy);
        if (seen[key]) continue;
        seen[key] = 1;
        map.towers.push({ x: cx, y: cy, corner: true });
        markTowerMacro(map, x, y);
      }
    }
  }

  /* Sprite/collision radius for floor pickups (matches game PICK_R ≈ 14). */
  var PICKUP_CLEAR_R = TILE * 0.95;

  /* Pull a floor pickup away from neighbouring walls so sprites/badges
   * do not sit under wall tiles. */
  function nudgeFromWalls(map, cx, cy, strength) {
    var T = map.tile;
    var push = (strength == null ? 0.32 : strength) * T;
    var tx = (cx / T) | 0;
    var ty = (cy / T) | 0;
    var nx = 0;
    var ny = 0;
    var ox;
    var oy;
    for (oy = -1; oy <= 1; oy++) {
      for (ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        if (tileAt(map, tx + ox, ty + oy).kind === "wall") {
          nx -= ox;
          ny -= oy;
        }
      }
    }
    var len = Math.hypot(nx, ny);
    if (!len) return { x: cx, y: cy };
    return {
      x: cx + (nx / len) * push,
      y: cy + (ny / len) * push
    };
  }

  /* Keep moving / spiral-search until the circle clears walls (and closed doors). */
  function ensureClear(map, cx, cy, r) {
    var rad = r == null ? PICKUP_CLEAR_R : r;
    if (!circleBlocked(map, cx, cy, rad)) return { x: cx, y: cy };
    var x = cx;
    var y = cy;
    var step;
    for (step = 0; step < 16; step++) {
      var nudged = nudgeFromWalls(map, x, y, 0.28 + step * 0.06);
      x = nudged.x;
      y = nudged.y;
      if (!circleBlocked(map, x, y, rad)) return { x: x, y: y };
    }
    var T = map.tile;
    var ox = (cx / T) | 0;
    var oy = (cy / T) | 0;
    var ring;
    for (ring = 0; ring <= 10; ring++) {
      var dy;
      for (dy = -ring; dy <= ring; dy++) {
        var dx;
        for (dx = -ring; dx <= ring; dx++) {
          if (ring > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          var tx = ox + dx;
          var ty = oy + dy;
          var tile = tileAt(map, tx, ty);
          if (tile.kind !== "floor" && tile.kind !== "exit") continue;
          var px = (tx + 0.5) * T;
          var py = (ty + 0.5) * T;
          var p = nudgeFromWalls(map, px, py, 0.4);
          if (!circleBlocked(map, p.x, p.y, rad)) return p;
          if (!circleBlocked(map, px, py, rad)) return { x: px, y: py };
        }
      }
    }
    return { x: cx, y: cy };
  }

  function relocateList(map, list, r) {
    if (!list || !list.length) return;
    var i;
    for (i = 0; i < list.length; i++) {
      var p = ensureClear(map, list[i].x, list[i].y, r);
      list[i].x = p.x;
      list[i].y = p.y;
    }
  }

  /* Ammo / loot / guns / booths / keys / caches / crates / spawns — off the walls. */
  function clearFloorObjects(map) {
    var r = PICKUP_CLEAR_R;
    relocateList(map, map.ammoCrates, r);
    relocateList(map, map.lootCrates, r);
    relocateList(map, map.healthBooths, r);
    relocateList(map, map.gunPickups, r);
    relocateList(map, map.keys, r);
    relocateList(map, map.caches, r);
    relocateList(map, map.crates, r);
    relocateList(map, map.spawns, r * 0.85);
  }

  function dropCache(map) {
    var exits = map.exits;
    var best = null;
    var bestScore = -1;
    var y;
    for (y = 1; y < map.rows - 1; y++) {
      var x;
      for (x = 1; x < map.cols - 1; x++) {
        var tile = map.tiles[y][x];
        if (tile.kind !== "floor") continue;
        var cx = (x + 0.5) * map.tile;
        var cy = (y + 0.5) * map.tile;
        if (Math.hypot(cx - map.start.x, cy - map.start.y) < map.tile * 4) continue;
        var nearExit = false;
        var i;
        for (i = 0; i < exits.length; i++) {
          if (Math.hypot(cx - exits[i].x, cy - exits[i].y) < map.tile * 3) nearExit = true;
        }
        if (nearExit || nearDoor(map, x, y)) continue;
        var walls = 0;
        if (map.tiles[y - 1][x].kind === "wall") walls++;
        if (map.tiles[y + 1][x].kind === "wall") walls++;
        if (map.tiles[y][x - 1].kind === "wall") walls++;
        if (map.tiles[y][x + 1].kind === "wall") walls++;
        /* Prefer a side alcove (1–2 walls), not a dead pocket jammed in a corner. */
        var score;
        if (walls >= 1 && walls <= 2) score = 100 + walls * 10;
        else if (walls >= 1) score = walls;
        else continue;
        score += (x + y) * 0.01;
        if (score > bestScore) {
          bestScore = score;
          best = { x: x, y: y, cx: cx, cy: cy };
        }
      }
    }
    if (!best) return;
    map.tiles[best.y][best.x].cache = true;
    var pos = nudgeFromWalls(map, best.cx, best.cy);
    map.caches.push({
      x: pos.x,
      y: pos.y,
      kind: (map.index % 2 === 0) ? "ammo" : "patch",
      taken: false
    });
  }

  function nearDoor(map, x, y) {
    var i;
    for (i = 0; i < map.doors.length; i++) {
      if (Math.abs(map.doors[i].x - x) + Math.abs(map.doors[i].y - y) <= 1) return true;
    }
    return false;
  }

  /*
   * A short pocket dug into solid wall, opening onto one floor tile.
   * It is not on the keycard path: the exit was already reachable, and
   * this only turns wall into floor.
   */
  function cacheWall(map, px, py) {
    if (py <= 0 || px <= 0 || py >= map.rows - 1 || px >= map.cols - 1) return false;
    return map.tiles[py][px].kind === "wall";
  }

  function carveCache(map) {
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var y;
    for (y = 2; y < map.rows - 2; y++) {
      var x;
      for (x = 2; x < map.cols - 2; x++) {
        if (map.tiles[y][x].kind !== "wall") continue;
        if (nearDoor(map, x, y)) continue;
        var floors = [];
        var d;
        for (d = 0; d < 4; d++) {
          var t = map.tiles[y + dirs[d][1]][x + dirs[d][0]];
          if (t.kind === "floor" || t.kind === "exit") floors.push(dirs[d]);
        }
        if (floors.length !== 1) continue;
        var ix = -floors[0][0];
        var iy = -floors[0][1];
        var x1 = x + ix;
        var y1 = y + iy;
        var x2 = x + ix * 2;
        var y2 = y + iy * 2;
        if (x2 <= 0 || y2 <= 0 || x2 >= map.cols - 1 || y2 >= map.rows - 1) continue;
        if (map.tiles[y1][x1].kind !== "wall" || map.tiles[y2][x2].kind !== "wall") continue;
        var sx = iy;
        var sy = ix;
        if (!cacheWall(map, x1 + sx, y1 + sy) || !cacheWall(map, x1 - sx, y1 - sy)) continue;
        if (!cacheWall(map, x2 + sx, y2 + sy) || !cacheWall(map, x2 - sx, y2 - sy)) continue;
        if (!cacheWall(map, x2 + ix, y2 + iy)) continue;
        if (nearDoor(map, x1, y1) || nearDoor(map, x2, y2)) continue;
        map.tiles[y][x] = { kind: "floor", outdoor: false, cache: true };
        map.tiles[y1][x1] = { kind: "floor", outdoor: false, cache: true };
        map.tiles[y2][x2] = { kind: "floor", outdoor: false, cache: true };
        /* Sit at the pocket mouth (toward the corridor), not deep in the wall. */
        var mouth = nudgeFromWalls(
          map,
          (x + 0.5) * map.tile + floors[0][0] * map.tile * 0.4,
          (y + 0.5) * map.tile + floors[0][1] * map.tile * 0.4
        );
        map.caches.push({
          x: mouth.x,
          y: mouth.y,
          kind: (map.index % 2 === 0) ? "ammo" : "patch",
          taken: false
        });
        return;
      }
    }
  }

  function sectorCount() { return SECTORS.length; }

  function cloneSector(index) {
    var i = Math.max(0, Math.min(SECTORS.length - 1, index | 0));
    var s = SECTORS[i];
    return parseLevel(s.rows, s.name, i, s);
  }

  function tileAt(map, tx, ty) {
    if (ty < 0 || tx < 0 || ty >= map.rows || tx >= map.cols) return { kind: "wall" };
    return map.tiles[ty][tx];
  }

  function isBlocking(tile) {
    if (!tile) return true;
    if (tile.kind === "wall") return true;
    if (tile.kind === "door" && !tile.open) return true;
    return false;
  }

  function circleBlocked(map, x, y, r, ignoreTowerWalls) {
    var minTX = Math.floor((x - r) / map.tile);
    var maxTX = Math.floor((x + r) / map.tile);
    var minTY = Math.floor((y - r) / map.tile);
    var maxTY = Math.floor((y + r) / map.tile);
    var ty;
    for (ty = minTY; ty <= maxTY; ty++) {
      var tx;
      for (tx = minTX; tx <= maxTX; tx++) {
        var tile = tileAt(map, tx, ty);
        if (!isBlocking(tile)) continue;
        /* Bullets may pass the wall cell under a corner tower so the gun is hittable. */
        if (ignoreTowerWalls && tile.kind === "wall" && tile.tower) continue;
        var rects = wallRectsForTile(map, tx, ty);
        var ri;
        for (ri = 0; ri < rects.length; ri++) {
          var box = rects[ri];
          var nearestX = Math.max(box.x, Math.min(x, box.x + box.w));
          var nearestY = Math.max(box.y, Math.min(y, box.y + box.h));
          var dx = x - nearestX;
          var dy = y - nearestY;
          if (dx * dx + dy * dy < r * r) return true;
        }
      }
    }
    return false;
  }

  function tryOpenDoor(map, inventory, x, y, r) {
    /* r is full unlock reach from the pilot centre (caller passes a generous radius). */
    var reach = Math.max(0, r || 0);
    var minTX = Math.floor((x - reach) / map.tile);
    var maxTX = Math.floor((x + reach) / map.tile);
    var minTY = Math.floor((y - reach) / map.tile);
    var maxTY = Math.floor((y + reach) / map.tile);
    var opened = null;
    var ty;
    for (ty = minTY; ty <= maxTY; ty++) {
      var tx;
      for (tx = minTX; tx <= maxTX; tx++) {
        var tile = tileAt(map, tx, ty);
        if (tile.kind !== "door" || tile.open) continue;
        if (!inventory[tile.colour]) continue;
        opened = tile.colour;
        break;
      }
      if (opened) break;
    }
    if (!opened) return null;
    for (ty = 0; ty < map.rows; ty++) {
      for (var tx2 = 0; tx2 < map.cols; tx2++) {
        var d = map.tiles[ty][tx2];
        if (d.kind === "door" && d.colour === opened) d.open = true;
      }
    }
    return opened;
  }

  function allDoorsOpen(map) {
    var i;
    for (i = 0; i < map.doors.length; i++) {
      var d = map.doors[i];
      var tile = map.tiles[d.y] && map.tiles[d.y][d.x];
      if (tile && tile.kind === "door" && !tile.open) return false;
    }
    return true;
  }

  function floorCells(map) {
    var cells = [];
    var y;
    for (y = 0; y < map.rows; y++) {
      var x;
      for (x = 0; x < map.cols; x++) {
        var k = map.tiles[y][x].kind;
        if (k === "floor" || k === "exit") cells.push({ x: x, y: y });
      }
    }
    return cells;
  }

  window.GameMap = {
    TILE: TILE,
    MACRO: MACRO,
    WALL_THICK: WALL_THICK,
    PICKUP_CLEAR_R: PICKUP_CLEAR_R,
    KEY_COLOURS: KEY_COLOURS,
    sectorCount: sectorCount,
    cloneSector: cloneSector,
    cloneMap: function () { return cloneSector(0); },
    tileAt: tileAt,
    isBlocking: isBlocking,
    wallRectsForTile: wallRectsForTile,
    isCornerTowerCell: isCornerTowerCell,
    circleBlocked: circleBlocked,
    ensureClear: ensureClear,
    clearFloorObjects: clearFloorObjects,
    tryOpenDoor: tryOpenDoor,
    allDoorsOpen: allDoorsOpen,
    floorCells: floorCells,
    /* Raw ASCII rows for biome / preview tooling. */
    sectorRows: function (index) {
      var i = Math.max(0, Math.min(SECTORS.length - 1, index | 0));
      return SECTORS[i].rows.slice();
    },
    sectorMeta: function (index) {
      var i = Math.max(0, Math.min(SECTORS.length - 1, index | 0));
      var s = SECTORS[i];
      return { name: s.name, noWallCache: !!s.noWallCache };
    }
  };
})();
