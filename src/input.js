// Commandes : clavier, souris et écran tactile.
// Les touches sont lues par leur position physique (e.code) : Z Q S D sur
// un clavier AZERTY et W A S D sur un clavier QWERTY fonctionnent tous les deux.

export class Input {
  constructor(canvas, isTouch) {
    this.canvas = canvas;
    this.isTouch = isTouch;
    this.enabled = false;
    this.keys = new Set();
    this.joy = { x: 0, y: 0 };
    this.look = { dx: 0, dy: 0 };
    this.zoom = 0;
    this.actions = { interact: false, attack: false, jump: false, heavy: false, guard: null, target: false, map: false, pause: false, bow: false };
    this.sens = 1;
    this.locked = false;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === 'Space') this.actions.jump = true;
      if (e.code === 'KeyE' || e.code === 'Enter') this.actions.interact = true;
      if (e.code === 'KeyF') this.actions.attack = true;
      if (e.code === 'KeyR') this.actions.heavy = true;
      if (e.code === 'Tab') this.actions.target = true;
      if (e.code === 'KeyM') this.actions.map = true;
      if (e.code === 'KeyB') this.actions.bow = true;
      if (e.code === 'Escape' || e.code === 'KeyP') this.actions.pause = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // Souris : clic pour capturer le pointeur, puis la souris oriente la caméra
    let dragging = false;
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled || this.isTouch) return;
      if (this.locked) {
        if (e.button === 0) this.actions.attack = true;
        if (e.button === 2) this.actions.heavy = true;
      } else {
        dragging = true;
        try {
          const p = canvas.requestPointerLock();
          if (p && p.catch) p.catch(() => {});
        } catch (_) { /* pointeur non capturable : on garde le glisser */ }
      }
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked || dragging) {
        this.look.dx += e.movementX;
        this.look.dy += e.movementY;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('wheel', (e) => {
      this.zoom += e.deltaY;
      e.preventDefault();
    }, { passive: false });

    if (isTouch) this.setupTouch();
  }

  setupTouch() {
    const left = document.getElementById('touch-left');
    const right = document.getElementById('touch-right');
    const base = document.getElementById('joy-base');
    const knob = document.getElementById('joy-knob');
    const RADIUS = 55;
    let joyId = null, ox = 0, oy = 0;

    left.addEventListener('pointerdown', (e) => {
      if (joyId !== null) return;
      joyId = e.pointerId; ox = e.clientX; oy = e.clientY;
      base.style.left = ox + 'px'; base.style.top = oy + 'px';
      base.classList.remove('hidden');
      knob.style.transform = 'translate(0px, 0px)';
      left.setPointerCapture(e.pointerId);
    });
    left.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyId) return;
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const d = Math.hypot(dx, dy);
      if (d > RADIUS) { dx *= RADIUS / d; dy *= RADIUS / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.x = dx / RADIUS;
      this.joy.y = -dy / RADIUS;
    });
    const endJoy = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null; this.joy.x = 0; this.joy.y = 0;
      base.classList.add('hidden');
    };
    left.addEventListener('pointerup', endJoy);
    left.addEventListener('pointercancel', endJoy);

    let lookId = null, lx = 0, ly = 0;
    right.addEventListener('pointerdown', (e) => {
      if (lookId !== null) return;
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
      right.setPointerCapture(e.pointerId);
    });
    right.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return;
      this.look.dx += (e.clientX - lx) * 1.8;
      this.look.dy += (e.clientY - ly) * 1.8;
      lx = e.clientX; ly = e.clientY;
    });
    const endLook = (e) => { if (e.pointerId === lookId) lookId = null; };
    right.addEventListener('pointerup', endLook);
    right.addEventListener('pointercancel', endLook);

    const bind = (id, action) => {
      document.getElementById(id).addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.actions[action] = true;
      });
    };
    bind('btn-attack', 'attack');
    bind('btn-jump', 'jump');
    bind('btn-talk', 'interact');
    bind('btn-heavy', 'heavy');
    bind('btn-dodge', 'jump');
    bind('btn-target', 'target');
    bind('btn-bow', 'bow');
    // Parer : bouton à maintenir
    const blockBtn = document.getElementById('btn-block');
    blockBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.touchBlock = true; blockBtn.setPointerCapture(e.pointerId); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) blockBtn.addEventListener(ev, () => { this.touchBlock = false; });
  }

  /** Direction de déplacement : x = droite/gauche, y = avant/arrière. */
  get move() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    const len = Math.hypot(x, y);
    if (len > 0) return { x: x / len, y: y / len };
    const jl = Math.hypot(this.joy.x, this.joy.y);
    if (jl > 0.15) return { x: this.joy.x, y: this.joy.y };
    return { x: 0, y: 0 };
  }

  /** Parade maintenue (E ou Maj, ou bouton 🛡 sur mobile). */
  get blockHeld() {
    return this.keys.has('KeyE') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || !!this.touchBlock;
  }

  get run() {
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) return true;
    return Math.hypot(this.joy.x, this.joy.y) > 0.9;
  }

  consumeActions() {
    const a = { ...this.actions };
    this.actions.interact = this.actions.attack = this.actions.jump = this.actions.heavy = false;
    this.actions.target = this.actions.map = this.actions.pause = this.actions.bow = false;
    this.actions.guard = null;
    return a;
  }

  consumeLook() {
    const l = { dx: this.look.dx * this.sens, dy: this.look.dy * this.sens, zoom: this.zoom };
    this.look.dx = this.look.dy = 0;
    this.zoom = 0;
    return l;
  }
}
