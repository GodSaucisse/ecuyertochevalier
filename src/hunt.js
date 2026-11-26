// La chasse : des cerfs qui broutent dans la forêt et fuient quand on approche.
import * as THREE from 'three';

function mat(color) { return new THREE.MeshStandardMaterial({ color, roughness: 0.85 }); }

function buildDeer() {
  const coat = mat(0x8a5a32), light = mat(0xe8dcc8), dark = mat(0x2a1e16), antler = mat(0xcab89a);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const add = (geo, m, parent, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const trunk = add(new THREE.CapsuleGeometry(0.24, 0.7, 6, 10).rotateX(Math.PI / 2), coat, body, 0, 1.0, 0);
  trunk.scale.set(0.9, 1.1, 1);
  add(new THREE.SphereGeometry(0.14, 8, 6), light, body, 0, 1.05, -0.5); // croupe claire
  const neck = new THREE.Group();
  neck.position.set(0, 1.15, 0.42);
  neck.rotation.x = 0.55;
  body.add(neck);
  add(new THREE.CylinderGeometry(0.09, 0.14, 0.55, 8), coat, neck, 0, 0.25, 0);
  const head = new THREE.Group();
  head.position.set(0, 0.52, 0.02);
  head.rotation.x = 1.55;
  neck.add(head);
  add(new THREE.CylinderGeometry(0.05, 0.1, 0.36, 8), coat, head, 0, 0.18, 0);
  add(new THREE.SphereGeometry(0.04, 6, 6), dark, head, 0, 0.37, 0);
  for (const s of [-1, 1]) {
    add(new THREE.ConeGeometry(0.035, 0.13, 5), coat, head, s * 0.08, -0.02, -0.06).rotation.set(-1.4, 0, s * 0.6);
    // Bois du cerf (ramure)
    const a = new THREE.Group();
    a.position.set(s * 0.05, -0.04, -0.03);
    a.rotation.set(-2.2, 0, s * 0.45);
    head.add(a);
    add(new THREE.CylinderGeometry(0.012, 0.02, 0.45, 5), antler, a, 0, 0.22, 0);
    for (const [y, r] of [[0.15, 0.7], [0.3, -0.6], [0.4, 0.5]]) {
      const t = add(new THREE.CylinderGeometry(0.008, 0.012, 0.16, 4), antler, a, 0, y, 0.05);
      t.rotation.x = r;
    }
  }
  add(new THREE.ConeGeometry(0.06, 0.15, 6), light, body, 0, 1.12, -0.62).rotation.x = -2.4; // queue
  const legs = [];
  for (const [x, z] of [[-0.13, 0.36], [0.13, 0.36], [-0.13, -0.38], [0.13, -0.38]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.92, z);
    body.add(hip);
    add(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 6), coat, hip, 0, -0.25, 0);
    const knee = new THREE.Group();
    knee.position.y = -0.48;
    hip.add(knee);
    add(new THREE.CylinderGeometry(0.022, 0.03, 0.44, 6), coat, knee, 0, -0.22, 0);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 6), dark, knee, 0, -0.44, 0);
    legs.push({ hip, knee });
  }
  return { root, body, neck, legs };
}

const rand = (a, b) => a + Math.random() * (b - a);

export class Hunt {
  constructor(scene, world, isFree) {
    this.scene = scene;
    this.world = world;
    this.isFree = isFree; // (x, z) → vrai si l'endroit convient (pas un bâtiment)
    this.deer = [];
    this.onKill = null;
    for (let i = 0; i < 6; i++) this.spawn();
  }

  spawnPoint() {
    for (let k = 0; k < 60; k++) {
      const a = Math.random() * Math.PI * 2, d = rand(52, 84);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (this.isFree(x, z)) return { x, z };
    }
    return { x: -70, z: 40 };
  }

  spawn(existing) {
    const p = this.spawnPoint();
    const d = existing || { parts: buildDeer() };
    d.parts.root.position.set(p.x, 0, p.z);
    d.parts.root.rotation.set(0, Math.random() * 6, 0);
    d.parts.root.visible = true;
    if (!existing) { this.scene.add(d.parts.root); this.deer.push(d); }
    Object.assign(d, { alive: true, carcass: false, state: 'graze', t: rand(1, 4), speed: 0, phase: 0, target: null, respawn: 0 });
    return d;
  }

