/*
 * Settings + progress — local only via Store.
 */

(function () {
  "use strict";

  function blankOwned() {
    return { pistol: true, shotgun: false, smg: false, rifle: false, lance: false };
  }

  function num(v, min, max, fallback) {
    var n = typeof v === "number" ? v : fallback;
    if (n !== n || n === Infinity || n === -Infinity) n = fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function boolList(list, cap) {
    if (!Array.isArray(list)) return [];
    return list.slice(0, cap).map(function (v) { return !!v; });
  }

  function normalizeSuspended(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (!raw.player || typeof raw.player !== "object") return null;
    var kinds = { grunt: 1, crawler: 1, fortress: 1, drone: 1, boss: 1, tower: 1 };
    var enemies = [];
    if (Array.isArray(raw.enemies)) {
      raw.enemies.slice(0, 40).forEach(function (e) {
        if (!e || !kinds[e.kind]) return;
        enemies.push({
          x: num(e.x, 0, 4000, 0),
          y: num(e.y, 0, 4000, 0),
          hp: num(e.hp, 1, 80, 1),
          kind: e.kind,
          fireCool: num(e.fireCool, 0, 10, 0),
          post: e.post && typeof e.post === "object"
            ? { x: num(e.post.x, 0, 4000, 0), y: num(e.post.y, 0, 4000, 0) }
            : null
        });
      });
    }
    var breached = [];
    if (Array.isArray(raw.breached)) {
      raw.breached.slice(0, 16).forEach(function (cell) {
        if (!cell) return;
        breached.push({ x: cell.x | 0, y: cell.y | 0 });
      });
    }
    var owned = raw.owned && typeof raw.owned === "object" ? raw.owned : {};
    var inv = raw.inventory && typeof raw.inventory === "object" ? raw.inventory : {};
    var allowedGun = { pistol: 1, shotgun: 1, smg: 1, rifle: 1, lance: 1 };
    var weapon = allowedGun[raw.weaponId] ? raw.weaponId : "pistol";
    return {
      sectorIndex: num(raw.sectorIndex, 0, 19, 0),
      score: num(raw.score, 0, 999999, 0),
      hp: num(raw.hp, 1, 5, 5),
      ammo: num(raw.ammo, 0, 999, 0),
      weaponId: weapon,
      owned: {
        pistol: true,
        shotgun: !!owned.shotgun,
        smg: !!owned.smg,
        rifle: !!owned.rifle,
        lance: !!owned.lance,
        dash: !!owned.dash,
        hull: !!owned.hull
      },
      inventory: { R: !!inv.R, G: !!inv.G, B: !!inv.B },
      player: {
        x: num(raw.player.x, 0, 4000, 48),
        y: num(raw.player.y, 0, 4000, 48),
        facing: num(raw.player.facing, -7, 7, 0)
      },
      enemies: enemies,
      doorsOpen: boolList(raw.doorsOpen, 32),
      keysTaken: boolList(raw.keysTaken, 8),
      cratesTaken: boolList(raw.cratesTaken, 8),
      creditsTaken: boolList(raw.creditsTaken, 16),
      cachesTaken: boolList(raw.cachesTaken, 4),
      breached: breached,
      breachCharges: raw.breachCharges ? 1 : 0,
      patchRun: !!raw.patchRun
    };
  }

  function read() {
    var data = window.Store && window.Store.getData ? window.Store.getData() : {};
    if (!data || typeof data !== "object") data = {};
    var owned = data.owned && typeof data.owned === "object" ? data.owned : blankOwned();
    return {
      autoAim: data.autoAim !== false,
      muted: !!data.muted,
      difficulty: data.difficulty === "easy" || data.difficulty === "hard" ? data.difficulty : "normal",
      unlockedSector: Math.max(0, Math.min(99, data.unlockedSector | 0)),
      owned: {
        pistol: true,
        shotgun: !!owned.shotgun,
        smg: !!owned.smg,
        rifle: !!owned.rifle,
        lance: !!owned.lance
      },
      bestScore: Math.max(0, data.bestScore | 0),
      cleared: !!data.cleared,
      suspended: normalizeSuspended(data.suspended)
    };
  }

  function write(patch) {
    var next = read();
    if (patch && typeof patch === "object") {
      if (typeof patch.autoAim === "boolean") next.autoAim = patch.autoAim;
      if (typeof patch.muted === "boolean") next.muted = patch.muted;
      if (patch.difficulty === "easy" || patch.difficulty === "normal" || patch.difficulty === "hard") {
        next.difficulty = patch.difficulty;
      }
      if (typeof patch.unlockedSector === "number") {
        next.unlockedSector = Math.max(next.unlockedSector, patch.unlockedSector | 0);
      }
      if (patch.owned && typeof patch.owned === "object") {
        next.owned = {
          pistol: true,
          shotgun: !!patch.owned.shotgun,
          smg: !!patch.owned.smg,
          rifle: !!patch.owned.rifle,
          lance: !!patch.owned.lance
        };
      }
      if (typeof patch.bestScore === "number") {
        next.bestScore = Math.max(next.bestScore, patch.bestScore | 0);
      }
      if (typeof patch.cleared === "boolean") next.cleared = next.cleared || patch.cleared;
      if (patch.clearSuspended) next.suspended = null;
      else if (patch.suspended) next.suspended = normalizeSuspended(patch.suspended);
    }
    if (window.Store && window.Store.setData) window.Store.setData(next);
    return next;
  }

  function difficultyMods(diff) {
    /* maxEnemies = live mobile foes (not towers). Caps wave spawns.
     * Higher spawn / fireScale = longer gaps. mapSpawn < 1 thins deck enemies.
     * damageTaken < 1 banks partial hits (0.5 ⇒ two hits per heart). */
    if (diff === "easy") {
      return {
        spawn: 2.8, enemySpeed: 0.48, enemyHp: 0.55, ammo: 2.4,
        playerSpeed: 1.22, maxEnemies: 2, fireScale: 2.4,
        mapSpawn: 0.35, damageTaken: 0.5, iframeScale: 2.0, bonusHp: 3
      };
    }
    if (diff === "hard") {
      return {
        spawn: 0.85, enemySpeed: 1.2, enemyHp: 1.35, ammo: 0.75,
        playerSpeed: 1, maxEnemies: 16, fireScale: 1,
        mapSpawn: 1, damageTaken: 1, iframeScale: 1, bonusHp: 0
      };
    }
    /* Medium / normal — clearly easier than hard, still above easy. */
    return {
      spawn: 2.0, enemySpeed: 0.68, enemyHp: 0.75, ammo: 1.7,
      playerSpeed: 1.12, maxEnemies: 4, fireScale: 1.85,
      mapSpawn: 0.55, damageTaken: 0.7, iframeScale: 1.45, bonusHp: 2
    };
  }

  window.GameSettings = {
    read: read,
    write: write,
    getAutoAim: function () { return read().autoAim; },
    setAutoAim: function (v) { return write({ autoAim: !!v }).autoAim; },
    getMuted: function () { return read().muted; },
    setMuted: function (v) {
      var muted = write({ muted: !!v }).muted;
      if (window.GameAudio && window.GameAudio.setMuted) window.GameAudio.setMuted(muted);
      return muted;
    },
    getDifficulty: function () { return read().difficulty; },
    setDifficulty: function (v) { return write({ difficulty: v }).difficulty; },
    difficultyMods: difficultyMods,
    getProgress: function () { return read(); },
    unlockSector: function (index) { return write({ unlockedSector: index | 0 }); },
    saveOwned: function (owned) { return write({ owned: owned }); },
    recordScore: function (score, cleared) {
      return write({ bestScore: score | 0, cleared: !!cleared });
    },
    canContinue: function () {
      var p = read();
      if (p.suspended) return true;
      return p.unlockedSector > 0 || p.owned.shotgun || p.owned.smg || p.owned.rifle || p.owned.lance || p.cleared;
    },
    /* Wipe score / continue / guns. Keeps theme, auto-aim, mute, difficulty. */
    clearProgress: function () {
      var cur = read();
      var next = {
        autoAim: cur.autoAim,
        muted: cur.muted,
        difficulty: cur.difficulty,
        unlockedSector: 0,
        owned: blankOwned(),
        bestScore: 0,
        cleared: false,
        suspended: null
      };
      if (window.Store && window.Store.setData) window.Store.setData(next);
      return next;
    }
  };
})();
