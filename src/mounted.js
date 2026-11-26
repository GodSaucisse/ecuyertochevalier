// Combat à cheval : coups d'épée depuis la selle, mannequins d'entraînement,
// et chevaliers ennemis montés (mêlée du tournoi).
import * as THREE from 'three';
import { createHumanoid, createSword } from './humanoid.js?v=202611261508';
import { Horse } from './horse.js?v=202611261508';
import { playSwing, playHit, playBlock, playHurt } from './audio.js?v=202611261508';

const REACH = 3.1;
const SWING = { light: { dur: 0.5, strike: 0.2, dmg: 10 }, heavy: { dur: 0.85, strike: 0.42, dmg: 19 } };
const lerp = (a, b, t) => a + (b - a) * t;

/** Pose du bras qui frappe (t de 0 à 1 : armer, frapper, revenir). */
function swingArm(h, k, side) {
  let a, z, e;
  if (k < 0.35) { const t = k / 0.35; a = lerp(-0.75, -2.7, t); z = lerp(0, 0.5 * side, t); e = lerp(-0.9, -1.1, t); }
  else if (k < 0.6) { const t = (k - 0.35) / 0.25; a = lerp(-2.7, -0.6, t); z = lerp(0.5 * side, -0.9 * side, t); e = lerp(-1.1, -0.15, t); }
  else { const t = (k - 0.6) / 0.4; a = lerp(-0.6, -0.75, t); z = lerp(-0.9 * side, 0, t); e = lerp(-0.15, -0.9, t); }
  h.armR.rotation.set(a, 0, z);
  h.elbowR.rotation.x = e;
}

/** Bras gauche levé : l'écu protège le cavalier. */
function guardArm(h) {
  h.armL.rotation.set(-1.25, 0, -0.35);
  h.elbowL.rotation.x = -1.4;
}

export class MountedCombat {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.targets = [];
    this.t = -1;
    this.kind = 'light';
    this.struck = false;
    this.armed = false;
    this.blocking = false;
    this.side = 1;
    this.dummies = [];
  }

  /** t : { pos() → Vector3, radius, alive(), hit(dmg, from) } */
  addTarget(t) { this.targets.push(t); return t; }
  removeTarget(t) { const i = this.targets.indexOf(t); if (i >= 0) this.targets.splice(i, 1); }

  swing(kind) {
    if (!this.armed || this.t >= 0) return;
    this.kind = kind;
    this.t = 0;
    this.struck = false;
    playSwing();
  }

  get swinging() { return this.t >= 0; }

  /** À appeler après la pose du cavalier. */
  update(dt, player, horse) {
    const h = player.h;
    if (this.armed) player.sword.visible = true;
    // De quel côté frapper : vers la cible la plus proche
    const p = player.position;
    let best = null, bd = 1e9;
    for (const t of this.targets) {
      if (!t.alive()) continue;
      const d = t.pos().distanceTo(p);
      if (d < bd) { bd = d; best = t; }
    }
    if (this.t >= 0) {
      const S = SWING[this.kind];
      this.t += dt;
      if (best && this.t < 0.05) {
        // Côté de la cible par rapport au cheval
        const f = new THREE.Vector3(Math.sin(horse.heading), 0, Math.cos(horse.heading));
        const to = best.pos().clone().sub(p);
        this.side = f.x * to.z - f.z * to.x > 0 ? -1 : 1;
      }
      swingArm(h, Math.min(1, this.t / S.dur), this.side);
      h.spine.rotation.y = Math.sin(Math.min(1, this.t / S.dur) * Math.PI) * 0.35 * -this.side;
      if (!this.struck && this.t >= S.strike) {
        this.struck = true;
        if (best && bd < REACH + best.radius) {
          const speed = Math.abs(horse.speed);
          const dmg = S.dmg * (0.6 + Math.min(1, speed / 11.5) * 0.8);
          playHit();
          best.hit(dmg, p);
        }
      }
      if (this.t >= S.dur) this.t = -1;
    }
    if (this.blocking && player.fighter.shield) guardArm(h);
    for (const d of this.dummies) d.update(dt);
  }

  /** Mannequins de paille plantés sur des poteaux, pour s'entraîner au galop. */
  addDummies(spots) {
    const straw = new THREE.MeshStandardMaterial({ color: 0xc8a860, roughness: 1 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.85 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x8a2a20, roughness: 0.95 });
    for (const s of spots) {
      const g = new THREE.Group();
      g.position.set(s.x, 0, s.z);
      this.scene.add(g);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.9, 8), wood);
      post.position.y = 0.95;
      post.castShadow = true;
      g.add(post);
      const body = new THREE.Group();
      body.position.y = 1.7;
      g.add(body);
      const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; body.add(o); return o; };
      add(new THREE.CapsuleGeometry(0.24, 0.45, 4, 10), cloth, 0, 0.35, 0);
      add(new THREE.SphereGeometry(0.17, 10, 8), straw, 0, 0.95, 0);
      add(new THREE.BoxGeometry(1.2, 0.1, 0.1), wood, 0, 0.55, 0);
      this.world.circles.push({ x: s.x, z: s.z, r: 0.25, top: 99 });
      const d = {
        g, body, spin: 0, tilt: 0, hits: 0,
        update(dt) {
          d.tilt *= Math.exp(-dt * 3);
          d.spin *= Math.exp(-dt * 2);
          body.rotation.z = d.tilt;
          body.rotation.y += d.spin * dt;
        },
      };
      const center = new THREE.Vector3(s.x, 2, s.z);
      this.addTarget({
        pos: () => center, radius: 0.4, alive: () => true,
        hit: (dmg) => { d.tilt = (Math.random() < 0.5 ? -1 : 1) * Math.min(0.9, dmg / 25); d.spin = dmg * 0.6; d.hits++; if (this.onDummyHit) this.onDummyHit(dmg); },
      });
      this.dummies.push(d);
    }
  }
}

