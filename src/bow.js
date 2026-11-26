// L'arc : visée par-dessus l'épaule, flèches soumises à la pesanteur, cibles notées et gibier.
import * as THREE from 'three';
import { playSwing, playHit } from './audio.js?v=202611261414';

const SPEED = 42;      // vitesse d'une flèche (m/s)
const GRAVITY = 9.8;
const COOLDOWN = 0.75; // temps pour encocher une nouvelle flèche

function arrowMesh() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xa47548, roughness: 0.8 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.75, 5).rotateX(Math.PI / 2), wood);
  g.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 4).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a8e94, metalness: 1, roughness: 0.4 }));
  tip.position.z = 0.4;
  g.add(tip);
  const feather = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, side: THREE.DoubleSide });
  for (const r of [0, Math.PI / 2]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.12), feather);
    f.position.z = -0.32;
    f.rotation.set(Math.PI / 2, 0, r);
    g.add(f);
  }
  g.traverse((m) => { m.castShadow = true; });
  return g;
}

/** Arc tenu dans la main gauche (corde verticale). */
function bowMesh() {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16 - 0.5) * 2.2;
    pts.push(new THREE.Vector3(0, Math.sin(a) * 0.62, Math.cos(a) * 0.18 - 0.1));
  }
  const limb = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.016, 6), new THREE.MeshStandardMaterial({ color: 0x6a4424, roughness: 0.7 }));
  limb.castShadow = true;
  g.add(limb);
  const top = pts[0], bot = pts[pts.length - 1];
  const stringGeo = new THREE.BufferGeometry().setFromPoints([top, new THREE.Vector3(0, 0, top.z - 0.02), bot]);
  const string = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: 0xddd6c4 }));
  g.add(string);
  g.userData.string = string;
  g.userData.top = top;
  g.userData.bot = bot;
  return g;
}

