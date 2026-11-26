// Système de combat (version simple).
//
// - Coup léger : rapide. Coup lourd : lent, plus de dégâts, épuise davantage celui qui le bloque.
// - Parer : maintenir la garde levée bloque tous les coups (cela coûte de l'endurance ;
//   à zéro d'endurance, la garde est brisée).
// - Parade parfaite : lever la garde juste avant l'impact → l'attaquant est déséquilibré.
// - Esquive : un pas rapide, invulnérable un court instant.
// Les directions (L, T, R) ne servent plus qu'à varier les animations.
import * as THREE from 'three';

export const DIRS = ['L', 'T', 'R'];
/** Côté du défenseur où arrive une attaque lancée depuis la direction d. */
export const mirror = (d) => (d === 'L' ? 'R' : d === 'R' ? 'L' : 'T');

export const ATTACKS = {
  light: { windup: 0.42, strike: 0.12, recover: 0.38, cost: 10, damage: 10 },
  heavy: { windup: 0.8, strike: 0.16, recover: 0.6, cost: 20, damage: 22 },
};
export const PARRY_WINDOW = 0.3;    // la garde levée moins de 0,3 s avant l'impact = parade parfaite
const BLOCK_COST = { light: 5, heavy: 15 };
const DODGE = { time: 0.38, invuln: 0.28, distance: 2.4, cost: 12 };
const STAMINA_MAX = 100;
const STAMINA_REGEN = 24;
const STAMINA_DELAY = 0.7;
const EXHAUSTED_UNTIL = 30;

// ---------- Poses (bras de l'épée, buste, bras libre) ----------
// ax/az : rotation de l'épaule, ex : coude, sw : angle de l'épée dans la main,
// sy : rotation du buste, sx : inclinaison du buste
const P = (ax, az, ex, sw, sy = 0, sx = 0) => ({ ax, az, ex, sw, sy, sx });
const GUARD = {
  L: P(-1.0, 0.55, -1.25, 1.25, 0.25),
  T: P(-2.4, 0.3, -0.6, 1.05, 0.05),
  R: P(-1.05, -0.75, -1.2, 1.25, -0.35),
};
const WIND = {
  L: P(-1.6, 1.15, -1.6, 1.55, 0.7),
  T: P(-2.95, 0.2, -1.1, 1.45, 0.0, -0.15),
  R: P(-1.7, -1.1, -1.65, 1.55, -0.7),
};
const STRIKE = {
  L: P(-1.3, -0.7, -0.2, 1.45, -0.6, 0.1),
  T: P(-0.75, 0.05, -0.15, 1.5, 0.0, 0.3),
  R: P(-1.3, 0.8, -0.2, 1.45, 0.6, 0.1),
};
const REST = P(0, 0, -0.3, 0.45, 0, 0);
const READY = GUARD.L;
const BLOCK = P(-1.75, -0.6, -1.15, 1.25, -0.15, -0.05);
const KEYS = ['ax', 'az', 'ex', 'sw', 'sy', 'sx'];

