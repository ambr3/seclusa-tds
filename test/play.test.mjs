/* Facing, minimap placement, and the menu closing sheets. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const jsDir = join(here, "..", "static", "js");

function load(file, win) {
  const source = readFileSync(join(jsDir, file), "utf8");
  new Function("window", "document", "navigator", "getComputedStyle", source)(
    win,
    win.document,
    win.navigator,
    win.getComputedStyle
  );
  return win;
}

function mockCanvas(width, height) {
  const calls = [];
  const grad = { addColorStop() {} };
  const canvas = {
    width,
    height,
    style: {},
    calls,
    getContext() {
      return ctx;
    },
    getBoundingClientRect() {
      return { width, height, top: 0, left: 0, right: width, bottom: height };
    },
  };
  const ctx = new Proxy(
    { canvas, measureText: () => ({ width: 40 }) },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === "createLinearGradient" || prop === "createRadialGradient") {
          return () => grad;
        }
        return (...args) => {
          calls.push([prop, args]);
        };
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    }
  );
  return canvas;
}

function settingsStub() {
  const progress = {
    autoAim: false,
    muted: false,
    difficulty: "normal",
    bestScore: 0,
    cleared: false,
    unlockedSector: 0,
    owned: {},
  };
  return {
    getAutoAim: () => progress.autoAim,
    setAutoAim: (v) => {
      progress.autoAim = !!v;
      return progress.autoAim;
    },
    getMuted: () => progress.muted,
    setMuted: (v) => {
      progress.muted = !!v;
      return progress.muted;
    },
    getDifficulty: () => progress.difficulty,
    setDifficulty: (v) => {
      progress.difficulty = v;
      return v;
    },
    difficultyMods: () => ({ spawn: 1, enemySpeed: 1, enemyHp: 1, ammo: 1, playerSpeed: 1, maxEnemies: 12 }),
    getProgress: () => progress,
    write: (patch) => {
      if (patch && patch.clearSuspended) progress.suspended = null;
      else if (patch && patch.suspended) progress.suspended = patch.suspended;
      if (patch && typeof patch.bestScore === "number") progress.bestScore = patch.bestScore;
      if (patch && patch.owned && typeof patch.owned === "object") {
        progress.owned = {
          pistol: true,
          shotgun: !!patch.owned.shotgun,
          smg: !!patch.owned.smg,
          rifle: !!patch.owned.rifle,
          lance: !!patch.owned.lance,
        };
      }
      return progress;
    },
    canContinue: () => !!progress.suspended,
  };
}

function bootWindow(canvas) {
  const ids = [
    "game", "stage", "scrim",
    "sheet-theme", "sheet-settings", "sheet-shop",
    "btn-theme", "btn-settings", "btn-play", "btn-continue", "btn-restart",
    "btn-menu", "btn-main-menu", "btn-shop-close",
    "opt-auto-aim", "opt-mute",
    "menu-controls", "menu-best",
    "overlay-menu", "overlay-over", "over-title", "over-score",
    "shop-credits", "shop-ammo", "shop-hp",
    "playhud", "hud-guns", "hud-score", "hud-hp", "hud-ammo", "hud-deck", "hud-gear",
    "hud-card-R", "hud-card-G", "hud-card-B",
  ];
  const nodes = new Map();
  function make(id) {
    const classes = new Set();
    const attrs = {};
    const listeners = {};
    let html = "";
    const node = {
      id,
      hidden: false,
      disabled: false,
      textContent: "",
      style: {},
      classList: {
        add(c) { classes.add(c); },
        remove(c) { classes.delete(c); },
        contains(c) { return classes.has(c); },
        toggle(c, on) {
          const next = on === undefined ? !classes.has(c) : !!on;
          if (next) classes.add(c);
          else classes.delete(c);
        },
      },
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
      addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
      click(event) { (listeners.click || []).forEach((fn) => fn(event || {})); },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getBoundingClientRect() {
        return { width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 };
      },
      get innerHTML() { return html; },
      set innerHTML(value) { html = String(value); },
      _listeners: listeners,
    };
    nodes.set(id, node);
    return node;
  }
  ids.forEach(make);
  nodes.set("game", canvas);

  const win = {
    devicePixelRatio: 2,
    document: {
      readyState: "complete",
      documentElement: {},
      getElementById: (id) => nodes.get(id) || null,
      querySelectorAll: () => [],
      addEventListener() {},
    },
    navigator: {},
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    requestAnimationFrame() { return 1; },
    cancelAnimationFrame() {},
    addEventListener() {},
  };
  win.nodes = nodes;
  return win;
}

test("facing follows aim and movement", () => {
  const canvas = mockCanvas(800, 600);
  const win = bootWindow(canvas);
  const { GameMap } = load("map.js", win);
  win.GameMap = GameMap;
  win.GameSettings = settingsStub();
  const { ShooterGame } = load("game.js", win);
  const game = ShooterGame.create(canvas);
  game.resize(400, 300);
  game.start({});
  const idle = {
    moveX: 0, moveY: 0, aimX: 0, aimY: 0, hasAim: false,
    shooting: false, autoAim: false, interact: false,
  };
  game.update(0.016, { ...idle, hasAim: true, aimX: 0, aimY: 1 });
  assert.ok(Math.abs(game.getFacing() - Math.PI / 2) < 0.001, "aim south");
  game.update(0.016, { ...idle, moveX: -1, moveY: 0 });
  assert.ok(Math.abs(game.getFacing() - Math.PI) < 0.001, "move west");
});

test("minimap stays inside the logical view when the backing store is larger", () => {
  const canvas = mockCanvas(800, 600);
  const win = bootWindow(canvas);
  const { GameMap } = load("map.js", win);
  win.GameMap = GameMap;
  win.GameSettings = settingsStub();
  const { ShooterGame } = load("game.js", win);
  const game = ShooterGame.create(canvas);
  game.resize(800, 600);
  assert.equal(canvas.width, 1600);
  game.start({});
  canvas.calls.length = 0;
  game.render();
  const dots = canvas.calls.filter((c) => c[0] === "arc" && c[1][2] === 3.2);
  assert.equal(dots.length, 1);
  const x = dots[0][1][0];
  assert.ok(x > 600 && x < 800, "player dot x " + x + " is inside the 800px view");
});

test("menu closes an open sheet", () => {
  const canvas = mockCanvas(800, 600);
  const win = bootWindow(canvas);
  const { GameMap } = load("map.js", win);
  win.GameMap = GameMap;
  win.GameSettings = settingsStub();
  win.Theme = {
    apply() {},
    current() { return "system"; },
    setBackground() {},
    paintBackground() {},
    paintModeChrome() {},
    set() {},
  };
  win.GameInput = {
    setAutoAim() {},
    setEnabled() {},
    attach() {},
    getState() {
      return { moveX: 0, moveY: 0, aimX: 0, aimY: 0, hasAim: false, shooting: false };
    },
  };
  load("game.js", win);
  load("app.js", win);

  const sheet = win.document.getElementById("sheet-settings");
  const scrim = win.document.getElementById("scrim");
  const menu = win.document.getElementById("overlay-menu");
  win.document.getElementById("btn-settings").click();
  assert.equal(sheet.classList.contains("open"), true);
  assert.equal(scrim.classList.contains("open"), true);

  win.document.getElementById("btn-main-menu").click();
  assert.equal(sheet.classList.contains("open"), false);
  assert.equal(sheet.getAttribute("aria-hidden"), "true");
  assert.equal(scrim.classList.contains("open"), false);
  assert.equal(menu.hidden, false);
  assert.equal(menu.classList.contains("hidden"), false);
});

test("menu keeps the live deck", () => {
  const canvas = mockCanvas(800, 600);
  const win = bootWindow(canvas);
  const { GameMap } = load("map.js", win);
  win.GameMap = GameMap;
  win.GameSettings = settingsStub();
  const { ShooterGame } = load("game.js", win);
  const game = ShooterGame.create(canvas);
  game.resize(800, 600);
  game.start({});
  const idle = {
    moveX: 0, moveY: 0, aimX: 0, aimY: 0, hasAim: false,
    shooting: false, autoAim: false, interact: false,
  };
  game.update(0.05, { ...idle, moveX: 1 });
  assert.equal(game.isPlaying(), true);
  game.suspend();
  assert.equal(game.isPlaying(), false);
  const snap = win.GameSettings.getProgress().suspended;
  assert.equal(snap.sectorIndex, 0);
  assert.ok(snap.player.x > 0);
  const hp = snap.hp;
  game.start({ continueRun: true });
  assert.equal(game.isPlaying(), true);
  assert.equal(game.getScore(), snap.score);
  assert.equal(win.GameSettings.getProgress().suspended.hp, hp);
});


test("begin run keeps unlocked guns", () => {
  const canvas = mockCanvas(640, 480);
  const win = bootWindow(canvas);
  const { GameMap } = load("map.js", win);
  win.GameMap = GameMap;
  win.GameSettings = settingsStub();
  win.GameSettings.getProgress().owned = {
    pistol: true, shotgun: true, smg: true, rifle: false, lance: false,
  };
  const { ShooterGame } = load("game.js", win);
  const game = ShooterGame.create(canvas);
  game.start({});
  const hud = game.hudSnapshot();
  const ids = hud.guns.map((g) => g.id);
  assert.deepEqual(ids, ["pistol", "shotgun", "smg"]);
  assert.equal(game.setWeapon("smg"), true);
  assert.equal(game.hudSnapshot().weaponId, "smg");
  assert.equal(game.setWeapon("lance"), false);
});

test("shop lists auto and lance", () => {
  const canvas = mockCanvas(320, 240);
  const win = bootWindow(canvas);
  const { GameMap } = load("map.js", win);
  win.GameMap = GameMap;
  win.GameSettings = settingsStub();
  const { ShooterGame } = load("game.js", win);
  const ids = ShooterGame.SHOP_ITEMS.filter((i) => i.kind === "weapon").map((i) => i.id);
  assert.deepEqual(ids, ["shotgun", "smg", "rifle", "lance"]);
  assert.ok(ShooterGame.WEAPONS.smg);
  assert.ok(ShooterGame.WEAPONS.lance);
});

test("corner towers block the pilot", () => {
  const canvas = mockCanvas(800, 600);
  const win = bootWindow(canvas);
  const { GameMap } = load("map.js", win);
  win.GameMap = GameMap;
  win.GameSettings = settingsStub();
  const { ShooterGame } = load("game.js", win);
  const game = ShooterGame.create(canvas);
  game.resize(400, 300);
  game.start({});
  const crash = GameMap.cloneSector(0);
  assert.ok(crash.towers.length >= 2, "crash has towers");
  const tw = crash.towers[0];
  assert.equal(game.blocksAt(tw.x, tw.y, 12), true, "tower body blocks");
  assert.equal(game.blocksAt(crash.start.x, crash.start.y, 12), false, "start is open");
});

test("camera stays locked on the pilot", () => {
  const canvas = mockCanvas(800, 600);
  const win = bootWindow(canvas);
  const { GameMap } = load("map.js", win);
  win.GameMap = GameMap;
  const settings = settingsStub();
  win.GameSettings = settings;
  const { ShooterGame } = load("game.js", win);
  const game = ShooterGame.create(canvas);
  game.resize(400, 300);
  /* Mid-map so the camera is free to centre on the pilot. */
  settings.write({
    suspended: {
      sectorIndex: 0,
      score: 0,
      hp: 5,
      ammo: 40,
      weaponId: "pistol",
      owned: { pistol: true },
      inventory: { R: false, G: false, B: false },
      player: { x: 520, y: 280, facing: 0 },
      enemies: [],
      doorsOpen: [],
      keysTaken: [],
      cratesTaken: [],
      creditsTaken: [],
      cachesTaken: [],
      breached: [],
      breachCharges: 0,
      patchRun: false,
    },
  });
  game.start({ continueRun: true });
  const idle = {
    moveX: 0, moveY: 0, aimX: 0, aimY: 0, hasAim: false,
    shooting: false, autoAim: false, interact: false,
  };
  for (let i = 0; i < 20; i++) game.update(0.016, { ...idle, moveX: 1 });
  const pos = game.getPlayerPos();
  assert.ok(Math.abs(pos.x - 200) < 2, "player stays mid-view x " + pos.x);
  assert.ok(Math.abs(pos.y - 150) < 2, "player stays mid-view y " + pos.y);
  game.render();
  assert.equal(canvas.style.transform || "", "", "camera uses canvas translate, not CSS slide");
});

