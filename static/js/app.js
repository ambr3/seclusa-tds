/*
 * Seclusa Lockdown shell — sheets, overlays, rAF loop.
 */

(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var openSheetId = null;
  var game = null;
  var raf = 0;
  var lastTs = 0;
  var looping = false;
  var hudCache = "";

  function syncThemeChrome() {
    if (window.Theme.paintModeChrome) window.Theme.paintModeChrome();
  }

  function showSheet(id) {
    closeSheet();
    openSheetId = id;
    var scrim = $("scrim");
    var sheet = $(id);
    if (scrim) scrim.classList.add("open");
    if (sheet) {
      sheet.classList.add("open");
      sheet.setAttribute("aria-hidden", "false");
    }
    if (id === "sheet-theme") syncThemeChrome();
    if (id === "sheet-settings") syncSettingsChrome();
  }

  function closeSheet() {
    if (openSheetId) {
      var sheet = $(openSheetId);
      if (sheet) {
        sheet.classList.remove("open");
        sheet.setAttribute("aria-hidden", "true");
      }
    }
    openSheetId = null;
    var scrim = $("scrim");
    if (scrim) scrim.classList.remove("open");
  }

  function applyAutoAim(value) {
    var on = window.GameSettings.setAutoAim(value);
    window.GameInput.setAutoAim(on);
    syncSettingsChrome();
    syncControlsBlurb();
    return on;
  }

  function unlockAudio() {
    if (window.GameAudio && window.GameAudio.unlock) window.GameAudio.unlock();
  }

  function applyMuted(value) {
    var on = window.GameSettings.setMuted(value);
    if (!on) unlockAudio();
    syncSettingsChrome();
    return on;
  }

  function syncToggle(id, on) {
    var toggle = $(id);
    if (!toggle) return;
    toggle.setAttribute("aria-checked", on ? "true" : "false");
    toggle.classList.toggle("on", on);
    var label = toggle.querySelector(".toggle-state");
    if (label) label.textContent = on ? "On" : "Off";
  }

  function syncSettingsChrome() {
    syncToggle("opt-auto-aim", window.GameSettings.getAutoAim());
    syncToggle("opt-mute", window.GameSettings.getMuted());
    var diff = window.GameSettings.getDifficulty();
    document.querySelectorAll("[data-diff-opt]").forEach(function (chip) {
      chip.setAttribute("aria-checked", String(chip.getAttribute("data-diff-opt") === diff));
    });
  }

  function syncControlsBlurb() {
    var copy = $("menu-controls");
    if (!copy) return;
    if (window.GameSettings.getAutoAim()) {
      copy.textContent = "WASD move · 1–5 guns · Shift dash · F breach · Space fire · shoot LOOT boxes · P pause";
    } else {
      copy.textContent = "WASD move · mouse aim · 1–5 guns · Shift dash · F breach · click fire · shoot LOOT boxes";
    }
  }

  function syncMenuProgress() {
    var progress = window.GameSettings.getProgress();
    var best = $("menu-best");
    if (best) {
      var scoreLine = progress.bestScore
        ? ("Best score " + progress.bestScore + (progress.cleared ? " · Parts recovered" : ""))
        : "No runs yet — salvage stays on this device.";
      best.textContent = scoreLine + " · v" + BUILD;
    }
    var cont = $("btn-continue");
    if (cont) {
      var suspended = progress.suspended;
      var can = window.GameSettings.canContinue();
      cont.hidden = !can;
      cont.disabled = !can;
      if (suspended) {
        cont.textContent = suspended.patchRun
          ? "Resume — the wreck"
          : ("Resume — Deck " + ((suspended.sectorIndex | 0) + 1));
      } else if (can) {
        cont.textContent = "Continue — Deck " + (progress.unlockedSector + 1);
      }
    }
  }


  function wireTheme() {
    window.Theme.apply(window.Theme.current());
    if (window.Theme.setBackground) window.Theme.setBackground("grid");
    if (window.Theme.paintBackground) window.Theme.paintBackground();
    syncThemeChrome();

    var button = $("btn-theme");
    if (button) {
      button.addEventListener("click", function () { showSheet("sheet-theme"); });
    }

    document.querySelectorAll("[data-theme-opt]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var mode = chip.getAttribute("data-theme-opt");
        if (mode !== "system" && mode !== "light" && mode !== "dark") return;
        window.Theme.set(mode);
        syncThemeChrome();
      });
    });
  }

  function wireSettings() {
    applyAutoAim(window.GameSettings.getAutoAim());
    applyMuted(window.GameSettings.getMuted());
    syncSettingsChrome();

    var btn = $("btn-settings");
    if (btn) {
      btn.addEventListener("click", function () { showSheet("sheet-settings"); });
    }

    var toggle = $("opt-auto-aim");
    if (toggle) {
      toggle.addEventListener("click", function () {
        applyAutoAim(!window.GameSettings.getAutoAim());
      });
    }

    var mute = $("opt-mute");
    if (mute) {
      mute.addEventListener("click", function () {
        applyMuted(!window.GameSettings.getMuted());
      });
    }

    document.querySelectorAll("[data-diff-opt]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        window.GameSettings.setDifficulty(chip.getAttribute("data-diff-opt"));
        syncSettingsChrome();
      });
    });

    var clearBtn = $("btn-clear-progress");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        var ok = window.confirm(
          "Clear best score, continue point, and found guns? Theme and settings stay."
        );
        if (!ok) return;
        window.GameSettings.clearProgress();
        closeSheet();
        if (game && game.isPlaying() && !game.isOver()) {
          if (game.suspend) game.suspend();
          game.stop();
        }
        syncMenuProgress();
        showOverlay("overlay-menu");
        syncPlayHud();
      });
    }
  }


  function wireChrome() {
    var scrim = $("scrim");
    if (scrim) {
      scrim.addEventListener("click", function () {
        closeSheet();
      });
    }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (openSheetId) {
          closeSheet();
          return;
        }
        if (game && game.isPlaying() && !game.isOver()) {
          game.setPaused(!game.isPaused());
        }
      }
    });
  }

  function showOverlay(id) {
    ["overlay-menu", "overlay-over"].forEach(function (oid) {
      var el = $(oid);
      if (!el) return;
      var on = oid === id;
      el.hidden = !on;
      el.classList.toggle("hidden", !on);
    });
    window.GameInput.setEnabled(false);
  }

  function hideOverlays() {
    ["overlay-menu", "overlay-over"].forEach(function (oid) {
      var el = $(oid);
      if (!el) return;
      el.hidden = true;
      el.classList.add("hidden");
    });
    window.GameInput.setEnabled(true);
  }

  function fitCanvas() {
    var stage = $("stage");
    var canvas = $("game");
    if (!stage || !canvas || !game) return;
    var rect = stage.getBoundingClientRect();
    var cssW = Math.max(1, Math.floor(rect.width));
    var cssH = Math.max(1, Math.floor(rect.height));
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    game.resize(cssW, cssH);
  }

  function frame(ts) {
    if (!looping) return;
    var dt = lastTs ? (ts - lastTs) / 1000 : 0;
    lastTs = ts;

    var pos = game.getPlayerPos();
    var input = window.GameInput.getState(pos.x, pos.y);

    if (game.isPlaying()) {
      game.update(dt, input);
    }
    game.render();
    syncPlayHud();
    raf = window.requestAnimationFrame(frame);
  }

  var gunRackHtml = "";
  var gunRackWired = false;
  function syncGunRack(hud) {
    var rack = $("hud-guns");
    if (!rack) return;
    if (!gunRackWired) {
      gunRackWired = true;
      rack.addEventListener("click", function (event) {
        var btn = event.target;
        while (btn && btn !== rack && !(btn.getAttribute && btn.getAttribute("data-gun"))) {
          btn = btn.parentNode;
        }
        if (!btn || btn === rack || !game || !game.setWeapon) return;
        var id = btn.getAttribute("data-gun");
        if (id) game.setWeapon(id);
      });
    }
    var guns = hud.guns || [];
    var html = [];
    var i;
    for (i = 0; i < guns.length; i++) {
      var g = guns[i];
      var locked = !g.owned;
      var cls = "hud-gun" + (g.active && !locked ? " on" : "") + (locked ? " locked" : "");
      html.push(
        '<button type="button" class="' + cls + '" data-gun="' + g.id + '"' +
        (locked ? " disabled" : "") +
        ' aria-pressed="' + (g.active && !locked ? "true" : "false") + '"' +
        ' title="' + (locked ? g.name + " — not found yet" : g.name + " · key " + g.key) + '">' +
        '<span class="hud-gun-key">' + g.key + "</span>" +
        (locked ? "" : '<span class="hud-gun-name">' + g.name + "</span>") +
        "</button>"
      );
    }
    var next = html.join("");
    if (next === gunRackHtml) return;
    gunRackHtml = next;
    rack.innerHTML = next;
  }

  function setHudStat(id, value, low) {
    var el = $(id);
    if (!el) return;
    var b = el.querySelector("b");
    if (b) b.textContent = String(value);
    else el.textContent = String(value);
    el.classList.toggle("is-low", !!low);
  }

  function shortDeck(name) {
    if (!name) return "";
    var m = /^Deck\s+(\d+)/i.exec(name);
    if (m) {
      var rest = name.replace(/^Deck\s+\d+\s*[—–-]\s*/i, "");
      return rest && rest !== name ? ("D" + m[1] + " · " + rest) : ("Deck " + m[1]);
    }
    return name;
  }

  function syncPlayHud() {
    var bar = $("playhud");
    var brand = $("top-brand");
    if (!bar || !game || !game.hudSnapshot) return;
    var menu = $("overlay-menu");
    var menuOpen = menu && !menu.hidden && !menu.classList.contains("hidden");
    var show = game.isPlaying() && !game.isOver() && !menuOpen;
    bar.hidden = !show;
    if (brand) brand.hidden = !!show;
    if (!show) {
      hudCache = "";
      return;
    }
    var hud = game.hudSnapshot();
    var key = [
      hud.score, hud.hp, hud.ammo, hud.deck, hud.gear || "",
      hud.lowHp ? 1 : 0, hud.lowAmmo ? 1 : 0,
      hud.cards.R ? 1 : 0, hud.cards.G ? 1 : 0, hud.cards.B ? 1 : 0,
      (hud.guns || []).map(function (g) {
        return g.id + (g.owned ? (g.active ? "*" : "+") : "-");
      }).join(",")
    ].join("|");
    if (key === hudCache) return;
    hudCache = key;
    setHudStat("hud-score", hud.score, false);
    setHudStat("hud-hp", hud.hp, hud.lowHp);
    setHudStat("hud-ammo", hud.ammo, hud.lowAmmo);
    syncGunRack(hud);
    var deck = $("hud-deck");
    if (deck) {
      deck.textContent = shortDeck(hud.deck);
      deck.title = hud.deck || "";
    }
    ["R", "G", "B"].forEach(function (c) {
      var chip = $("hud-card-" + c);
      if (chip) chip.classList.toggle("on", !!hud.cards[c]);
    });
    var gear = $("hud-gear");
    if (gear) {
      gear.hidden = !hud.gear;
      gear.textContent = hud.gear || "";
    }
  }

  function startLoop() {
    if (looping) return;
    looping = true;
    lastTs = 0;
    raf = window.requestAnimationFrame(frame);
  }

  function stopLoop() {
    looping = false;
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
  }

  function startGame(opts) {
    closeSheet();
    hideOverlays();
    fitCanvas();
    unlockAudio();
    game.start(opts || {});
    startLoop();
  }

  function endGame(score, won) {
    var title = $("over-title");
    var label = $("over-score");
    if (title) title.textContent = won ? "Salvage complete" : "Downed";
    if (label) {
      label.textContent = won
        ? ("Score: " + score + " — hull patched, fortress behind you.")
        : ("Score: " + score);
    }
    syncMenuProgress();
    showOverlay("overlay-over");
    syncPlayHud();
  }

  function goMenu() {
    closeSheet();
    if (game && game.isPlaying() && !game.isOver() && game.suspend) game.suspend();
    else game.stop();
    stopLoop();
    fitCanvas();
    if (game.paintMenuBackdrop) game.paintMenuBackdrop();
    else game.render();
    syncControlsBlurb();
    syncMenuProgress();
    showOverlay("overlay-menu");
    syncPlayHud();
  }

  var BUILD = "0.1.61";

  function registerSw() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", function () {
      var host = location.hostname;
      var local = host === "127.0.0.1" || host === "localhost";
      /* Local preview: drop SW/caches so every refresh actually loads new JS. */
      if (local) {
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          regs.forEach(function (reg) { reg.unregister(); });
        });
        if (window.caches && caches.keys) {
          caches.keys().then(function (keys) {
            keys.forEach(function (key) {
              if (key.indexOf("seclusa-lockdown-") === 0) caches.delete(key);
            });
          });
        }
        return;
      }
      navigator.serviceWorker.register("./sw.js").catch(function () { /* offline first load */ });
    });
  }

  function boot() {
    wireTheme();
    wireSettings();
    wireChrome();

    var canvas = $("game");
    if (!canvas || !window.ShooterGame || !window.GameInput || !window.GameSettings) return;

    game = window.ShooterGame.create(canvas);
    game.setOnOver(endGame);
    window.GameInput.attach(canvas);

    var play = $("btn-play");
    var cont = $("btn-continue");
    var restart = $("btn-restart");
    var menu = $("btn-menu");
    if (play) play.addEventListener("click", function () { startGame({ continueRun: false }); });
    if (cont) cont.addEventListener("click", function () { startGame({ continueRun: true }); });
    if (restart) restart.addEventListener("click", function () { startGame({ continueRun: false }); });
    if (menu) menu.addEventListener("click", goMenu);
    var mainMenu = $("btn-main-menu");
    if (mainMenu) mainMenu.addEventListener("click", goMenu);

    window.addEventListener("resize", function () {
      fitCanvas();
      if (!looping) {
        if (game.paintMenuBackdrop) game.paintMenuBackdrop();
        else game.render();
      }
    });

    fitCanvas();
    if (game.paintMenuBackdrop) game.paintMenuBackdrop();
    syncControlsBlurb();
    syncMenuProgress();
    showOverlay("overlay-menu");
    /* First gesture unlocks Web Audio (browsers start the context suspended). */
    document.addEventListener("pointerdown", unlockAudio, true);
    document.addEventListener("keydown", unlockAudio, true);
    registerSw();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
