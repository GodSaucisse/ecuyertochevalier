// Tonnerre, le cheval : modèle articulé, allures (pas, trot, galop) et conduite.
import * as THREE from 'three';
import { Tex } from './textures.js?v=202611261148';
import { playHoof } from './audio.js?v=202611261148';

const SPEEDS = { walk: 2.4, trot: 5.5, gallop: 11.5 };
const RADIUS = 0.85;

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
}

function mesh(geo, material, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Construit le cheval. Il regarde vers +Z, sabots à y = 0. */
function buildHorse(coatColor = 0x7a4626, blanketColor = 0x22386e) {
  const coatTex = Tex.leather();
  const coatMap = coatTex.map.clone(); coatMap.repeat.set(3, 3); coatMap.needsUpdate = true;
  const coat = mat(coatColor, { map: coatMap, roughness: 0.55 });
  const dark = mat(0x1c1410, { roughness: 0.8 });
  const hoof = mat(0x2a2420, { roughness: 0.6 });
  const leather = mat(0x3a2414, { roughness: 0.6 });
  const clothTex = Tex.cloth();
  const blanketMap = clothTex.map.clone(); blanketMap.repeat.set(3, 3); blanketMap.needsUpdate = true;
  const blanket = mat(blanketColor, { map: blanketMap, roughness: 0.95 });
  const gold = mat(0xd4a843, { metalness: 1, roughness: 0.35 });
  const steel = mat(0xb8bcc0, { metalness: 1, roughness: 0.3 });

  const root = new THREE.Group();
  const body = new THREE.Group(); // tout ce qui bouge avec le dos (balancement)
  root.add(body);

  // Tronc
  const trunk = mesh(new THREE.CapsuleGeometry(0.36, 1.05, 6, 14).rotateX(Math.PI / 2), coat, body, 0, 1.28, 0);
  trunk.scale.set(0.92, 1.12, 1);
  mesh(new THREE.SphereGeometry(0.4, 14, 10), coat, body, 0, 1.3, 0.55).scale.set(0.9, 1.05, 0.85); // poitrail
  mesh(new THREE.SphereGeometry(0.42, 14, 10), coat, body, 0, 1.32, -0.55).scale.set(0.95, 1.0, 0.9); // croupe

  // Encolure et tête
  const neck = new THREE.Group();
  neck.position.set(0, 1.5, 0.72);
  neck.rotation.x = 0.75;
  body.add(neck);
  mesh(new THREE.CylinderGeometry(0.2, 0.33, 0.9, 12), coat, neck, 0, 0.38, 0).scale.set(0.85, 1, 1.05);
  // Crinière
  const mane = mesh(new THREE.BoxGeometry(0.08, 0.9, 0.16), dark, neck, 0, 0.42, -0.22);
  mane.rotation.x = 0.08;
  const head = new THREE.Group();
  head.position.set(0, 0.8, 0.02);
  head.rotation.x = 1.75;
  neck.add(head);
  const skull = mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.6, 10), coat, head, 0, 0.3, 0);
  skull.scale.z = 1.15;
  mesh(new THREE.SphereGeometry(0.1, 10, 8), coat, head, 0, 0.6, 0.0).scale.set(0.95, 0.7, 1.1); // naseaux
  mesh(new THREE.SphereGeometry(0.03, 6, 6), dark, head, -0.11, 0.12, 0.06); // yeux
  mesh(new THREE.SphereGeometry(0.03, 6, 6), dark, head, 0.11, 0.12, 0.06);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.04, 0.16, 6), coat, head, s * 0.07, -0.06, -0.08);
    ear.rotation.x = -1.6;
  }
  // Bride
  mesh(new THREE.TorusGeometry(0.12, 0.012, 4, 16).rotateX(Math.PI / 2), leather, head, 0, 0.5, 0).scale.z = 1.1;
  mesh(new THREE.TorusGeometry(0.15, 0.012, 4, 16).rotateX(Math.PI / 2), leather, head, 0, 0.12, 0).scale.z = 1.1;
  mesh(new THREE.SphereGeometry(0.025, 6, 6), steel, head, 0.11, 0.56, 0.02);
  mesh(new THREE.SphereGeometry(0.025, 6, 6), steel, head, -0.11, 0.56, 0.02);

  // Queue
  const tail = new THREE.Group();
  tail.position.set(0, 1.45, -0.95);
  tail.rotation.x = -2.85;
  body.add(tail);
  mesh(new THREE.CylinderGeometry(0.06, 0.15, 1.05, 8).translate(0, 0.52, 0), dark, tail).scale.z = 0.6;

  // Selle, tapis, étriers
  const blanketMesh = mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.85, 18, 1, true, Math.PI - 1.3, 2.6).rotateX(Math.PI / 2), blanket, body, 0, 1.28, -0.05);
  blanketMesh.material.side = THREE.DoubleSide;
  blanketMesh.scale.set(0.95, 1.05, 1);
  // Bordure dorée du tapis
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.02, 0.06, 0.86), gold, body, s * 0.405, 1.04, -0.05);
  const saddle = mesh(new THREE.CapsuleGeometry(0.2, 0.35, 4, 10).rotateX(Math.PI / 2), leather, body, 0, 1.66, -0.05);
  saddle.scale.set(1.15, 0.45, 1);
  mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), leather, body, 0, 1.76, 0.2);  // pommeau
  mesh(new THREE.BoxGeometry(0.4, 0.2, 0.06), leather, body, 0, 1.78, -0.32); // troussequin
  mesh(new THREE.TorusGeometry(0.02, 0.006, 4, 8), gold, body, 0, 1.73, 0.24);
  for (const s of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.015, 0.55, 0.03), leather, body, s * 0.34, 1.32, 0.0);
    mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 10), steel, body, s * 0.34, 1.02, 0.0);
  }
  // Jambes : épaule/hanche → genou/jarret → sabot
  const legs = [];
  for (const [x, z, front] of [[-0.2, 0.55, true], [0.2, 0.55, true], [-0.21, -0.58, false], [0.21, -0.58, false]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 1.12, z);
    body.add(hip);
    mesh(new THREE.CapsuleGeometry(front ? 0.13 : 0.16, 0.3, 4, 8), coat, hip, 0, -0.22, 0).scale.z = front ? 1.1 : 1.25;
    const knee = new THREE.Group();
    knee.position.y = -0.5;
    hip.add(knee);
    mesh(new THREE.CapsuleGeometry(0.07, 0.4, 4, 8), coat, knee, 0, -0.25, 0);
    mesh(new THREE.SphereGeometry(0.085, 8, 6), coat, knee, 0, 0, 0); // genou
    mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.12, 8), dark, knee, 0, -0.5, 0);
    mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.09, 10), hoof, knee, 0, -0.58, 0.01);
    legs.push({ hip, knee, front });
  }

  // Point d'attache du cavalier (sur la selle)
  const seat = new THREE.Group();
  seat.position.set(0, 1.72, -0.08);
  body.add(seat);

  return { root, body, neck, head, tail, legs, seat };
}

