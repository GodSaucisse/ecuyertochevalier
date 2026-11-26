// La vie du village : forge et forgeron, villageois qui se promènent, poules.
import * as THREE from 'three';
import { createHumanoid, animateWalk } from './humanoid.js?v=202611261148';
import { Tex, metricBoxUV } from './textures.js?v=202611261148';
import { atDistance, playAnvil, playCluck } from './audio.js?v=202611261148';

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

const VILLAGER_LINES = [
  ['Belle journée pour les moissons… enfin, ce qu\'il en reste.'],
  ['Il paraît que des brigands rôdent dans la forêt, à l\'ouest. Sois prudent, jeune maître.'],
  ['Tu es l\'écuyer du seigneur ? Mon fils rêve de faire comme toi.'],
  ['Le père Anselme dit la messe tous les matins. Tu devrais y passer.'],
  ['Gautier le forgeron tape sur son enclume du matin au soir. On ne s\'entend plus penser !'],
  ['Mes poules se sont encore échappées… si tu les vois, dis-leur de rentrer.'],
];

export function createLife(scene, world) {
  const npcs = [];
  const woodT = Tex.wood(), stoneT = Tex.stone(), thatchT = Tex.thatch();
  const wood = mat(0x7a5634, { map: woodT.map, normalMap: woodT.normalMap });
  const stone = mat(0x9a948a, { map: stoneT.map, normalMap: stoneT.normalMap });
  const thatch = mat(0xc9a35a, { map: thatchT.map, normalMap: thatchT.normalMap });
  const iron = mat(0x3a3c40, { metalness: 0.8, roughness: 0.5 });

  // ---------- Forge ----------
  const F = { x: 16.5, z: 17 };
  const forgeGlow = new THREE.MeshStandardMaterial({ color: 0x2a1006, emissive: 0xff5a10, emissiveIntensity: 2.5, roughness: 1 });
  {
    const g = new THREE.Group();
    g.position.set(F.x, 0, F.z);
    g.rotation.y = -Math.PI / 2; // ouverte vers le chemin
    scene.add(g);
    for (const [px, pz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
      mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.8, 8), wood, g, px, 1.4, pz);
    }
    const roof = mesh(metricBoxUV(new THREE.BoxGeometry(4, 0.2, 4.2), 4, 0.2, 4.2), thatch, g, 0, 2.95, 0);
    roof.rotation.x = 0.18;
    // Foyer en pierre avec braises, et cheminée
    mesh(metricBoxUV(new THREE.BoxGeometry(1.4, 0.9, 1.2), 1.4, 0.9, 1.2), stone, g, 0.6, 0.45, -1.2);
    const coals = mesh(new THREE.BoxGeometry(1.0, 0.1, 0.8), forgeGlow, g, 0.6, 0.92, -1.2);
    coals.castShadow = false;
    mesh(metricBoxUV(new THREE.BoxGeometry(0.7, 3.6, 0.7), 0.7, 3.6, 0.7), stone, g, 0.6, 2.4, -1.5);
    // Enclume sur sa souche
    mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.55, 10), wood, g, -0.3, 0.28, 0.2);
    mesh(new THREE.BoxGeometry(0.55, 0.22, 0.25), iron, g, -0.3, 0.66, 0.2);
    mesh(new THREE.ConeGeometry(0.1, 0.3, 6).rotateZ(Math.PI / 2), iron, g, 0.1, 0.7, 0.2);
    // Tonneau d'eau
    mesh(new THREE.CylinderGeometry(0.35, 0.32, 0.8, 12), wood, g, -1.2, 0.4, -1.1);
    // Obstacles (la forge est tournée : local (x, z) → monde (F.x - z, F.z + x))
    world.boxes.push({ minX: F.x + 0.6, maxX: F.x + 1.8, minZ: F.z - 0.1, maxZ: F.z + 1.3, top: 99 }); // foyer
    world.circles.push({ x: F.x - 0.2, z: F.z - 0.3, r: 0.4, top: 0.8 }); // enclume
    world.circles.push({ x: F.x + 1.1, z: F.z - 1.2, r: 0.4, top: 0.8 }); // tonneau
    for (const [px, pz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
      const wx = F.x - pz, wz = F.z + px;
      world.circles.push({ x: wx, z: wz, r: 0.15, top: 99 });
    }
    world.addBare({ minX: F.x - 2, maxX: F.x + 2, minZ: F.z - 2, maxZ: F.z + 2 });
  }

  // Forgeron
  const smith = (() => {
    const h = createHumanoid({ outfit: 'peasant', tunic: 0x4a3a2a, trousers: 0x3a3028, hair: 0x2a1a10, beard: 0x2a1a10 });
    h.root.position.set(F.x + 0.4, 0, F.z - 0.3);
    h.root.rotation.y = -Math.PI / 2;
    scene.add(h.root);
    // Tablier de cuir
    mesh(new THREE.BoxGeometry(0.42, 0.75, 0.04), mat(0x3a2414), h.spine, 0, 0.1, 0.17);
    const hammer = new THREE.Group();
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6).rotateX(Math.PI / 2), wood, hammer, 0, 0, 0.12);
    mesh(new THREE.BoxGeometry(0.12, 0.08, 0.08), iron, hammer, 0, 0, 0.3);
    h.handR.add(hammer);
    world.circles.push({ x: F.x + 0.4, z: F.z - 0.3, r: 0.4, top: 99 });
    let t = 0, struck = false, talkPause = 0;
    return {
      id: 'forgeron', name: 'Gautier, forgeron', h, object: h.root, markerHeight: 2.4,
      lines: [
        ['Besoin d\'un fer pour ton cheval ? Reviens plus tard, j\'ai trois socs de charrue à reforger.'],
        ['Une bonne lame, c\'est du fer, du feu et de la patience. Comme un bon chevalier.'],
        ['Tu veux savoir pourquoi je tape si fort ? Parce que le fer n\'écoute pas les gentilles paroles.'],
      ],
      update(dt, playerPos) {
        t += dt;
        const near = Math.hypot(playerPos.x - h.root.position.x, playerPos.z - h.root.position.z) < 2.5;
        talkPause = near ? 1 : Math.max(0, talkPause - dt);
        h.armL.rotation.x = -0.7;
        h.elbowL.rotation.x = -0.6;
        h.spine.rotation.x = 0.15;
        if (talkPause > 0) { h.armR.rotation.x += (-0.2 - h.armR.rotation.x) * dt * 5; return; }
        // Coups de marteau réguliers
        const cycle = (t % 0.9) / 0.9;
        const a = cycle < 0.6 ? -0.6 - (cycle / 0.6) * 1.6 : -2.2 + ((cycle - 0.6) / 0.4) * 1.6;
        h.armR.rotation.x = a;
        h.elbowR.rotation.x = -0.5;
        if (cycle > 0.95 && !struck) {
          struck = true;
          atDistance(Math.hypot(playerPos.x - F.x, playerPos.z - F.z), playAnvil, 40);
        }
        if (cycle < 0.5) struck = false;
        forgeGlow.emissiveIntensity = 2.2 + Math.sin(t * 3.1) * 0.4 + Math.sin(t * 7.3) * 0.2;
      },
    };
  })();
  npcs.push(smith);

  // ---------- Villageois qui se promènent ----------
  const routes = [
    { look: { outfit: 'peasant', tunic: 0x6a5a3a, trousers: 0x4a4038, hair: 0x5a3a1e }, path: [[-1.4, 50], [-1.4, 15]] },
    { look: { outfit: 'dress', tunic: 0x7a4a3a, hair: 0x3a2a1a }, path: [[-3.6, 16], [-3.6, 48]] },
    { look: { outfit: 'peasant', tunic: 0x4a5a6a, trousers: 0x3a3028, hair: 0x8a6a3a, beard: 0x8a6a3a }, path: [[-2.5, 6], [-15.5, 6]] },
    { look: { outfit: 'dress', tunic: 0x5a6a4a, hair: 0x6a3a1a }, path: [[27, 29], [27, 50]] },
  ];
  routes.forEach((r, i) => {
    const h = createHumanoid(r.look);
    const [sx, sz] = r.path[i % r.path.length];
    h.root.position.set(sx, 0, sz);
    scene.add(h.root);
    let target = 1, wait = Math.random() * 3, phase = 0, walkAmt = 0;
    const lines = VILLAGER_LINES;
    npcs.push({
      id: 'villageois', name: r.look.outfit === 'dress' ? 'Villageoise' : 'Villageois', h, object: h.root, markerHeight: 2.3,
      lines: [lines[i % lines.length], lines[(i + 3) % lines.length]],
      update(dt, playerPos) {
        const p = h.root.position;
        const [tx, tz] = r.path[target];
        const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
        const toPlayer = Math.hypot(playerPos.x - p.x, playerPos.z - p.z);
        let moving = false;
        if (wait > 0) wait -= dt;
        else if (d < 0.3) { target = (target + 1) % r.path.length; wait = 3 + Math.random() * 4; }
        else if (toPlayer > 1.6) {
          const speed = 1.15;
          p.x += (dx / d) * speed * dt;
          p.z += (dz / d) * speed * dt;
          const want = Math.atan2(dx, dz);
          h.root.rotation.y += Math.atan2(Math.sin(want - h.root.rotation.y), Math.cos(want - h.root.rotation.y)) * Math.min(1, dt * 6);
          moving = true;
        }
        if (!moving && toPlayer < 3) {
          const want = Math.atan2(playerPos.x - p.x, playerPos.z - p.z);
          h.root.rotation.y += Math.atan2(Math.sin(want - h.root.rotation.y), Math.cos(want - h.root.rotation.y)) * Math.min(1, dt * 4);
        }
        walkAmt += ((moving ? 0.55 : 0) - walkAmt) * Math.min(1, dt * 8);
        phase += dt * 7 * walkAmt * 1.6;
        animateWalk(h, phase, walkAmt);
      },
    });
  });

  // ---------- Poules ----------
  const chickens = [];
  const center = { x: -4.6, z: 25 };
  const white = mat(0xe8e2d4), brown = mat(0x9a5a2a), red = mat(0xb02018), yellow = mat(0xd8a030);
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    const feathers = i % 3 === 0 ? brown : white;
    mesh(new THREE.SphereGeometry(0.15, 10, 8), feathers, body, 0, 0.22, 0).scale.set(0.85, 0.9, 1.15);
    mesh(new THREE.ConeGeometry(0.08, 0.16, 6), feathers, body, 0, 0.32, -0.15).rotation.x = -0.9;
    const head = new THREE.Group();
    head.position.set(0, 0.36, 0.13);
    body.add(head);
    mesh(new THREE.SphereGeometry(0.065, 8, 6), feathers, head);
    mesh(new THREE.ConeGeometry(0.02, 0.06, 4).rotateX(Math.PI / 2), yellow, head, 0, -0.01, 0.07);
    mesh(new THREE.BoxGeometry(0.015, 0.05, 0.06), red, head, 0, 0.065, 0.01);
    for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4), yellow, g, s * 0.05, 0.07, 0);
    g.position.set(center.x + (Math.random() - 0.5) * 4, 0, center.z + (Math.random() - 0.5) * 4);
    scene.add(g);
    chickens.push({ g, body, head, tx: g.position.x, tz: g.position.z, wait: Math.random() * 2, peck: 0, cluckIn: 3 + Math.random() * 8 });
  }

  return {
    npcs,
    update(dt, playerPos, night = 0) {
      // La nuit, les villageois et les poules sont rentrés
      const home = night > 0.6;
      for (const n of npcs) {
        n.object.visible = !home;
        if (!home) n.update(dt, playerPos);
      }
      for (const c of chickens) c.g.visible = !home;
      if (home) return;
      for (const c of chickens) {
        const p = c.g.position;
        // Les poules s'écartent quand on s'approche
        const px = p.x - playerPos.x, pz = p.z - playerPos.z, pd = Math.hypot(px, pz);
        if (pd < 1.5) { c.tx = p.x + (px / pd) * 2.5; c.tz = p.z + (pz / pd) * 2.5; c.wait = 0; }
        const dx = c.tx - p.x, dz = c.tz - p.z, d = Math.hypot(dx, dz);
        if (c.wait > 0) {
          c.wait -= dt;
          c.peck += dt * 9;
          c.head.rotation.x = Math.max(0, Math.sin(c.peck)) * 1.2;
        } else if (d < 0.1) {
          c.wait = 1 + Math.random() * 3;
          const a = Math.random() * Math.PI * 2, r = Math.random() * 3;
          c.tx = center.x + Math.cos(a) * r; c.tz = center.z + Math.sin(a) * r;
        } else {
          const speed = pd < 2 ? 2.2 : 0.7;
          p.x += (dx / d) * Math.min(d, speed * dt);
          p.z += (dz / d) * Math.min(d, speed * dt);
          c.g.rotation.y = Math.atan2(dx, dz);
          c.body.position.y = Math.abs(Math.sin(performance.now() * 0.02)) * 0.02;
          c.head.rotation.x = 0;
        }
        c.cluckIn -= dt;
        if (c.cluckIn < 0) {
          c.cluckIn = 5 + Math.random() * 12;
          atDistance(pd, playCluck, 20);
        }
      }
    },
  };
}
