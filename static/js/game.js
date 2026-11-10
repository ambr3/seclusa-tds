/*
 * Seclusa Lockdown — sectors, gear, atmosphere, pause, minimap.
 */

(function () {
  "use strict";

  var PLAYER_SPEED = 230;
  var ENEMY_SPEED = 68;
  var SPAWN_START = 3.1;
  var SPAWN_MIN = 1.35;
  var PLAYER_R = 14;
  var KEY_R = 9;
  var PICK_R = 14;
  /* Unlock reach — stand back so door-campers do not melt you on open. */
  var DOOR_OPEN_R = 56;
  var MAX_HP = 5;
  var IFRAMES = 0.8;
  var ORANGE = "#f97316";
  var TEAL = "#2f8f8a";
  var TAN = "#c9a882";
  var TAN_DARK = "#8a6d4f";
  var METAL = "#4a5562";
  var RED_GLOW = "#ef4444";
  var PURPLE = "#a855f7";
  var YELLOW = "#facc15";
  var AUTO_AIM_RANGE = 520;
  var AMMO_START = 80;
  var AMMO_PICKUP = 30;

  var GUN_ORDER = ["pistol", "shotgun", "smg", "rifle", "lance"];

  var WEAPONS = {
    pistol: {
      id: "pistol", name: "Pistol",
      cooldown: 0.18, speed: 520, radius: 4,
      cost: 1, damage: 1, pellets: 1, spread: 0
    },
    shotgun: {
      id: "shotgun", name: "Scatter",
      cooldown: 0.55, speed: 460, radius: 3.5,
      cost: 2, damage: 1, pellets: 5, spread: 0.22
    },
    smg: {
      id: "smg", name: "Auto",
      cooldown: 0.07, speed: 500, radius: 3,
      cost: 1, damage: 1, pellets: 1, spread: 0.04
    },
    rifle: {
      id: "rifle", name: "Rifle",
      cooldown: 0.11, speed: 640, radius: 3.5,
      cost: 1, damage: 1, pellets: 1, spread: 0
    },
    lance: {
      id: "lance", name: "Lance",
      cooldown: 0.78, speed: 880, radius: 5,
      cost: 3, damage: 3, pellets: 1, spread: 0
    }
  };

  var SHOP_ITEMS = [
    { id: "ammo", kind: "ammo", label: "+30 ammo", cost: 12 },
    { id: "heal", kind: "heal", label: "+1 HP", cost: 18 },
    { id: "breach", kind: "charge", label: "Breach charge", cost: 26 },
    { id: "dash", kind: "gear", label: "Dash", cost: 32 },
    { id: "shotgun", kind: "weapon", label: "Scatter gun", cost: 28 },
    { id: "smg", kind: "weapon", label: "Auto gun", cost: 40 },
    { id: "hull", kind: "gear", label: "Hull patch", cost: 40 },
    { id: "rifle", kind: "weapon", label: "Rifle", cost: 52 },
    { id: "lance", kind: "weapon", label: "Lance", cost: 68 }
  ];

  function blankGunOwned() {
    return { pistol: true, shotgun: false, smg: false, rifle: false, lance: false };
  }

  function normalizeGunOwned(src) {
    src = src || {};
    return {
      pistol: true,
      shotgun: !!src.shotgun,
      smg: !!src.smg,
      rifle: !!src.rifle,
      lance: !!src.lance
    };
  }

  function preferWeapon(guns, want) {
    if (want && guns[want] && WEAPONS[want]) return want;
    var i;
    for (i = GUN_ORDER.length - 1; i >= 0; i--) {
      if (guns[GUN_ORDER[i]]) return GUN_ORDER[i];
    }
    return "pistol";
  }

  /* Along the wall when one is close, otherwise straight at the pilot. */
  function crawlerVector(px, py, ex, ey, nx, ny) {
    var tx;
    var ty;
    if (nx || ny) {
      tx = -ny;
      ty = nx;
      var dx = px - ex;
      var dy = py - ey;
      if (tx * dx + ty * dy < 0) {
        tx = -tx;
        ty = -ty;
      }
      tx -= nx * 0.45;
      ty -= ny * 0.45;
    } else {
      tx = px - ex;
      ty = py - ey;
    }
    var len = Math.hypot(tx, ty) || 1;
    return { x: tx / len, y: ty / len };
  }

  function fortressShouldFire(dist, planted, cool) {
    return !!planted && cool <= 0 && dist < 300 && dist > 36;
  }

  function circlesHit(ax, ay, ar, bx, by, br) {
    var dx = ax - bx;
    var dy = ay - by;
    var r = ar + br;
    return dx * dx + dy * dy <= r * r;
  }

  function readColour(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (err) {
      return fallback;
    }
  }

  function sfx(name) {
    if (window.GameAudio && window.GameAudio[name]) window.GameAudio[name]();
  }

  function enemyStats(kind, mods) {
    if (kind === "crawler" || kind === "runner") {
      return { r: 13, hp: Math.max(1, Math.round(1 * mods.enemyHp)), speed: 1.5, score: 3 };
    }
    if (kind === "fortress" || kind === "brute") {
      return { r: 20, hp: Math.max(3, Math.round(4 * mods.enemyHp)), speed: 0.55, score: 6 };
    }
    if (kind === "drone") {
      return { r: 10, hp: Math.max(1, Math.round(1 * mods.enemyHp)), speed: 1.1, score: 4 };
    }
    if (kind === "boss") {
      return { r: 30, hp: Math.max(10, Math.round(16 * mods.enemyHp)), speed: 0.45, score: 45 };
    }
    if (kind === "tower") {
      return { r: 22, hp: Math.max(3, Math.round(5 * mods.enemyHp)), speed: 0, score: 8 };
    }
    // grunt
    return { r: 12, hp: Math.max(1, Math.round(1 * mods.enemyHp)), speed: 0.95, score: 2 };
  }

  function create(canvas) {
    var ctx = canvas.getContext("2d");
    var w = canvas.width;
    var h = canvas.height;
    var viewScale = 1;
    var playing = false;
    var paused = false;
    var over = false;
    var won = false;
    var score = 0;
    var hp = MAX_HP;
    var maxHp = MAX_HP;
    var hurtBank = 0;
    var iframes = 0;
    var fireWait = 0;
    var spawnWait = 0;
    var spawnEvery = SPAWN_START;
    var player = { x: 0, y: 0, facing: 0 };
    var bullets = [];
    var enemyShots = [];
    var enemies = [];
    var inventory = { R: false, G: false, B: false };
    var owned = { pistol: true, shotgun: false, smg: false, rifle: false, lance: false, dash: false, hull: false };
    var breachCharges = 0;
    var dashLeft = 0;
    var dashCool = 0;
    var dashVx = 0;
    var dashVy = 0;
    var patchRun = false;
    var patchHold = 0;
    var breached = [];
    var weaponId = "pistol";
    var ammo = AMMO_START;
    var sectorIndex = 0;
    var map = null;
    var floorList = [];
    var floorDecor = [];
    var minimapCache = null;
    var minimapCacheKey = "";
    var camX = 0;
    var camY = 0;
    var onOver = null;
    var onShop = null;
    var onPause = null;
    var lastInput = null;
    var toastMsg = "";
    var toastLife = 0;
    var shopOpen = false;
    var flash = 0;
    var shake = 0;
    var hitMarks = [];
    var mods = window.GameSettings.difficultyMods("normal");
    var continueMode = false;

    function showToast(msg) {
      toastMsg = msg;
      toastLife = 2.2;
    }

    function weapon() {
      return WEAPONS[weaponId] || WEAPONS.pistol;
    }

    function persistProgress(extra) {
      var patch = {
        owned: owned,
        unlockedSector: sectorIndex,
        bestScore: score
      };
      if (extra) {
        if (typeof extra.unlockedSector === "number") patch.unlockedSector = extra.unlockedSector;
        if (typeof extra.cleared === "boolean") patch.cleared = extra.cleared;
        if (typeof extra.bestScore === "number") patch.bestScore = extra.bestScore;
        if (extra.clearSuspended) patch.clearSuspended = true;
        if (extra.suspended) patch.suspended = extra.suspended;
      }
      window.GameSettings.write(patch);
    }

    function makeEnemy(x, y, kind) {
      var k = kind || "grunt";
      if (k === "runner" || k === "crawler") k = "grunt";
      if (k === "brute") k = "fortress";
      var st = enemyStats(k, mods);
      return {
        x: x, y: y, r: st.r, hp: st.hp, maxHp: st.hp,
        speed: st.speed, kind: k, score: st.score,
        spawnCool: k === "boss" ? 2.5 : 0,
        fireCool: (k === "drone" || k === "grunt" || k === "fortress" || k === "tower") ? 0.8 : 0,
        planted: k === "tower",
        post: null
      };
    }

    function tileHash(tx, ty, salt) {
      var n = ((tx + 1) * 73856093) ^ ((ty + 1) * 19349663) ^ ((salt + 1) * 83492791) ^ ((sectorIndex + 3) * 39916801);
      n = (n >>> 0);
      return n / 4294967295;
    }

    function buildFloorDecor() {
      floorDecor.length = 0;
      if (!map) return;
      var i;

      // Only map-placed crates + ship are solid. Procedural junk is visual only.
      for (i = 0; i < (map.ships || []).length; i++) {
        var sh = map.ships[i];
        floorDecor.push({ kind: "ship", x: sh.x, y: sh.y, rot: -0.35, v: 0, solid: true, r: 30 });
      }
      for (i = 0; i < (map.crates || []).length; i++) {
        var cr = map.crates[i];
        floorDecor.push({
          kind: "box",
          x: cr.x,
          y: cr.y,
          rot: (tileHash(i + 1, 3, 2) - 0.5) * 0.5,
          v: 1,
          solid: true,
          r: 12
        });
      }

      // Visual litter. Candidates are shuffled by hash, then kept only if they
      // sit well clear of each other, the start, doors, keys, and tower bodies.
      var macro = map.macro || 3;
      var clearStart = map.tile * macro * 2.5;
      var litterGap = map.tile * macro * 2.6;
      var cands = [];
      for (i = 0; i < floorList.length; i++) {
        var cell = floorList[i];
        if (cell.x % macro !== (macro >> 1) || cell.y % macro !== (macro >> 1)) continue;
        var tile = map.tiles[cell.y][cell.x];
        if (!tile || tile.kind === "exit") continue;
        var outdoor = !!tile.outdoor;
        var h = tileHash(cell.x, cell.y, 7);
        if (h > (outdoor ? 0.2 : 0.55)) continue;
        var span = map.tile * macro;
        var wander = span * 0.72;
        var cx = (cell.x + 0.5) * map.tile + (tileHash(cell.x, cell.y, 3) - 0.5) * wander;
        var cy = (cell.y + 0.5) * map.tile + (tileHash(cell.x, cell.y, 5) - 0.5) * wander;
        var kind;
        if (outdoor) {
          kind = h < 0.07 ? "scrap" : h < 0.14 ? "rock" : "stain";
        } else {
          var pick = tileHash(cell.x, cell.y, 13);
          var indoorKinds = [
            "rubble", "gravel", "drain", "bricks", "broken", "bucket", "cans",
            "cracks", "crates", "hose", "lights", "tools", "tyre", "wood", "tin", "sandbag"
          ];
          kind = indoorKinds[Math.floor(pick * indoorKinds.length) % indoorKinds.length];
        }
        cands.push({
          kind: kind,
          x: cx,
          y: cy,
          rot: tileHash(cell.x, cell.y, 9) * Math.PI * 2,
          v: Math.floor(tileHash(cell.x, cell.y, 11) * 4),
          h: h,
          outdoor: outdoor
        });
      }
      cands.sort(function (a, b) { return a.h - b.h; });
      var ci;
      for (ci = 0; ci < cands.length; ci++) {
        var cand = cands[ci];
        if (Math.hypot(cand.x - map.start.x, cand.y - map.start.y) < clearStart) continue;
        var crowded = false;
        var j;
        for (j = 0; j < floorDecor.length; j++) {
          var d = floorDecor[j];
          var minD = d.solid ? map.tile * 2.2 : litterGap;
          if (Math.hypot(cand.x - d.x, cand.y - d.y) < minD) { crowded = true; break; }
        }
        if (crowded) continue;
        for (j = 0; j < map.keys.length; j++) {
          if (Math.hypot(cand.x - map.keys[j].x, cand.y - map.keys[j].y) < map.tile * macro) {
            crowded = true;
            break;
          }
        }
        if (crowded) continue;
        for (j = 0; j < map.doors.length; j++) {
          var doorx = (map.doors[j].x + 0.5) * map.tile;
          var doory = (map.doors[j].y + 0.5) * map.tile;
          if (Math.hypot(cand.x - doorx, cand.y - doory) < map.tile * macro * 1.2) {
            crowded = true;
            break;
          }
        }
        if (crowded) continue;
        for (j = 0; j < (map.towers || []).length; j++) {
          var foot = towerFootAt(map.towers[j].x, map.towers[j].y);
          if (Math.abs(cand.x - foot.x) < foot.half + 16 && Math.abs(cand.y - foot.y) < foot.half + 16) {
            crowded = true;
            break;
          }
        }
        if (crowded) continue;
        floorDecor.push({
          kind: cand.kind,
          x: cand.x,
          y: cand.y,
          rot: cand.rot,
          v: cand.v,
          solid: false,
          r: 0
        });
      }
    }

    /* Corner gun sits on the wall MACRO cell — not a full guard-room stamp. */
    function towerFootAt(x, y) {
      var t = map.tile;
      var macro = map.macro || 3;
      var tx = Math.floor(x / t);
      var ty = Math.floor(y / t);
      var ax = Math.floor(tx / macro) * macro;
      var ay = Math.floor(ty / macro) * macro;
      var side = t * macro * 1.05;
      return {
        x: (ax + macro * 0.5) * t,
        y: (ay + macro * 0.5) * t,
        half: side * 0.42
      };
    }

    function towerFoot(e) {
      return towerFootAt(e.x, e.y);
    }

    function towerBlocked(x, y, radius) {
      var i;
      for (i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        if (e.kind !== "tower") continue;
        var foot = towerFoot(e);
        var nx = Math.max(foot.x - foot.half, Math.min(x, foot.x + foot.half));
        var ny = Math.max(foot.y - foot.half, Math.min(y, foot.y + foot.half));
        var dx = x - nx;
        var dy = y - ny;
        if (dx * dx + dy * dy < radius * radius) return true;
      }
      return false;
    }

    function propBlocked(x, y, radius) {
      var i;
      for (i = 0; i < floorDecor.length; i++) {
        var d = floorDecor[i];
        if (!d.solid || !d.r) continue;
        if (Math.hypot(x - d.x, y - d.y) < radius + d.r) return true;
      }
      if (map && map.creditCrates) {
        for (i = 0; i < map.creditCrates.length; i++) {
          var box = map.creditCrates[i];
          if (box.taken) continue;
          if (Math.hypot(x - box.x, y - box.y) < radius + 12) return true;
        }
      }
      return false;
    }

    function loadSector(index, keepGear) {
      patchRun = false;
      patchHold = 0;
      breached = [];
      sectorIndex = index;
      applyDeckTheme(index);
      map = window.GameMap.cloneSector(index);
      floorList = window.GameMap.floorCells(map);
      buildFloorDecor();
      minimapCache = null;
      minimapCacheKey = "";
      inventory = { R: false, G: false, B: false };
      player.x = map.start.x;
      player.y = map.start.y;
      player.facing = 0;
      bullets.length = 0;
      enemyShots.length = 0;
      enemies.length = 0;
      shopOpen = false;
      spawnWait = 1.4 * mods.spawn;
      spawnEvery = SPAWN_START * mods.spawn;
      if (!keepGear) {
        owned = {
          pistol: true, shotgun: false, smg: false, rifle: false, lance: false,
          dash: false, hull: false
        };
        breachCharges = 0;
        weaponId = "pistol";
        ammo = Math.round(AMMO_START * mods.ammo);
      }
      var i;
      var mapFrac = mods.mapSpawn == null ? 1 : mods.mapSpawn;
      var mapStep = mapFrac >= 0.99 ? 1 : Math.max(2, Math.round(1 / Math.max(0.2, mapFrac)));
      for (i = 0; i < map.spawns.length; i++) {
        var s = map.spawns[i];
        if (s.kind !== "boss" && mapStep > 1 && (i % mapStep) !== 0) continue;
        enemies.push(readyEnemy(makeEnemy(s.x, s.y, s.kind)));
      }
      for (i = 0; i < (map.towers || []).length; i++) {
        var tw = map.towers[i];
        enemies.push(readyEnemy(makeEnemy(tw.x, tw.y, "tower")));
      }
      updateCamera();
      showToast(sectorIndex === 0 ? "Crash site — grab the keycard" : map.name);
      persistProgress({ unlockedSector: Math.max(sectorIndex, window.GameSettings.getProgress().unlockedSector) });
    }

    function assignPost(e) {
      var best = null;
      var bestD = Infinity;
      var i;
      for (i = 0; i < map.doors.length; i++) {
        var door = map.doors[i];
        var x = (door.x + 0.5) * map.tile;
        var y = (door.y + 0.5) * map.tile;
        var dist = Math.hypot(x - e.x, y - e.y);
        if (dist < bestD) {
          bestD = dist;
          best = { x: x, y: y };
        }
      }
      e.post = best || { x: e.x, y: e.y };
    }

    function pushOutOfWalls(ent, radius) {
      if (!blockedAt(ent.x, ent.y, radius)) return;
      var step = Math.max(4, map.tile * 0.35);
      var best = null;
      var bestD = Infinity;
      var ring;
      for (ring = 1; ring <= 8; ring++) {
        var ang;
        for (ang = 0; ang < 16; ang++) {
          var a = (ang / 16) * Math.PI * 2;
          var nx = ent.x + Math.cos(a) * step * ring;
          var ny = ent.y + Math.sin(a) * step * ring;
          if (blockedAt(nx, ny, radius)) continue;
          var d = Math.hypot(nx - ent.x, ny - ent.y);
          if (d < bestD) {
            bestD = d;
            best = { x: nx, y: ny };
          }
        }
        if (best) break;
      }
      if (best) {
        ent.x = best.x;
        ent.y = best.y;
      }
    }

    function readyEnemy(e) {
      if (e.kind === "fortress") assignPost(e);
      if (e.kind !== "tower") pushOutOfWalls(e, e.r);
      return e;
    }

    function reset(opts) {
      opts = opts || {};
      mods = window.GameSettings.difficultyMods(window.GameSettings.getDifficulty());
      continueMode = !!opts.continueRun;
      score = 0;
      maxHp = MAX_HP + (mods.bonusHp | 0);
      hp = maxHp;
      hurtBank = 0;
      iframes = 0;
      fireWait = 0;
      over = false;
      won = false;
      paused = false;
      toastMsg = "";
      toastLife = 0;
      flash = 0;
      shake = 0;
      hitMarks.length = 0;

      var progress = window.GameSettings.getProgress();
      if (continueMode && progress.suspended) {
        restoreRun(progress.suspended);
        return;
      }
      if (continueMode) {
        owned = Object.assign(normalizeGunOwned(progress.owned), { dash: false, hull: false });
        breachCharges = 0;
        weaponId = preferWeapon(owned, null);
        ammo = Math.round(AMMO_START * mods.ammo);
        loadSector(Math.min(progress.unlockedSector, window.GameMap.sectorCount() - 1), true);
      } else {
        window.GameSettings.write({ clearSuspended: true });
        /* Guns stay unlocked across runs; dash / hull / breach reset. */
        owned = Object.assign(normalizeGunOwned(progress.owned), { dash: false, hull: false });
        breachCharges = 0;
        weaponId = preferWeapon(owned, null);
        ammo = Math.round(AMMO_START * mods.ammo);
        loadSector(0, true);
      }
    }

    function clampCameraTarget(tx, ty) {
      if (map.width < w) tx = (map.width - w) * 0.5;
      else tx = Math.max(0, Math.min(map.width - w, tx));
      if (map.height < h) ty = (map.height - h) * 0.5;
      else ty = Math.max(0, Math.min(map.height - h, ty));
      return { x: tx, y: ty };
    }

    function updateCamera() {
      if (!map) return;
      /* Locked to the pilot. A catch-up follow reads as jitter. */
      var target = clampCameraTarget(player.x - w * 0.5, player.y - h * 0.5);
      camX = target.x;
      camY = target.y;
    }

    function blockedAt(x, y, radius) {
      return window.GameMap.circleBlocked(map, x, y, radius) ||
        propBlocked(x, y, radius) ||
        towerBlocked(x, y, radius);
    }

    function moveCircle(ent, dx, dy, radius) {
      /* Try the full step first so diagonal motion does not stutter on one axis. */
      if (dx || dy) {
        var fx = ent.x + dx;
        var fy = ent.y + dy;
        if (!blockedAt(fx, fy, radius)) {
          ent.x = fx;
          ent.y = fy;
          return;
        }
      }
      if (dx) {
        var nx = ent.x + dx;
        if (!blockedAt(nx, ent.y, radius)) ent.x = nx;
      }
      if (dy) {
        var ny = ent.y + dy;
        if (!blockedAt(ent.x, ny, radius)) ent.y = ny;
      }
    }

    function randomFloorAwayFromPlayer(minDist) {
      var tries = 50;
      while (tries--) {
        var cell = floorList[Math.floor(Math.random() * floorList.length)];
        var tile = map.tiles[cell.y][cell.x];
        if (tile.outdoor) continue;
        var x = (cell.x + 0.5) * map.tile;
        var y = (cell.y + 0.5) * map.tile;
        if (propBlocked(x, y, 16) || towerBlocked(x, y, 16)) continue;
        if (window.GameMap.circleBlocked(map, x, y, 18)) continue;
        if (Math.hypot(x - player.x, y - player.y) >= minDist) return { x: x, y: y };
      }
      return null;
    }

    function mobileEnemyCount() {
      var n = 0;
      var i;
      for (i = 0; i < enemies.length; i++) {
        if (enemies[i].kind !== "tower") n++;
      }
      return n;
    }

    function spawnEnemy(kind) {
      if (mobileEnemyCount() >= (mods.maxEnemies || 12)) return;
      var spot = randomFloorAwayFromPlayer(map.tile * 5);
      if (!spot) return;
      var k = kind;
      /* Only Dave's robot + drone sheets for wave spawns. No procedural crawlers. */
      if (!k || k === "crawler" || k === "runner" || k === "fortress") {
        var t = sectorIndex / Math.max(1, window.GameMap.sectorCount() - 1);
        k = Math.random() < 0.32 + t * 0.2 ? "drone" : "grunt";
      }
      enemies.push(readyEnemy(makeEnemy(spot.x, spot.y, k)));
    }

    function nearestEnemy(x, y, range) {
      var best = null;
      var bestD = range * range;
      var i;
      for (i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        var d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      return best;
    }

    function nearTerminal() {
      var i;
      for (i = 0; i < map.terminals.length; i++) {
        var t = map.terminals[i];
        if (circlesHit(player.x, player.y, PLAYER_R, t.x, t.y, PICK_R + 8)) return t;
      }
      return null;
    }

    function onExit() {
      var i;
      for (i = 0; i < map.exits.length; i++) {
        var e = map.exits[i];
        if (circlesHit(player.x, player.y, PLAYER_R, e.x, e.y, PICK_R)) return true;
      }
      return false;
    }

    function nearShip() {
      var i;
      for (i = 0; i < (map.ships || []).length; i++) {
        var ship = map.ships[i];
        if (Math.hypot(player.x - ship.x, player.y - ship.y) < 64) return ship;
      }
      return null;
    }

    function bossAlive() {
      var i;
      for (i = 0; i < enemies.length; i++) {
        if (enemies[i].kind === "boss" && enemies[i].hp > 0) return true;
      }
      return false;
    }

    function hurt(amount) {
      if (iframes > 0) return;
      var scale = mods.damageTaken == null ? 1 : mods.damageTaken;
      var iframeMul = mods.iframeScale || 1;
      hurtBank += amount * scale;
      var dmg = Math.floor(hurtBank + 1e-9);
      if (dmg < 1) {
        /* Partial hit on easy/medium — flinch, no heart lost yet. */
        iframes = IFRAMES * 0.45 * iframeMul;
        flash = 0.12;
        shake = 0.12;
        sfx("thud");
        return;
      }
      hurtBank -= dmg;
      if (hp - dmg <= 0 && owned.hull) {
        owned.hull = false;
        hp = 2;
        hurtBank = 0;
        iframes = 1.2 * iframeMul;
        flash = 0.3;
        shake = 0.35;
        showToast("Hull patch caught it");
        sfx("hurt");
        return;
      }
      hp -= dmg;
      iframes = IFRAMES * iframeMul;
      flash = 0.25;
      shake = 0.3;
      sfx("hurt");
      sfx("thud");
      if (hp <= 0) {
        hp = 0;
        endRun(false);
      }
    }

    function wallNormal(ent) {
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [0.7, -0.7], [-0.7, 0.7], [-0.7, -0.7]];
      var nx = 0;
      var ny = 0;
      var hit = 0;
      var i;
      for (i = 0; i < dirs.length; i++) {
        var d = dirs[i];
        var len = Math.hypot(d[0], d[1]) || 1;
        var px = ent.x + (d[0] / len) * (ent.r + 10);
        var py = ent.y + (d[1] / len) * (ent.r + 10);
        if (window.GameMap.circleBlocked(map, px, py, 4)) {
          nx -= d[0] / len;
          ny -= d[1] / len;
          hit++;
        }
      }
      if (!hit) return null;
      var nlen = Math.hypot(nx, ny) || 1;
      return { x: nx / nlen, y: ny / nlen };
    }

    function clearLine(x0, y0, x1, y1) {
      var dist = Math.hypot(x1 - x0, y1 - y0);
      var steps = Math.max(1, Math.ceil(dist / (map.tile * 0.45)));
      var i;
      for (i = 1; i < steps; i++) {
        var t = i / steps;
        var x = x0 + (x1 - x0) * t;
        var y = y0 + (y1 - y0) * t;
        if (window.GameMap.circleBlocked(map, x, y, 3)) return false;
      }
      return true;
    }

    function pushShot(e, nx, ny, speed, radius, dmg, life) {
      enemyShots.push({
        x: e.x + nx * (e.r + 4),
        y: e.y + ny * (e.r + 4),
        vx: nx * speed,
        vy: ny * speed,
        life: life,
        r: radius,
        dmg: dmg
      });
    }

    function enemyFireGap(base) {
      return base * (mods.fireScale || 1);
    }

    function stepEnemy(e, dt) {
      var edx = player.x - e.x;
      var edy = player.y - e.y;
      var elen = Math.hypot(edx, edy) || 1;
      var spd = ENEMY_SPEED * e.speed * mods.enemySpeed;
      var nx = edx / elen;
      var ny = edy / elen;

      if (e.kind === "drone") {
        var ideal = 170;
        if (elen < ideal - 30) moveCircle(e, -nx * spd * dt, -ny * spd * dt, e.r);
        else if (elen > ideal + 50) moveCircle(e, nx * spd * dt, ny * spd * dt, e.r);
        else moveCircle(e, -ny * spd * 0.7 * dt, nx * spd * 0.7 * dt, e.r);
        e.fireCool -= dt;
        if (e.fireCool <= 0 && elen < 340 && clearLine(e.x, e.y, player.x, player.y)) {
          e.fireCool = enemyFireGap(1.35);
          pushShot(e, nx, ny, 260, 3.5, 1, 1.4);
        }
        return;
      }

      if (e.kind === "crawler") {
        var wall = wallNormal(e);
        var dir = crawlerVector(player.x, player.y, e.x, e.y, wall ? wall.x : 0, wall ? wall.y : 0);
        moveCircle(e, dir.x * spd * dt, dir.y * spd * dt, e.r);
        return;
      }

      if (e.kind === "tower") {
        e.planted = true;
        e.fireCool -= dt;
        var foot = towerFoot(e);
        var ang = Math.atan2(player.y - foot.y, player.x - foot.x);
        var mx = foot.x + Math.cos(ang) * (foot.half + 12);
        var my = foot.y + Math.sin(ang) * (foot.half + 12);
        var mdx = player.x - mx;
        var mdy = player.y - my;
        var mlen = Math.hypot(mdx, mdy) || 1;
        if (e.fireCool <= 0 && mlen < 420 && mlen > 28 && clearLine(mx, my, player.x, player.y)) {
          e.fireCool = enemyFireGap(1.45);
          enemyShots.push({
            x: mx,
            y: my,
            vx: (mdx / mlen) * 240,
            vy: (mdy / mlen) * 240,
            life: 1.5,
            r: 4,
            dmg: 1
          });
        }
        return;
      }

      if (e.kind === "fortress") {
        if (!e.post) assignPost(e);
        var pdx = e.post.x - e.x;
        var pdy = e.post.y - e.y;
        var plen = Math.hypot(pdx, pdy);
        if (plen > 22) {
          moveCircle(e, (pdx / plen) * spd * dt, (pdy / plen) * spd * dt, e.r);
          var after = Math.hypot(e.post.x - e.x, e.post.y - e.y);
          e.planted = after > plen - 0.4;
        } else {
          e.planted = true;
        }
        if (e.planted) {
          e.fireCool -= dt;
          if (fortressShouldFire(elen, true, e.fireCool) && clearLine(e.x, e.y, player.x, player.y)) {
            e.fireCool = enemyFireGap(1.7);
            pushShot(e, nx, ny, 200, 5, 2, 1.6);
          }
        }
        return;
      }

      /* Grunts (Dave's robots): chase and shoot. */
      moveCircle(e, nx * spd * dt, ny * spd * dt, e.r);
      e.fireCool -= dt;
      if (e.fireCool <= 0 && elen < 300 && clearLine(e.x, e.y, player.x, player.y)) {
        e.fireCool = enemyFireGap(1.15);
        pushShot(e, nx, ny, 280, 3.2, 1, 1.25);
      }
    }

    function useBreach() {
      if (breachCharges <= 0) {
        showToast("No breach charge");
        sfx("empty");
        return;
      }
      var tx = Math.floor((player.x + Math.cos(player.facing) * 36) / map.tile);
      var ty = Math.floor((player.y + Math.sin(player.facing) * 36) / map.tile);
      if (tx <= 0 || ty <= 0 || tx >= map.cols - 1 || ty >= map.rows - 1) {
        showToast("The outer wall holds");
        return;
      }
      var tile = map.tiles[ty] && map.tiles[ty][tx];
      if (!tile || tile.kind !== "wall") {
        showToast("Face a wall");
        return;
      }
      map.tiles[ty][tx] = { kind: "floor", outdoor: false, breached: true };
      breached.push({ x: tx, y: ty });
      floorList = window.GameMap.floorCells(map);
      breachCharges -= 1;
      showToast("Wall breached");
      sfx("thud");
    }

    function beginPatch() {
      patchRun = true;
      patchHold = 0;
      sectorIndex = 0;
      map = window.GameMap.cloneSector(0);
      floorList = window.GameMap.floorCells(map);
      buildFloorDecor();
      bullets.length = 0;
      enemyShots.length = 0;
      enemies.length = 0;
      var ship = (map.ships && map.ships[0]) || map.start;
      player.x = ship.x + 58;
      player.y = ship.y;
      if (window.GameMap.circleBlocked(map, player.x, player.y, PLAYER_R) || propBlocked(player.x, player.y, PLAYER_R)) {
        player.x = map.start.x;
        player.y = map.start.y;
      }
      updateCamera();
      showToast("Back at the wreck — hold E to patch");
      sfx("exit");
    }

    function snapshotRun() {
      return {
        sectorIndex: patchRun ? 0 : sectorIndex,
        score: score,
        hp: hp,
        ammo: ammo,
        weaponId: weaponId,
        owned: {
          pistol: true,
          shotgun: !!owned.shotgun,
          smg: !!owned.smg,
          rifle: !!owned.rifle,
          lance: !!owned.lance,
          dash: !!owned.dash,
          hull: !!owned.hull
        },
        inventory: { R: !!inventory.R, G: !!inventory.G, B: !!inventory.B },
        player: { x: player.x, y: player.y, facing: player.facing },
        enemies: enemies.map(function (e) {
          return {
            x: e.x, y: e.y, hp: e.hp, kind: e.kind,
            fireCool: e.fireCool || 0,
            post: e.post ? { x: e.post.x, y: e.post.y } : null
          };
        }),
        doorsOpen: map.doors.map(function (d) { return !!map.tiles[d.y][d.x].open; }),
        keysTaken: map.keys.map(function (k) { return !!k.taken; }),
        cratesTaken: map.ammoCrates.map(function (c) { return !!c.taken; }),
        creditsTaken: (map.creditCrates || []).map(function (c) { return !!c.taken; }),
        cachesTaken: (map.caches || []).map(function (c) { return !!c.taken; }),
        breached: breached.map(function (c) { return { x: c.x, y: c.y }; }),
        breachCharges: breachCharges,
        patchRun: patchRun
      };
    }

    function applySnapshotMap(snap) {
      var i;
      for (i = 0; i < snap.doorsOpen.length && i < map.doors.length; i++) {
        if (snap.doorsOpen[i]) map.tiles[map.doors[i].y][map.doors[i].x].open = true;
      }
      for (i = 0; i < snap.keysTaken.length && i < map.keys.length; i++) {
        map.keys[i].taken = !!snap.keysTaken[i];
        if (map.keys[i].taken) inventory[map.keys[i].colour] = true;
      }
      for (i = 0; i < snap.cratesTaken.length && i < map.ammoCrates.length; i++) {
        map.ammoCrates[i].taken = !!snap.cratesTaken[i];
      }
      if (snap.creditsTaken && map.creditCrates) {
        for (i = 0; i < snap.creditsTaken.length && i < map.creditCrates.length; i++) {
          map.creditCrates[i].taken = !!snap.creditsTaken[i];
        }
      }
      for (i = 0; i < snap.cachesTaken.length && i < (map.caches || []).length; i++) {
        map.caches[i].taken = !!snap.cachesTaken[i];
      }
      breached = [];
      for (i = 0; i < snap.breached.length; i++) {
        var cell = snap.breached[i];
        if (!map.tiles[cell.y] || !map.tiles[cell.y][cell.x]) continue;
        if (cell.x <= 0 || cell.y <= 0 || cell.x >= map.cols - 1 || cell.y >= map.rows - 1) continue;
        map.tiles[cell.y][cell.x] = { kind: "floor", outdoor: false, breached: true };
        breached.push({ x: cell.x, y: cell.y });
      }
      floorList = window.GameMap.floorCells(map);
    }

    function restoreRun(snap) {
      maxHp = MAX_HP + (mods.bonusHp | 0);
      hurtBank = 0;
      score = snap.score;
      hp = Math.min(maxHp, snap.hp);
      ammo = snap.ammo;
      weaponId = snap.weaponId;
      owned = {
        pistol: true,
        shotgun: !!snap.owned.shotgun,
        smg: !!snap.owned.smg,
        rifle: !!snap.owned.rifle,
        lance: !!snap.owned.lance,
        dash: !!snap.owned.dash,
        hull: !!snap.owned.hull
      };
      inventory = { R: !!snap.inventory.R, G: !!snap.inventory.G, B: !!snap.inventory.B };
      breachCharges = snap.breachCharges ? 1 : 0;
      patchRun = !!snap.patchRun;
      patchHold = 0;
      dashLeft = 0;
      dashCool = 0;
      sectorIndex = snap.patchRun ? 0 : snap.sectorIndex;
      applyDeckTheme(sectorIndex);
      map = window.GameMap.cloneSector(sectorIndex);
      floorList = window.GameMap.floorCells(map);
      buildFloorDecor();
      applySnapshotMap(snap);
      player.x = snap.player.x;
      player.y = snap.player.y;
      player.facing = snap.player.facing;
      bullets.length = 0;
      enemyShots.length = 0;
      enemies.length = 0;
      var i;
      for (i = 0; i < snap.enemies.length; i++) {
        var src = snap.enemies[i];
        var e = makeEnemy(src.x, src.y, src.kind);
        e.hp = src.hp;
        e.fireCool = src.fireCool || 0;
        if (src.post) e.post = { x: src.post.x, y: src.post.y };
        else if (e.kind === "fortress") assignPost(e);
        enemies.push(e);
      }
      shopOpen = false;
      spawnWait = 1.2;
      updateCamera();
      showToast(patchRun ? "Hold E at the wreck" : map.name);
    }

    function suspend() {
      if (!playing || over || !map) return;
      var snap = snapshotRun();
      playing = false;
      paused = false;
      shopOpen = false;
      persistProgress({
        suspended: snap,
        bestScore: score,
        unlockedSector: sectorIndex
      });
    }

    function fire() {
      var gun = weapon();
      var cost = gun.cost || 1;
      if (ammo < cost) {
        sfx("empty");
        showToast("Empty");
        return;
      }
      ammo -= cost;
      sfx("shoot");
      var base = player.facing;
      var p;
      for (p = 0; p < gun.pellets; p++) {
        var ang = base + (gun.pellets === 1 ? 0 : (p - (gun.pellets - 1) / 2) * gun.spread);
        bullets.push({
          x: player.x + Math.cos(ang) * (PLAYER_R + 4),
          y: player.y + Math.sin(ang) * (PLAYER_R + 4),
          vx: Math.cos(ang) * gun.speed,
          vy: Math.sin(ang) * gun.speed,
          life: 1.15,
          r: gun.radius,
          dmg: gun.damage
        });
      }
      fireWait = gun.cooldown || 0.2;
    }

    function shopSnapshot() {
      return {
        score: score,
        ammo: ammo,
        hp: hp,
        maxHp: maxHp,
        owned: {
          pistol: true,
          shotgun: !!owned.shotgun,
          smg: !!owned.smg,
          rifle: !!owned.rifle,
          lance: !!owned.lance,
          dash: !!owned.dash,
          hull: !!owned.hull
        },
        breachCharges: breachCharges,
        items: SHOP_ITEMS
      };
    }

    function openShop() {
      shopOpen = true;
      paused = true;
      sfx("shop");
      if (typeof onShop === "function") onShop(shopSnapshot());
      if (typeof onPause === "function") onPause(true);
    }

    function closeShop() {
      shopOpen = false;
      paused = false;
      showToast("Terminal closed");
      if (typeof onPause === "function") onPause(false);
    }

    function purchase(id) {
      var item = null;
      var i;
      for (i = 0; i < SHOP_ITEMS.length; i++) {
        if (SHOP_ITEMS[i].id === id) item = SHOP_ITEMS[i];
      }
      if (!item) return shopSnapshot();
      if (score < item.cost) {
        showToast("Need " + item.cost + " credits");
        sfx("empty");
        return shopSnapshot();
      }
      if (item.kind === "ammo") {
        score -= item.cost;
        ammo += Math.round(AMMO_PICKUP * mods.ammo);
        showToast("Ammo restocked");
        sfx("shop");
      } else if (item.kind === "weapon") {
        if (owned[item.id]) {
          showToast("Already owned");
          return shopSnapshot();
        }
        score -= item.cost;
        owned[item.id] = true;
        weaponId = item.id;
        showToast(WEAPONS[item.id].name + " online");
        sfx("shop");
        persistProgress();
      } else if (item.kind === "heal") {
        if (hp >= maxHp) {
          showToast("HP full");
          return shopSnapshot();
        }
        score -= item.cost;
        hp = Math.min(maxHp, hp + 1);
        showToast("Vitals restored");
        sfx("shop");
      } else if (item.kind === "gear") {
        if (owned[item.id]) {
          showToast("Already carried");
          return shopSnapshot();
        }
        score -= item.cost;
        owned[item.id] = true;
        showToast(item.id === "dash" ? "Dash online — Shift" : "Hull patch stowed");
        sfx("shop");
      } else if (item.kind === "charge") {
        if (breachCharges >= 1) {
          showToast("Already carrying a charge");
          return shopSnapshot();
        }
        score -= item.cost;
        breachCharges = 1;
        showToast("Breach charge — press F at a wall");
        sfx("shop");
      }
      return shopSnapshot();
    }

    function endRun(didWin) {
      over = true;
      playing = false;
      paused = false;
      shopOpen = false;
      won = !!didWin;
      persistProgress({
        bestScore: score,
        cleared: didWin,
        unlockedSector: didWin ? window.GameMap.sectorCount() - 1 : sectorIndex,
        clearSuspended: true
      });
      if (didWin) sfx("win");
      if (typeof onOver === "function") onOver(score, didWin);
    }

    function setPaused(value) {
      if (!playing || over || shopOpen) return;
      paused = !!value;
      if (typeof onPause === "function") onPause(paused);
      if (paused) showToast("Paused");
    }

    function update(dt, input) {
      if (!playing || over) return;
      lastInput = input;

      if (input.pause) {
        if (shopOpen) {
          closeShop();
          if (typeof onShop === "function") onShop(null);
        } else {
          setPaused(!paused);
        }
      }

      if (paused || shopOpen) {
        if (toastLife > 0) toastLife -= dt;
        return;
      }

      if (dt > 0.05) dt = 0.05;
      if (toastLife > 0) toastLife -= dt;
      if (flash > 0) flash -= dt;
      if (shake > 0) shake -= dt;

      if (input.weapon1 && owned.pistol) weaponId = "pistol";
      if (input.weapon2 && owned.shotgun) weaponId = "shotgun";
      if (input.weapon3 && owned.smg) weaponId = "smg";
      if (input.weapon4 && owned.rifle) weaponId = "rifle";
      if (input.weapon5 && owned.lance) weaponId = "lance";

      if (input.breach) useBreach();

      if (owned.dash && input.dash && dashCool <= 0 && dashLeft <= 0) {
        var dashX = input.moveX;
        var dashY = input.moveY;
        if (!dashX && !dashY) {
          dashX = Math.cos(player.facing);
          dashY = Math.sin(player.facing);
        }
        var dashLen = Math.hypot(dashX, dashY) || 1;
        dashVx = (dashX / dashLen) * 640;
        dashVy = (dashY / dashLen) * 640;
        dashLeft = 0.14;
        dashCool = 0.95;
        iframes = Math.max(iframes, 0.14);
      }
      if (dashCool > 0) dashCool -= dt;

      if (input.interact && nearTerminal()) {
        openShop();
        return;
      }

      if (dashLeft > 0) {
        moveCircle(player, dashVx * dt, dashVy * dt, PLAYER_R);
        dashLeft -= dt;
      } else {
        moveCircle(
          player,
          input.moveX * PLAYER_SPEED * mods.playerSpeed * dt,
          input.moveY * PLAYER_SPEED * mods.playerSpeed * dt,
          PLAYER_R
        );
      }

      var opened = window.GameMap.tryOpenDoor(map, inventory, player.x, player.y, DOOR_OPEN_R);
      if (opened) {
        showToast(opened === "R" ? "Red door unlocked" :
          opened === "G" ? "Green door unlocked" : "Blue door unlocked");
        sfx("door");
      }

      var ki;
      for (ki = 0; ki < map.keys.length; ki++) {
        var key = map.keys[ki];
        if (key.taken) continue;
        if (circlesHit(player.x, player.y, PLAYER_R, key.x, key.y, KEY_R)) {
          key.taken = true;
          inventory[key.colour] = true;
          showToast(
            key.colour === "R" ? "Red keycard" :
            key.colour === "G" ? "Green keycard" : "Blue keycard"
          );
          sfx("pickup");
        }
      }

      for (ki = 0; ki < (map.caches || []).length; ki++) {
        var cache = map.caches[ki];
        if (cache.taken) continue;
        if (circlesHit(player.x, player.y, PLAYER_R, cache.x, cache.y, PICK_R)) {
          cache.taken = true;
          if (cache.kind === "patch" && !owned.hull) {
            owned.hull = true;
            showToast("Hull patch");
          } else {
            ammo += Math.round(AMMO_PICKUP * mods.ammo);
            showToast("Cache ammo +" + Math.round(AMMO_PICKUP * mods.ammo));
          }
          sfx("pickup");
        }
      }

      for (ki = 0; ki < map.ammoCrates.length; ki++) {
        var crate = map.ammoCrates[ki];
        if (crate.taken) continue;
        if (circlesHit(player.x, player.y, PLAYER_R, crate.x, crate.y, PICK_R)) {
          crate.taken = true;
          ammo += Math.round(AMMO_PICKUP * mods.ammo);
          showToast("Ammo +" + Math.round(AMMO_PICKUP * mods.ammo));
          sfx("pickup");
        }
      }


      if (input.autoAim) {
        var autoTarget = nearestEnemy(player.x, player.y, AUTO_AIM_RANGE);
        if (autoTarget) {
          player.facing = Math.atan2(autoTarget.y - player.y, autoTarget.x - player.x);
        } else if (input.moveX || input.moveY) {
          player.facing = Math.atan2(input.moveY, input.moveX);
        }
      } else if (input.hasAim) {
        player.facing = Math.atan2(input.aimY, input.aimX);
      } else if (input.moveX || input.moveY) {
        player.facing = Math.atan2(input.moveY, input.moveX);
      }

      fireWait -= dt;
      if (input.shooting && fireWait <= 0) fire();

      iframes -= dt;

      var i;
      for (i = bullets.length - 1; i >= 0; i--) {
        var b = bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        var cracked = false;
        /* Towers / enemies first so wall guards are not shielded by the wall tile. */
        var ei;
        for (ei = enemies.length - 1; ei >= 0 && !cracked; ei--) {
          var be = enemies[ei];
          if (be.kind === "tower") {
            var tf = towerFoot(be);
            var hx = Math.max(tf.x - tf.half, Math.min(b.x, tf.x + tf.half));
            var hy = Math.max(tf.y - tf.half, Math.min(b.y, tf.y + tf.half));
            if ((b.x - hx) * (b.x - hx) + (b.y - hy) * (b.y - hy) >= b.r * b.r) continue;
          } else if (!circlesHit(b.x, b.y, b.r, be.x, be.y, be.r)) continue;
          be.hp -= b.dmg;
          hitMarks.push({ x: be.x, y: be.y, life: 0.25 });
          sfx("hit");
          cracked = true;
          if (be.hp <= 0) {
            score += be.score + sectorIndex;
            enemies.splice(ei, 1);
          }
          break;
        }
        if (!cracked && map.creditCrates) {
          var ci;
          for (ci = 0; ci < map.creditCrates.length; ci++) {
            var box = map.creditCrates[ci];
            if (box.taken) continue;
            if (circlesHit(b.x, b.y, b.r, box.x, box.y, 14)) {
              box.taken = true;
              score += box.credits || 8;
              hitMarks.push({ x: box.x, y: box.y, life: 0.3 });
              showToast("+" + (box.credits || 8) + " credits");
              sfx("hit");
              cracked = true;
              break;
            }
          }
        }
        if (
          cracked ||
          b.life <= 0 ||
          window.GameMap.circleBlocked(map, b.x, b.y, b.r, true) ||
          propBlocked(b.x, b.y, b.r)
        ) {
          bullets.splice(i, 1);
        }
      }

      if (!patchRun) {
        spawnWait -= dt;
        if (spawnWait <= 0) {
          spawnEnemy();
          spawnEvery = Math.max(SPAWN_MIN * mods.spawn, spawnEvery * 0.98);
          spawnWait = spawnEvery;
        }
      }

      for (i = enemyShots.length - 1; i >= 0; i--) {
        var es = enemyShots[i];
        es.x += es.vx * dt;
        es.y += es.vy * dt;
        es.life -= dt;
        if (
          es.life <= 0 ||
          window.GameMap.circleBlocked(map, es.x, es.y, es.r) ||
          propBlocked(es.x, es.y, es.r)
        ) {
          enemyShots.splice(i, 1);
          continue;
        }
        if (circlesHit(es.x, es.y, es.r, player.x, player.y, PLAYER_R)) {
          enemyShots.splice(i, 1);
          hurt(es.dmg || 1);
          if (!playing) return;
        }
      }

      for (i = enemies.length - 1; i >= 0; i--) {
        var e = enemies[i];
        stepEnemy(e, dt);
        if (e.kind !== "tower") pushOutOfWalls(e, e.r);

        if (e.kind === "boss") {
          e.spawnCool -= dt;
          if (e.spawnCool <= 0 && mobileEnemyCount() < (mods.maxEnemies || 12)) {
            e.spawnCool = 3.2;
            spawnEnemy(Math.random() < 0.5 ? "grunt" : "drone");
            showToast("Bay defenders");
          }
        }

        var hit = false;
        for (var j = bullets.length - 1; j >= 0; j--) {
          var bullet = bullets[j];
          if (circlesHit(e.x, e.y, e.r, bullet.x, bullet.y, bullet.r)) {
            e.hp -= bullet.dmg;
            bullets.splice(j, 1);
            hitMarks.push({ x: e.x, y: e.y, life: 0.25 });
            sfx("hit");
            if (e.hp <= 0) hit = true;
            break;
          }
        }
        if (hit) {
          score += e.score + sectorIndex;
          enemies.splice(i, 1);
          continue;
        }

        if (
          e.kind !== "drone" &&
          e.kind !== "tower" &&
          circlesHit(e.x, e.y, e.r, player.x, player.y, PLAYER_R)
        ) {
          hurt(e.kind === "boss" || e.kind === "fortress" ? 2 : 1);
          if (!playing) return;
        }
      }

      for (i = hitMarks.length - 1; i >= 0; i--) {
        hitMarks[i].life -= dt;
        if (hitMarks[i].life <= 0) hitMarks.splice(i, 1);
      }

      if (patchRun) {
        if (nearShip() && input.interactHeld) {
          patchHold += dt;
          if (patchHold >= 1.35) endRun(true);
        } else {
          patchHold = 0;
        }
      } else if (window.GameMap.allDoorsOpen(map) && onExit()) {
        if (sectorIndex >= window.GameMap.sectorCount() - 1) {
          if (bossAlive()) showToast("Drop the core first");
          else beginPatch();
        } else {
          sfx("exit");
          persistProgress({ unlockedSector: sectorIndex + 1 });
          loadSector(sectorIndex + 1, true);
        }
      }

      updateCamera(dt);
    }

    function drawStick(stick, radius, labelColour) {
      if (!stick || !stick.active) return;
      ctx.beginPath();
      ctx.arc(stick.ox, stick.oy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = labelColour;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(stick.x, stick.y, radius * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = labelColour;
      ctx.globalAlpha = 0.45;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function drawIdleStick(colour) {
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = colour;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(80, h - 80, 56, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function drawFirePad(active, colour) {
      var cx = w - 80;
      var cy = h - 80;
      ctx.beginPath();
      ctx.arc(cx, cy, 48, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.globalAlpha = active ? 0.45 : 0.18;
      ctx.fill();
      ctx.globalAlpha = active ? 0.9 : 0.4;
      ctx.strokeStyle = colour;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = active ? 0.95 : 0.55;
      ctx.fillStyle = colour;
      ctx.font = "700 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("FIRE", cx, cy);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.globalAlpha = 1;
    }

    function drawHpBar(e) {
      if (e.kind !== "boss" && e.maxHp <= 1) return;
      var hx = e.x;
      var hy = e.y - e.r - 10;
      var bw = e.r * 2;
      if (e.kind === "tower" && map) {
        var foot = towerFoot(e);
        hx = foot.x;
        hy = foot.y - foot.half - 8;
        bw = 36;
      }
      ctx.fillStyle = "#111";
      ctx.fillRect(hx - bw / 2, hy, bw, 4);
      ctx.fillStyle = ORANGE;
      ctx.fillRect(hx - bw / 2, hy, bw * (e.hp / e.maxHp), 4);
    }

    function rivetAt(x, y, r) {
      var rg = ctx.createRadialGradient(x - 0.5, y - 0.5, 0.2, x, y, r);
      rg.addColorStop(0, "#e8d4b8");
      rg.addColorStop(0.55, "#9a7a58");
      rg.addColorStop(1, "#4a3828");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    function inkStroke() {
      ctx.strokeStyle = "#1a120c";
      ctx.lineWidth = 2.25;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    }

    function castShadow(x, y, rx, ry) {
      ctx.save();
      ctx.translate(x + 5, y + 7);
      ctx.fillStyle = "rgba(26,18,12,0.34)";
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Highlight and shade stay upper-left on screen. The body underneath is already turned to face.
    function shadeUpperLeft(cx, cy, rx, ry) {
      if (typeof ctx.getTransform !== "function") return;
      var m = ctx.getTransform();
      if (!m || typeof m.a !== "number") return;
      var ang = Math.atan2(m.b, m.a);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.translate(cx, cy);
      ctx.rotate(-ang);
      ctx.fillStyle = "rgba(255,248,230,0.42)";
      ctx.beginPath();
      ctx.ellipse(-rx * 0.32, -ry * 0.36, rx * 0.55, ry * 0.42, -0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(28,16,8,0.34)";
      ctx.beginPath();
      ctx.ellipse(rx * 0.28, ry * 0.32, rx * 0.6, ry * 0.48, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function roundPlate(x, y, rw, rh, rad) {
      var r = Math.min(rad, rw / 2, rh / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + rw - r, y);
      ctx.quadraticCurveTo(x + rw, y, x + rw, y + r);
      ctx.lineTo(x + rw, y + rh - r);
      ctx.quadraticCurveTo(x + rw, y + rh, x + rw - r, y + rh);
      ctx.lineTo(x + r, y + rh);
      ctx.quadraticCurveTo(x, y + rh, x, y + rh - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function drawDirSprite(img, drawH) {
      var aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
      var dh = drawH;
      var dw = dh * aspect;
      ctx.drawImage(img, -dw * 0.5, -dh * 0.5, dw, dh);
    }

    function drawPlayerBody() {
      /* 8-dir frames are pre-rotated art — do not also rotate the canvas. */
      var pFrame = pilotFrames[dir8(player.facing)];
      if (readyImg(pFrame)) {
        drawDirSprite(pFrame, 42);
        return;
      }
      if (readyImg(pilotArt)) {
        drawDirSprite(pilotArt, 42);
        return;
      }
      /* Pilot scale — independent of the fine wall grid. */
      ctx.scale(0.88, 0.88);

      ctx.fillStyle = "#6b4a32";
      ctx.beginPath();
      ctx.ellipse(-2, -7.5, 3.2, 4.2, 0.4, 0, Math.PI * 2);
      ctx.ellipse(-2, 7.5, 3.2, 4.2, -0.4, 0, Math.PI * 2);
      ctx.fill();
      inkStroke();

      ctx.fillStyle = "#ea580c";
      ctx.beginPath();
      ctx.moveTo(-2, -4);
      ctx.quadraticCurveTo(-24, -14, -22, 0);
      ctx.quadraticCurveTo(-24, 14, -2, 4);
      ctx.closePath();
      ctx.fill();
      inkStroke();

      ctx.fillStyle = "#2f8f8a";
      ctx.beginPath();
      ctx.ellipse(-1, 0, 11, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      inkStroke();
      shadeUpperLeft(-1, 0, 11, 13);

      ctx.fillStyle = "#5c4330";
      ctx.fillRect(-9, -2.4, 16, 4.8);
      ctx.fillStyle = "#e7d3b0";
      ctx.fillRect(-7, -1.2, 12, 2.4);

      ctx.fillStyle = "#e7d3b0";
      ctx.beginPath();
      ctx.arc(8, 0, 8.6, 0, Math.PI * 2);
      ctx.fill();
      inkStroke();
      shadeUpperLeft(8, 0, 8.6, 8.6);
      ctx.fillStyle = "#14110e";
      ctx.beginPath();
      ctx.ellipse(13.2, 0, 3.2, 5.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = "rgba(125,211,252,0.35)";
      ctx.beginPath();
      ctx.ellipse(12.4, -1.2, 1.2, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();

      var i, side;
      for (i = 0; i < 2; i++) {
        side = i === 0 ? -1 : 1;
        ctx.fillStyle = "#2f8f8a";
        ctx.beginPath();
        ctx.ellipse(2, side * 11, 4.2, 3.2, 0.2 * side, 0, Math.PI * 2);
        ctx.fill();
        inkStroke();
        ctx.fillStyle = "#d5dde4";
        ctx.beginPath();
        roundPlate(6, side * 11 - 2.6, 16, 5.2, 1.5);
        ctx.fill();
        inkStroke();
        ctx.fillStyle = ORANGE;
        ctx.fillRect(10, side * 11 - 1.3, 4, 2.6);
        ctx.fillStyle = "#14110e";
        ctx.fillRect(20, side * 11 - 1.4, 3.4, 2.8);
      }
      ctx.lineWidth = 1;
    }

    function drawGrunt(e, facing) {
      var ang = facing == null ? 0 : facing;
      var frame = robotFrames[ROBOT_DIR_MAP[dir8(ang)]];
      if (readyImg(frame)) {
        drawDirSprite(frame, Math.max(34, e.r * 2.9));
        return;
      }
      var s = Math.max(0.95, e.r / 11);
      ctx.save();
      ctx.scale(s, s);
      ctx.strokeStyle = "#1a120c";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-2, -6);
      ctx.lineTo(-10, -13);
      ctx.moveTo(-2, 6);
      ctx.lineTo(-10, 13);
      ctx.moveTo(4, 0);
      ctx.lineTo(13, 0);
      ctx.stroke();
      ctx.fillStyle = "#3f3a34";
      ctx.beginPath();
      ctx.arc(-10, -13, 2.6, 0, Math.PI * 2);
      ctx.arc(-10, 13, 2.6, 0, Math.PI * 2);
      ctx.arc(13, 0, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d2b48a";
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      inkStroke();
      shadeUpperLeft(0, 0, 12, 12);
      ctx.fillStyle = "#14110e";
      ctx.beginPath();
      ctx.ellipse(5.5, 0, 5.2, 6.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(7.6, -2.4, 1.8, 0, Math.PI * 2);
      ctx.arc(7.6, 2.4, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 1;
      ctx.lineCap = "butt";
    }

    function drawGruntLamp(e) {
      var s = Math.max(0.95, e.r / 11);
      var x = e.x;
      var y = e.y - 11 * s;
      ctx.fillStyle = "rgba(239,68,68,0.28)";
      ctx.beginPath();
      ctx.arc(x, y, 6.2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7f1d1d";
      ctx.beginPath();
      ctx.arc(x, y, 4.1 * s, 0, Math.PI * 2);
      ctx.fill();
      inkStroke();
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(x, y, 2.8 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fee2e2";
      ctx.beginPath();
      ctx.arc(x - 1.1 * s, y - 1.2 * s, 1.15 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawCrawler(e) {
      var r = e.r;
      ctx.strokeStyle = "#1a120c";
      ctx.lineWidth = Math.max(2.5, r * 0.18);
      ctx.lineCap = "round";
      var legs = [
        [-0.2, -0.15, -1.15, -0.85],
        [-0.2, 0.15, -1.15, 0.85],
        [0.15, -0.2, 0.95, -0.95],
        [0.15, 0.2, 0.95, 0.95]
      ];
      var i;
      ctx.beginPath();
      for (i = 0; i < legs.length; i++) {
        ctx.moveTo(r * legs[i][0], r * legs[i][1]);
        ctx.lineTo(r * legs[i][2], r * legs[i][3]);
      }
      ctx.stroke();
      ctx.fillStyle = "#e8e4dc";
      ctx.beginPath();
      ctx.moveTo(r * 0.85, -r * 0.15);
      ctx.lineTo(r * 1.45, -r * 0.02);
      ctx.lineTo(r * 0.95, -r * 0.55);
      ctx.closePath();
      ctx.moveTo(r * 0.85, r * 0.15);
      ctx.lineTo(r * 1.45, r * 0.02);
      ctx.lineTo(r * 0.95, r * 0.55);
      ctx.closePath();
      ctx.fill();
      inkStroke();
      ctx.fillStyle = "#c4a06a";
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.95, r * 0.58, 0, 0, Math.PI * 2);
      ctx.fill();
      inkStroke();
      shadeUpperLeft(0, 0, r * 0.95, r * 0.58);
      ctx.fillStyle = "#14110e";
      ctx.beginPath();
      ctx.ellipse(r * 0.42, 0, r * 0.34, r * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.ellipse(r * 0.62, -r * 0.06, r * 0.1, r * 0.07, 0, 0, Math.PI * 2);
      ctx.ellipse(r * 0.62, r * 0.08, r * 0.1, r * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.lineCap = "butt";
    }

    function drawFortress(e) {
      var r = e.r;
      var i, a;
      ctx.fillStyle = "#6e5134";
      ctx.beginPath();
      ctx.ellipse(r * 0.08, r * 0.18, r * 1.02, r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d2b48a";
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.02, r * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      inkStroke();
      shadeUpperLeft(0, 0, r * 1.02, r * 0.78);
      ctx.strokeStyle = "#1a120c";
      ctx.lineWidth = Math.max(1.6, r * 0.07);
      for (i = 0; i < 5; i++) {
        a = -0.9 + i * 0.45;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.28);
        ctx.lineTo(Math.cos(a) * r * 1.0, Math.sin(a) * r * 0.76);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
    }

    function drawFortressCore(e) {
      var r = e.kind === "boss" ? e.r * 0.95 : e.r;
      var x = e.x;
      var y = e.y - r * 0.22;
      ctx.fillStyle = "rgba(217,70,239,0.28)";
      ctx.beginPath();
      ctx.arc(x, y, r * 0.46, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2a1a3a";
      ctx.beginPath();
      ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      inkStroke();
      var core = ctx.createRadialGradient(x - r * 0.08, y - r * 0.1, 1, x, y, r * 0.26);
      core.addColorStop(0, "#f5d0fe");
      core.addColorStop(0.5, "#d946ef");
      core.addColorStop(1, "#6b21a8");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      var k;
      for (k = 0; k < 3; k++) {
        ctx.fillStyle = "#e879f9";
        ctx.beginPath();
        ctx.arc(x + (k - 1) * r * 0.46, e.y + r * 0.38, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawDrone(e, facing) {
      var frame = droneFrames[dir8(facing == null ? 0 : facing)];
      if (readyImg(frame)) {
        drawDirSprite(frame, Math.max(30, e.r * 2.8));
        return;
      }
      var r = e.r;
      ctx.fillStyle = "#c4a06a";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
      ctx.fill();
      inkStroke();
      shadeUpperLeft(0, 0, r * 0.9, r * 0.9);
      ctx.fillStyle = "#c4a06a";
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, -r * 0.45);
      ctx.lineTo(-r * 1.15, -r * 0.15);
      ctx.lineTo(-r * 0.2, -r * 0.05);
      ctx.closePath();
      ctx.fill();
      inkStroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, r * 0.45);
      ctx.lineTo(-r * 1.15, r * 0.15);
      ctx.lineTo(-r * 0.2, r * 0.05);
      ctx.closePath();
      ctx.fill();
      inkStroke();
      ctx.fillStyle = "#14110e";
      ctx.beginPath();
      ctx.arc(r * 0.22, 0, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(r * 0.34, 0, r * 0.24, 0, Math.PI * 2);
      ctx.fill();
      inkStroke();
      ctx.fillStyle = "#fffbeb";
      ctx.beginPath();
      ctx.arc(r * 0.28, -r * 0.06, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1;
    }

    function drawDroneBeam(e, facing) {
      var r = e.r;
      var len = r * 2.8;
      var x0 = e.x + Math.cos(facing) * r * 0.75;
      var y0 = e.y + Math.sin(facing) * r * 0.75;
      var x1 = e.x + Math.cos(facing) * len;
      var y1 = e.y + Math.sin(facing) * len;
      ctx.strokeStyle = "rgba(250,204,21,0.32)";
      ctx.lineWidth = Math.max(3, r * 0.5);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.save();
      ctx.translate(x1, y1);
      ctx.scale(1, 0.42);
      ctx.fillStyle = "rgba(250,204,21,0.22)";
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3.5, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.lineWidth = 1;
    }

    function drawBoss(e) {
      drawFortress({ x: 0, y: 0, r: e.r * 0.95 });
      ctx.strokeStyle = ORANGE;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 1.08, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    function shadowFor(e) {
      if (e.kind === "crawler") return [e.r * 1.35, e.r * 0.5];
      if (e.kind === "fortress") return [e.r * 1.1, e.r * 0.48];
      if (e.kind === "boss") return [e.r * 1.15, e.r * 0.5];
      if (e.kind === "drone") return [e.r * 0.7, e.r * 0.28];
      return [14, 7];
    }

    function drawEnemy(e) {
      if (e.kind === "tower") {
        drawTower(e);
        drawHpBar(e);
        return;
      }
      var facing = Math.atan2(player.y - e.y, player.x - e.x);
      var sh = shadowFor(e);
      castShadow(e.x, e.y, sh[0], sh[1]);
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.kind === "drone" && readyImg(droneFrames[dir8(facing)])) {
        drawDrone(e, facing);
      } else if (e.kind === "grunt" && readyImg(robotFrames[ROBOT_DIR_MAP[dir8(facing)]])) {
        drawGrunt(e, facing);
      } else {
        ctx.rotate(facing);
        if (e.kind === "fortress") drawFortress(e);
        else if (e.kind === "drone") drawDrone(e, facing);
        else if (e.kind === "boss") drawBoss(e);
        else drawGrunt(e, facing);
      }
      ctx.restore();
      if (e.kind === "grunt" && !readyImg(robotFrames[0])) drawGruntLamp(e);
      else if (e.kind === "fortress" || e.kind === "boss") drawFortressCore(e);
      else if (e.kind === "drone") drawDroneBeam(e, facing);
      drawHpBar(e);
    }

    var platePattern = null;
    var yardPattern = null;
    var concretePattern = null;
    var wallConcretePattern = null;
    var groundIn = [];
    var groundOut = [];
    var wallArt = null;
    var wallVert = null;
    var wallVertClean = null;
    var wallVertCracked = null;
    var joinL = null;
    var joinLClean = null;
    var joinLCracked = null;
    var joinT = null;
    var joinX = null;
    var towerArt = null;
    var floorArt = null;
    var floorsByKey = { concrete: null, plate: null, plate2: null, plate3: null };
    var grassArt = null;
    var junkRubble = null;
    var junkGravel = null;
    var junkDrain = null;
    var propArts = Object.create(null);
    var shipArt = null;
    var robotArt = null;
    var robotFrames = [];
    var pilotArt = null;
    var pilotFrames = [];
    var droneFrames = [];
    var cannonFrames = [];
    /* robot sheet rows top→bottom: S SW W NW N NE E SE → map dir8(N..) index */
    var ROBOT_DIR_MAP = [4, 5, 6, 7, 0, 1, 2, 3];
    var grassStamp = null;
    var floorStamp = null;
    var cornerArt = null;
    var doorArt = null;
    var crateArt = null;
    var barrelArt = null;
    var deckCracked = false;

    function loadImg(file, done) {
      if (typeof Image === "undefined") return;
      var img = new Image();
      img.onload = function () {
        if (done) done(img);
        /* Menu paints once before textures arrive — refresh when art lands. */
        if (!playing && !map) paintMenuBackdrop();
      };
      img.onerror = function () {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("texture failed:", file);
        }
      };
      img.src = "static/textures/" + file;
    }

    /* Art cut from docs/ — floors and walls swap per deck. */
    (function loadGroundParts() {
      var i;
      for (i = 0; i < 8; i++) {
        loadImg("in-" + i + ".png", function (img) { groundIn.push(img); });
        loadImg("out-" + i + ".png", function (img) { groundOut.push(img); });
        (function (idx) {
          loadImg("drone-" + idx + ".png", function (img) { droneFrames[idx] = img; });
          loadImg("cannon-" + idx + ".png", function (img) { cannonFrames[idx] = img; });
          loadImg("robot-dir-" + idx + ".png", function (img) { robotFrames[idx] = img; });
          loadImg("pilot-dir-" + idx + ".png", function (img) { pilotFrames[idx] = img; });
        })(i);
      }
      loadImg("wall-straight.png", function (img) { wallArt = img; });
      loadImg("wall-vert.png", function (img) {
        wallVertClean = img;
        if (!wallVert) wallVert = img;
      });
      loadImg("wall-cracked-vert.png", function (img) { wallVertCracked = img; });
      loadImg("join-l1.png", function (img) {
        joinLClean = img;
        if (!joinL) joinL = img;
      });
      loadImg("join-cracked.png", function (img) { joinLCracked = img; });
      loadImg("join-t.png", function (img) { joinT = img; });
      loadImg("join-x.png", function (img) { joinX = img; });
      loadImg("guard-body.png", function (img) { towerArt = img; });
      loadImg("floor-concrete.jpg", function (img) {
        floorsByKey.concrete = img;
        if (!floorArt) floorArt = img;
        floorStamp = null;
      });
      loadImg("floor-plate.jpg", function (img) { floorsByKey.plate = img; floorStamp = null; });
      loadImg("floor-plate2.jpg", function (img) { floorsByKey.plate2 = img; });
      loadImg("floor-plate3.jpg", function (img) { floorsByKey.plate3 = img; });
      loadImg("grass.jpg", function (img) { grassArt = img; grassStamp = null; });
      loadImg("junk-rubble.png", function (img) { junkRubble = img; });
      loadImg("junk-gravel.png", function (img) { junkGravel = img; });
      loadImg("junk-drain.png", function (img) { junkDrain = img; });
      [
        "bricks", "broken", "bucket", "cans", "cracks", "crates",
        "foot", "hose", "lights", "tools", "tyre", "wood", "tin", "sandbag"
      ].forEach(function (name) {
        loadImg("prop-" + name + ".png", function (img) { propArts[name] = img; });
      });
      loadImg("wall-corner.png", function (img) { cornerArt = img; });
      loadImg("wall-door.png", function (img) { doorArt = img; });
      loadImg("crate.png", function (img) { crateArt = img; });
      loadImg("barrel.png", function (img) { barrelArt = img; });
      loadImg("ship-crashed.png", function (img) { shipArt = img; });
      loadImg("enemy-robot1.png", function (img) { robotArt = img; });
      loadImg("pilot-dir-2.png", function (img) {
        pilotArt = img;
        if (!pilotFrames[2]) pilotFrames[2] = img;
      });
    })();

    function readyImg(img) {
      return !!(img && img.complete && img.naturalWidth);
    }

    /* Different floor + wall set each deck. */
    function applyDeckTheme(index) {
      var floorKeys = ["concrete", "plate", "plate2", "plate3"];
      var key = floorKeys[((index % floorKeys.length) + floorKeys.length) % floorKeys.length];
      floorArt = floorsByKey[key] || floorsByKey.concrete || floorArt;
      floorStamp = null;
      deckCracked = Math.floor(index / 5) % 2 === 1;
      wallVert = deckCracked && wallVertCracked ? wallVertCracked : (wallVertClean || wallVert);
      joinL = deckCracked && joinLCracked ? joinLCracked : (joinLClean || joinL);
    }

    function dir8(ang) {
      var a = ang + Math.PI * 0.5;
      if (a < 0) a += Math.PI * 2;
      return Math.round(a / (Math.PI * 0.25)) % 8;
    }

    function bakeStamp(src, size) {
      if (!readyImg(src) || typeof document === "undefined" || !document.createElement) return null;
      var c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      var g = c.getContext("2d");
      g.imageSmoothingEnabled = true;
      g.drawImage(src, 0, 0, src.naturalWidth, src.naturalHeight, 0, 0, size, size);
      return c;
    }

    function stampBlock(stamp, px, py, span) {
      if (!stamp) return false;
      var prevSmooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(stamp, px, py, span, span);
      ctx.imageSmoothingEnabled = prevSmooth;
      return true;
    }

    function paintGroundPart(px, py, size, tx, ty, outdoor) {
      if (!map) return false;
      var macro = map.macro || 3;
      var ax = Math.floor(tx / macro);
      var ay = Math.floor(ty / macro);
      var bx = ax * macro;
      var by = ay * macro;
      var span = size * macro;
      /* One stamp per macro block. Pattern fillRect on full JPEGs kills FPS. */
      if (tx !== bx || ty !== by) {
        var origin = map.tiles[by] && map.tiles[by][bx];
        if (origin && origin.kind !== "wall" && origin.kind !== "door" && !!origin.outdoor === !!outdoor) {
          return true;
        }
      }
      /* Outdoor crash site: cheap pre-scaled grass drawImage (not createPattern). */
      if (outdoor) {
        if (!grassStamp && readyImg(grassArt)) grassStamp = bakeStamp(grassArt, 96);
        if (stampBlock(grassStamp, bx * size, by * size, span)) return true;
      }
      var list = outdoor ? groundOut : groundIn;
      if (list.length) {
        var img = list[Math.floor(tileHash(ax, ay, outdoor ? 2 : 4) * list.length) % list.length];
        if (readyImg(img)) {
          var prevSmooth = ctx.imageSmoothingEnabled;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 4, 4, img.naturalWidth - 8, img.naturalHeight - 8, bx * size, by * size, span, span);
          ctx.imageSmoothingEnabled = prevSmooth;
          return true;
        }
      }
      if (!outdoor) {
        if (!floorStamp && readyImg(floorArt)) floorStamp = bakeStamp(floorArt, 96);
        if (stampBlock(floorStamp, bx * size, by * size, span)) return true;
      }
      return false;
    }

    function stampTread(g, cx, cy) {
      g.save();
      g.translate(cx, cy);
      g.rotate(Math.PI / 4);
      g.fillStyle = "rgba(48,32,16,0.55)";
      g.beginPath();
      g.moveTo(0, -6.4);
      g.lineTo(3.5, 0.8);
      g.lineTo(0, 6.6);
      g.lineTo(-3.5, 0.8);
      g.closePath();
      g.fill();
      g.fillStyle = "#f3e7d0";
      g.beginPath();
      g.moveTo(0, -5.4);
      g.lineTo(2.7, -0.2);
      g.lineTo(0, 4.6);
      g.lineTo(-2.7, -0.2);
      g.closePath();
      g.fill();
      g.restore();
    }

    function makeSheet(w, h) {
      var doc = canvas.ownerDocument;
      if (!doc || !doc.createElement) return null;
      var sheet = doc.createElement("canvas");
      sheet.width = w;
      sheet.height = h;
      return sheet;
    }

    function floorPlate() {
      if (platePattern) return platePattern;
      var sheet = makeSheet(36, 28);
      if (!sheet) return null;
      var g = sheet.getContext("2d");
      g.fillStyle = "#b7a58c";
      g.fillRect(0, 0, 36, 28);
      stampTread(g, 9, 7);
      stampTread(g, 27, 7);
      stampTread(g, 18, 21);
      platePattern = ctx.createPattern(sheet, "repeat");
      return platePattern;
    }

    function yardGround() {
      if (yardPattern) return yardPattern;
      var sheet = makeSheet(128, 128);
      if (!sheet) return null;
      var g = sheet.getContext("2d");
      var x;
      var y;
      g.fillStyle = "#3a3228";
      g.fillRect(0, 0, 128, 128);
      for (y = 0; y < 128; y += 2) {
        for (x = 0; x < 128; x += 2) {
          var h = ((x * 17 + y * 31) >>> 0) % 100;
          if (h < 35) {
            g.fillStyle = "rgba(" + (40 + h) + "," + (34 + (h % 20)) + "," + (26 + (h % 12)) + ",0.55)";
            g.fillRect(x, y, 2, 2);
          } else if (h > 88) {
            g.fillStyle = "rgba(90,82,68,0.5)";
            g.fillRect(x, y, 1, 1);
          }
        }
      }
      for (x = 0; x < 90; x++) {
        g.fillStyle = x % 3 ? "rgba(110,100,85,0.55)" : "rgba(25,22,18,0.45)";
        g.beginPath();
        g.arc((x * 47) % 128, (x * 91) % 128, 0.6 + (x % 3) * 0.4, 0, Math.PI * 2);
        g.fill();
      }
      for (x = 0; x < 8; x++) {
        g.fillStyle = "rgba(55,48,38," + (0.2 + (x % 4) * 0.05) + ")";
        g.beginPath();
        g.ellipse((x * 37) % 128, (x * 53) % 128, 14 + x, 8, x * 0.4, 0, Math.PI * 2);
        g.fill();
      }
      for (x = 0; x < 14; x++) {
        var wx = (x * 29 + 10) % 128;
        var wy = (x * 41 + 20) % 128;
        g.fillStyle = "rgba(" + (36 + (x % 5) * 8) + "," + (92 + (x % 4) * 12) + ",32,0.55)";
        g.beginPath();
        g.ellipse(wx, wy, 5 + (x % 3), 3, -0.3, 0, Math.PI * 2);
        g.fill();
      }
      yardPattern = ctx.createPattern(sheet, "repeat");
      return yardPattern;
    }

    function concreteGround() {
      if (concretePattern) return concretePattern;
      var sheet = makeSheet(128, 128);
      if (!sheet) return null;
      var g = sheet.getContext("2d");
      g.fillStyle = "#7a756e";
      g.fillRect(0, 0, 128, 128);
      var i;
      for (i = 0; i < 128; i += 2) {
        var j;
        for (j = 0; j < 128; j += 2) {
          var v = ((i * 13 + j * 19) >>> 0) % 40;
          g.fillStyle = "rgba(" + (110 + v) + "," + (105 + v * 0.8) + "," + (98 + v * 0.6) + ",0.35)";
          g.fillRect(i, j, 2, 2);
        }
      }
      g.strokeStyle = "rgba(40,36,32,0.35)";
      g.lineWidth = 2;
      g.strokeRect(1, 1, 62, 62);
      g.strokeRect(65, 1, 62, 62);
      g.strokeRect(1, 65, 62, 62);
      g.strokeRect(65, 65, 62, 62);
      g.strokeStyle = "rgba(30,28,24,0.4)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(12, 20); g.lineTo(40, 48); g.lineTo(58, 44);
      g.moveTo(70, 80); g.lineTo(100, 110); g.lineTo(120, 95);
      g.stroke();
      g.fillStyle = "rgba(25,20,14,0.28)";
      g.beginPath();
      g.ellipse(96, 36, 18, 10, 0.4, 0, Math.PI * 2);
      g.fill();
      concretePattern = ctx.createPattern(sheet, "repeat");
      return concretePattern;
    }

    function wallConcrete() {
      if (wallConcretePattern) return wallConcretePattern;
      var sheet = makeSheet(64, 64);
      if (!sheet) return null;
      var g = sheet.getContext("2d");
      g.fillStyle = "#6a6662";
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = "#5a5652";
      g.fillRect(0, 0, 64, 20);
      g.fillRect(0, 32, 64, 20);
      g.strokeStyle = "rgba(25,22,20,0.55)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, 21); g.lineTo(64, 21);
      g.moveTo(0, 52); g.lineTo(64, 52);
      g.moveTo(32, 0); g.lineTo(32, 21);
      g.moveTo(16, 32); g.lineTo(16, 52);
      g.moveTo(48, 32); g.lineTo(48, 52);
      g.stroke();
      wallConcretePattern = ctx.createPattern(sheet, "repeat");
      return wallConcretePattern;
    }

    function drawFloorTile(px, py, size, tx, ty, outdoor) {
      var s = size + 0.6;
      var n = tileHash(tx, ty, 1);
      var n2 = tileHash(tx, ty, 2);
      var n3 = tileHash(tx, ty, 3);
      var macro = (map && map.macro) || 3;
      if (size <= 18) {
        if (paintGroundPart(px, py, size, tx, ty, outdoor)) return;
        if (outdoor) {
          ctx.fillStyle = yardGround() || "#3a3228";
          ctx.fillRect(px - 1, py - 1, size + 2, size + 2);
        } else {
          ctx.fillStyle = concreteGround() || "#7a756e";
          ctx.fillRect(px - 1, py - 1, size + 2, size + 2);
        }
        return;
      }
      if (outdoor) {
        if (sectorIndex === 0) {
          /* Crash approach — grass, dirt patches, sparse blades. */
          var g = 0.42 + n * 0.18;
          ctx.fillStyle = "rgb(" + Math.floor(62 + n * 28) + "," + Math.floor(110 + g * 50) + "," + Math.floor(48 + n2 * 20) + ")";
          /* Overlap neighbours so the floor grid does not read as big squares. */
          ctx.fillRect(px - 2, py - 2, s + 3, s + 3);
          ctx.fillStyle = "rgba(30,70,28," + (0.14 + n2 * 0.16) + ")";
          ctx.beginPath();
          ctx.ellipse(px + size * (0.3 + n * 0.4), py + size * (0.35 + n2 * 0.35), 10 + n * 10, 5 + n2 * 4, -0.4, 0, Math.PI * 2);
          ctx.fill();
          if (n3 > 0.55) {
            ctx.fillStyle = "rgba(90,70,40," + (0.18 + n * 0.12) + ")";
            ctx.beginPath();
            ctx.ellipse(px + size * 0.6, py + size * 0.7, 8 + n2 * 6, 3.5, 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.strokeStyle = "rgba(20,50,18," + (0.25 + n * 0.2) + ")";
          ctx.lineWidth = 1.2;
          var blades = 2 + Math.floor(n * 3);
          var bi;
          for (bi = 0; bi < blades; bi++) {
            var bx = px + 6 + ((n * 40 + bi * 11) % (size - 10));
            var by = py + 10 + ((n2 * 30 + bi * 9) % (size - 14));
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.quadraticCurveTo(bx + 1.5, by - 5, bx + (bi % 2 ? 3 : -2), by - 9 - n * 3);
            ctx.stroke();
          }
          ctx.lineWidth = 1;
          return;
        }
        ctx.fillStyle = "#d2bc96";
        ctx.fillRect(px - 1, py - 1, s + 1, s + 1);
        ctx.fillStyle = "rgba(255,236,200," + (0.08 + (1 - n) * 0.08) + ")";
        ctx.beginPath();
        ctx.ellipse(px + size * 0.28, py + size * 0.24, 16, 5.5, -0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(90,62,32," + (0.1 + n * 0.12) + ")";
        ctx.beginPath();
        ctx.ellipse(px + size * 0.68, py + size * 0.72, 15 + n * 8, 5 + n2 * 3, -0.5, 0, Math.PI * 2);
        ctx.fill();
        if (n2 > 0.35) {
          ctx.strokeStyle = "rgba(255,244,220," + (0.16 + n * 0.14) + ")";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          var wx = px + 8 + n * 12;
          var wy = py + 10 + n2 * 12;
          ctx.moveTo(wx, wy);
          ctx.lineTo(wx + 18, wy + 7);
          ctx.stroke();
        }
        ctx.lineWidth = 1;
        return;
      }
      ctx.fillStyle = floorPlate() || "#b7a58c";
      ctx.fillRect(px - 2, py - 2, size + 4, size + 4);
      /* Extra plate wear: weld seam, grate, scuff. */
      if (n > 0.62) {
        ctx.strokeStyle = "rgba(40,28,16," + (0.18 + n2 * 0.2) + ")";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px + 6, py + size * 0.5);
        ctx.lineTo(px + size - 6, py + size * 0.5 + (n3 - 0.5) * 4);
        ctx.stroke();
      }
      if (n2 > 0.78) {
        ctx.strokeStyle = "rgba(26,18,12,0.35)";
        ctx.lineWidth = 1;
        var gx = px + 8;
        var gy = py + 8;
        var gi;
        for (gi = 0; gi < 3; gi++) {
          ctx.strokeRect(gx + gi * 10, gy, 8, 8);
          ctx.strokeRect(gx + gi * 10, gy + 10, 8, 8);
        }
      } else if (n3 > 0.7) {
        ctx.fillStyle = "rgba(60,40,20," + (0.08 + n * 0.08) + ")";
        ctx.beginPath();
        ctx.ellipse(px + size * 0.55, py + size * 0.6, 7 + n * 5, 3, -0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.lineWidth = 1;
    }

    function drawFloorDecorItem(d) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot || 0);
      if (d.kind === "ship") {
        drawCrashedShip();
      } else if (d.kind === "box") {
        if (readyImg(crateArt)) {
          ctx.drawImage(crateArt, -20, -20, 40, 40);
          ctx.restore();
          return;
        }
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(1, 4, 14, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        var wood = ctx.createLinearGradient(-12, -12, 12, 12);
        wood.addColorStop(0, "#c4a06a");
        wood.addColorStop(0.45, "#8b5a2b");
        wood.addColorStop(1, "#4a3018");
        ctx.fillStyle = wood;
        ctx.beginPath();
        // rounded crate
        var rr = 3;
        ctx.moveTo(-12 + rr, -11);
        ctx.lineTo(12 - rr, -11);
        ctx.quadraticCurveTo(12, -11, 12, -11 + rr);
        ctx.lineTo(12, 11 - rr);
        ctx.quadraticCurveTo(12, 11, 12 - rr, 11);
        ctx.lineTo(-12 + rr, 11);
        ctx.quadraticCurveTo(-12, 11, -12, 11 - rr);
        ctx.lineTo(-12, -11 + rr);
        ctx.quadraticCurveTo(-12, -11, -12 + rr, -11);
        ctx.fill();
        ctx.strokeStyle = "rgba(40,24,12,0.55)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "#d4b896";
        ctx.globalAlpha = 0.35;
        ctx.fillRect(-12, -11, 24, 4);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#2a2118";
        ctx.fillRect(-12, -1, 24, 3);
        ctx.fillRect(-2, -11, 4, 22);
        ctx.fillStyle = "#a16207";
        ctx.fillRect(-5, 3, 10, 4);
      } else if (d.kind === "barrel") {
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath();
        ctx.ellipse(1, 5, 9, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        var steel = ctx.createLinearGradient(-8, -10, 8, 10);
        steel.addColorStop(0, "#9aa3ad");
        steel.addColorStop(0.5, "#4b5563");
        steel.addColorStop(1, "#1f2937");
        ctx.fillStyle = steel;
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(220,230,240,0.25)";
        ctx.beginPath();
        ctx.ellipse(0, -4, 9, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 4, 9, 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = ORANGE;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (d.kind === "rock") {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(1, 3, 11, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#5c5346";
        ctx.beginPath();
        ctx.moveTo(-10, 2);
        ctx.quadraticCurveTo(-8, -8, 0, -9);
        ctx.quadraticCurveTo(9, -7, 11, 1);
        ctx.quadraticCurveTo(4, 8, -6, 7);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath();
        ctx.ellipse(-3, -3, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.kind === "rubble" || d.kind === "gravel" || d.kind === "drain") {
        var litter = d.kind === "drain" ? junkDrain : d.kind === "gravel" ? junkGravel : junkRubble;
        if (readyImg(litter)) {
          var dw = d.kind === "drain" ? 52 : 44;
          var dh = d.kind === "drain" ? 34 : 40;
          ctx.drawImage(litter, -dw * 0.5, -dh * 0.5, dw, dh);
        }
      } else if (propArts[d.kind] && readyImg(propArts[d.kind])) {
        var prop = propArts[d.kind];
        var pw = d.kind === "lights" || d.kind === "foot" ? 36 : 42;
        var ph = d.kind === "lights" ? 28 : d.kind === "foot" ? 48 : 40;
        ctx.drawImage(prop, -pw * 0.5, -ph * 0.5, pw, ph);
      } else if (d.kind === "scrap") {
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.ellipse(0, 3, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#6b7280";
        ctx.beginPath();
        ctx.moveTo(-9, -1);
        ctx.lineTo(4, -4);
        ctx.lineTo(8, 2);
        ctx.lineTo(-5, 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = TEAL;
        ctx.globalAlpha = 0.45;
        ctx.fillRect(-2, -2, 5, 3);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#9ca3af";
        ctx.fillRect(3, -6, 4, 7);
      } else if (d.kind === "stain") {
        ctx.fillStyle = "rgba(20,14,8,0.28)";
        ctx.beginPath();
        ctx.ellipse(0, 0, 12 + d.v * 2, 7 + d.v, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(80,40,20,0.15)";
        ctx.beginPath();
        ctx.ellipse(3, 1, 6, 3, -0.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        rivetAt(0, 0, 1.8);
      }
      ctx.restore();
    }

    function drawCrashedShip() {
      if (readyImg(shipArt)) {
        var smooth = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(shipArt, -70, -55, 140, 120);
        ctx.imageSmoothingEnabled = smooth;
        return;
      }
      ctx.fillStyle = "rgba(20,12,8,0.4)";
      ctx.beginPath();
      ctx.ellipse(6, 22, 70, 20, 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(48,24,10,0.5)";
      ctx.beginPath();
      ctx.ellipse(-16, 18, 78, 26, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(24,12,6,0.45)";
      ctx.beginPath();
      ctx.ellipse(-48, 10, 28, 12, 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#9aa3ad";
      ctx.beginPath();
      ctx.moveTo(34, 16);
      ctx.lineTo(52, 26);
      ctx.lineTo(40, 22);
      ctx.closePath();
      ctx.fill();
      inkStroke();
      ctx.fillStyle = "#5eead4";
      ctx.globalAlpha = 0.45;
      ctx.fillRect(38, 18, 6, 3);
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#3d4c56";
      ctx.beginPath();
      ctx.moveTo(-6, -14);
      ctx.lineTo(-62, -46);
      ctx.lineTo(-48, -22);
      ctx.lineTo(-28, -10);
      ctx.closePath();
      ctx.fill();
      inkStroke();
      ctx.strokeStyle = ORANGE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-14, -14);
      ctx.lineTo(-50, -36);
      ctx.stroke();
      ctx.strokeStyle = "#1a120c";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-40, -34);
      ctx.lineTo(-36, -18);
      ctx.stroke();

      var hull = ctx.createLinearGradient(-70, -18, 64, 18);
      hull.addColorStop(0, "#5eead4");
      hull.addColorStop(0.4, "#2f8f8a");
      hull.addColorStop(0.78, "#1a4f4c");
      hull.addColorStop(1, "#0f2e2c");
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.moveTo(64, -2);
      ctx.quadraticCurveTo(42, -26, 8, -20);
      ctx.lineTo(-32, -16);
      ctx.quadraticCurveTo(-72, -8, -62, 4);
      ctx.quadraticCurveTo(-50, 22, -18, 18);
      ctx.lineTo(16, 18);
      ctx.quadraticCurveTo(50, 16, 64, -2);
      ctx.closePath();
      ctx.fill();
      inkStroke();
      shadeUpperLeft(0, 0, 58, 18);

      ctx.strokeStyle = "rgba(8,40,38,0.7)";
      ctx.lineWidth = 2;
      var rib;
      for (rib = 0; rib < 5; rib++) {
        var rx = -22 + rib * 14;
        ctx.beginPath();
        ctx.moveTo(rx, -12);
        ctx.quadraticCurveTo(rx + 5, 0, rx, 12);
        ctx.stroke();
      }

      ctx.strokeStyle = "#ea580c";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-36, 3);
      ctx.lineTo(36, -3);
      ctx.stroke();

      ctx.fillStyle = "#0b1214";
      ctx.beginPath();
      ctx.ellipse(30, -3, 13, 8, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#99f6e4";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = "rgba(153,246,228,0.85)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(22, -6);
      ctx.lineTo(34, 2);
      ctx.lineTo(26, 4);
      ctx.moveTo(30, -8);
      ctx.lineTo(38, 1);
      ctx.stroke();

      ctx.fillStyle = "#1f2937";
      ctx.beginPath();
      ctx.ellipse(-58, 3, 12, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      inkStroke();
      ctx.strokeStyle = "#6b7280";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(-58, 3, 7, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(249,115,22,0.7)";
      ctx.beginPath();
      ctx.arc(-58, 3, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#cbd5e1";
      ctx.beginPath();
      ctx.moveTo(18, 20);
      ctx.lineTo(36, 28);
      ctx.lineTo(22, 24);
      ctx.closePath();
      ctx.fill();
      inkStroke();
      ctx.beginPath();
      ctx.moveTo(-8, 22);
      ctx.lineTo(6, 30);
      ctx.lineTo(-4, 26);
      ctx.closePath();
      ctx.fill();
      inkStroke();

      var puff = (Date.now() / 700) % 1;
      ctx.fillStyle = "rgba(220,220,220," + (0.16 + puff * 0.14) + ")";
      ctx.beginPath();
      ctx.arc(-24, -22 - puff * 8, 6 + puff * 3, 0, Math.PI * 2);
      ctx.arc(-8, -34 - puff * 10, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1;
    }

    function drawMetalDoor(px, py, size, colour) {
      if (size <= 20) {
        /* Thin door segment — matches wall beam, not a chunky lock panel. */
        var door = ctx.createLinearGradient(px, py, px, py + size);
        door.addColorStop(0, "#f8fafc");
        door.addColorStop(0.35, colour || ORANGE);
        door.addColorStop(1, "#1c1917");
        ctx.fillStyle = door;
        ctx.fillRect(px, py, size, size);
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(px + 1, py + 2, size - 2, Math.max(2, size * 0.2));
        ctx.strokeStyle = "#0c0e12";
        ctx.lineWidth = 1.3;
        ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
        ctx.fillStyle = "#0c0e12";
        ctx.fillRect(px + size * 0.42, py + size * 0.28, size * 0.16, size * 0.44);
        ctx.lineWidth = 1;
        return;
      }
      var s = size + 0.5;
      var plate = ctx.createLinearGradient(px, py, px, py + s);
      plate.addColorStop(0, "#efe0c4");
      plate.addColorStop(0.35, "#d2b48a");
      plate.addColorStop(1, "#8d6b45");
      ctx.fillStyle = plate;
      roundPlate(px + 2, py + 2, s - 4, s - 4, 6);
      ctx.fill();
      ctx.strokeStyle = "#1a120c";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,244,220,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 8, py + s - 8);
      ctx.lineTo(px + 8, py + 8);
      ctx.lineTo(px + s - 8, py + 8);
      ctx.stroke();
      ctx.fillStyle = colour || ORANGE;
      roundPlate(px + 6, py + 8, 7, s - 16, 2);
      ctx.fill();
      ctx.strokeStyle = "#1a120c";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#1a120c";
      roundPlate(px + s * 0.5 - 8, py + s * 0.5 - 10, 16, 20, 3);
      ctx.fill();
      ctx.fillStyle = colour || ORANGE;
      ctx.fillRect(px + s * 0.5 - 5, py + s * 0.5 - 6, 10, 6);
      ctx.beginPath();
      ctx.arc(px + s * 0.5, py + s * 0.5 + 6, 3, 0, Math.PI * 2);
      ctx.fill();
      rivetAt(px + 14, py + 12, 2.4);
      rivetAt(px + s - 14, py + 12, 2.4);
      rivetAt(px + 14, py + s - 18, 2.4);
      rivetAt(px + s - 14, py + s - 18, 2.4);
      ctx.lineWidth = 1;
    }

    function drawKeycard(x, y, colour) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.35);
      ctx.scale(1.05, 1.05);
      ctx.fillStyle = "rgba(26,18,12,0.35)";
      roundPlate(-13, -7, 28, 18, 3);
      ctx.fill();
      ctx.fillStyle = colour;
      roundPlate(-14, -10, 28, 18, 3);
      ctx.fill();
      ctx.strokeStyle = "#1a120c";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = "#1a120c";
      ctx.fillRect(-14, -2, 28, 5);
      ctx.fillStyle = "#f8f1e3";
      roundPlate(-10, -7, 8, 4, 1);
      ctx.fill();
      ctx.strokeStyle = "#1a120c";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      ctx.lineWidth = 1;
    }

    function drawAmmoCrate(x, y) {
      if (readyImg(barrelArt)) {
        ctx.drawImage(barrelArt, x - 16, y - 16, 32, 32);
        return;
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1.05, 1.05);
      ctx.fillStyle = "rgba(26,18,12,0.35)";
      roundPlate(-15, -10, 32, 26, 4);
      ctx.fill();
      var plate = ctx.createLinearGradient(-16, -14, 16, 14);
      plate.addColorStop(0, "#efe0c4");
      plate.addColorStop(0.5, "#d2b48a");
      plate.addColorStop(1, "#8d6b45");
      ctx.fillStyle = plate;
      roundPlate(-16, -14, 32, 26, 4);
      ctx.fill();
      ctx.strokeStyle = "#1a120c";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = ORANGE;
      roundPlate(-10, -2, 20, 10, 2);
      ctx.fill();
      ctx.strokeStyle = "#1a120c";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#1a120c";
      ctx.font = "800 8px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("AMMO", 0, 3);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      rivetAt(-11, -9, 1.8);
      rivetAt(11, -9, 1.8);
      rivetAt(-11, 8, 1.8);
      rivetAt(11, 8, 1.8);
      ctx.lineWidth = 1;
      ctx.restore();
    }

    function drawCreditCrate(x, y) {
      if (readyImg(crateArt)) {
        ctx.drawImage(crateArt, x - 18, y - 18, 36, 36);
        return;
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1.08, 1.08);
      ctx.fillStyle = "rgba(26,18,12,0.35)";
      ctx.beginPath();
      ctx.ellipse(1, 7, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      var scrap = ctx.createLinearGradient(-14, -12, 14, 12);
      scrap.addColorStop(0, "#f0e2a0");
      scrap.addColorStop(0.5, "#c9a227");
      scrap.addColorStop(1, "#7a5c12");
      ctx.fillStyle = scrap;
      roundPlate(-14, -12, 28, 24, 3);
      ctx.fill();
      ctx.strokeStyle = "#1a120c";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = "#1a120c";
      ctx.fillRect(-14, -2, 28, 3);
      ctx.fillRect(-2, -12, 4, 24);
      ctx.fillStyle = "#fff7d6";
      ctx.font = "800 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("CR", 0, 1);
      ctx.strokeStyle = "#1a120c";
      ctx.lineWidth = 1.2;
      ctx.strokeText("CR", 0, 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      rivetAt(-10, -8, 1.5);
      rivetAt(10, -8, 1.5);
      ctx.lineWidth = 1;
      ctx.restore();
    }

    function drawTowerCannon(cx, cy) {
      var ang = Math.atan2(player.y - cy, player.x - cx);
      var frame = cannonFrames[dir8(ang)];
      if (readyImg(frame)) {
        ctx.save();
        ctx.translate(cx, cy);
        drawDirSprite(frame, 56);
        ctx.restore();
        return;
      }
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = "#1c2128";
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0c0e12";
      ctx.lineWidth = 2.4;
      ctx.stroke();
      var barrel = ctx.createLinearGradient(6, -5, 40, 5);
      barrel.addColorStop(0, "#d7dde4");
      barrel.addColorStop(1, "#2a3038");
      ctx.fillStyle = barrel;
      ctx.fillRect(8, -5, 34, 10);
      ctx.strokeRect(8, -5, 34, 10);
      ctx.fillStyle = ORANGE;
      ctx.fillRect(38, -3, 9, 6);
      ctx.strokeRect(38, -3, 9, 6);
      ctx.restore();
    }

    function drawTower(e) {
      /* Cannon on the corner wall only — skip the huge guard-body room art. */
      if (map && (readyImg(cannonFrames[0]) || readyImg(towerArt))) {
        var foot = towerFoot(e);
        var pad = foot.half * 0.85;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(foot.x + 1, foot.y + pad * 0.55, pad * 0.95, pad * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3a3f46";
        ctx.beginPath();
        ctx.arc(foot.x, foot.y, pad * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#12151a";
        ctx.lineWidth = 2;
        ctx.stroke();
        drawTowerCannon(foot.x, foot.y);
        return;
      }
      var ang = Math.atan2(player.y - e.y, player.x - e.x);
      ctx.save();
      ctx.translate(e.x, e.y);
      castShadow(0, 0, 18, 11);
      var steel = ctx.createLinearGradient(-16, -18, 16, 16);
      steel.addColorStop(0, "#d7dde4");
      steel.addColorStop(0.45, "#7b8794");
      steel.addColorStop(1, "#2a3038");
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(1, 12, 17, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = steel;
      ctx.beginPath();
      ctx.moveTo(-15, 10);
      ctx.lineTo(-12, -10);
      ctx.lineTo(12, -10);
      ctx.lineTo(15, 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#0c0e12";
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -2, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      rivetAt(-8, -7, 1.7);
      rivetAt(8, -7, 1.7);
      rivetAt(-9, 5, 1.7);
      rivetAt(9, 5, 1.7);
      ctx.save();
      ctx.rotate(ang);
      var barrel = ctx.createLinearGradient(4, -4, 26, 4);
      barrel.addColorStop(0, "#c5ced6");
      barrel.addColorStop(1, "#2a3038");
      ctx.fillStyle = barrel;
      ctx.fillRect(6, -4, 22, 8);
      ctx.strokeRect(6, -4, 22, 8);
      ctx.fillStyle = ORANGE;
      ctx.fillRect(24, -2.5, 7, 5);
      ctx.strokeRect(24, -2.5, 7, 5);
      ctx.restore();
      ctx.fillStyle = "#c2410c";
      ctx.beginPath();
      ctx.arc(0, -16, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0c0e12";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.restore();
    }

    function drawCache(cache) {
      ctx.save();
      ctx.translate(cache.x, cache.y);
      ctx.fillStyle = "rgba(26,18,12,0.35)";
      ctx.beginPath();
      ctx.ellipse(1, 6, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cache.kind === "patch" ? "#2f8f8a" : "#e8d0a8";
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1a120c";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#1a120c";
      ctx.font = "800 8px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cache.kind === "patch" ? "PATCH" : "CACHE", 0, 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.restore();
    }

    function drawTerminalProp(x, y, dim) {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(x - 11, y - 13, 22, 26);
      ctx.strokeStyle = "#64748b";
      ctx.strokeRect(x - 11, y - 13, 22, 26);
      ctx.fillStyle = "#0ea5e9";
      ctx.fillRect(x - 8, y - 9, 16, 11);
      ctx.fillStyle = "#e0f2fe";
      ctx.fillRect(x - 6, y - 7, 12, 3);
      ctx.fillStyle = dim;
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("E", x, y + 20);
      ctx.textAlign = "left";
    }

    function drawMinimap(text, dim, danger, colours) {
      if (!map || !map.cols || !map.rows) return;
      var mw = 156;
      var mh = 96;
      var mx = w - mw - 14;
      var my = 14;
      var pad = 8;
      var doorsKey = "";
      var di;
      for (di = 0; di < map.doors.length; di++) {
        doorsKey += map.tiles[map.doors[di].y][map.doors[di].x].open ? "1" : "0";
      }
      var key = sectorIndex + ":" + map.cols + "x" + map.rows + ":" + doorsKey + ":" + mw + "x" + mh;
      if (!minimapCache || minimapCacheKey !== key) {
        minimapCache = (typeof document !== "undefined" && document.createElement)
          ? document.createElement("canvas")
          : null;
        if (minimapCache) {
          minimapCache.width = mw + pad * 2;
          minimapCache.height = mh + pad * 2;
          var g = minimapCache.getContext("2d");
          g.fillStyle = "#14110e";
          g.fillRect(0, 0, minimapCache.width, minimapCache.height);
          g.strokeStyle = "#e8d0a8";
          g.lineWidth = 3;
          g.strokeRect(1.5, 1.5, minimapCache.width - 3, minimapCache.height - 3);
          var cellW = mw / map.cols;
          var cellH = mh / map.rows;
          var y;
          for (y = 0; y < map.rows; y++) {
            var x;
            for (x = 0; x < map.cols; x++) {
              var tile = map.tiles[y][x];
              if (!tile) continue;
              if (tile.kind === "wall") g.fillStyle = "#e8d0a8";
              else if (tile.cache) g.fillStyle = "#2f8f8a";
              else if (tile.kind === "door" && !tile.open) g.fillStyle = colours[tile.colour] || ORANGE;
              else if (tile.kind === "exit") g.fillStyle = ORANGE;
              else if (tile.outdoor) g.fillStyle = sectorIndex === 0 ? "#3f6b34" : "#3a2e22";
              else g.fillStyle = "#241c16";
              g.fillRect(pad + x * cellW, pad + y * cellH, cellW + 0.5, cellH + 0.5);
            }
          }
          minimapCacheKey = key;
        }
      }
      if (minimapCache) {
        ctx.drawImage(minimapCache, mx - pad, my - pad);
      }
      var unitX = mw / map.width;
      var unitY = mh / map.height;
      for (var i = 0; i < enemies.length; i++) {
        ctx.fillStyle = danger || "#ef4444";
        ctx.fillRect(mx + enemies[i].x * unitX - 1.5, my + enemies[i].y * unitY - 1.5, 3, 3);
      }
      ctx.fillStyle = "#2f8f8a";
      ctx.beginPath();
      ctx.arc(mx + player.x * unitX, my + player.y * unitY, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1;
    }

    function drawVignette() {
      var g = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.25, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    function solidTile(tx, ty) {
      if (!map || ty < 0 || tx < 0 || ty >= map.rows || tx >= map.cols) return true;
      var tile = map.tiles[ty][tx];
      return tile && (tile.kind === "wall" || (tile.kind === "door" && !tile.open));
    }

    function floorUnderWall(tx, ty) {
      var dirs = [[0, -1], [0, 1], [1, 0], [-1, 0]];
      var i;
      var sawIndoor = false;
      for (i = 0; i < dirs.length; i++) {
        var tile = window.GameMap.tileAt(map, tx + dirs[i][0], ty + dirs[i][1]);
        if (!tile || tile.kind !== "floor") continue;
        if (tile.outdoor) return true;
        sawIndoor = true;
      }
      return !sawIndoor && sectorIndex === 0 && ty < map.macro * 6;
    }

    function wallCell(tx, ty) {
      if (!map || ty < 0 || tx < 0 || ty >= map.rows || tx >= map.cols) return false;
      var tile = map.tiles[ty][tx];
      return !!(tile && tile.kind === "wall");
    }

    function closedDoorCell(tx, ty) {
      if (!map || ty < 0 || tx < 0 || ty >= map.rows || tx >= map.cols) return false;
      var tile = map.tiles[ty][tx];
      return !!(tile && tile.kind === "door" && !tile.open);
    }

    function drawDoorBeam(x0, y0, bw, bh, horiz, colour) {
      /* Thin metal shutter + key colour lamp — not the thick wall-door sheet. */
      var thick = horiz ? Math.min(bh, 10) : Math.min(bw, 10);
      var gx = horiz ? x0 : x0 + (bw - thick) * 0.5;
      var gy = horiz ? y0 + (bh - thick) * 0.5 : y0;
      var gw = horiz ? bw : thick;
      var gh = horiz ? thick : bh;
      var gate = ctx.createLinearGradient(gx, gy, gx + (horiz ? 0 : gw), gy + (horiz ? gh : 0));
      gate.addColorStop(0, "#4b5563");
      gate.addColorStop(0.45, "#1f2937");
      gate.addColorStop(1, "#0b0f14");
      ctx.fillStyle = gate;
      ctx.fillRect(gx, gy, gw, gh);
      ctx.strokeStyle = "#030712";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gx + 0.5, gy + 0.5, gw - 1, gh - 1);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      var i;
      if (horiz) {
        for (i = 6; i < gw - 4; i += 8) {
          ctx.beginPath();
          ctx.moveTo(gx + i, gy + 1);
          ctx.lineTo(gx + i, gy + gh - 1);
          ctx.stroke();
        }
      } else {
        for (i = 6; i < gh - 4; i += 8) {
          ctx.beginPath();
          ctx.moveTo(gx + 1, gy + i);
          ctx.lineTo(gx + gw - 1, gy + i);
          ctx.stroke();
        }
      }
      var lamp = colour || ORANGE;
      ctx.fillStyle = lamp;
      if (horiz) ctx.fillRect(gx + gw * 0.5 - 4, gy + 1, 8, Math.max(2, gh - 2));
      else ctx.fillRect(gx + 1, gy + gh * 0.5 - 4, Math.max(2, gw - 2), 8);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      if (horiz) ctx.fillRect(gx + gw * 0.5 - 2, gy + 2, 4, 1.5);
      else ctx.fillRect(gx + 2, gy + gh * 0.5 - 2, 1.5, 4);
      ctx.lineWidth = 1;
    }

    function drawDoorRuns(x0, y0, x1, y1, t, colours) {
      var seen = Object.create(null);
      var y;
      for (y = y0; y <= y1; y++) {
        var x;
        for (x = x0; x <= x1; x++) {
          if (!closedDoorCell(x, y) || seen[x + "," + y]) continue;
          var tile = map.tiles[y][x];
          var colour = colours[tile.colour] || ORANGE;
          var e = closedDoorCell(x + 1, y);
          var wNbr = closedDoorCell(x - 1, y);
          var n = closedDoorCell(x, y - 1);
          var s = closedDoorCell(x, y + 1);
          var horiz = e || wNbr || (!n && !s);
          if (horiz) {
            var xL = x;
            var xR = x;
            while (closedDoorCell(xL - 1, y)) xL--;
            while (closedDoorCell(xR + 1, y)) xR++;
            var xi;
            for (xi = xL; xi <= xR; xi++) seen[xi + "," + y] = 1;
            drawDoorBeam(xL * t, y * t, (xR - xL + 1) * t, t, true, colour);
          } else {
            var yT = y;
            var yB = y;
            while (closedDoorCell(x, yT - 1)) yT--;
            while (closedDoorCell(x, yB + 1)) yB++;
            var yi;
            for (yi = yT; yi <= yB; yi++) seen[x + "," + yi] = 1;
            drawDoorBeam(x * t, yT * t, t, (yB - yT + 1) * t, false, colour);
          }
        }
      }
    }

    /* Vertical wall art, tiled along the run. Rotated for horizontal runs. */
    function drawWallStrip(x, y, bw, bh, horiz) {
      var img = wallVert;
      var thick = horiz ? bh : bw;
      var length = horiz ? bw : bh;
      var scale = thick / img.naturalWidth;
      if (!(scale > 0) || !(length > 0)) return;
      var seg = img.naturalHeight * scale;
      if (!(seg > 0.5)) {
        ctx.drawImage(img, x, y, thick, length);
        return;
      }
      var pos = 0;
      var guard = 0;
      while (pos < length - 0.25 && guard++ < 256) {
        var drawLen = Math.min(seg, length - pos);
        if (!(drawLen > 0.25)) break;
        var srcH = img.naturalHeight * (drawLen / seg);
        if (!horiz) {
          ctx.drawImage(img, 0, 0, img.naturalWidth, srcH, x, y + pos, thick, drawLen);
        } else {
          ctx.save();
          ctx.translate(x + pos + drawLen * 0.5, y + thick * 0.5);
          ctx.rotate(-Math.PI * 0.5);
          ctx.drawImage(img, 0, 0, img.naturalWidth, srcH, -thick * 0.5, -drawLen * 0.5, thick, drawLen);
          ctx.restore();
        }
        pos += drawLen;
      }
    }

    function drawMetalBeam(x0, y0, bw, bh, horiz) {
      if (readyImg(wallVert)) {
        drawWallStrip(x0, y0, bw, bh, horiz);
        return;
      }
      if (readyImg(wallArt) && horiz) {
        ctx.drawImage(wallArt, x0, y0, bw, bh);
        return;
      }
      ctx.fillStyle = wallConcrete() || "#5a5652";
      ctx.fillRect(x0, y0, bw, bh);
    }

    function drawWallRuns(x0, y0, x1, y1, t) {
      var seen = Object.create(null);
      var y;
      for (y = y0; y <= y1; y++) {
        var x;
        for (x = x0; x <= x1; x++) {
          if (!wallCell(x, y) || seen[x + "," + y]) continue;
          var e = wallCell(x + 1, y);
          var wNbr = wallCell(x - 1, y);
          var n = wallCell(x, y - 1);
          var s = wallCell(x, y + 1);
          var horiz = e || wNbr || (!n && !s);
          if (horiz) {
            var xL = x;
            var xR = x;
            while (wallCell(xL - 1, y)) xL--;
            while (wallCell(xR + 1, y)) xR++;
            var yT = y;
            var yB = y;
            function rowSolid(ry) {
              var xi;
              for (xi = xL; xi <= xR; xi++) if (!wallCell(xi, ry)) return false;
              return true;
            }
            while (rowSolid(yT - 1)) yT--;
            while (rowSolid(yB + 1)) yB++;
            var yi;
            for (yi = yT; yi <= yB; yi++) {
              var xi;
              for (xi = xL; xi <= xR; xi++) seen[xi + "," + yi] = 1;
            }
            var bwH = (xR - xL + 1) * t;
            var bhH = (yB - yT + 1) * t;
            drawMetalBeam(xL * t, yT * t, bwH, bhH, bwH >= bhH);
          } else {
            var yT2 = y;
            var yB2 = y;
            while (wallCell(x, yT2 - 1)) yT2--;
            while (wallCell(x, yB2 + 1)) yB2++;
            var xL2 = x;
            var xR2 = x;
            function colSolid(cx) {
              var yi;
              for (yi = yT2; yi <= yB2; yi++) if (!wallCell(cx, yi)) return false;
              return true;
            }
            while (colSolid(xL2 - 1)) xL2--;
            while (colSolid(xR2 + 1)) xR2++;
            var yi2;
            for (yi2 = yT2; yi2 <= yB2; yi2++) {
              var xi2;
              for (xi2 = xL2; xi2 <= xR2; xi2++) seen[xi2 + "," + yi2] = 1;
            }
            var bwV = (xR2 - xL2 + 1) * t;
            var bhV = (yB2 - yT2 + 1) * t;
            drawMetalBeam(xL2 * t, yT2 * t, bwV, bhV, bwV >= bhV);
          }
        }
      }
    }

    function blockIsWall(ax, ay, macro) {
      var x = ax * macro;
      var y = ay * macro;
      if (!map || y < 0 || x < 0 || y >= map.rows || x >= map.cols) return false;
      return wallCell(x, y);
    }

    /* L / T / + pieces, anchored on the wall centreline. */
    function drawJoinSprite(img, cx, cy, rot, ax, ay, armPx, thick) {
      if (!readyImg(img)) return;
      var scale = thick / armPx;
      var dw = img.naturalWidth * scale;
      var dh = img.naturalHeight * scale;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.drawImage(img, -ax * dw, -ay * dh, dw, dh);
      ctx.restore();
    }

    function drawWallJoins(x0, y0, x1, y1, t) {
      if (!map || !map.macro) return;
      var macro = map.macro;
      var thick = t * macro;
      var ax0 = Math.max(0, Math.floor(x0 / macro) - 1);
      var ay0 = Math.max(0, Math.floor(y0 / macro) - 1);
      var ax1 = Math.min(Math.floor((map.cols - 1) / macro), Math.floor(x1 / macro) + 1);
      var ay1 = Math.min(Math.floor((map.rows - 1) / macro), Math.floor(y1 / macro) + 1);
      var ay;
      for (ay = ay0; ay <= ay1; ay++) {
        var ax;
        for (ax = ax0; ax <= ax1; ax++) {
          if (!blockIsWall(ax, ay, macro)) continue;
          var n = blockIsWall(ax, ay - 1, macro);
          var s = blockIsWall(ax, ay + 1, macro);
          var e = blockIsWall(ax + 1, ay, macro);
          var w = blockIsWall(ax - 1, ay, macro);
          var arms = (n ? 1 : 0) + (s ? 1 : 0) + (e ? 1 : 0) + (w ? 1 : 0);
          if (arms < 2 || (arms === 2 && ((n && s) || (e && w)))) continue;
          var cx = (ax * macro + macro * 0.5) * t;
          var cy = (ay * macro + macro * 0.5) * t;
          if (arms === 4) {
            drawJoinSprite(joinX, cx, cy, 0, 598.5 / 1199, 576.5 / 1217, 110, thick);
            continue;
          }
          if (arms === 3) {
            var rotT = 0;
            if (!n) rotT = 0;
            else if (!e) rotT = Math.PI * 0.5;
            else if (!s) rotT = Math.PI;
            else rotT = -Math.PI * 0.5;
            drawJoinSprite(joinT, cx, cy, rotT, 546.5 / 1094, 52 / 984, 104, thick);
            continue;
          }
          var rotL = 0;
          if (e && s) rotL = 0;
          else if (s && w) rotL = Math.PI * 0.5;
          else if (w && n) rotL = Math.PI;
          else rotL = -Math.PI * 0.5;
          drawJoinSprite(joinL, cx, cy, rotL, 62 / 897, 66 / 1001, 124, thick);
        }
      }
    }

    function drawWallCornerTower(cx, cy, tx, ty) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(1, 10, 15, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      var steel = ctx.createLinearGradient(-14, -16, 14, 14);
      steel.addColorStop(0, "#d7dde4");
      steel.addColorStop(0.45, "#7b8794");
      steel.addColorStop(1, "#2a3038");
      ctx.fillStyle = steel;
      ctx.beginPath();
      ctx.moveTo(-13, 8);
      ctx.lineTo(-11, -8);
      ctx.lineTo(11, -8);
      ctx.lineTo(13, 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#0c0e12";
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.fillStyle = steel;
      ctx.beginPath();
      ctx.arc(0, -2, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      rivetAt(-7, -6, 1.6);
      rivetAt(7, -6, 1.6);
      rivetAt(-8, 4, 1.6);
      rivetAt(8, 4, 1.6);
      rivetAt(0, -9, 1.5);
      ctx.fillStyle = "#c2410c";
      ctx.beginPath();
      ctx.arc(0, -14, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0c0e12";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.restore();
    }

    function beginFrame() {
      ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
      ctx.imageSmoothingEnabled = true;
      if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "low";
    }

    function render() {
      beginFrame();
      if (!map) {
        ctx.clearRect(0, 0, w, h);
        if (canvas.style) canvas.style.transform = "";
        return;
      }

      var text = readColour("--text", "#e8e8e8");
      var dim = readColour("--text-dim", "#8a8a8a");
      var danger = readColour("--danger", "#f2857c");
      var colours = window.GameMap.KEY_COLOURS;
      var sx = shake > 0 ? (Math.random() - 0.5) * 6 : 0;
      var sy = shake > 0 ? (Math.random() - 0.5) * 6 : 0;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#1a140e";
      ctx.fillRect(0, 0, w, h);

      /* Simple float camera — same as the last smooth release. No CSS slide. */
      if (canvas.style && canvas.style.transform) canvas.style.transform = "";
      ctx.save();
      ctx.translate(-camX + sx, -camY + sy);

      var t = map.tile;
      var macro = map.macro || 3;
      var drawCamX = camX + sx;
      var drawCamY = camY + sy;
      /* Align the floor loop to the macro grid so block art is not skipped. */
      var x0 = Math.max(0, Math.floor(drawCamX / t) - 1);
      var y0 = Math.max(0, Math.floor(drawCamY / t) - 1);
      x0 = Math.floor(x0 / macro) * macro;
      y0 = Math.floor(y0 / macro) * macro;
      var x1 = Math.min(map.cols - 1, Math.ceil((drawCamX + w) / t) + 1);
      var y1 = Math.min(map.rows - 1, Math.ceil((drawCamY + h) / t) + 1);
      var y;
      for (y = y0; y <= y1; y++) {
        var x;
        for (x = x0; x <= x1; x++) {
          var tile = map.tiles[y][x];
          if (!tile) continue;
          var px = x * t;
          var py = y * t;
          /* Floor under walls/doors so beams sit on continuous ground. */
          var outdoorFloor = tile.kind === "wall" || tile.kind === "door"
            ? floorUnderWall(x, y)
            : !!tile.outdoor;
          drawFloorTile(px, py, t, x, y, outdoorFloor);
          if (tile.kind === "exit") {
            var ready = window.GameMap.allDoorsOpen(map);
            var pad = Math.max(1, (t * 0.2) | 0);
            ctx.strokeStyle = ready ? ORANGE : dim;
            ctx.globalAlpha = ready ? 0.9 : 0.35;
            ctx.lineWidth = Math.max(1, t * 0.25);
            ctx.strokeRect(px + pad, py + pad, t - pad * 2, t - pad * 2);
            if (t >= 10) {
              ctx.font = "700 11px system-ui, sans-serif";
              ctx.fillStyle = ready ? ORANGE : dim;
              ctx.textAlign = "center";
              ctx.fillText("EXIT", px + t * 0.5, py + t * 0.55);
              ctx.textAlign = "left";
            }
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;
          }
        }
      }
      /* Doors under props; walls redrawn after mobile enemies so concrete
       * occludes oversized sprites instead of robots painting "through" walls. */
      drawDoorRuns(x0, y0, x1, y1, t, colours);

      var viewL = drawCamX - 48;
      var viewT = drawCamY - 48;
      var viewR = drawCamX + w + 48;
      var viewB = drawCamY + h + 48;
      for (var di = 0; di < floorDecor.length; di++) {
        var decor = floorDecor[di];
        if (decor.x < viewL || decor.y < viewT || decor.x > viewR || decor.y > viewB) continue;
        drawFloorDecorItem(decor);
      }

      for (var ti = 0; ti < map.terminals.length; ti++) {
        drawTerminalProp(map.terminals[ti].x, map.terminals[ti].y, dim);
      }

      for (var ai = 0; ai < map.ammoCrates.length; ai++) {
        if (map.ammoCrates[ai].taken) continue;
        drawAmmoCrate(map.ammoCrates[ai].x, map.ammoCrates[ai].y);
      }
      for (var cri = 0; cri < (map.creditCrates || []).length; cri++) {
        if (map.creditCrates[cri].taken) continue;
        drawCreditCrate(map.creditCrates[cri].x, map.creditCrates[cri].y);
      }

      for (var ci = 0; ci < (map.caches || []).length; ci++) {
        if (map.caches[ci].taken) continue;
        drawCache(map.caches[ci]);
      }

      for (var ki = 0; ki < map.keys.length; ki++) {
        var key = map.keys[ki];
        if (key.taken) continue;
        drawKeycard(key.x, key.y, colours[key.colour] || ORANGE);
      }

      for (var i = 0; i < enemies.length; i++) {
        if (enemies[i].kind === "tower") continue;
        drawEnemy(enemies[i]);
      }

      drawWallRuns(x0, y0, x1, y1, t);
      drawWallJoins(x0, y0, x1, y1, t);

      for (i = 0; i < enemies.length; i++) {
        if (enemies[i].kind !== "tower") continue;
        drawEnemy(enemies[i]);
      }

      for (i = 0; i < hitMarks.length; i++) {
        var hm = hitMarks[i];
        ctx.globalAlpha = Math.max(0, hm.life * 4);
        ctx.strokeStyle = ORANGE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hm.x, hm.y, 10 + (0.25 - hm.life) * 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (i = 0; i < bullets.length; i++) {
        var b = bullets[i];
        ctx.fillStyle = "rgba(249,115,22,0.35)";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff7ed";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ORANGE;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (i = 0; i < enemyShots.length; i++) {
        var shot = enemyShots[i];
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
        ctx.fillStyle = YELLOW;
        ctx.fill();
        ctx.strokeStyle = "rgba(250,204,21,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(shot.x - shot.vx * 0.02, shot.y - shot.vy * 0.02);
        ctx.lineTo(shot.x, shot.y);
        ctx.stroke();
      }

      castShadow(player.x, player.y, 18, 8);
      ctx.save();
      ctx.translate(player.x, player.y);
      /* Dir frames already face the right way; only rotate procedural fallback. */
      if (!readyImg(pilotFrames[dir8(player.facing)]) && !readyImg(pilotArt)) {
        ctx.rotate(player.facing);
      }
      ctx.globalAlpha = iframes > 0 && Math.floor(iframes * 20) % 2 === 0 ? 0.35 : 1;
      drawPlayerBody();
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.restore();

      drawVignette();
      if (flash > 0) {
        ctx.fillStyle = "rgba(180,30,30," + (flash * 1.2) + ")";
        ctx.fillRect(0, 0, w, h);
      }

      drawMinimap(text, dim, danger, colours);

      if (patchRun && nearShip() && !shopOpen && playing && !paused) {
        ctx.fillStyle = text;
        ctx.font = "600 13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Hold E — patch the hull", w * 0.5, h - 24);
        ctx.textAlign = "left";
      } else if (nearTerminal() && !shopOpen && playing && !paused) {
        ctx.fillStyle = text;
        ctx.font = "600 13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("E — terminal", w * 0.5, h - 24);
        ctx.textAlign = "left";
      }

      if (toastLife > 0 && toastMsg) {
        ctx.font = "700 15px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        var tw = ctx.measureText(toastMsg).width;
        ctx.globalAlpha = Math.min(1, toastLife);
        roundPlate(w * 0.5 - tw / 2 - 14, 14, tw + 28, 32, 8);
        ctx.fillStyle = "#1a120c";
        ctx.fill();
        ctx.strokeStyle = "#e8d0a8";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#f8f1e3";
        ctx.fillText(toastMsg, w * 0.5, 30);
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.lineWidth = 1;
      }

      if (paused && !shopOpen) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = text;
        ctx.font = "700 28px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Paused", w * 0.5, h * 0.45);
        ctx.font = "14px system-ui, sans-serif";
        ctx.fillStyle = dim;
        ctx.fillText("Press P or Esc", w * 0.5, h * 0.45 + 28);
        ctx.textAlign = "left";
      }

      if ((playing || over) && lastInput) {
        var showChrome = lastInput.touchMode ||
          (window.GameInput && window.GameInput.preferTouchChrome());
        if (showChrome) {
          if (lastInput.autoAim) {
            drawStick(lastInput.moveStick, lastInput.stickRadius, text);
            if (!lastInput.moveStick.active) drawIdleStick(dim);
            drawFirePad(!!lastInput.firePadActive, ORANGE);
          } else {
            drawStick(lastInput.moveStick, lastInput.stickRadius, text);
            drawStick(lastInput.aimStick, lastInput.stickRadius, ORANGE);
            if (!lastInput.moveStick.active && !lastInput.aimStick.active) {
              drawIdleStick(dim);
              ctx.globalAlpha = 0.22;
              ctx.strokeStyle = ORANGE;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(w - 80, h - 80, 56, 0, Math.PI * 2);
              ctx.stroke();
              ctx.globalAlpha = 1;
            }
          }
        }
      }
    }

    function paintMenuBackdrop() {
      if (canvas.style) canvas.style.transform = "";
      beginFrame();
      ctx.clearRect(0, 0, w, h);
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#12151a");
      g.addColorStop(0.55, "#0c0e12");
      g.addColorStop(1, "#07080a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // soft sand wash (crash site mood)
      var sand = ctx.createRadialGradient(w * 0.28, h * 0.62, 20, w * 0.28, h * 0.62, w * 0.45);
      sand.addColorStop(0, "rgba(120,90,50,0.18)");
      sand.addColorStop(1, "rgba(120,90,50,0)");
      ctx.fillStyle = sand;
      ctx.fillRect(0, 0, w, h);

      // distant fortress wall band
      ctx.fillStyle = "rgba(140,110,80,0.22)";
      ctx.fillRect(0, h * 0.22, w, 28);
      ctx.fillStyle = "rgba(90,70,48,0.35)";
      for (var i = 0; i < 12; i++) {
        ctx.fillRect(i * (w / 11) + 8, h * 0.22, w / 14, 28);
      }

      var card = Math.min(480, Math.max(280, w - 32));
      var margin = Math.max(72, (w - card) * 0.5);
      var shipScale = Math.max(1.05, Math.min(2.15, (margin * 0.48 - 10) / 72));
      var pilotScale = Math.max(1.45, Math.min(3.05, (margin * 0.48 - 10) / 34));
      var shipX = margin * 0.52;
      var pilotX = w - margin * 0.52;

      function menuPool(x, y, radius) {
        var pool = ctx.createRadialGradient(x, y, 8, x, y, radius);
        pool.addColorStop(0, "rgba(196,154,96,0.72)");
        pool.addColorStop(0.55, "rgba(120,86,48,0.28)");
        pool.addColorStop(1, "rgba(120,86,48,0)");
        ctx.fillStyle = pool;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      menuPool(shipX, h * 0.64, margin * 0.85);
      menuPool(pilotX, h * 0.6, margin * 0.7);

      ctx.save();
      ctx.translate(shipX, h * 0.62);
      ctx.rotate(-0.4);
      ctx.scale(shipScale, shipScale);
      drawCrashedShip();
      ctx.restore();

      castShadow(pilotX, h * 0.58, 22 * pilotScale * 0.45, 10 * pilotScale * 0.45);
      ctx.save();
      ctx.translate(pilotX, h * 0.58);
      ctx.scale(pilotScale, pilotScale);
      var prevFacing = player.facing;
      player.facing = -Math.PI * 0.75; /* NW pose on the menu */
      drawPlayerBody();
      player.facing = prevFacing;
      ctx.restore();
      drawVignette();
    }

    return {
      reset: reset,
      start: function (opts) {
        reset(opts || {});
        playing = true;
        over = false;
        won = false;
        paused = false;
        if (window.GameAudio && window.GameAudio.unlock) window.GameAudio.unlock();
      },
      stop: function () {
        playing = false;
        paused = false;
        shopOpen = false;
      },
      suspend: suspend,
      update: update,
      render: render,
      paintMenuBackdrop: paintMenuBackdrop,
      isPlaying: function () { return playing; },
      isPaused: function () { return paused; },
      setPaused: setPaused,
      isOver: function () { return over; },
      didWin: function () { return won; },
      getScore: function () { return score; },
      hudSnapshot: function () {
        var gearBits = [];
        var guns = [];
        var gi;
        if (owned.dash) gearBits.push(dashCool > 0.15 ? "Dash…" : "Dash");
        if (breachCharges) gearBits.push("Breach");
        if (owned.hull) gearBits.push("Patch");
        for (gi = 0; gi < GUN_ORDER.length; gi++) {
          var gid = GUN_ORDER[gi];
          if (!owned[gid] || !WEAPONS[gid]) continue;
          guns.push({ id: gid, name: WEAPONS[gid].name, active: weaponId === gid });
        }
        return {
          score: score,
          hp: hp,
          ammo: ammo,
          weapon: weapon().name,
          weaponId: weaponId,
          guns: guns,
          deck: map ? map.name : "",
          cards: { R: !!inventory.R, G: !!inventory.G, B: !!inventory.B },
          lowHp: hp <= 2,
          lowAmmo: ammo <= 8,
          gear: gearBits.join("  ")
        };
      },
      setWeapon: function (id) {
        if (!owned[id] || !WEAPONS[id]) return false;
        weaponId = id;
        return true;
      },
      getPlayerPos: function () { return { x: player.x - camX, y: player.y - camY }; },
      /* Used by tests — tower body + props + walls. */
      blocksAt: function (x, y, r) {
        if (!map) return true;
        var rad = r == null ? PLAYER_R : r;
        return window.GameMap.circleBlocked(map, x, y, rad) ||
          propBlocked(x, y, rad) ||
          towerBlocked(x, y, rad);
      },
      setOnOver: function (fn) { onOver = fn; },
      setOnShop: function (fn) { onShop = fn; },
      setOnPause: function (fn) { onPause = fn; },
      purchase: purchase,
      closeShop: closeShop,
      shopSnapshot: shopSnapshot,
      isShopOpen: function () { return shopOpen; },
      getFacing: function () { return player.facing; },
      resize: function (width, height) {
        var dpr = 1;
        if (typeof window !== "undefined" && window.devicePixelRatio) {
          dpr = Math.min(2, window.devicePixelRatio);
        }
        viewScale = dpr;
        w = Math.max(1, Math.floor(width));
        h = Math.max(1, Math.floor(height));
        canvas.width = Math.max(1, Math.floor(w * viewScale));
        canvas.height = Math.max(1, Math.floor(h * viewScale));
        if (map) updateCamera();
      }
    };
  }

  window.ShooterGame = {
    create: create,
    circlesHit: circlesHit,
    crawlerVector: crawlerVector,
    fortressShouldFire: fortressShouldFire,
    WEAPONS: WEAPONS,
    GUN_ORDER: GUN_ORDER,
    SHOP_ITEMS: SHOP_ITEMS
  };
})();