  center(d, out = new THREE.Vector3()) { return out.copy(d.parts.root.position).setY(1.0); }

  kill(d) {
    d.alive = false;
    d.carcass = true;
    d.state = 'dead';
    d.parts.root.rotation.z = Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1);
    d.parts.root.position.y = 0.3;
    if (this.onKill) this.onKill(d);
  }

  /** Gibier à ramasser près du joueur. */
  nearCarcass(pos) {
    return this.deer.find((d) => d.carcass && Math.hypot(pos.x - d.parts.root.position.x, pos.z - d.parts.root.position.z) < 2.2) || null;
  }

  take(d) {
    d.carcass = false;
    d.parts.root.visible = false;
    d.respawn = 90;
  }

  update(dt, playerPos, mounted) {
    for (const d of this.deer) {
      const r = d.parts.root, p = r.position;
      if (d.state === 'dead') {
        if (!d.carcass && d.respawn > 0) { d.respawn -= dt; if (d.respawn <= 0) { r.rotation.set(0, 0, 0); this.spawn(d); } }
        continue;
      }
      const dx = p.x - playerPos.x, dz = p.z - playerPos.z, dist = Math.hypot(dx, dz);
      const scare = mounted ? 24 : 15;
      if (dist < scare && d.state !== 'flee') { d.state = 'flee'; d.t = rand(4, 6); }
      d.t -= dt;
      let speed = 0;
      if (d.state === 'flee') {
        speed = 8.5;
        const want = Math.atan2(dx, dz);
        r.rotation.y += Math.atan2(Math.sin(want - r.rotation.y), Math.cos(want - r.rotation.y)) * Math.min(1, dt * 5);
        if (d.t < 0) { d.state = 'graze'; d.t = rand(2, 5); }
      } else if (d.state === 'walk') {
        speed = 1.2;
        if (d.target) {
          const want = Math.atan2(d.target.x - p.x, d.target.z - p.z);
          r.rotation.y += Math.atan2(Math.sin(want - r.rotation.y), Math.cos(want - r.rotation.y)) * Math.min(1, dt * 2);
          if (Math.hypot(d.target.x - p.x, d.target.z - p.z) < 1) d.t = 0;
        }
        if (d.t < 0) { d.state = 'graze'; d.t = rand(3, 7); }
      } else if (d.t < 0) {
        d.state = 'walk';
        d.t = rand(4, 8);
        const a = Math.random() * Math.PI * 2;
        d.target = { x: p.x + Math.cos(a) * 8, z: p.z + Math.sin(a) * 8 };
      }
      d.speed += (speed - d.speed) * Math.min(1, dt * 4);
      p.x += Math.sin(r.rotation.y) * d.speed * dt;
      p.z += Math.cos(r.rotation.y) * d.speed * dt;
      const before = p.clone();
      this.world.resolve(p, 0.5);
      if (before.distanceTo(p) > 0.01 && d.state === 'walk') d.t = 0;
      // Animation : marche ou bonds, tête baissée pour brouter
      const P = d.parts;
      const running = d.speed > 4;
      d.phase += dt * (running ? 3.2 : 1.6) * Math.max(0.3, d.speed / (running ? 8.5 : 1.2));
      const amp = d.speed < 0.1 ? 0 : running ? 0.8 : 0.35;
      const offs = running ? [0, 0.1, 0.5, 0.6] : [0, 0.5, 0.75, 0.25];
      P.legs.forEach((l, i) => {
        const a = (d.phase + offs[i]) * Math.PI * 2;
        l.hip.rotation.x = Math.sin(a) * amp;
        l.knee.rotation.x = (i < 2 ? 1 : -0.8) * Math.max(0, Math.cos(a)) * amp;
      });
      P.body.position.y = running ? Math.abs(Math.sin(d.phase * Math.PI * 2)) * 0.15 : 0;
      const graze = d.state === 'graze' ? 1 : 0;
      P.neck.rotation.x += ((0.55 + graze * 1.0) - P.neck.rotation.x) * Math.min(1, dt * 2);
    }
  }
}