test("menu backdrop clears the camera slide", () => {
  const canvas = mockCanvas(800, 600);
  const win = bootWindow(canvas);
  const { GameMap } = load("map.js", win);
  win.GameMap = GameMap;
  win.GameSettings = settingsStub();
  const { ShooterGame } = load("game.js", win);
  const game = ShooterGame.create(canvas);
  game.resize(400, 300);
  game.start({});
  canvas.style.transform = "translate3d(0.4px, -0.3px, 0)";
  game.paintMenuBackdrop();
  assert.equal(canvas.style.transform, "");
});

test("mouse aim uses CSS pixels not the backing store", () => {
  const listeners = {};
  const surface = {
    width: 1600,
    height: 1200,
    style: {},
    addEventListener(type, fn) { listeners[type] = fn; },
    removeEventListener() {},
    setPointerCapture() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 };
    },
  };
  const win = {
    document: { documentElement: {} },
    navigator: {},
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    removeEventListener() {},
  };
  load("input.js", win);
  win.GameInput.attach(surface);
  win.GameInput.setAutoAim(false);
  listeners.pointermove({
    clientX: 500,
    clientY: 300,
    pointerType: "mouse",
    pointerId: 1,
    preventDefault() {},
  });
  const state = win.GameInput.getState(400, 300);
  assert.ok(state.hasAim, "aiming");
  assert.ok(state.aimX > 0.95, "aim right in CSS space, got " + state.aimX);
  assert.ok(Math.abs(state.aimY) < 0.1, "no vertical drift, got " + state.aimY);
});