/** Chevalier ennemi à cheval (IA simple : il charge, frappe en passant, fait demi-tour). */
export class EnemyRider {
  constructor(scene, world, { name, arms, coat = 0x3a2a20, blanket, hp = 36, skill = 0.6, speed = 9.5 }) {
    this.name = name;
    this.scene = scene;
    this.horse = new Horse(scene, world, { x: 0, z: 0, rot: 0, coat, blanket: blanket || 0x5a5a5a });
    this.horse.maxSpeed = speed;
    this.h = createHumanoid({ outfit: 'mail', trousers: 0x3a3028, helmet: true, coif: true, shield: true, arms });
    this.sword = createSword(false);
    this.sword.rotation.x = 0.45;
    this.h.handR.add(this.sword);
    scene.add(this.h.root);
    this.maxHp = hp;
    this.skill = skill;
    this.hide();
  }

  place(x, z, rot) {
    const H = this.horse;
    H.position.set(x, 0, z);
    H.object.rotation.y = rot;
    H.speed = 0;
    H.setMounted(true);
    H.object.visible = this.h.root.visible = true;
    this.hp = this.maxHp;
    this.down = false;
    this.fall = 0;
    this.t = -1;
    this.cool = 1 + Math.random() * 1.5;
    this.flinch = 0;
    this.mode = 'charge';
    this.modeT = 0;
    this.h.root.rotation.set(0, 0, 0);
    this.seat();
  }

  hide() {
    this.horse.setMounted(false);
    this.horse.object.visible = this.h.root.visible = false;
    this.horse.circle.top = this.horse.circle2.top = -99;
    this.down = true;
  }

  get position() { return this.horse.position; }

  seat() {
    const s = this.horse.parts.seat.getWorldPosition(new THREE.Vector3());
    this.h.root.position.set(s.x, s.y - 0.9, s.z);
    this.h.root.rotation.y = this.horse.heading;
    this.horse.poseRider(this.h, false);
  }

  /** Touché par le joueur. Renvoie true s'il tombe de cheval. */
  hit(dmg) {
    if (this.down) return false;
    // Il lui arrive de parer avec son écu
    if (this.t < 0 && Math.random() < this.skill * 0.25) { playBlock(); dmg *= 0.3; }
    this.hp -= dmg;
    this.flinch = 0.3;
    if (this.hp <= 0) {
      this.down = true;
      this.fall = 0.001;
      this.mode = 'down';
      return true;
    }
    return false;
  }

  /**
   * ctx : { target (Vector3), onStrike(rider) } — onStrike est appelé au moment où l'épée passe.
   */
  update(dt, ctx) {
    const H = this.horse, p = H.position;
    if (this.mode === 'down') {
      // Désarçonné : le cavalier glisse et tombe, le cheval s'arrête
      H.update(dt, { throttle: 0 });
      if (this.fall > 0 && this.fall < 1) {
        this.fall = Math.min(1, this.fall + dt * 1.6);
        const k = this.fall;
        const r = this.h.root;
        r.rotation.z = -k * Math.PI / 2;
        r.position.y = Math.max(0.15, r.position.y - dt * 4);
      }
      return;
    }
    this.modeT += dt;
    this.cool -= dt;
    const tx = ctx.target.x - p.x, tz = ctx.target.z - p.z, dist = Math.hypot(tx, tz);
    let want = Math.atan2(tx, tz);
    let throttle = 1, gallop = true;
    if (this.mode === 'pass') {
      // Après un passage, il s'éloigne un peu avant de revenir
      want = H.heading;
      if (this.modeT > 1.6) { this.mode = 'charge'; this.modeT = 0; }
    } else if (dist < 3.2 && this.cool <= 0 && this.t < 0) {
      this.t = 0;
      this.struck = false;
      playSwing();
    }
    if (this.mode === 'charge' && dist < 2.2) { this.mode = 'pass'; this.modeT = 0; }
    if (dist < 6) gallop = Math.random() < 0.98;
    const diff = Math.atan2(Math.sin(want - H.heading), Math.cos(want - H.heading));
    if (Math.abs(diff) > 1.6) gallop = false;
    if (this.flinch > 0) { this.flinch -= dt; throttle = 0.4; }
    H.update(dt, { throttle, gallop, turn: THREE.MathUtils.clamp(-diff * 2.2, -1, 1) });
    this.seat();
    // Coup d'épée
    if (this.t >= 0) {
      this.t += dt;
      const k = Math.min(1, this.t / 0.6);
      const to = new THREE.Vector3(ctx.target.x - p.x, 0, ctx.target.z - p.z);
      const side = Math.sin(H.heading) * to.z - Math.cos(H.heading) * to.x > 0 ? -1 : 1;
      swingArm(this.h, k, side);
      if (!this.struck && this.t > 0.26) {
        this.struck = true;
        if (dist < 3.5) ctx.onStrike(this);
      }
      if (k >= 1) { this.t = -1; this.cool = 2.2 + Math.random() * (2.4 - this.skill * 1.5); }
    }
  }
}

export { playHurt };
