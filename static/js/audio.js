/*
 * Tiny Web Audio SFX — no files, no network.
 */

(function () {
  "use strict";

  var ctx = null;
  var muted = false;
  var unlocking = null;

  function ac() {
    if (muted) return null;
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      return ctx;
    } catch (err) {
      return null;
    }
  }

  /* Browsers start AudioContext suspended until a user gesture + resume(). */
  function ensureRunning(thenPlay) {
    var c = ac();
    if (!c) return;
    if (c.state === "running") {
      if (thenPlay) thenPlay(c);
      return;
    }
    if (!unlocking) {
      unlocking = c.resume().then(function () {
        unlocking = null;
      }).catch(function () {
        unlocking = null;
      });
    }
    unlocking.then(function () {
      if (muted || !ctx || ctx.state !== "running") return;
      if (thenPlay) thenPlay(ctx);
    });
  }

  function beep(freq, dur, type, gain) {
    ensureRunning(function (c) {
      var t0 = c.currentTime;
      var amp = gain == null ? 0.04 : gain;
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
      g.gain.setValueAtTime(gain == null ? 0.05 : gain, t0);
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
      var amp = gain == null ? 0.04 : gain;
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

  window.GameAudio = {
    setMuted: function (value) { muted = !!value; },
    isMuted: function () { return muted; },
    unlock: function () {
      ensureRunning(null);
    },
    shoot: function () { beep(420, 0.05, "square", 0.03); },
    shootBolt: function () { beep(380, 0.045, "square", 0.032); },
    shootSpray: function () {
      noiseBurst(0.05, 0.045);
      beep(520, 0.04, "sawtooth", 0.025);
    },
    shootPulse: function () {
      beep(720, 0.035, "sine", 0.04);
      beepAt(540, 0.05, "triangle", 0.02, 0.02);
    },
    shootBeam: function () {
      beep(880, 0.08, "sine", 0.03);
      beepAt(220, 0.1, "triangle", 0.02, 0.02);
    },
    shootLance: function () {
      noiseBurst(0.07, 0.05);
      beep(160, 0.12, "sawtooth", 0.04);
      beepAt(640, 0.06, "square", 0.03, 0.04);
    },
    empty: function () { beep(90, 0.08, "triangle", 0.04); },
    hit: function () { beep(180, 0.07, "sawtooth", 0.035); },
    hurt: function () { beep(110, 0.18, "sawtooth", 0.05); },
    pickup: function () {
      beep(660, 0.09, "sine", 0.045);
      beepAt(880, 0.1, "sine", 0.03, 0.06);
    },
    door: function () {
      beep(240, 0.07, "square", 0.045);
      beepAt(140, 0.16, "triangle", 0.038, 0.05);
      noiseBurst(0.05, 0.03);
    },
    alert: function () { beep(980, 0.04, "square", 0.025); },
    exit: function () {
      beep(400, 0.1, "sine", 0.04);
      beepAt(600, 0.12, "sine", 0.035, 0.08);
    },
    win: function () {
      beep(523, 0.14, "sine", 0.055);
      beepAt(659, 0.16, "sine", 0.05, 0.12);
      beepAt(784, 0.22, "sine", 0.045, 0.26);
      beepAt(1046, 0.28, "sine", 0.04, 0.42);
    },
    thud: function () { noiseBurst(0.06, 0.04); }
  };
})();
