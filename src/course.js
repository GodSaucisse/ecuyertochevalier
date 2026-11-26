// Chapitre II : parcours de portes à bannières et lice de joute.
import * as THREE from 'three';
import { Tex, metricBoxUV } from './textures.js?v=202611261106';
import { GATES, LISTS, JOUST_QUINTAIN } from './layout.js?v=202611261106';
import { createHumanoid } from './humanoid.js?v=202611261106';

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
}
function mesh(geo, material, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function createCourse(scene, world) {
  const woodT = Tex.wood();
  const wood = mat(0x8a6240, { map: woodT.map, normalMap: woodT.normalMap });
  const blue = mat(0x22386e, { side: THREE.DoubleSide });
  const goldCloth = mat(0xd8b04a, { side: THREE.DoubleSide });
  const red = mat(0x8a1f18, { side: THREE.DoubleSide });
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffd27a, emissive: 0xffb030, emissiveIntensity: 1.6, transparent: true, opacity: 0.75, depthWrite: false,
  });
  const time = { t: 0 };

  // ---------- Portes ----------
  const gates = GATES.map((g, i) => {
    const prev = i === 0 ? { x: 0, z: -18 } : GATES[i - 1];
    const dir = new THREE.Vector3(g.x - prev.x, 0, g.z - prev.z).normalize();
    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    const group = new THREE.Group();
    group.position.set(g.x, 0, g.z);
    group.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(group);
    const half = 2.8;
    for (const s of [-1, 1]) {
      mesh(new THREE.CylinderGeometry(0.11, 0.14, 4.9, 8), wood, group, s * half, 2.45, 0);
      mesh(new THREE.ConeGeometry(0.16, 0.3, 8), goldCloth, group, s * half, 5.05, 0);
      const wx = g.x + right.x * s * half, wz = g.z + right.z * s * half;
      world.circles.push({ x: wx, z: wz, r: 0.2, top: 99 });
    }
    mesh(metricBoxUV(new THREE.BoxGeometry(half * 2 + 0.3, 0.14, 0.14), half * 2 + 0.3, 0.14, 0.14), wood, group, 0, 4.7, 0);
    // Bannières suspendues
    const banners = [];
    for (const bx of [-1.4, 0, 1.4]) {
      const b = mesh(new THREE.PlaneGeometry(0.7, 0.9), bx === 0 ? goldCloth : blue, group, bx, 4.2, 0);
      banners.push(b);
    }
    // Anneau lumineux de la porte à franchir
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.07, 8, 40), ringMat);
    ring.position.y = 2.0;
    ring.visible = false;
    group.add(ring);
    return { x: g.x, z: g.z, dir, right, half, ring, banners, group };
  });

  // ---------- Lice ----------
  const L = LISTS;
  {
    const sandT = Tex.sand();
    const sand = new THREE.MeshStandardMaterial({
      map: sandT.map, normalMap: sandT.normalMap, roughness: 1,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    const w = L.halfWidth * 2, len = L.z1 - L.z0;
    const geo = new THREE.PlaneGeometry(w, len).rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * len);
    const ground = new THREE.Mesh(geo, sand);
    ground.position.set(L.x, 0.02, (L.z0 + L.z1) / 2);
    ground.receiveShadow = true;
    scene.add(ground);
    world.addBare({ minX: L.x - L.halfWidth, maxX: L.x + L.halfWidth, minZ: L.z0, maxZ: L.z1 });

    // Palissades de chaque côté
    for (const s of [-1, 1]) {
      const fx = L.x + s * L.halfWidth;
      for (let z = L.z0; z <= L.z1; z += 3) mesh(new THREE.BoxGeometry(0.14, 1.3, 0.14), wood, scene, fx, 0.65, z);
      for (const y of [0.55, 1.15]) {
        mesh(metricBoxUV(new THREE.BoxGeometry(0.08, 0.12, len), 0.08, 0.12, len), wood, scene, fx, y, (L.z0 + L.z1) / 2);
      }
      world.boxes.push({ minX: fx - 0.15, maxX: fx + 0.15, minZ: L.z0, maxZ: L.z1, top: 1.3 });
    }
    // Mâts à oriflammes aux quatre coins
    for (const [x, z] of [[L.x - L.halfWidth, L.z0], [L.x + L.halfWidth, L.z0], [L.x - L.halfWidth, L.z1], [L.x + L.halfWidth, L.z1]]) {
      mesh(new THREE.CylinderGeometry(0.07, 0.09, 5, 8), wood, scene, x, 2.5, z);
      const pennon = mesh(new THREE.PlaneGeometry(1.4, 0.5), x > L.x ? red : blue, scene, x + 0.7, 4.6, z);
      pennon.rotation.y = Math.PI / 2 * 0;
    }

    // Tribune pour les spectateurs (côté est)
    const sx = L.x + L.halfWidth + 3.2, sz = 6;
    for (let tier = 0; tier < 3; tier++) {
      mesh(metricBoxUV(new THREE.BoxGeometry(1.2, 0.5 + tier * 0.5, 12), 1.2, 0.5 + tier * 0.5, 12), wood, scene, sx + tier * 1.2, (0.5 + tier * 0.5) / 2, sz);
    }
    world.boxes.push({ minX: sx - 0.6, maxX: sx + 3.0, minZ: sz - 6, maxZ: sz + 6, top: 99 });
    for (const dz of [-6, 6]) mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 8), wood, scene, sx + 2.5, 2.1, sz + dz);
    for (const dz of [-6, 6]) mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 8), wood, scene, sx - 0.5, 1.5, sz + dz);
    // Toile rayée
    for (let i = 0; i < 6; i++) {
      const stripe = mesh(new THREE.BoxGeometry(3.4, 0.04, 2), i % 2 ? goldCloth : blue, scene, sx + 1, 3.6, sz - 5 + i * 2);
      stripe.rotation.z = -0.3;
    }
  }

  // Spectateurs
  const spectators = [];
  const looks = [
    { outfit: 'dress', tunic: 0x8a3a2a, hair: 0x5a3a1e },
    { outfit: 'lord', tunic: 0x3a5a2a, trousers: 0x3a3028, hair: 0x2a1a10, cloak: 0x22386e },
    { outfit: 'gambeson', trousers: 0x4a4038, hair: 0xa0703a },
    { outfit: 'dress', tunic: 0x4a5a8a, hair: 0x2a1a10 },
    { outfit: 'lord', tunic: 0x6a2a4a, trousers: 0x2a2a30, hair: 0x8a8070, beard: 0x8a8070 },
  ];
  looks.forEach((look, i) => {
    const h = createHumanoid(look);
    const tier = i % 3;
    h.root.position.set(L.x + L.halfWidth + 3.2 + tier * 1.2, 0.5 + tier * 0.5, 1.5 + i * 2.2);
    h.root.rotation.y = -Math.PI / 2;
    scene.add(h.root);
    spectators.push({ h, phase: Math.random() * 6 });
  });
  let cheerUntil = 0;

  // Quintaine de joute : poteau, bras pivotant, écu à hauteur de lance
  const joust = (() => {
    const { x, z } = JOUST_QUINTAIN;
    mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.8, 10), wood, scene, x, 1.4, z);
    world.circles.push({ x, z, r: 0.3, top: 99 });
    const pivot = new THREE.Group();
    pivot.position.set(x, 2.55, z);
    scene.add(pivot);
    mesh(new THREE.BoxGeometry(2.3, 0.12, 0.12), wood, pivot, 0, 0, 0);
    const shieldT = Tex.heraldry();
    const shield = mesh(new THREE.BoxGeometry(0.06, 0.75, 0.6), new THREE.MeshStandardMaterial({ map: shieldT, roughness: 0.6 }), pivot, 0.95, -0.45, 0);
    shield.rotation.y = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 4), mat(0x3a2a1a), pivot, -1.05, -0.22, 0);
    mesh(new THREE.SphereGeometry(0.25, 10, 8), mat(0xb59c6e), pivot, -1.05, -0.6, 0).scale.y = 1.3;
    let spin = 0;
    const shieldWorld = new THREE.Vector3();
    return {
      position: new THREE.Vector3(x, 0, z),
      markerHeight: 3.6,
      shieldPos() { return shield.getWorldPosition(shieldWorld); },
      hit(strength = 1) { spin += 12 * strength; },
      update(dt) {
        pivot.rotation.y += spin * dt;
        spin *= Math.exp(-dt * 1.5);
        if (Math.abs(spin) < 2) {
          // Le bras revient se placer face à la piste
          spin = 0;
          const target = Math.round(pivot.rotation.y / (Math.PI * 2)) * Math.PI * 2;
          pivot.rotation.y += (target - pivot.rotation.y) * Math.min(1, dt * 3);
        }
      },
      get ready() { return spin === 0 && Math.abs(pivot.rotation.y - Math.round(pivot.rotation.y / (Math.PI * 2)) * Math.PI * 2) < 0.3; },
    };
  })();

  // Lance (portée par le cheval quand le cavalier joute)
  const lance = new THREE.Group();
  {
    const shaft = mesh(new THREE.CylinderGeometry(0.025, 0.06, 3.9, 10), mat(0xc8a070), lance, 0, 0, 0);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 1.3;
    const vamplate = mesh(new THREE.ConeGeometry(0.11, 0.22, 12), mat(0x9aa0a6, { metalness: 1, roughness: 0.3 }), lance, 0, 0, -0.35);
    vamplate.rotation.x = Math.PI / 2;
    const tip = mesh(new THREE.ConeGeometry(0.035, 0.18, 8), mat(0x9aa0a6, { metalness: 1, roughness: 0.3 }), lance, 0, 0, 3.3);
    tip.rotation.x = Math.PI / 2;
    const pennon = mesh(new THREE.PlaneGeometry(0.5, 0.22), blue, lance, 0, 0.13, 2.8);
    pennon.rotation.y = Math.PI / 2;
    lance.position.set(0.55, 1.98, 0.05);
    lance.rotation.y = -0.03;
    lance.visible = false;
  }

  return {
    gates, joust, lance,
    setActiveGate(index) {
      gates.forEach((g, i) => {
        g.ring.visible = i === index;
        g.banners.forEach((b) => { b.material = i < index ? red : (b.position.x === 0 ? goldCloth : blue); });
      });
    },
    /** Vrai si le cavalier a franchi la porte i entre prev et pos. */
    crossed(i, prev, pos) {
      const g = gates[i];
      if (!g) return false;
      const sPrev = (prev.x - g.x) * g.dir.x + (prev.z - g.z) * g.dir.z;
      const sNow = (pos.x - g.x) * g.dir.x + (pos.z - g.z) * g.dir.z;
      const lat = Math.abs((pos.x - g.x) * g.right.x + (pos.z - g.z) * g.right.z);
      return sPrev < 0 && sNow >= 0 && lat < g.half;
    },
    cheer() { cheerUntil = time.t + 2.5; },
    update(dt) {
      time.t += dt;
      joust.update(dt);
      for (const g of gates) if (g.ring.visible) g.ring.rotation.z += dt * 0.8;
      ringMat.emissiveIntensity = 1.3 + Math.sin(time.t * 4) * 0.4;
      const cheering = time.t < cheerUntil;
      for (const s of spectators) {
        const k = cheering ? Math.abs(Math.sin(time.t * 7 + s.phase)) : 0;
        s.h.armL.rotation.x += ((cheering ? -2.6 - k * 0.4 : 0) - s.h.armL.rotation.x) * Math.min(1, dt * 8);
        s.h.armR.rotation.x += ((cheering ? -2.6 - k * 0.4 : 0) - s.h.armR.rotation.x) * Math.min(1, dt * 8);
        s.h.spine.position.y = 0.98 + (cheering ? k * 0.05 : Math.sin(time.t * 1.5 + s.phase) * 0.005);
      }
    },
  };
}