test("HUD gun buttons call setWeapon", () => {
  const canvas = mockCanvas(800, 600);
  const win = bootWindow(canvas);
  const rafQueue = [];
  win.requestAnimationFrame = (fn) => {
    rafQueue.push(fn);
    return rafQueue.length;
  };
  const { GameMap } = load("map.js", win);
  win.GameMap = GameMap;
  win.GameSettings = settingsStub();
  win.GameSettings.getProgress().owned = {
    pistol: true, shotgun: true, smg: true, rifle: false, lance: false,
  };
  win.Theme = {
    apply() {},
    current() { return "system"; },
    setBackground() {},
    paintBackground() {},
    paintModeChrome() {},
    set() {},
  };
  win.GameInput = {
    setAutoAim() {},
    setEnabled() {},
    attach() {},
    preferTouchChrome() { return false; },
    getState() {
      return {
        moveX: 0, moveY: 0, aimX: 0, aimY: 0, hasAim: false, shooting: false,
        touchMode: false,
      };
    },
  };
  win.GameAudio = { unlock() {}, setMuted() {} };
  win.navigator.serviceWorker = undefined;
  load("game.js", win);
  load("app.js", win);
  win.document.getElementById("btn-play").click();
  assert.ok(rafQueue.length >= 1, "play starts the frame loop");
  const first = rafQueue.shift();
  first(16);
  const rack = win.document.getElementById("hud-guns");
  assert.ok(rack._listeners.click && rack._listeners.click.length, "rack click wired");
  assert.match(rack.innerHTML, /data-gun="smg"/);
  rack.click({
    target: {
      getAttribute(k) { return k === "data-gun" ? "smg" : null; },
      parentNode: null,
    },
  });
  rafQueue.length = 0;
  first(32);
  assert.match(rack.innerHTML, /data-gun="smg"[^>]*aria-pressed="true"/);
});
