/*
 * Tiny Web Audio SFX — no files, no network.
 */

(function () {
  "use strict";

  var ctx = null;
  var muted = false;

  function ac() {
    if (muted) return null;
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch (err) {
      return null;
    }
  }

  function beep(freq, dur, type, gain) {
    var c = ac();
    if (!c) return;
    var t0 = c.currentTime;
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain == null ? 0.04 : gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur, gain) {
    var c = ac();
    if (!c) return;
    var n = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, n, c.sampleRate);
    var data = buf.getChannelData(0);
    var i;
    for (i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = c.createBufferSource();
    var g = c.createGain();
    src.buffer = buf;
    g.gain.value = gain == null ? 0.05 : gain;
    src.connect(g);
    g.connect(c.destination);
    src.start();
  }

  function dual(aFreq, aDur, bFreq, bDur, type, gain) {
    beep(aFreq, aDur, type || "square", gain == null ? 0.035 : gain);
    setTimeout(function () {
      beep(bFreq, bDur, type || "square", (gain == null ? 0.035 : gain) * 0.85);
    }, Math.floor(aDur * 400));
  }

  window.GameAudio = {
    setMuted: function (value) { muted = !!value; },
    isMuted: function () { return muted; },
    unlock: function () { ac(); },
    shoot: function () { beep(420, 0.05, "square", 0.03); },
    shootBolt: function () { beep(380, 0.045, "square", 0.032); },
    shootSpray: function () {
      noiseBurst(0.05, 0.045);
      beep(520, 0.04, "sawtooth", 0.025);
    },
    shootPulse: function () { beep(720, 0.035, "sine", 0.04); beep(540, 0.05, "triangle", 0.02); },
    shootBeam: function () { beep(880, 0.08, "sine", 0.03); beep(220, 0.1, "triangle", 0.02); },
    shootLance: function () {
      noiseBurst(0.07, 0.05);
      beep(160, 0.12, "sawtooth", 0.04);
      beep(640, 0.06, "square", 0.03);
    },
    empty: function () { beep(90, 0.08, "triangle", 0.04); },
    hit: function () { beep(180, 0.07, "sawtooth", 0.035); },
    hurt: function () { beep(110, 0.18, "sawtooth", 0.05); },
    pickup: function () { beep(660, 0.09, "sine", 0.045); beep(880, 0.1, "sine", 0.03); },
    door: function () { dual(240, 0.07, 140, 0.16, "square", 0.045); noiseBurst(0.05, 0.03); },
    alert: function () { beep(980, 0.04, "square", 0.025); },
    exit: function () { beep(400, 0.1, "sine", 0.04); beep(600, 0.12, "sine", 0.035); },
    win: function () {
      beep(523, 0.14, "sine", 0.055);
      setTimeout(function () { beep(659, 0.16, "sine", 0.05); }, 120);
      setTimeout(function () { beep(784, 0.22, "sine", 0.045); }, 260);
      setTimeout(function () { beep(1046, 0.28, "sine", 0.04); }, 420);
    },
    thud: function () { noiseBurst(0.06, 0.04); }
  };
})();
