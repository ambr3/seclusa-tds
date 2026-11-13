/*
 * Tiny Web Audio SFX — no files, no network.
 *
 * Browsers start AudioContext suspended. iOS / installed PWAs often stay silent
 * after resume() alone, or after returning from background — kick a one-sample
 * buffer inside a real user gesture, and recreate if the context is stuck.
 */

(function () {
  "use strict";

  var ctx = null;
  var muted = false;
  var unlocking = null;
  var needsKick = true;

  function makeContext() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      return new AC();
    } catch (err) {
      return null;
    }
  }

  function ac() {
    if (muted) return null;
    if (ctx && ctx.state === "closed") ctx = null;
    if (!ctx) ctx = makeContext();
    return ctx;
  }

  function kickSilent(c) {
    try {
      var buf = c.createBuffer(1, 1, c.sampleRate || 22050);
      var src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(0);
    } catch (err) {
      /* ignore */
    }
  }

  function markNeedsKick() {
    needsKick = true;
  }

  /* Must run resume + silent buffer on the gesture call stack (not a microtask). */
  function unlockNow() {
    var c = ac();
    if (!c) return null;
    if (c.state === "closed") {
      ctx = makeContext();
      c = ctx;
      if (!c) return null;
    }
    kickSilent(c);
    if (c.state === "running") {
      needsKick = false;
      return Promise.resolve();
    }
    if (!unlocking) {
      unlocking = c.resume().then(function () {
        if (ctx && ctx.state === "running") needsKick = false;
      }).catch(function () {
        /* Still need a gesture. */
      }).then(function () {
        unlocking = null;
      });
    }
    return unlocking;
  }

  function ensureRunning(thenPlay) {
    var c = ac();
    if (!c) return;

    function playIfReady() {
      if (muted || !ctx || ctx.state !== "running") return;
      if (thenPlay) thenPlay(ctx);
    }

    if (c.state === "running" && !needsKick) {
      playIfReady();
      return;
    }

    var wait = unlockNow();
    if (!wait) return;
    wait.then(playIfReady);
  }

  function beep(freq, dur, type, gain) {
    ensureRunning(function (c) {
      var t0 = c.currentTime;
      var amp = gain == null ? 0.07 : gain;
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(amp, t0);
      g.gain.linearRampToValueAtTime(0.0001, t0 + Math.max(0.02, dur));
      osc.connect(g);
      g.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + Math.max(0.02, dur) + 0.03);
    });
  }

  function noiseBurst(dur, gain) {
    ensureRunning(function (c) {
      var n = Math.max(1, Math.floor(c.sampleRate * dur));
      var buf = c.createBuffer(1, n, c.sampleRate);
      var data = buf.getChannelData(0);
      var i;
      for (i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var t0 = c.currentTime;
      var src = c.createBufferSource();
      var g = c.createGain();
      src.buffer = buf;
      g.gain.setValueAtTime(gain == null ? 0.08 : gain, t0);
      g.gain.linearRampToValueAtTime(0.0001, t0 + Math.max(0.02, dur));
      src.connect(g);
      g.connect(c.destination);
      src.start(t0);
    });
  }

  /* Second note on the audio clock — survives tab timing better than setTimeout. */
  function beepAt(freq, dur, type, gain, delay) {
    ensureRunning(function (c) {
      var t0 = c.currentTime + (delay || 0);
      var amp = gain == null ? 0.07 : gain;
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(amp, t0 + 0.005);
      g.gain.linearRampToValueAtTime(0.0001, t0 + Math.max(0.02, dur));
      osc.connect(g);
      g.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + Math.max(0.02, dur) + 0.03);
    });
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) markNeedsKick();
    });
  }
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", markNeedsKick);
    window.addEventListener("pageshow", markNeedsKick);
    window.addEventListener("focus", markNeedsKick);
  }

  window.GameAudio = {
    setMuted: function (value) { muted = !!value; },
    isMuted: function () { return muted; },
    unlock: function () {
      needsKick = true;
      unlockNow();
    },
    shoot: function () { beep(420, 0.05, "square", 0.055); },
    shootBolt: function () { beep(380, 0.045, "square", 0.055); },
    shootSpray: function () {
      noiseBurst(0.05, 0.07);
      beep(520, 0.04, "sawtooth", 0.04);
    },
    shootPulse: function () {
      beep(720, 0.035, "sine", 0.065);
      beepAt(540, 0.05, "triangle", 0.035, 0.02);
    },
    shootBeam: function () {
      beep(880, 0.08, "sine", 0.055);
      beepAt(220, 0.1, "triangle", 0.035, 0.02);
    },
    shootLance: function () {
      noiseBurst(0.07, 0.08);
      beep(160, 0.12, "sawtooth", 0.065);
      beepAt(640, 0.06, "square", 0.05, 0.04);
    },
    empty: function () { beep(90, 0.08, "triangle", 0.065); },
    hit: function () { beep(180, 0.07, "sawtooth", 0.06); },
    hurt: function () { beep(110, 0.18, "sawtooth", 0.08); },
    pickup: function () {
      beep(660, 0.09, "sine", 0.07);
      beepAt(880, 0.1, "sine", 0.05, 0.06);
    },
    door: function () {
      beep(240, 0.07, "square", 0.07);
      beepAt(140, 0.16, "triangle", 0.06, 0.05);
      noiseBurst(0.05, 0.05);
    },
    alert: function () { beep(980, 0.04, "square", 0.045); },
    exit: function () {
      beep(400, 0.1, "sine", 0.065);
      beepAt(600, 0.12, "sine", 0.055, 0.08);
    },
    win: function () {
      beep(523, 0.14, "sine", 0.08);
      beepAt(659, 0.16, "sine", 0.07, 0.12);
      beepAt(784, 0.22, "sine", 0.065, 0.26);
      beepAt(1046, 0.28, "sine", 0.06, 0.42);
    },
    thud: function () { noiseBurst(0.06, 0.065); }
  };
})();
