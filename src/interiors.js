// Intérieurs : grande salle du donjon, église, taverne « À la Pomme d'Or ».
// Les pièces sont construites loin du village (x = 250) ; on y entre par un fondu au noir.
import * as THREE from 'three';
import { Tex, metricBoxUV } from './textures.js?v=202611261343';
import { makeNPC } from './npcs.js?v=202611261343';
import { createHumanoid } from './humanoid.js?v=202611261343';

export const ROOMS = {
  hall: {
    name: 'la grande salle', origin: { x: 250, z: -60 }, w: 16, d: 11, h: 6.5,
    door: { x: 0, z: -40.2, rot: 0 },     // devant la porte du donjon (dehors), regard vers le sud
  },
  church: {
    name: 'l\'église', origin: { x: 250, z: 0 }, w: 8, d: 16, h: 8,
    door: { x: -20, z: -4.6, rot: Math.PI },
  },
  tavern: {
    name: 'la taverne', origin: { x: 250, z: 60 }, w: 12, d: 9, h: 4.2,
    door: { x: 4.6, z: 44, rot: -Math.PI / 2 },
  },
  // Chapitre V : la grande salle du comte (on n'y entre que par l'histoire)
  court: {
    name: 'la cour du comte', origin: { x: 250, z: 140 }, w: 14, d: 24, h: 9,
    door: { x: 0, z: -28.5, rot: Math.PI }, locked: true,
  },
};

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
}