export class Horse {
  constructor(scene, world, { x, z, rot, coat, blanket }) {
    this.world = world;
    this.parts = buildHorse(coat, blanket);
    this.object = this.parts.root;
    this.object.position.set(x, 0, z);
    this.object.rotation.y = rot;
    scene.add(this.object);
    this.speed = 0;
    this.phase = 0;
    this.time = 0;
    this.lastStep = 0;
    this.mounted = false;
    this.circle = { x, z, r: 0.75, top: 99 };
    world.circles.push(this.circle);
    // Deuxième obstacle pour la longueur du cheval
    this.circle2 = { x, z, r: 0.6, top: 99 };
    world.circles.push(this.circle2);
    this.syncColliders();
  }

  get position() { return this.object.position; }
  get heading() { return this.object.rotation.y; }

  get gait() {
    const s = Math.abs(this.speed);
    if (s < 0.2) return 'halt';
    if (s < 3.5) return 'walk';
    if (s < 8) return 'trot';
    return 'gallop';
  }

  syncColliders() {
    const p = this.object.position, h = this.heading;
    const off = this.mounted ? -99 : 99;
    Object.assign(this.circle, { x: p.x + Math.sin(h) * 0.45, z: p.z + Math.cos(h) * 0.45, top: off });
    Object.assign(this.circle2, { x: p.x - Math.sin(h) * 0.5, z: p.z - Math.cos(h) * 0.5, top: off });
  }

  setMounted(m) {
    this.mounted = m;
    if (!m) this.speed = 0;
    this.syncColliders();
  }

  /** Point au bout de la lance, en coordonnées du monde. */
  lanceTip(out = new THREE.Vector3()) {
    this.parts.root.updateMatrixWorld(true);
    return this.parts.root.localToWorld(out.set(0.55, 2.0, 3.3));
  }