export class BowSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.arrows = [];
    this.targets = [];
    this.aiming = false;
    this.cool = 0;
    this.draw = 0;
    this.bow = bowMesh();
    this.bow.visible = false;
    this.ray = new THREE.Ray();
    this.onShot = null;
  }

  /** Cible ronde (paille peinte) : center, normal (vers le tireur), radius, onHit(score, point). */
  addRing(center, normal, radius, onHit) { this.targets.push({ type: 'ring', center, normal: normal.clone().normalize(), radius, onHit }); }
  /** Cible ronde mobile (gibier) : getCenter(), radius, alive(), onHit(point). */
  addSphere(getCenter, radius, alive, onHit) { this.targets.push({ type: 'sphere', getCenter, radius, alive, onHit }); }

  /** Met l'arc en main (ou le range). */
  setAiming(on, player) {
    if (on === this.aiming) return;
    this.aiming = on;
    if (on) {
      player.h.handL.add(this.bow);
      this.bow.position.set(0, -0.06, 0);
      this.bow.rotation.set(Math.PI / 2, 0, 0.12); // arc vertical, le ventre vers la cible
      this.bow.scale.setScalar(0.85);
      this.bow.visible = true;
      player.sword.visible = false;
    } else {
      this.bow.visible = false;
      if (this.bow.parent) this.bow.parent.remove(this.bow);
      player.sword.visible = true;
      player.h.armL.rotation.set(0, 0, 0);
      player.h.armR.rotation.set(0, 0, 0);
      player.h.spine.rotation.set(0, 0, 0);
    }
  }

  /** Pose de tir (après l'animation de marche). */
  applyPose(h, camPitch) {
    const k = this.draw;
    const tilt = THREE.MathUtils.clamp(-camPitch * 0.8, -0.6, 0.6);
    h.armL.rotation.set(-1.55 + tilt, 0, 0.1);
    h.elbowL.rotation.x = -0.05;
    h.armR.rotation.set(-1.45 + tilt, 0, -0.35 - k * 0.2);
    h.elbowR.rotation.x = -1.6 - k * 0.6;
    h.spine.rotation.y = 0.15;
    // La corde se tend
    const s = this.bow.userData;
    const pos = s.string.geometry.attributes.position;
    pos.setXYZ(1, 0, 0, s.top.z - 0.02 - k * 0.32);
    pos.needsUpdate = true;
  }

  /**
   * Tire une flèche vers ce que vise la caméra.
   * origin : point de départ (main), camera : caméra du jeu.
   */
  shoot(origin, camera) {
    if (this.cool > 0) return false;
    this.cool = COOLDOWN;
    this.draw = 0;
    // Le point visé : là où le regard de la caméra rencontre une cible, le sol, ou au loin
    camera.getWorldDirection(this.ray.direction);
    this.ray.origin.copy(camera.position);
    let t = 70;
    const tmp = new THREE.Vector3();
    for (const tg of this.targets) {
      if (tg.type === 'ring') {
        const denom = tg.normal.dot(this.ray.direction);
        if (Math.abs(denom) < 1e-4) continue;
        const d = tmp.copy(tg.center).sub(this.ray.origin).dot(tg.normal) / denom;
        if (d > 0 && d < t) {
          this.ray.at(d, tmp);
          if (tmp.distanceTo(tg.center) < tg.radius * 2) t = d;
        }
      } else if (tg.alive()) {
        const c = tg.getCenter();
        const d = this.ray.distanceSqToPoint(c);
        if (d < (tg.radius * 1.5) ** 2) {
          const along = tmp.copy(c).sub(this.ray.origin).dot(this.ray.direction);
          if (along > 0 && along < t) t = along;
        }
      }
    }
    if (this.ray.direction.y < -0.01) t = Math.min(t, -this.ray.origin.y / this.ray.direction.y);
    const aim = this.ray.at(t, new THREE.Vector3());
    // Vitesse initiale qui compense la chute de la flèche
    const dir = aim.clone().sub(origin);
    const dist = dir.length();
    dir.normalize();
    const vel = dir.multiplyScalar(SPEED);
    vel.y += 0.5 * GRAVITY * (dist / SPEED);
    const mesh = arrowMesh();
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.arrows.push({ mesh, vel, pos: origin.clone(), stuck: false, life: 25 });
    if (this.arrows.length > 24) {
      const old = this.arrows.shift();
      this.scene.remove(old.mesh);
    }
    playSwing();
    if (this.onShot) this.onShot();
    return true;
  }

  update(dt) {
    this.cool = Math.max(0, this.cool - dt);
    if (this.aiming) this.draw = Math.min(1, this.draw + dt * 2.5);
    const prev = new THREE.Vector3(), seg = new THREE.Vector3(), tmp = new THREE.Vector3();
    for (const a of this.arrows) {
      a.life -= dt;
      if (a.stuck) continue;
      prev.copy(a.pos);
      a.vel.y -= GRAVITY * dt;
      a.pos.addScaledVector(a.vel, dt);
      seg.copy(a.pos).sub(prev);
      let hit = false;
      for (const tg of this.targets) {
        if (tg.type === 'ring') {
          const d0 = tmp.copy(prev).sub(tg.center).dot(tg.normal);
          const d1 = tmp.copy(a.pos).sub(tg.center).dot(tg.normal);
          if (d0 > 0 && d1 <= 0) {
            const k = d0 / (d0 - d1);
            const p = prev.clone().addScaledVector(seg, k);
            const r = p.distanceTo(tg.center);
            if (r < tg.radius) {
              a.pos.copy(p);
              const score = Math.max(1, 10 - Math.floor((r / tg.radius) * 10));
              playHit();
              tg.onHit(score, p);
              hit = true;
              break;
            }
          }
        } else if (tg.alive()) {
          const c = tg.getCenter();
          const len2 = seg.lengthSq() || 1e-6;
          const k = THREE.MathUtils.clamp(tmp.copy(c).sub(prev).dot(seg) / len2, 0, 1);
          const p = prev.clone().addScaledVector(seg, k);
          if (p.distanceTo(c) < tg.radius) {
            a.pos.copy(p);
            playHit();
            tg.onHit(p);
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        if (a.pos.y <= 0.02) { a.pos.y = 0.02; hit = true; }
        else {
          for (const b of this.world.boxes) {
            if (a.pos.y < b.top && a.pos.x > b.minX && a.pos.x < b.maxX && a.pos.z > b.minZ && a.pos.z < b.maxZ) { hit = true; break; }
          }
        }
      }
      a.mesh.position.copy(a.pos);
      a.mesh.lookAt(tmp.copy(a.pos).add(a.vel));
      if (hit) a.stuck = true;
    }
    // Les vieilles flèches disparaissent
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      if (this.arrows[i].life <= 0) { this.scene.remove(this.arrows[i].mesh); this.arrows.splice(i, 1); }
    }
  }
}