export function createInteriors(scene, world) {
  const stoneT = Tex.stone(), stoneL = Tex.stoneLight(), woodT = Tex.wood(), timberT = Tex.timber(), plasterT = Tex.plaster();
  const tmat = (t, color = 0xffffff, extra = {}) => mat(color, { map: t.map, normalMap: t.normalMap, ...extra });
  const M = {
    stone: tmat(stoneT), stoneLight: tmat(stoneL), floor: tmat(woodT, 0xb08a60), timber: tmat(timberT),
    plaster: tmat(plasterT), wood: tmat(woodT), dark: mat(0x1a1410),
    cloth: mat(0x22386e, { side: THREE.DoubleSide }), gold: mat(0xd8b04a, { side: THREE.DoubleSide }),
    red: mat(0x8a1f18, { side: THREE.DoubleSide }),
    fire: new THREE.MeshStandardMaterial({ color: 0x331000, emissive: 0xff6a18, emissiveIntensity: 3 }),
    candle: new THREE.MeshStandardMaterial({ color: 0xeee6cc, emissive: 0xffc060, emissiveIntensity: 0.6 }),
    flame: new THREE.MeshStandardMaterial({ color: 0x331000, emissive: 0xffb040, emissiveIntensity: 4 }),
  };
  const fires = [];
  const npcs = [];

  function box(w, h, d, x, y, z, material, { collide = true, parent = scene } = {}) {
    const m = new THREE.Mesh(metricBoxUV(new THREE.BoxGeometry(w, h, d), w, h, d), material);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    if (collide) world.boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: y + h });
    return m;
  }

  /** Une pièce fermée : sol, murs, plafond à poutres. La porte est au sud (z max). */
  function room(R, wallMat, floorMat) {
    const { x, z } = R.origin, { w, d, h } = R;
    const T = 0.5;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), floorMat);
    const uv = floor.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
    floor.position.set(x, 0.01, z);
    floor.receiveShadow = true;
    scene.add(floor);
    box(w + T * 2, h, T, x, 0, z - d / 2 - T / 2, wallMat);
    box(w + T * 2, h, T, x, 0, z + d / 2 + T / 2, wallMat);
    box(T, h, d, x - w / 2 - T / 2, 0, z, wallMat);
    box(T, h, d, x + w / 2 + T / 2, 0, z, wallMat);
    box(w + T * 2, 0.3, d + T * 2, x, h, z, M.timber, { collide: false });
    for (let k = -d / 2 + 1.5; k < d / 2; k += 2.5) box(w, 0.25, 0.25, x, h - 0.25, z + k, M.timber, { collide: false });
    // Porte (côté intérieur)
    box(1.4, 2.4, 0.08, x, 0, z + d / 2 - 0.02, M.dark, { collide: false });
    box(1.7, 0.15, 0.15, x, 2.4, z + d / 2 - 0.05, M.timber, { collide: false });
    world.indoor.push({ minX: x - w / 2 - 1, maxX: x + w / 2 + 1, minZ: z - d / 2 - 1, maxZ: z + d / 2 + 1 });
    R.bounds = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h };
    R.spawn = { x: x - 0.6, z: z + d / 2 - 3.4, rot: Math.PI };
    R.exit = { x, z: z + d / 2 - 0.5 };
  }

  function fire(x, y, z, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    scene.add(g);
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.18 * scale, 0.6 * scale, 7), M.fire);
      f.position.set((i - 1) * 0.18 * scale, 0.3 * scale, (i % 2) * 0.08);
      g.add(f);
    }
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7 * scale, 6).rotateZ(Math.PI / 2), M.timber);
      log.rotation.y = i * 1.1;
      g.add(log);
    }
    fires.push(g);
    return g;
  }

  function candle(x, y, z) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), M.candle);
    c.position.set(x, y + 0.11, z);
    scene.add(c);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 6), M.flame);
    f.position.set(x, y + 0.26, z);
    scene.add(f);
  }

  function banner(x, y, z, rotY, main = M.cloth) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), main);
    b.position.set(x, y, z);
    b.rotation.y = rotY;
    scene.add(b);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.9), M.gold);
    c.position.set(x + Math.sin(rotY) * 0.01, y + 0.1, z + Math.cos(rotY) * 0.01);
    c.rotation.y = rotY;
    scene.add(c);
  }

  function sit(h) {
    h.root.position.y = -0.4;
    h.legL.rotation.x = h.legR.rotation.x = -1.5;
    h.kneeL.rotation.x = h.kneeR.rotation.x = 1.5;
    h.armL.rotation.x = h.armR.rotation.x = -0.7;
    h.elbowL.rotation.x = h.elbowR.rotation.x = -0.8;
  }

  // ---------- Grande salle du donjon ----------
  {
    const R = ROOMS.hall;
    room(R, M.stone, M.floor);
    const { x, z } = R.origin;
    // Longue table et bancs
    box(1.4, 0.8, 7, x, 0, z, M.wood);
    box(0.4, 0.45, 7, x - 1.2, 0, z, M.wood, { collide: false });
    box(0.4, 0.45, 7, x + 1.2, 0, z, M.wood, { collide: false });
    for (const dz of [-2.5, -0.5, 1.5]) { candle(x, 0.8, z + dz); }
    // Estrade et siège du seigneur au nord
    box(5, 0.35, 2.2, x, 0, z - 4.2, M.wood);
    box(1.1, 0.6, 0.9, x, 0.35, z - 4.3, M.timber);
    box(1.1, 1.6, 0.2, x, 0.35, z - 4.75, M.timber);
    // Cheminée à l'est
    box(0.8, 3.2, 2.6, x + 7.6, 0, z - 1, M.stoneLight);
    box(0.3, 1.2, 1.6, x + 7.2, 0, z - 1, M.dark, { collide: false });
    fire(x + 7.0, 0.05, z - 1, 1.1);
    // Bannières et râtelier d'armes
    banner(x - 7.7, 3.4, z - 2, Math.PI / 2);
    banner(x - 7.7, 3.4, z + 2, Math.PI / 2, M.red);
    banner(x, 4.0, z - 5.45, 0);
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 6), M.timber);
      sp.position.set(x - 7.5, 1.1, z + 4 - i * 0.4);
      sp.rotation.x = 0.1;
      scene.add(sp);
    }
    // Hersende, la servante
    const servant = makeNPC(scene, world, {
      id: 'hersende', name: 'Hersende, servante', x: x - 3.5, z: z - 1.5, rotY: Math.PI / 2,
      look: { outfit: 'dress', tunic: 0x6a4a3a, hair: 0x4a2a1a },
    });
    servant.lines = [
      ['Le seigneur prend ses repas ici, avec ses gens. Et ne touche pas aux tartes, elles sont pour ce soir !'],
      ['Ce feu brûle jour et nuit, l\'hiver comme l\'été. Les pierres du donjon sont froides comme une tombe.'],
      ['On dit qu\'au temps du vieux seigneur, on dansait ici jusqu\'à l\'aube. Ce temps-là reviendra peut-être, quand tu seras chevalier.'],
    ];
    npcs.push(servant);
    R.light = { x: x + 6.6, y: 1.2, z: z - 1, color: 0xff8a40, intensity: 18, distance: 22 };
    R.light2 = { x, y: 1.6, z: z - 1, color: 0xffb060, intensity: 5, distance: 12 };
  }

  // ---------- Église ----------
  {
    const R = ROOMS.church;
    room(R, M.stoneLight, M.stone);
    const { x, z } = R.origin;
    // Bancs
    for (let r = 0; r < 5; r++) {
      for (const s of [-1, 1]) box(2.6, 0.45, 0.45, x + s * 1.9, 0, z + 4.5 - r * 1.7, M.wood);
    }
    // Autel, nappe, cierges, croix
    box(2.2, 1.0, 1.0, x, 0, z - 6.6, M.stoneLight);
    box(2.3, 0.04, 1.05, x, 1.0, z - 6.6, mat(0xeee6d4), { collide: false });
    for (const dx of [-0.8, -0.4, 0.4, 0.8]) candle(x + dx, 1.04, z - 6.7);
    box(0.14, 2.0, 0.1, x, 1.8, z - 7.9, M.gold, { collide: false });
    box(1.0, 0.14, 0.1, x, 3.2, z - 7.9, M.gold, { collide: false });
    // Vitraux (lumière colorée)
    const glass = [0xb02a1a, 0x2a4ab0, 0xd8a020];
    for (let i = 0; i < 3; i++) {
      for (const s of [-1, 1]) {
        const g = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.8), new THREE.MeshStandardMaterial({ color: glass[i], emissive: glass[i], emissiveIntensity: 1.3, side: THREE.DoubleSide }));
        g.position.set(x + s * 3.95, 4.6, z - 4 + i * 4);
        g.rotation.y = Math.PI / 2;
        scene.add(g);
      }
    }
    R.light = { x, y: 2.2, z: z - 5.8, color: 0xffc070, intensity: 10, distance: 16 };
    R.light2 = { x, y: 5, z: z + 2, color: 0x8090c0, intensity: 4, distance: 14 };
    R.altar = { x, z: z - 5.7 };
  }

  // ---------- Taverne « À la Pomme d'Or » ----------
  {
    const R = ROOMS.tavern;
    room(R, M.plaster, M.floor);
    const { x, z } = R.origin;
    // Comptoir et tonneaux
    box(4, 1.1, 0.7, x + 2.5, 0, z - 2.6, M.timber);
    for (const dx of [1.2, 2.2, 3.2, 4.2]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 12).rotateZ(Math.PI / 2), M.wood);
      b.position.set(x + dx, 0.45, z - 4.0);
      b.castShadow = true;
      scene.add(b);
    }
    world.boxes.push({ minX: x + 0.7, maxX: x + 4.7, minZ: z - 4.5, maxZ: z - 3.5, top: 99 });
    // Tables et tabourets
    const tables = [[x - 3, z - 1.5], [x - 3, z + 2], [x + 1, z + 1.8]];
    for (const [tx, tz] of tables) {
      box(1.6, 0.75, 1.0, tx, 0, tz, M.wood);
      for (const s of [-1, 1]) {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.45, 8), M.wood);
        st.position.set(tx + s * 1.1, 0.22, tz);
        st.castShadow = true;
        scene.add(st);
      }
      // Chope sur la table
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.14, 8), M.timber);
      mug.position.set(tx + 0.3, 0.82, tz);
      scene.add(mug);
      candle(tx - 0.3, 0.75, tz);
    }
    // Cheminée au fond
    box(2.2, 2.6, 0.7, x - 3, 0, z - 4.2, M.stone);
    box(1.4, 1.0, 0.3, x - 3, 0, z - 3.85, M.dark, { collide: false });
    fire(x - 3, 0.05, z - 3.7, 0.9);
    // Raoul, le tavernier, et deux clients
    const keeper = makeNPC(scene, world, {
      id: 'tavernier', name: 'Raoul, tavernier', x: x + 2.5, z: z - 3.3, rotY: 0,
      look: { outfit: 'peasant', tunic: 0x6a5a3a, trousers: 0x3a3028, hair: 0x2a1a10, beard: 0x6a4a2a },
    });
    npcs.push(keeper);
    const patrons = [
      { id: 'client', name: 'Un vieux soldat', x: x - 4.1, z: z + 2, rot: Math.PI / 2, look: { outfit: 'gambeson', trousers: 0x3a3028, hair: 0x8a8070, beard: 0x8a8070 },
        lines: [['À ton âge, j\'étais déjà à Antioche avec le comte. Il faisait si chaud que les chevaux tombaient comme des mouches.'], ['Un conseil, petit : pare d\'abord, frappe ensuite. Les morts sont ceux qui frappent les premiers.']] },
      { id: 'client', name: 'Un marchand', x: x + 2.1, z: z + 1.8, rot: -Math.PI / 2, look: { outfit: 'lord', tunic: 0x5a2a4a, trousers: 0x2a2a30, hair: 0x4a3020, cloak: 0x3a3a3a },
        lines: [['Je vends du drap de Flandre à la foire de Troyes. Les routes ne sont plus sûres : on parle d\'un borgne qui rançonne les voyageurs.'], ['La Pentecôte ? Toute la noblesse du comté sera à la cour. Beaucoup de belles bourses sur les routes… et beaucoup de brigands.']] },
    ];
    for (const p of patrons) {
      const n = makeNPC(scene, world, { id: p.id, name: p.name, x: p.x, z: p.z, rotY: p.rot, look: p.look, pose: sit });
      n.lines = p.lines;
      n.seated = true;
      npcs.push(n);
    }
    R.light = { x: x - 3, y: 1.2, z: z - 3.2, color: 0xff8a40, intensity: 12, distance: 14 };
    R.light2 = { x: x + 1, y: 3.2, z: z + 1, color: 0xffb060, intensity: 6, distance: 12 };
  }

  // ---------- Grande salle du comte ----------
  {
    const R = ROOMS.court;
    room(R, M.stoneLight, M.stone);
    const { x, z } = R.origin;
    // Tapis rouge jusqu'au trône
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 20).rotateX(-Math.PI / 2), mat(0x7a1418, { roughness: 1 }));
    carpet.position.set(x, 0.02, z + 0.5);
    carpet.receiveShadow = true;
    scene.add(carpet);
    // Colonnes
    for (let k = -8; k <= 8; k += 4) {
      for (const sx of [-4.6, 4.6]) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, R.h, 14), M.stoneLight);
        c.position.set(x + sx, R.h / 2, z + k);
        c.castShadow = c.receiveShadow = true;
        scene.add(c);
        world.circles.push({ x: x + sx, z: z + k, r: 0.5, top: 99 });
      }
    }
    // Estrade, trône et dais
    box(6, 0.3, 3, x, 0, z - 10.4, M.wood);
    box(4, 0.3, 2, x, 0.3, z - 10.9, M.wood);
    box(1.3, 0.7, 1.0, x, 0.6, z - 11.2, M.timber);
    box(1.3, 2.4, 0.25, x, 0.6, z - 11.65, M.timber);
    const dais = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.6), M.cloth);
    dais.position.set(x, 5.2, z - 11.9);
    scene.add(dais);
    banner(x, 7.2, z - 11.85, 0, M.red);
    // Bannières des seigneurs du comté, le long des murs
    const colors = [0x22386e, 0x8a1f18, 0x2a5a2a, 0x6a2a6a, 0xb8902a, 0x22386e];
    colors.forEach((c, i) => {
      const side = i % 2 ? 1 : -1;
      const m = mat(c, { side: THREE.DoubleSide });
      banner(x + side * 6.9, 5.5, z - 7 + Math.floor(i / 2) * 6, -side * Math.PI / 2, m);
    });
    // Chandeliers sur pied
    for (const [dx, dz] of [[-2.2, -9], [2.2, -9], [-2.2, -2], [2.2, -2], [-2.2, 5], [2.2, 5]]) {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, 1.6, 8), mat(0x6a5020, { metalness: 0.7, roughness: 0.4 }));
      stand.position.set(x + dx, 0.8, z + dz);
      scene.add(stand);
      candle(x + dx, 1.6, z + dz);
    }
    // Hautes fenêtres lumineuses
    for (let k = -8; k <= 8; k += 5.3) {
      for (const sx of [-1, 1]) {
        const g = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.6), new THREE.MeshStandardMaterial({ color: 0xffeacc, emissive: 0xffe0b0, emissiveIntensity: 1.2, side: THREE.DoubleSide }));
        g.position.set(x + sx * 6.97, 6.2, z + k);
        g.rotation.y = Math.PI / 2;
        scene.add(g);
      }
    }
    R.light = { x, y: 4, z: z - 8, color: 0xffd8a0, intensity: 30, distance: 30 };
    R.light2 = { x, y: 6, z: z + 4, color: 0xffe8c8, intensity: 18, distance: 26 };
    R.kneel = { x, z: z - 7.6 };
  }

  // Enseigne de la taverne (dehors, au-dessus de la porte)
  {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#5a3b22'; ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 248, 120);
    ctx.fillStyle = '#d8b04a';
    ctx.beginPath(); ctx.arc(60, 64, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a6a20'; ctx.fillRect(56, 26, 6, 12);
    ctx.fillStyle = '#f0e0c0'; ctx.font = 'bold 26px Georgia'; ctx.textAlign = 'left';
    ctx.fillText('À la', 104, 56); ctx.fillText('Pomme d\'Or', 104, 90);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 1.4), [M.timber, M.timber, M.timber, M.timber, M.timber, M.timber]);
    sign.material = [new THREE.MeshStandardMaterial({ map: tex }), new THREE.MeshStandardMaterial({ map: tex }), M.timber, M.timber, M.timber, M.timber];
    sign.position.set(4.7, 3.0, 45.6);
    sign.castShadow = true;
    scene.add(sign);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.06), M.timber);
    arm.position.set(5.0, 3.4, 45.6);
    scene.add(arm);
  }

  // Deux lumières partagées, déplacées dans la pièce où l'on entre
  const light1 = new THREE.PointLight(0xff8a40, 0, 20, 2);
  const light2 = new THREE.PointLight(0xffb060, 0, 12, 2);
  scene.add(light1, light2);

  let current = null;
  let t = 0;
  return {
    npcs,
    get current() { return current; },
    get room() { return current ? ROOMS[current] : null; },

    /** Porte la plus proche (dehors) à moins de 1,8 m, ou sortie (dedans). */
    nearDoor(pos) {
      if (current) {
        const e = ROOMS[current].exit;
        if (ROOMS[current].locked) return null;
        return Math.hypot(pos.x - e.x, pos.z - e.z) < 1.6 ? { id: current, exit: true } : null;
      }
      for (const [id, R] of Object.entries(ROOMS)) {
        if (R.locked) continue;
        if (Math.hypot(pos.x - R.door.x, pos.z - R.door.z) < 1.8) return { id, exit: false };
      }
      return null;
    },

    nearAltar(pos) {
      if (current !== 'church') return false;
      const a = ROOMS.church.altar;
      return Math.hypot(pos.x - a.x, pos.z - a.z) < 1.8;
    },

    enter(id, player) {
      const R = ROOMS[id];
      current = id;
      player.position.set(R.spawn.x, 0, R.spawn.z);
      player.object.rotation.y = R.spawn.rot;
      for (const [L, cfg] of [[light1, R.light], [light2, R.light2]]) {
        L.position.set(cfg.x, cfg.y, cfg.z);
        L.color.setHex(cfg.color);
        L.distance = cfg.distance;
        L.userData.base = cfg.intensity;
      }
      return R;
    },

    exit(player) {
      const R = ROOMS[current];
      current = null;
      light1.intensity = light2.intensity = 0;
      player.position.set(R.door.x, 0, R.door.z);
      player.object.rotation.y = R.door.rot;
      return R;
    },

    update(dt) {
      t += dt;
      for (const f of fires) {
        f.children.forEach((c, i) => { if (i < 3) c.scale.y = 0.85 + Math.sin(t * 11 + i * 2) * 0.15 + Math.sin(t * 23 + i) * 0.08; });
      }
      if (current) {
        const flick = 0.88 + Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.06;
        light1.intensity = light1.userData.base * flick;
        light2.intensity = light2.userData.base;
      }
    },
  };
}