function lerpPose(a, b, t, out = {}) {
  for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeIn = (t) => t * t;

export class Fighter {
  /**
   * h : personnage (createHumanoid), sword : objet épée tenu dans la main droite,
   * opts : { maxHp, speed (multiplicateur de durée des attaques, 1 = normal), damageMul, shield }
   */
  constructor(h, sword, opts = {}) {
    this.h = h;
    this.sword = sword;
    this.swordBase = sword ? sword.rotation.x : 0;
    this.maxHp = opts.maxHp ?? 100;
    this.hp = this.maxHp;
    this.speed = opts.speed ?? 1;
    this.damageMul = opts.damageMul ?? 1;
    this.shield = !!opts.shield;
    this.stamina = STAMINA_MAX;
    this.exhausted = false;
    this.sinceSpend = 99;
    this.guard = 'T';
    this.state = 'guard';
    this.blockHeld = false;   // la touche de parade est maintenue
    this.blockStart = -99;    // moment où la garde a été levée
    this.combo = 0;
    this.stateT = 0;
    this.stateDur = 0;
    this.attack = null;      // { dir, kind, impactDone }
    this.parry = null;       // { dir, until } fenêtre de parade ouverte par un coup lourd
    this.invulnUntil = 0;
    this.dodgeVel = new THREE.Vector3();
    this.time = 0;
    this.pose = { ...GUARD.T };
    this.events = [];
    this.active = false;
  }

  get busy() { return !['guard', 'blockstun'].includes(this.state); }
  get canBlock() { return ['guard', 'blockstun', 'hitstun'].includes(this.state); }
  get attacking() { return ['windup', 'strike'].includes(this.state); }
  get alive() { return this.hp > 0; }
  /** La garde est vraiment levée (on ne peut pas parer en pleine attaque). */
  get isBlocking() { return this.blockHeld && ['guard', 'blockstun'].includes(this.state) && this.alive; }

  setBlocking(on) {
    if (on && !this.blockHeld) this.blockStart = this.time;
    this.blockHeld = on;
  }

  reset() {
    this.hp = this.maxHp;
    this.stamina = STAMINA_MAX;
    this.exhausted = false;
    this.setState('guard');
    this.attack = null;
    this.parry = null;
  }

  setState(s, dur = 0) {
    this.state = s;
    this.stateT = 0;
    this.stateDur = dur;
  }

  spend(n) {
    this.stamina = Math.max(0, this.stamina - n);
    this.sinceSpend = 0;
    if (this.stamina <= 0) this.exhausted = true;
  }

  setGuard(d) {
    if (this.state === 'defeated' || this.state === 'staggered') return;
    if (this.attacking) return; // la direction d'une attaque lancée ne change plus
    this.guard = d;
  }

  /** Lance une attaque ('light' ou 'heavy'). */
  tryAttack(kind) {
    if (this.busy || this.exhausted || !this.alive) return false;
    const a = ATTACKS[kind];
    this.spend(a.cost);
    // Direction de l'animation : les coups légers alternent, les lourds tombent souvent d'en haut
    this.combo++;
    const dir = kind === 'heavy' ? (Math.random() < 0.6 ? 'T' : 'L') : (this.combo % 2 ? 'L' : 'R');
    this.attack = { dir, kind, impactDone: false };
    this.guard = dir;
    this.setState('windup', a.windup * this.speed);
    return true;
  }

  /** Esquive dans une direction (vecteur au sol, normalisé). */
  tryDodge(dir) {
    if (this.busy || this.exhausted || !this.alive) return false;
    this.spend(DODGE.cost);
    this.dodgeVel.copy(dir).multiplyScalar(DODGE.distance / DODGE.time);
    this.invulnUntil = this.time + DODGE.invuln;
    this.setState('dodge', DODGE.time);
    return true;
  }

  /** Parade parfaite : la garde a été levée juste avant l'impact. */
  parries(_dir, parryWindow = PARRY_WINDOW) {
    return this.isBlocking && this.time - this.blockStart <= parryWindow;
  }

  blocks() {
    return this.isBlocking;
  }

  // ---- Réactions ----
  takeHit(damage) {
    this.hp = Math.max(0, this.hp - damage);
    this.attack = null;
    this.parry = null;
    if (this.hp <= 0) this.setState('defeated');
    else this.setState('hitstun', 0.4);
  }
  /** Coup bloqué : coûte de l'endurance. Renvoie true si la garde est brisée. */
  blockedHit(kind = 'light') {
    this.spend(BLOCK_COST[kind] || 8);
    if (this.stamina <= 0) {
      this.setState('staggered', 0.9);
      return true;
    }
    this.setState('blockstun', kind === 'heavy' ? 0.35 : 0.22);
    return false;
  }
  wasBlocked() { this.attack = null; this.setState('recover', 0.45); }
  getParried() {
    this.attack = null;
    this.spend(25);
    this.setState('staggered', 1.15);
  }
  cancelForParry() {
    this.attack = null;
    this.parry = null;
    this.setState('recover', 0.2);
  }

  update(dt) {
    this.time += dt;
    this.stateT += dt;
    this.events.length = 0;

    // Endurance
    this.sinceSpend += dt;
    if (this.sinceSpend > STAMINA_DELAY && !this.attacking) {
      // L'endurance remonte, deux fois moins vite quand on garde la parade levée
      this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN * dt * (this.isBlocking ? 0.5 : 1));
    }
    if (this.exhausted && this.stamina >= EXHAUSTED_UNTIL) this.exhausted = false;

    // Enchaînement des états
    const a = this.attack && ATTACKS[this.attack.kind];
    switch (this.state) {
      case 'windup':
        if (this.stateT >= this.stateDur) {
          this.setState('strike', a.strike * this.speed);
          this.events.push({ type: 'impact', dir: this.attack.dir, kind: this.attack.kind, damage: a.damage * this.damageMul });
        }
        break;
      case 'strike':
        if (this.stateT >= this.stateDur) this.setState('recover', a ? a.recover * this.speed : 0.3);
        break;
      case 'recover': case 'hitstun': case 'blockstun': case 'staggered': case 'dodge':
        if (this.stateT >= this.stateDur) {
          this.attack = null;
          this.parry = null;
          this.setState('guard');
        }
        break;
      default:
    }
    if (this.parry && this.time > this.parry.until && this.state !== 'windup') this.parry = null;
  }

  /** Calcule la pose voulue et l'applique en douceur au personnage. */
  applyPose(dt) {
    const target = {};
    const st = this.state;
    const k = this.stateDur > 0 ? Math.min(1, this.stateT / this.stateDur) : 1;
    const dir = this.attack ? this.attack.dir : this.guard;
    let rate = 14;
    if (st === 'windup') {
      lerpPose(GUARD[dir], WIND[dir], easeOut(k), target);
      if (this.attack && this.attack.kind === 'heavy') target.sx -= 0.08 * k;
      rate = 16;
    } else if (st === 'strike') {
      lerpPose(WIND[dir], STRIKE[dir], easeIn(Math.min(1, k * 1.3)), target);
      rate = 45;
    } else if (st === 'recover') {
      const from = this.attack ? STRIKE[dir] : READY;
      lerpPose(from, READY, easeOut(k), target);
    } else if (st === 'hitstun') {
      Object.assign(target, READY);
      target.sx = -0.35 * (1 - k);
      target.sy += Math.sin(k * 9) * 0.1 * (1 - k);
      rate = 20;
    } else if (st === 'blockstun') {
      Object.assign(target, BLOCK);
      target.sx = -0.15 * (1 - k);
      rate = 25;
    } else if (st === 'staggered') {
      Object.assign(target, P(-0.4, 0.9, -0.4, 1.0, 0.3, -0.35));
      rate = 10;
    } else if (st === 'defeated') {
      Object.assign(target, P(0.05, 0.1, -0.2, 1.4, 0, 0.45));
      rate = 4;
    } else if (!this.active) {
      Object.assign(target, REST);
      rate = 8;
    } else {
      Object.assign(target, this.isBlocking ? BLOCK : READY);
      rate = 18;
    }
    const f = 1 - Math.exp(-dt * rate);
    for (const key of KEYS) this.pose[key] += (target[key] - this.pose[key]) * f;

    const h = this.h, p = this.pose;
    h.armR.rotation.x = p.ax;
    h.armR.rotation.z = p.az;
    h.elbowR.rotation.x = p.ex;
    h.spine.rotation.y = p.sy;
    h.spine.rotation.x = p.sx;
    if (this.sword) this.sword.rotation.x = this.swordBase + p.sw - 0.45;
    // Bras libre : écu levé devant le corps, ou main en soutien
    if (this.active && st !== 'defeated') {
      const up = this.isBlocking || st === 'blockstun';
      h.armL.rotation.x = this.shield ? (up ? -1.25 : -0.55) : -0.7;
      h.armL.rotation.z = this.shield ? 0 : 0.35;
      h.elbowL.rotation.x = this.shield ? (up ? -1.45 : -1.25) : -1.1;
    }
  }
}