  /**
   * Conduite : throttle (-1 à 1), turn (-1 gauche à 1 droite), gallop (bool).
   * Sans cavalier, le cheval reste sur place et broute.
   */
  update(dt, { throttle = 0, turn = 0, gallop = false } = {}) {
    this.time += dt;
    const p = this.object.position;
    if (this.mounted) {
      let target = 0;
      if (throttle > 0.05) target = gallop ? SPEEDS.gallop : (throttle > 0.6 ? SPEEDS.trot : SPEEDS.walk + (SPEEDS.trot - SPEEDS.walk) * (throttle / 0.6) * 0.5);
      else if (throttle < -0.05) target = -1.6;
      const accel = target > this.speed ? 3.2 : 5.5;
      this.speed += Math.sign(target - this.speed) * Math.min(Math.abs(target - this.speed), accel * dt);
      // Tourner : plus serré au pas qu'au galop
      const rate = 2.2 - Math.min(1, Math.abs(this.speed) / SPEEDS.gallop) * 0.95;
      this.object.rotation.y -= turn * rate * dt * (this.speed < -0.1 ? -1 : 1) * (Math.abs(this.speed) < 0.2 ? 0.8 : 1);
      const h = this.heading;
      const before = p.clone();
      p.x += Math.sin(h) * this.speed * dt;
      p.z += Math.cos(h) * this.speed * dt;
      // Collisions : le centre et l'avant du cheval
      this.world.resolve(p, RADIUS);
      const front = new THREE.Vector3(p.x + Math.sin(h) * 0.7, 0, p.z + Math.cos(h) * 0.7);
      const fBefore = front.clone();
      this.world.resolve(front, 0.55);
      p.x += front.x - fBefore.x;
      p.z += front.z - fBefore.z;
      const moved = Math.hypot(p.x - before.x, p.z - before.z);
      const expected = Math.abs(this.speed) * dt;
      if (expected > 0.001 && moved < expected * 0.5) this.speed *= 0.85; // freiné par un obstacle
    } else {
      this.speed = 0;
    }
    this.syncColliders();
    this.animate(dt);
  }

  animate(dt) {
    const P = this.parts;
    const s = Math.abs(this.speed);
    const gait = this.gait;
    const freq = gait === 'gallop' ? 2.3 : gait === 'trot' ? 1.75 : gait === 'walk' ? 1.0 : 0;
    this.phase += dt * freq * Math.max(0.6, s / (gait === 'gallop' ? 11 : gait === 'trot' ? 5.5 : 2.4)) * Math.sign(this.speed || 1);
    const offsets = gait === 'gallop' ? [0.0, 0.12, 0.55, 0.65] : gait === 'trot' ? [0, 0.5, 0.5, 0] : [0, 0.5, 0.75, 0.25];
    const amp = gait === 'gallop' ? 0.75 : gait === 'trot' ? 0.5 : gait === 'walk' ? 0.32 : 0;
    P.legs.forEach((leg, i) => {
      const a = (this.phase + offsets[i]) * Math.PI * 2;
      const swing = Math.sin(a) * amp;
      leg.hip.rotation.x += (swing - leg.hip.rotation.x) * Math.min(1, dt * 20);
      const lift = Math.max(0, Math.cos(a)) * amp * 1.4;
      const kneeTarget = leg.front ? lift : -lift * 0.8;
      leg.knee.rotation.x += (kneeTarget - leg.knee.rotation.x) * Math.min(1, dt * 20);
      // Bruit de sabot quand la jambe se pose
      const step = Math.floor(this.phase * 2 + offsets[i] * 2);
      if (i === 0 && step !== this.lastStep && s > 0.3) {
        this.lastStep = step;
        playHoof(Math.min(1, s / 10), this.object.position);
      }
    });
    // Balancement du dos, de l'encolure et de la queue
    const bobAmp = gait === 'gallop' ? 0.09 : gait === 'trot' ? 0.05 : gait === 'walk' ? 0.015 : 0;
    const bob = Math.sin(this.phase * Math.PI * (gait === 'trot' ? 4 : 2)) * bobAmp;
    P.body.position.y = bob;
    P.body.rotation.x = gait === 'gallop' ? Math.sin(this.phase * Math.PI * 2) * 0.06 : 0;
    const idle = s < 0.2;
    // À l'arrêt, le cheval baisse parfois la tête pour brouter
    const graze = idle && !this.mounted ? (Math.sin(this.time * 0.25) > 0.3 ? 1 : 0) : 0;
    const neckTarget = 0.75 + graze * 1.1 + (gait === 'gallop' ? 0.25 : 0) + Math.sin(this.phase * Math.PI * 2) * 0.05;
    P.neck.rotation.x += (neckTarget - P.neck.rotation.x) * Math.min(1, dt * 2.5);
    P.tail.rotation.x = -2.85 + Math.sin(this.time * 2.1) * 0.06 + (gait === 'gallop' ? 0.5 : 0);
    P.tail.rotation.z = Math.sin(this.time * 1.3) * 0.15;
  }

  /** Pose du cavalier assis (h : personnage du joueur). */
  poseRider(h, lance) {
    h.legL.rotation.set(-1.25, 0, 0.42);
    h.legR.rotation.set(-1.25, 0, -0.42);
    h.kneeL.rotation.x = 1.45;
    h.kneeR.rotation.x = 1.45;
    const bob = this.parts.body.position.y;
    h.spine.rotation.x = 0.08 + (this.gait === 'gallop' ? 0.18 : 0) - bob * 0.8;
    h.spine.rotation.y = 0;
    h.armL.rotation.set(-0.75, 0, 0);
    h.elbowL.rotation.x = -0.9;
    if (lance) {
      h.armR.rotation.set(-0.25, 0, 0.15);
      h.elbowR.rotation.x = -1.45;
    } else {
      h.armR.rotation.set(-0.75, 0, 0);
      h.elbowR.rotation.x = -0.9;
    }
  }
}
