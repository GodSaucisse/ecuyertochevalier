// Le joueur : l'écuyer.
import * as THREE from 'three';
import { createHumanoid, animateWalk, createSword } from './humanoid.js';

const WALK_SPEED = 4.0;
const RUN_SPEED = 7.5;
const GRAVITY = 22;
const JUMP_SPEED = 7.5;
const ATTACK_DURATION = 0.42;

function lerp(a, b, t) { return a + (b - a) * t; }
function easeOut(t) { return 1 - (1 - t) * (1 - t); }

export class Player {
  constructor(scene, world) {
    this.world = world;
    this.h = createHumanoid({ outfit: 'gambeson', trousers: 0x4a4436, hair: 0x6b4423 });
    this.object = this.h.root;
    this.object.position.set(0, 0, 40);
    this.object.rotation.y = Math.PI; // regarde vers le château (au nord)
    scene.add(this.object);

    this.radius = 0.4;
    this.vy = 0;
    this.grounded = true;
    this.phase = 0;
    this.walkAmount = 0;
    this.attackT = -1;
    this.struck = false;
    this.pendingStrike = false;

    // Épée d'entraînement en bois, tenue dans la main droite
    const sword = createSword(true);
    sword.rotation.x = 0.45;
    this.h.handR.add(sword);
  }

  get position() { return this.object.position; }

  /** Direction vers laquelle le personnage regarde (sur le sol). */
  forward(out = new THREE.Vector3()) {
    const r = this.object.rotation.y;
    return out.set(Math.sin(r), 0, Math.cos(r));
  }

  jump() {
    if (this.grounded) { this.vy = JUMP_SPEED; this.grounded = false; }
  }

  startAttack() {
    if (this.attackT < 0) { this.attackT = 0; this.struck = false; }
    else this.queuedAttack = true; // enchaîne le coup suivant dès que possible
  }

  /** Renvoie true une seule fois, au moment où le coup d'épée "touche". */
  consumeStrike() {
    const s = this.pendingStrike;
    this.pendingStrike = false;
    return s;
  }

  update(dt, move, run, yaw) {
    const pos = this.object.position;
    const attacking = this.attackT >= 0;

    // Déplacement relatif à la caméra
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    let dx = -sin * move.y + cos * move.x;
    let dz = -cos * move.y - sin * move.x;
    let len = Math.hypot(dx, dz);
    if (len > 1) { dx /= len; dz /= len; len = 1; }

    const speed = (run ? RUN_SPEED : WALK_SPEED) * (attacking ? 0.35 : 1);
    pos.x += dx * speed * dt;
    pos.z += dz * speed * dt;

    if (len > 0.05) {
      const target = Math.atan2(dx, dz);
      let diff = target - this.object.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.object.rotation.y += diff * Math.min(1, dt * 12);
    }

    // Gravité et saut
    this.vy -= GRAVITY * dt;
    pos.y += this.vy * dt;
    if (pos.y <= 0) { pos.y = 0; this.vy = 0; this.grounded = true; }

    // Collisions avec le décor
    this.world.resolve(pos, this.radius);

    // Animation de marche
    const targetAmount = this.grounded ? len * (run ? 1 : 0.75) : 0;
    this.walkAmount += (targetAmount - this.walkAmount) * Math.min(1, dt * 10);
    this.phase += dt * (run ? 11 : 8) * len;
    animateWalk(this.h, this.phase, this.walkAmount, attacking);
    if (!this.grounded) {
      this.h.legL.rotation.x = -0.5;
      this.h.legR.rotation.x = 0.3;
    }

    // Animation d'attaque (bras droit)
    if (attacking) {
      this.attackT += dt;
      const t = this.attackT;
      // Armer (bras levé, buste tourné) puis frapper en diagonale avec tout le corps
      let a, e, tw;
      if (t < 0.12) {
        const k = t / 0.12;
        a = lerp(0, -2.7, k); e = lerp(-0.3, -1.0, k); tw = lerp(0, 0.55, k);
      } else if (t < 0.28) {
        const k = easeOut((t - 0.12) / 0.16);
        a = lerp(-2.7, -0.35, k); e = lerp(-1.0, -0.1, k); tw = lerp(0.55, -0.6, k);
      } else {
        const k = Math.min(1, (t - 0.28) / 0.14);
        a = lerp(-0.35, 0, k); e = lerp(-0.1, -0.3, k); tw = lerp(-0.6, 0, k);
      }
      this.h.armR.rotation.x = a;
      this.h.elbowR.rotation.x = e;
      this.h.spine.rotation.y = tw;
      this.h.armR.rotation.z = t < 0.28 ? 0.25 : 0;
      if (!this.struck && t >= 0.2) { this.struck = true; this.pendingStrike = true; }
      if (t >= ATTACK_DURATION) {
        this.attackT = -1;
        this.h.armR.rotation.z = 0;
        if (this.queuedAttack) { this.queuedAttack = false; this.startAttack(); }
      }
    }
  }
}
