// Le monde : terrain, château de Montclair, village, église, terrain d'entraînement, forêt.
import * as THREE from 'three';
import { Tex, metricBoxUV, metricCylinderUV } from './textures.js?v=202611251954';
import { createSky, SKY } from './sky.js?v=202611251954';

// Générateur aléatoire "à graine" : le monde est identique à chaque partie.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const WORLD_RADIUS = 90;

export function buildWorld(scene) {
  const rng = mulberry32(1126);
  const boxes = [];   // obstacles rectangulaires { minX, maxX, minZ, maxZ, top }
  const circles = []; // obstacles ronds { x, z, r, top }
  const animated = []; // objets à animer chaque image
  const bare = [];     // zones sans herbe (chemins, cours…)

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
  /** Matériau texturé. Les textures sont prévues pour des coordonnées en mètres. */
  const tmat = (name, extra = {}, repeat = null) => {
    const t = Tex[name]();
    let map = t.map, normalMap = t.normalMap;
    if (repeat) {
      map = map.clone(); normalMap = normalMap.clone();
      map.repeat.set(repeat[0], repeat[1]); normalMap.repeat.set(repeat[0], repeat[1]);
      map.needsUpdate = normalMap.needsUpdate = true;
    }
    return new THREE.MeshStandardMaterial({ map, normalMap, roughness: 0.92, ...extra });
  };
  const flat = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
  const M = {
    stone: tmat('stone'), stoneLight: tmat('stoneLight'), stoneDark: tmat('stone', { color: 0x8a847a }),
    slate: tmat('slate'), slateCone: tmat('slate', {}, [6, 2.5]), thatch: tmat('thatch'), plaster: tmat('plaster'),
    timber: tmat('timber'), wood: tmat('wood'), door: tmat('timber', { color: 0x9a8070 }),
    dark: mat(0x15110d), dirt: tmat('dirt', flat),
    courtyard: tmat('sand', { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    hay: tmat('thatch', { color: 0xe8d08a }), water: mat(0x23394a, { roughness: 0.08, metalness: 0.3 }),
  };

  // ---------- Ciel, brume et lumière ----------
  // Soleil bas d'automne, à l'ouest-sud-ouest : longues ombres et lumière dorée
  const sunOffset = new THREE.Vector3(-70, 32, 38);
  const sunDir = sunOffset.clone().normalize();
  scene.fog = new THREE.FogExp2(SKY.fog, 0.0095);
  const sky = createSky(sunDir);
  scene.add(sky);
  animated.push({ update: (dt, camPos) => sky.position.copy(camPos) });

  scene.add(new THREE.HemisphereLight(0xa8bcd6, 0x4a3f2e, 0.5));
  const sun = new THREE.DirectionalLight(0xffd6a0, 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.05;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  // ---------- Sol ----------
  {
    const geo = new THREE.PlaneGeometry(400, 400, 100, 100);
    geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 400, uv.getY(i) * 400);
    // Grandes taches de couleur pour casser la répétition de la texture
    const colors = [];
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const n = Math.sin(x * 0.05 + Math.sin(z * 0.03) * 2) * 0.5 + Math.sin(z * 0.07 + x * 0.02) * 0.5;
      const v = 0.85 + n * 0.12 + (rng() - 0.5) * 0.06;
      colors.push(v, v * (0.98 + n * 0.03), v * 0.95);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const t = Tex.grass();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: t.map, normalMap: t.normalMap, roughness: 1 }));
    ground.receiveShadow = true;
    scene.add(ground);
  }

  // Collines lointaines
  {
    const hillMat = mat(0x5a6a3a);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rng() * 0.2;
      const d = 150 + rng() * 40;
      const r = 30 + rng() * 25;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), hillMat);
      hill.scale.y = 0.3 + rng() * 0.25;
      hill.position.set(Math.cos(a) * d, -r * 0.05, Math.sin(a) * d);
      scene.add(hill);
    }
  }

  // ---------- Fonctions de construction ----------
  function addCollider(minX, maxX, minZ, maxZ, top = 99) {
    boxes.push({ minX, maxX, minZ, maxZ, top });
  }

  /** Boîte posée au sol (y = base). rotY doit être 0 ou ±PI/2. */
  function box(w, h, d, x, y, z, material, { collide = true, rotY = 0, parent = scene, shadow = true } = {}) {
    const m = new THREE.Mesh(metricBoxUV(new THREE.BoxGeometry(w, h, d), w, h, d), material);
    m.position.set(x, y + h / 2, z);
    m.rotation.y = rotY;
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    if (collide) {
      const swap = Math.abs(Math.sin(rotY)) > 0.5;
      const hw = (swap ? d : w) / 2, hd = (swap ? w : d) / 2;
      addCollider(x - hw, x + hw, z - hd, z + hd, y + h);
    }
    return m;
  }

  function cylinder(r, h, x, y, z, material, { collide = true, segments = 16, rTop = r } = {}) {
    const m = new THREE.Mesh(metricCylinderUV(new THREE.CylinderGeometry(rTop, r, h, segments), r, h), material);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    if (collide) circles.push({ x, z, r: Math.max(r, rTop), top: y + h });
    return m;
  }

  function cone(r, h, x, y, z, material, segments = 16, rotY = 0) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, segments), material);
    m.position.set(x, y + h / 2, z);
    m.rotation.y = rotY;
    m.castShadow = true;
    scene.add(m);
    return m;
  }

  /** Chemin de terre rectiligne (aligné sur un axe). */
  function path(x1, z1, x2, z2, width, material = M.dirt) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const pw = x1 === x2 ? width : len, pd = x1 === x2 ? len : width;
    const geo = new THREE.PlaneGeometry(pw, pd);
    geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * pw, uv.getY(i) * pd);
    bare.push({ minX: (x1 + x2) / 2 - pw / 2, maxX: (x1 + x2) / 2 + pw / 2, minZ: (z1 + z2) / 2 - pd / 2, maxZ: (z1 + z2) / 2 + pd / 2 });
    const m = new THREE.Mesh(geo, material);
    m.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2);
    m.receiveShadow = true;
    scene.add(m);
  }

  /** Toit à deux pans (prisme triangulaire), faîtage le long de Z. */
  function gableRoof(w, d, h, overhang, material) {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 - overhang, 0);
    shape.lineTo(w / 2 + overhang, 0);
    shape.lineTo(0, h);
    shape.closePath();
    const depth = d + overhang * 2;
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geo.translate(0, 0, -depth / 2);
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  // Créneaux (merlons) : un seul objet "instancié" pour tout le château
  const merlonList = [];
  function merlonsAlong(x1, z1, x2, z2, y, thickness) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.floor(len / 1.4);
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    for (let i = 0; i <= n; i++) {
      const t = n === 0 ? 0.5 : i / n;
      merlonList.push({ x: x1 + (x2 - x1) * t, y, z: z1 + (z2 - z1) * t, rot: alongX ? 0 : Math.PI / 2, s: thickness });
    }
  }
  function merlonsRing(x, z, r, y, count) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      merlonList.push({ x: x + Math.cos(a) * (r - 0.3), y, z: z + Math.sin(a) * (r - 0.3), rot: -a, s: 0.6 });
    }
  }

  const flags = [];
  function flag(x, y, z, color = 0x2b4a9a) {
    cylinder(0.06, 3, x, y, z, M.timber, { collide: false, segments: 6 });
    const cloth = new THREE.Group();
    cloth.position.set(x, y + 2.6, z);
    const geo = new THREE.PlaneGeometry(1.6, 0.9, 8, 1);
    geo.translate(0.8, 0, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 1 }));
    m.castShadow = true;
    cloth.add(m);
    const cross = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0xe8c66a, side: THREE.DoubleSide }));
    cross.position.set(0.8, 0, 0.01);
    cloth.add(cross);
    scene.add(cloth);
    flags.push({ geo, base: geo.attributes.position.array.slice(), phase: rng() * 6 });
  }

  // ---------- Château de Montclair (au nord) ----------
  const CZ = -40, HALF = 18, WALL_H = 6, WALL_T = 1.6;
  {
    path(-HALF + 1, CZ, HALF - 1, CZ, 2 * HALF - 2, M.courtyard); // cour intérieure
    const north = CZ - HALF, south = CZ + HALF;
    // Murailles
    box(2 * HALF, WALL_H, WALL_T, 0, 0, north, M.stone);
    box(WALL_T, WALL_H, 2 * HALF, -HALF, 0, CZ, M.stone);
    box(WALL_T, WALL_H, 2 * HALF, HALF, 0, CZ, M.stone);
    const gateHalf = 4.2;
    const segLen = HALF - gateHalf;
    box(segLen, WALL_H, WALL_T, -(gateHalf + segLen / 2), 0, south, M.stone);
    box(segLen, WALL_H, WALL_T, gateHalf + segLen / 2, 0, south, M.stone);
    merlonsAlong(-HALF, north, HALF, north, WALL_H, WALL_T);
    merlonsAlong(-HALF, north, -HALF, south, WALL_H, WALL_T);
    merlonsAlong(HALF, north, HALF, south, WALL_H, WALL_T);
    merlonsAlong(-HALF, south, -gateHalf - 2, south, WALL_H, WALL_T);
    merlonsAlong(gateHalf + 2, south, HALF, south, WALL_H, WALL_T);

    // Tours d'angle
    for (const [x, z] of [[-HALF, north], [HALF, north], [-HALF, south], [HALF, south]]) {
      cylinder(3, 10, x, 0, z, M.stone, { segments: 18 });
      cone(3.5, 4.5, x, 10, z, M.slateCone, 18);
    }
    // Tours de la porte + arche
    for (const x of [-gateHalf, gateHalf]) {
      cylinder(2.2, 8.5, x, 0, south, M.stoneLight, { segments: 16 });
      merlonsRing(x, south, 2.2, 8.5, 9);
    }
    box(2 * gateHalf - 2, 2.6, WALL_T + 0.4, 0, 5.4, south, M.stoneLight, { collide: false });
    merlonsAlong(-gateHalf + 1.5, south, gateHalf - 1.5, south, 8, WALL_T);
    // Herse relevée (grille en bois au-dessus de l'entrée)
    box(4, 0.6, 0.2, 0, 4.8, south + 0.9, M.timber, { collide: false });
    flag(-gateHalf, 8.5, south);
    flag(gateHalf, 8.5, south);

    // Donjon roman
    const KZ = CZ - 7;
    box(11, 14, 11, 0, 0, KZ, M.stone);
    merlonsAlong(-5.5, KZ - 5.5, 5.5, KZ - 5.5, 14, 0.8);
    merlonsAlong(-5.5, KZ + 5.5, 5.5, KZ + 5.5, 14, 0.8);
    merlonsAlong(-5.5, KZ - 5.5, -5.5, KZ + 5.5, 14, 0.8);
    merlonsAlong(5.5, KZ - 5.5, 5.5, KZ + 5.5, 14, 0.8);
    box(1.6, 2.6, 0.2, 0, 0, KZ + 5.55, M.door, { collide: false });
    for (const y of [5, 9.5]) {
      for (const x of [-3, 3]) box(0.5, 1.2, 0.2, x, y, KZ + 5.55, M.dark, { collide: false, shadow: false });
      for (const z of [-3, 3]) {
        box(0.2, 1.2, 0.5, -5.55, y, KZ + z, M.dark, { collide: false, shadow: false });
        box(0.2, 1.2, 0.5, 5.55, y, KZ + z, M.dark, { collide: false, shadow: false });
      }
    }
    flag(0, 14, KZ, 0x2b4a9a);

    // Écuries en bois contre la muraille ouest
    box(4, 3, 10, -HALF + 3, 0, CZ + 4, M.wood);
    const stableRoof = gableRoof(4, 10, 1.4, 0.3, M.thatch);
    stableRoof.position.set(-HALF + 3, 3, CZ + 4);
    scene.add(stableRoof);
    // Tonneaux et caisses dans la cour
    for (const [x, z] of [[10, CZ + 8], [11, CZ + 9.2], [9.6, CZ + 10]]) {
      cylinder(0.45, 1, x, 0, z, M.wood, { segments: 10 });
    }
    box(1, 1, 1, 12, 0, CZ + 6, M.wood);
    box(0.8, 0.8, 0.8, 12.2, 1, CZ + 6, M.wood, { collide: false });
  }

  // Créneaux : création de l'objet instancié
  {
    const geo = new THREE.BoxGeometry(0.8, 0.9, 1);
    const inst = new THREE.InstancedMesh(geo, M.stone, merlonList.length);
    const dummy = new THREE.Object3D();
    merlonList.forEach((m, i) => {
      dummy.position.set(m.x, m.y + 0.45, m.z);
      dummy.rotation.set(0, m.rot, 0);
      dummy.scale.set(1, 1, m.s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    scene.add(inst);
  }

  // ---------- Chemins ----------
  path(0, CZ + HALF - 1, 0, 52, 3);   // chemin principal village → château
  path(1.5, 0, 19.5, 0, 3);           // embranchement vers le terrain d'entraînement
  path(-1.5, 6, -16.5, 6, 2.4);       // vers l'église

  // ---------- Village (au sud) ----------
  function house(x, z, w, d, h, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    const walls = new THREE.Mesh(metricBoxUV(new THREE.BoxGeometry(w, h, d), w, h, d), M.plaster);
    walls.position.y = h / 2;
    walls.castShadow = walls.receiveShadow = true;
    g.add(walls);
    // Colombages
    const beam = (bw, bh, bd, bx, by, bz) => {
      const b = new THREE.Mesh(metricBoxUV(new THREE.BoxGeometry(bw, bh, bd), bw, bh, bd), M.timber);
      b.position.set(bx, by, bz);
      b.castShadow = true;
      g.add(b);
    };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(0.18, h, 0.18, sx * w / 2, h / 2, sz * d / 2);
    beam(w + 0.06, 0.16, d + 0.06, 0, h * 0.55, 0);
    beam(w + 0.06, 0.16, d + 0.06, 0, h - 0.08, 0);
    // Porte et fenêtre (face avant = +Z)
    const door = new THREE.Mesh(new THREE.BoxGeometry(1, 1.8, 0.08), M.door);
    door.position.set(-w / 6, 0.9, d / 2 + 0.03);
    g.add(door);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.06), M.dark);
    win.position.set(w / 4, h * 0.72, d / 2 + 0.03);
    g.add(win);
    // Toit de chaume (faîtage le long de la largeur)
    const roof = gableRoof(d, w, w * 0.45, 0.4, M.thatch);
    roof.rotation.y = Math.PI / 2;
    roof.position.y = h;
    g.add(roof);
    const swap = Math.abs(Math.sin(rotY)) > 0.5;
    const hw = (swap ? d : w) / 2, hd = (swap ? w : d) / 2;
    addCollider(x - hw, x + hw, z - hd, z + hd, 99);
  }

  // Maisons orientées vers le chemin principal
  house(-9, 20, 6, 5, 3, Math.PI / 2);
  house(-10, 32, 5, 6, 3, Math.PI / 2);
  house(-7, 44, 5, 5, 2.8, Math.PI / 2);
  house(9, 20, 6, 5, 3, -Math.PI / 2);
  house(11, 34, 5, 5, 3, -Math.PI / 2);
  house(8, 45, 6, 5, 3, -Math.PI / 2);
  house(-20, 24, 5, 5, 2.8, 0);
  house(20, 26, 6, 5, 3, 0);
  house(-19, 38, 5, 6, 3, Math.PI / 2);
  house(19, 41, 5, 5, 2.8, -Math.PI / 2);

  // Puits
  {
    const wx = 4, wz = 29;
    cylinder(0.9, 0.8, wx, 0, wz, M.stone, { segments: 14 });
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.7, 14), M.water);
    water.rotation.x = -Math.PI / 2;
    water.position.set(wx, 0.7, wz);
    scene.add(water);
    box(0.12, 2.2, 0.12, wx - 0.8, 0, wz, M.timber, { collide: false });
    box(0.12, 2.2, 0.12, wx + 0.8, 0, wz, M.timber, { collide: false });
    const roof = gableRoof(1.6, 1.4, 0.7, 0.2, M.thatch);
    roof.rotation.y = Math.PI / 2;
    roof.position.set(wx, 2.2, wz);
    scene.add(roof);
  }

  // Meules de foin
  for (const [x, z] of [[-14, 26], [15, 30], [-13, 46], [24, 34]]) {
    cylinder(1, 1.2, x, 0, z, M.hay, { segments: 12 });
    cone(1, 0.8, x, 1.2, z, M.hay, 12);
  }

  // Champ cultivé à l'est du village
  {
    const fx = 38, fz = 38, fw = 16, fd = 22;
    bare.push({ minX: fx - fw / 2, maxX: fx + fw / 2, minZ: fz - fd / 2, maxZ: fz + fd / 2 });
    const field = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd).rotateX(-Math.PI / 2),
      tmat('dirt', { color: 0x9a7a5a, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, [16 / 3, 22 / 3]));
    field.position.set(fx, 0.015, fz);
    field.receiveShadow = true;
    scene.add(field);
    const rows = Math.floor(fw / 1.2);
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.45, fd - 1), mat(0x8fa64a), rows);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < rows; i++) {
      dummy.position.set(fx - fw / 2 + 0.8 + i * 1.2, 0.22, fz);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.castShadow = true;
    scene.add(inst);
  }

  // ---------- Église romane ----------
  {
    const ex = -20, ez = 6;
    box(6, 5.5, 12, ex, 0, ez, M.stoneLight);
    const roof = gableRoof(6, 12, 2.6, 0.35, M.slate);
    roof.position.set(ex, 5.5, ez);
    scene.add(roof);
    // Clocher
    box(3.6, 11, 3.6, ex, 0, ez - 7.8, M.stoneLight);
    cone(2.9, 4, ex, 11, ez - 7.8, M.slateCone, 4, Math.PI / 4);
    for (const [dx, dz, w, d] of [[0, -1.82, 0.7, 0.1], [0, 1.82, 0.7, 0.1], [-1.82, 0, 0.1, 0.7], [1.82, 0, 0.1, 0.7]]) {
      box(w, 1.4, d, ex + dx, 8.8, ez - 7.8 + dz, M.dark, { collide: false, shadow: false });
    }
    box(1.4, 2.4, 0.1, ex, 0, ez - 9.65, M.door, { collide: false });
    // Abside semi-circulaire
    const apse = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 4.5, 16, 1, false, -Math.PI / 2, Math.PI), M.stoneLight);
    apse.position.set(ex, 2.25, ez + 6);
    apse.castShadow = apse.receiveShadow = true;
    scene.add(apse);
    const apseRoof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.8, 16, 1, false, -Math.PI / 2, Math.PI), M.slateCone);
    apseRoof.position.set(ex, 5.4, ez + 6);
    apseRoof.castShadow = true;
    scene.add(apseRoof);
    addCollider(ex - 2.6, ex + 2.6, ez + 6, ez + 8.6);
    // Petites fenêtres
    for (const dz of [-3, 0, 3]) {
      box(0.1, 1.1, 0.45, ex - 3.02, 2.8, ez + dz, M.dark, { collide: false, shadow: false });
      box(0.1, 1.1, 0.45, ex + 3.02, 2.8, ez + dz, M.dark, { collide: false, shadow: false });
    }
  }

  // ---------- Terrain d'entraînement (à l'est) ----------
  const YX = 26, YZ = 0, YH = 7;
  {
    path(YX, YZ - YH + 0.5, YX, YZ + YH - 0.5, 2 * YH - 1, M.courtyard);
    const x0 = YX - YH, x1 = YX + YH, z0 = YZ - YH, z1 = YZ + YH;
    const gap = 2;
    const fenceSide = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 2));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        box(0.15, 1.2, 0.15, ax + (bx - ax) * t, 0, az + (bz - az) * t, M.timber, { collide: false });
      }
      const alongX = Math.abs(bx - ax) > Math.abs(bz - az);
      for (const y of [0.45, 0.95]) {
        box(alongX ? len : 0.08, 0.1, alongX ? 0.08 : len, (ax + bx) / 2, y, (az + bz) / 2, M.wood, { collide: false });
      }
      const t = 0.15;
      addCollider(Math.min(ax, bx) - t, Math.max(ax, bx) + t, Math.min(az, bz) - t, Math.max(az, bz) + t, 1.2);
    };
    fenceSide(x0, z0, x1, z0);
    fenceSide(x0, z1, x1, z1);
    fenceSide(x1, z0, x1, z1);
    fenceSide(x0, z0, x0, YZ - gap);
    fenceSide(x0, YZ + gap, x0, z1);

    // Râtelier d'armes
    box(2.4, 0.12, 0.3, YX + 4, 1.1, YZ - 6, M.timber, { collide: false });
    for (let i = 0; i < 4; i++) {
      const s = box(0.06, 1.3, 0.04, YX + 3.2 + i * 0.5, 0.05, YZ - 6, M.wood, { collide: false });
      s.rotation.z = 0.12;
    }
    // Cibles de tir à l'arc (décor)
    for (const z of [-4, 4]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.3, 16), M.hay);
      t.rotation.z = Math.PI / 2;
      t.position.set(YX + 6, 1, YZ + z);
      t.castShadow = true;
      scene.add(t);
      const ring = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), mat(0xa52a1e));
      ring.rotation.y = -Math.PI / 2;
      ring.position.set(YX + 5.84, 1, YZ + z);
      scene.add(ring);
      circles.push({ x: YX + 6, z: YZ + z, r: 0.6, top: 2 });
    }
  }

  // Quintaine : poteau avec un bras pivotant (écu d'un côté, sac de sable de l'autre)
  const quintain = (() => {
    const qx = YX + 1.5, qz = YZ;
    cylinder(0.15, 2.3, qx, 0, qz, M.timber, { segments: 8 });
    circles.push({ x: qx, z: qz, r: 0.35, top: 3 });
    const pivot = new THREE.Group();
    pivot.position.set(qx, 2.15, qz);
    scene.add(pivot);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.12), M.wood);
    arm.castShadow = true;
    pivot.add(arm);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.6), mat(0xa52a1e));
    shield.position.set(1.25, -0.25, 0);
    shield.castShadow = true;
    pivot.add(shield);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.14), mat(0xeee3c8));
    band.position.set(1.25, -0.25, 0);
    pivot.add(band);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), M.timber);
    rope.position.set(-1.25, -0.25, 0);
    pivot.add(rope);
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), mat(0xb59c6e));
    bag.position.set(-1.25, -0.6, 0);
    bag.scale.y = 1.3;
    bag.castShadow = true;
    pivot.add(bag);
    pivot.rotation.y = Math.PI; // écu tourné vers l'entrée (à l'ouest)
    let spin = 0;
    return {
      position: new THREE.Vector3(qx, 0, qz),
      markerHeight: 3.2,
      hit(strength = 1) { spin += 9 * strength; },
      update(dt) {
        pivot.rotation.y += spin * dt;
        spin *= Math.exp(-dt * 1.6);
      },
    };
  })();
  animated.push(quintain);

  // ---------- Forêt ----------
  function blocked(x, z) {
    if (Math.abs(x) < 26 && z > -64 && z < -15) return true;      // château
    if (Math.abs(x) < 28 && z > 13 && z < 52) return true;        // village
    if (x > 16 && x < 37 && Math.abs(z) < 11) return true;        // terrain d'entraînement
    if (x > -26 && x < -13 && z > -6 && z < 16) return true;      // église
    if (Math.abs(x) < 4 && z > -20 && z < 58) return true;        // chemin
    if (x > 0 && x < 20 && Math.abs(z) < 3.5) return true;        // embranchement
    if (x > 28 && x < 48 && z > 25 && z < 51) return true;        // champ
    return false;
  }
  {
    const trees = [];
    let tries = 0;
    while (trees.length < 320 && tries < 6000) {
      tries++;
      const a = rng() * Math.PI * 2;
      const d = 12 + Math.pow(rng(), 0.7) * 125;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (blocked(x, z)) continue;
      // Densité plus forte en lisière de la zone de jeu
      if (d < 60 && rng() < 0.55) continue;
      if (trees.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < 9)) continue;
      trees.push({ x, z, s: 0.8 + rng() * 0.6, pine: rng() < 0.4 });
    }
    const trunkGeo = metricCylinderUV(new THREE.CylinderGeometry(0.16, 0.3, 2.6, 7), 0.25, 2.6);
    trunkGeo.translate(0, 1.3, 0);
    const blobGeo = new THREE.IcosahedronGeometry(1.25, 1);
    // Feuillage irrégulier : on bosselle la sphère
    {
      const p = blobGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i);
        const k = 1 + Math.sin(v.x * 3.1 + v.y * 2.3) * 0.12 + Math.cos(v.z * 2.7 - v.y * 1.9) * 0.1;
        p.setXYZ(i, v.x * k, v.y * k, v.z * k);
      }
      blobGeo.computeVertexNormals();
    }
    const pineGeo = new THREE.ConeGeometry(1.5, 4.2, 8, 3);
    pineGeo.translate(0, 3.8, 0);
    const pineGeo2 = new THREE.ConeGeometry(1.1, 3, 8, 2);
    pineGeo2.translate(0, 5.4, 0);
    const bark = tmat('timber', { color: 0x8a7a6a }, [1, 1.5]);
    const trunks = new THREE.InstancedMesh(trunkGeo, bark, trees.length);
    const leafTrees = trees.filter(t => !t.pine), pineTrees = trees.filter(t => t.pine);
    const foliageMat = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true });
    const leaves = new THREE.InstancedMesh(blobGeo, foliageMat, leafTrees.length * 4);
    const pines = new THREE.InstancedMesh(pineGeo, foliageMat, pineTrees.length);
    const pines2 = new THREE.InstancedMesh(pineGeo2, foliageMat, pineTrees.length);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    // Palette d'automne : verts fatigués, ors, roux
    const autumn = [0x5d6e2e, 0x6f7a30, 0xa8862e, 0xc0782a, 0x9a4a22, 0x7a6a2a, 0xb8962e];
    trees.forEach((t, i) => {
      dummy.position.set(t.x, 0, t.z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.scale.set(t.s, t.s * (1 + rng() * 0.3), t.s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      if (Math.hypot(t.x, t.z) < WORLD_RADIUS + 5) circles.push({ x: t.x, z: t.z, r: 0.35 * t.s, top: 99 });
    });
    let li = 0;
    leafTrees.forEach((t) => {
      const base = autumn[Math.floor(rng() * autumn.length)];
      for (let k = 0; k < 4; k++) {
        const a = rng() * Math.PI * 2, d = k === 0 ? 0 : 0.8 + rng() * 0.4;
        dummy.position.set(t.x + Math.cos(a) * d * t.s, (3.1 + (k === 0 ? 0.7 : rng() * 0.6)) * t.s, t.z + Math.sin(a) * d * t.s);
        dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
        const sc = t.s * (k === 0 ? 1.15 : 0.8 + rng() * 0.25);
        dummy.scale.set(sc, sc * 0.85, sc);
        dummy.updateMatrix();
        leaves.setMatrixAt(li, dummy.matrix);
        leaves.setColorAt(li, col.set(base).offsetHSL((rng() - 0.5) * 0.03, 0, (rng() - 0.5) * 0.08));
        li++;
      }
    });
    pineTrees.forEach((t, i) => {
      dummy.position.set(t.x, 0, t.z);
      dummy.rotation.set(0, rng() * 6, 0);
      dummy.scale.set(t.s, t.s * (0.9 + rng() * 0.4), t.s);
      dummy.updateMatrix();
      pines.setMatrixAt(i, dummy.matrix);
      pines2.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.28 + rng() * 0.04, 0.35, 0.16 + rng() * 0.05);
      pines.setColorAt(i, col);
      pines2.setColorAt(i, col);
    });
    for (const m of [trunks, leaves, pines, pines2]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  }

  // Rochers épars
  {
    const rockGeo = new THREE.DodecahedronGeometry(0.6, 0);
    let placed = 0;
    while (placed < 30) {
      const x = (rng() - 0.5) * 170, z = (rng() - 0.5) * 170;
      if (blocked(x, z) || Math.hypot(x, z) < 10) continue;
      const r = new THREE.Mesh(rockGeo, M.stoneDark);
      const s = 0.5 + rng() * 1.2;
      r.scale.set(s, s * 0.6, s);
      r.position.set(x, s * 0.15, z);
      r.rotation.set(rng(), rng() * 6, rng());
      r.castShadow = r.receiveShadow = true;
      scene.add(r);
      if (Math.hypot(x, z) < WORLD_RADIUS + 5) circles.push({ x, z, r: 0.55 * s, top: s * 0.6 });
      placed++;
    }
  }

  // ---------- Collisions ----------
  function resolve(pos, r) {
    for (let iter = 0; iter < 2; iter++) {
      for (const b of boxes) {
        if (pos.y >= b.top) continue; // on peut sauter par-dessus les obstacles bas
        const cx = clamp(pos.x, b.minX, b.maxX), cz = clamp(pos.z, b.minZ, b.maxZ);
        const dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x += (dx / d) * (r - d);
          pos.z += (dz / d) * (r - d);
        } else {
          const pl = pos.x - b.minX, pr = b.maxX - pos.x, pb = pos.z - b.minZ, pf = b.maxZ - pos.z;
          const m = Math.min(pl, pr, pb, pf);
          if (m === pl) pos.x = b.minX - r;
          else if (m === pr) pos.x = b.maxX + r;
          else if (m === pb) pos.z = b.minZ - r;
          else pos.z = b.maxZ + r;
        }
      }
      for (const c of circles) {
        if (pos.y >= c.top) continue;
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const min = r + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 1e-4;
        pos.x = c.x + (dx / d) * min;
        pos.z = c.z + (dz / d) * min;
      }
    }
    const dist = Math.hypot(pos.x, pos.z);
    if (dist > WORLD_RADIUS) {
      pos.x *= WORLD_RADIUS / dist;
      pos.z *= WORLD_RADIUS / dist;
    }
  }

  let time = 0;
  function update(dt, playerPos, camPos) {
    time += dt;
    // Le soleil suit le joueur pour garder des ombres nettes autour de lui
    sun.position.copy(playerPos).add(sunOffset);
    sun.target.position.copy(playerPos);
    for (const a of animated) a.update(dt, camPos);
    // Drapeaux qui ondulent
    for (const f of flags) {
      const arr = f.geo.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = f.base[i];
        arr[i + 2] = Math.sin(time * 4 + x * 3 + f.phase) * 0.12 * x;
      }
      f.geo.attributes.position.needsUpdate = true;
    }
  }

  /** Pas d'herbe sur les chemins, dans les cours, sous les bâtiments… */
  function isBare(x, z) {
    for (const b of bare) if (x > b.minX - 0.2 && x < b.maxX + 0.2 && z > b.minZ - 0.2 && z < b.maxZ + 0.2) return true;
    for (const b of boxes) if (x > b.minX - 0.3 && x < b.maxX + 0.3 && z > b.minZ - 0.3 && z < b.maxZ + 0.3) return true;
    for (const c of circles) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + 0.2) ** 2) return true;
    return Math.abs(x) < 19 && z > -59 && z < -21; // intérieur du château
  }

  return { resolve, update, isBare, quintain, circles, boxes, sun, sunDir };
}
