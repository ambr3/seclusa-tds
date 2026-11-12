/*
 * Movement + optional manual aim.
 * Auto-aim mode: WASD/arrows or one stick; Space / FIRE pad to shoot.
 * Manual mode: mouse or right stick aims; click / Space / aim-stick to shoot.
 * Touch: left = move, bottom-right = FIRE / USE / DASH action pads.
 */

(function () {
  "use strict";

  var keys = Object.create(null);
  var pressed = Object.create(null);
  var mouse = { x: 0, y: 0, down: false, inside: false };
  var moveStick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, dx: 0, dy: 0 };
  var aimStick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, dx: 0, dy: 0 };
  var firePad = { active: false, id: null };
  var usePad = { active: false, id: null };
  var dashPad = { active: false, id: null, armed: false };
  var touchMode = false;
  var surface = null;
  var maxRadius = 64;
  var enabled = true;
  var autoAim = true;
  var dashTap = false;

  function touchRadius() {
    return preferTouchChrome() || touchMode ? 78 : 64;
  }

  function clampStick(stick) {
    var radius = touchRadius();
    var dx = stick.x - stick.ox;
    var dy = stick.y - stick.oy;
    var len = Math.hypot(dx, dy);
    if (len > radius && len > 0) {
      dx = (dx / len) * radius;
      dy = (dy / len) * radius;
      stick.x = stick.ox + dx;
      stick.y = stick.oy + dy;
      len = radius;
    }
    var dead = preferTouchChrome() || touchMode ? 6 : 10;
    if (len < dead) {
      stick.dx = 0;
      stick.dy = 0;
    } else {
      var t = (len - dead) / Math.max(1, radius - dead);
      if (t > 1) t = 1;
      stick.dx = (dx / len) * t;
      stick.dy = (dy / len) * t;
    }
  }

  function resetStick(stick) {
    stick.active = false;
    stick.id = null;
    stick.dx = 0;
    stick.dy = 0;
  }

  function localPoint(event) {
    /* CSS / logical pixels — same space as getPlayerPos() and the game view.
       Use the stage (parent), not the canvas rect: the canvas CSS-slides by a
       sub-pixel for smooth camera, which would skew getBoundingClientRect. */
    var box = surface.parentElement || surface;
    var rect = box.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      w: Math.max(1, rect.width),
      h: Math.max(1, rect.height)
    };
  }

  function padLayout(p) {
    var m = Math.min(p.w, p.h);
    var fireR = Math.max(52, Math.min(72, m * 0.11));
    var smallR = fireR * 0.72;
    var fire = { cx: p.w - fireR - 18, cy: p.h - fireR - 18, r: fireR };
    var use = { cx: fire.cx - fireR - smallR - 10, cy: fire.cy + 4, r: smallR };
    var dash = { cx: fire.cx, cy: fire.cy - fireR - smallR - 8, r: smallR * 0.92 };
    return { fire: fire, use: use, dash: dash };
  }

  function inCircle(p, pad) {
    return Math.hypot(p.x - pad.cx, p.y - pad.cy) <= pad.r + 6;
  }

  function isTouchLike(event) {
    return event.pointerType === "touch" || event.pointerType === "pen";
  }

  function onKeyDown(event) {
    var code = event.code;
    if (
      code === "KeyW" || code === "KeyA" || code === "KeyS" || code === "KeyD" ||
      code === "ArrowUp" || code === "ArrowDown" || code === "ArrowLeft" || code === "ArrowRight" ||
      code === "Space" || code === "KeyE" || code === "KeyP" || code === "KeyF" ||
      code === "ShiftLeft" || code === "ShiftRight" ||
      code === "Digit1" || code === "Digit2" || code === "Digit3" || code === "Digit4" ||
      code === "Numpad1" || code === "Numpad2" || code === "Numpad3" || code === "Numpad4"
    ) {
      event.preventDefault();
    }
    if (!keys[code]) pressed[code] = true;
    keys[code] = true;
  }

  function onKeyUp(event) {
    keys[event.code] = false;
  }

  function consume(code) {
    if (!pressed[code]) return false;
    delete pressed[code];
    return true;
  }

  function startStick(stick, event, p) {
    if (stick.active) return false;
    stick.active = true;
    stick.id = event.pointerId;
    /* Keep move stick on the left half so thumbs do not cover the fire pads. */
    var ox = p.x;
    var oy = p.y;
    if (stick === moveStick) {
      ox = Math.min(ox, p.w * 0.48);
      oy = Math.max(oy, p.h * 0.35);
    }
    stick.ox = ox;
    stick.oy = oy;
    stick.x = p.x;
    stick.y = p.y;
    stick.dx = 0;
    stick.dy = 0;
    clampStick(stick);
    try { surface.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }
    return true;
  }

  function capturePad(pad, event) {
    pad.active = true;
    pad.id = event.pointerId;
    try { surface.setPointerCapture(event.pointerId); } catch (err) { /* ignore */ }
  }

  function onPointerDown(event) {
    if (!surface || !enabled) return;
    var p = localPoint(event);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.inside = true;

    if (isTouchLike(event)) {
      touchMode = true;
      maxRadius = touchRadius();
      event.preventDefault();
      var pads = padLayout(p);

      if (autoAim) {
        if (inCircle(p, pads.fire) && !firePad.active) {
          capturePad(firePad, event);
          return;
        }
        if (inCircle(p, pads.use) && !usePad.active) {
          capturePad(usePad, event);
          return;
        }
        if (inCircle(p, pads.dash) && !dashPad.active) {
          capturePad(dashPad, event);
          dashTap = true;
          return;
        }
        /* Any non-pad tap starts move (avoids dead zone beside FIRE). */
        startStick(moveStick, event, p);
        return;
      }

      /* Manual: left move, right aim/fire — still honour USE/DASH on the right. */
      if (inCircle(p, pads.use) && !usePad.active) {
        capturePad(usePad, event);
        return;
      }
      if (inCircle(p, pads.dash) && !dashPad.active) {
        capturePad(dashPad, event);
        dashTap = true;
        return;
      }
      if (p.x < p.w * 0.5) startStick(moveStick, event, p);
      else startStick(aimStick, event, p);
      return;
    }

    mouse.down = true;
  }

  function onPointerMove(event) {
    if (!surface) return;
    var p = localPoint(event);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.inside = true;

    if (moveStick.active && moveStick.id === event.pointerId) {
      event.preventDefault();
      moveStick.x = p.x;
      moveStick.y = p.y;
      clampStick(moveStick);
      return;
    }
    if (aimStick.active && aimStick.id === event.pointerId) {
      event.preventDefault();
      aimStick.x = p.x;
      aimStick.y = p.y;
      clampStick(aimStick);
    }
  }

  function clearPad(pad, event) {
    if (pad.active && pad.id === event.pointerId) {
      pad.active = false;
      pad.id = null;
      return true;
    }
    return false;
  }

  function onPointerUp(event) {
    if (!surface) return;
    if (clearPad(firePad, event)) return;
    if (clearPad(usePad, event)) return;
    if (clearPad(dashPad, event)) return;
    if (moveStick.active && moveStick.id === event.pointerId) {
      resetStick(moveStick);
      return;
    }
    if (aimStick.active && aimStick.id === event.pointerId) {
      resetStick(aimStick);
      return;
    }
    if (event.pointerType === "mouse" || event.pointerType === "") {
      mouse.down = false;
    }
  }

  function onPointerLeave(event) {
    if (event.pointerType === "mouse") {
      mouse.inside = false;
      mouse.down = false;
    }
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  function keyboardMove() {
    var x = 0;
    var y = 0;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    if (keys.KeyW || keys.ArrowUp) y -= 1;
    if (keys.KeyS || keys.ArrowDown) y += 1;
    var len = Math.hypot(x, y);
    if (len > 0) {
      x /= len;
      y /= len;
    }
    return { x: x, y: y };
  }

  function attach(el) {
    detach();
    surface = el;
    maxRadius = touchRadius();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    surface.addEventListener("pointerdown", onPointerDown);
    surface.addEventListener("pointermove", onPointerMove);
    surface.addEventListener("pointerup", onPointerUp);
    surface.addEventListener("pointercancel", onPointerUp);
    surface.addEventListener("pointerleave", onPointerLeave);
    surface.addEventListener("contextmenu", onContextMenu);
  }

  function detach() {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    if (surface) {
      surface.removeEventListener("pointerdown", onPointerDown);
      surface.removeEventListener("pointermove", onPointerMove);
      surface.removeEventListener("pointerup", onPointerUp);
      surface.removeEventListener("pointercancel", onPointerUp);
      surface.removeEventListener("pointerleave", onPointerLeave);
      surface.removeEventListener("contextmenu", onContextMenu);
    }
    surface = null;
    resetStick(moveStick);
    resetStick(aimStick);
    firePad.active = false;
    firePad.id = null;
    usePad.active = false;
    usePad.id = null;
    dashPad.active = false;
    dashPad.id = null;
    dashTap = false;
    mouse.down = false;
    keys = Object.create(null);
  }

  /** @param {number} [playerX] screen-space player x (manual mouse aim)
   *  @param {number} [playerY] screen-space player y */
  function getState(playerX, playerY) {
    maxRadius = touchRadius();
    var move = keyboardMove();
    if (moveStick.active) {
      move = { x: moveStick.dx, y: moveStick.dy };
    }

    var aimX = 0;
    var aimY = 0;
    var hasAim = false;
    var shooting = !!keys.Space || firePad.active;

    if (!autoAim) {
      if (aimStick.active) {
        var alen = Math.hypot(aimStick.dx, aimStick.dy);
        if (alen > 0.12) {
          aimX = aimStick.dx;
          aimY = aimStick.dy;
          hasAim = true;
          shooting = true;
        }
      } else if (mouse.inside || mouse.down) {
        var px = playerX == null ? 0 : playerX;
        var py = playerY == null ? 0 : playerY;
        aimX = mouse.x - px;
        aimY = mouse.y - py;
        var mlen = Math.hypot(aimX, aimY);
        if (mlen > 0.001) {
          aimX /= mlen;
          aimY /= mlen;
          hasAim = true;
        }
        if (mouse.down) shooting = true;
      }
    }

    var interact = consume("KeyE");
    var interactHeld = !!keys.KeyE || usePad.active;
    if (usePad.active) interact = true;
    var dash = consume("ShiftLeft") || consume("ShiftRight");
    if (dashTap) {
      dash = true;
      dashTap = false;
    }
    var breach = consume("KeyF");
    var pause = consume("KeyP");
    var weapon1 = consume("Digit1") || consume("Numpad1");
    var weapon2 = consume("Digit2") || consume("Numpad2");
    var weapon3 = consume("Digit3") || consume("Numpad3");
    var weapon4 = consume("Digit4") || consume("Numpad4");
    var weapon5 = consume("Digit5") || consume("Numpad5");

    var pads = null;
    if (surface && surface.parentElement) {
      var box = surface.parentElement.getBoundingClientRect();
      pads = padLayout({ x: 0, y: 0, w: box.width, h: box.height });
    }

    return {
      moveX: move.x,
      moveY: move.y,
      aimX: aimX,
      aimY: aimY,
      hasAim: hasAim,
      shooting: shooting,
      autoAim: autoAim,
      interact: interact,
      interactHeld: interactHeld,
      dash: dash,
      breach: breach,
      pause: pause,
      weapon1: weapon1,
      weapon2: weapon2,
      weapon3: weapon3,
      weapon4: weapon4,
      weapon5: weapon5,
      touchMode: touchMode || moveStick.active || aimStick.active || firePad.active || usePad.active || dashPad.active,
      moveStick: {
        active: moveStick.active,
        ox: moveStick.ox,
        oy: moveStick.oy,
        x: moveStick.x,
        y: moveStick.y
      },
      aimStick: {
        active: aimStick.active,
        ox: aimStick.ox,
        oy: aimStick.oy,
        x: aimStick.x,
        y: aimStick.y
      },
      firePadActive: firePad.active,
      usePadActive: usePad.active,
      dashPadActive: dashPad.active,
      pads: pads,
      stickRadius: maxRadius
    };
  }

  function preferTouchChrome() {
    try {
      return !!(window.matchMedia && (
        window.matchMedia("(pointer: coarse)").matches ||
        window.matchMedia("(hover: none)").matches
      ));
    } catch (err) {
      return false;
    }
  }

  window.GameInput = {
    attach: attach,
    detach: detach,
    getState: getState,
    preferTouchChrome: preferTouchChrome,
    padLayout: function (width, height) {
      return padLayout({ x: 0, y: 0, w: width, h: height });
    },
    setEnabled: function (value) { enabled = !!value; },
    setAutoAim: function (value) {
      autoAim = !!value;
      resetStick(aimStick);
      firePad.active = false;
      firePad.id = null;
      usePad.active = false;
      usePad.id = null;
      dashPad.active = false;
      dashPad.id = null;
    },
    getAutoAim: function () { return autoAim; },
    markTouch: function () { touchMode = true; maxRadius = touchRadius(); }
  };
})();
