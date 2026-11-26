// Paris en 1127 : l'île de la Cité, la Seine, le Grand Pont et le Petit Pont,
// le palais du roi à l'ouest, la cathédrale à l'est, les Châtelets et les rives.
// La ville est construite loin de Montclair (origine PARIS) ; on y voyage par un fondu au noir.
import * as THREE from 'three';
import { Tex, metricBoxUV } from './textures.js?v=202611261748';
import { makeNPC } from './npcs.js?v=202611261748';
import { createHumanoid, animateWalk } from './humanoid.js?v=202611261748';
import { ROOMS } from './interiors.js?v=202611261748';

/** Origine de Paris dans le monde du jeu. */
export const PARIS = { x: -600, z: 0 };
/** Le joueur est-il à Paris ? */
export const inParis = (pos) => pos.x < -380 && pos.x > -820;
/** Coordonnées locales de Paris → monde. */
export const P = (x, z) => ({ x: PARIS.x + x, z: PARIS.z + z });

// Repères (coordonnées locales)
export const SPOTS = {
  arrival: { x: 10, z: 58, rot: Math.PI },           // rive gauche, arrivée par la route du sud
  market: { x: 11, z: 13 },                          // marché Palu, au bout du Petit Pont
  alley: { x: -20.5, z: -16.5 },                     // cul-de-sac (ruelle des Marmousets)
  palaceGate: { x: -40, z: 0 },
  hallDoor: { x: -55, z: -2.6 },
  cathedralDoor: { x: 32.6, z: 0 },
  tavernDoor: { x: 2.2, z: -30.5 },
  bridgeFight: { x: 0, z: -27 },
  quay: { x: -2, z: -44 },
};

// ---------- Fusion des géométries par matériau (beaucoup moins d'objets à dessiner) ----------
class Batch {
  constructor() { this.parts = new Map(); this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); }
  add(material, geo, matrix) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (matrix) g.applyMatrix4(matrix);
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(g);
  }
  /** Boîte posée au sol en (x, y, z) (y = bas de la boîte). */
  box(material, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
    this.e.set(rx, ry, rz);
    this.m.compose(new THREE.Vector3(x, y + h / 2, z), this.q.setFromEuler(this.e), new THREE.Vector3(1, 1, 1));
    this.add(material, metricBoxUV(new THREE.BoxGeometry(w, h, d), w, h, d), this.m);
  }
  /** Géométrie quelconque placée en (x, y, z). */
  geo(material, geo, x, y, z, ry = 0, rx = 0) {
    this.e.set(rx, ry, 0);
    this.m.compose(new THREE.Vector3(x, y, z), this.q.setFromEuler(this.e), new THREE.Vector3(1, 1, 1));
    this.add(material, geo, this.m);
  }
  build(scene, shadows = true) {
    for (const [material, list] of this.parts) {
      let n = 0;
      for (const g of list) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      let o = 0;
      for (const g of list) {
        pos.set(g.attributes.position.array, o * 3);
        nor.set(g.attributes.normal.array, o * 3);
        uv.set(g.attributes.uv.array, o * 2);
        o += g.attributes.position.count;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    this.parts.clear();
  }
}

function mat(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }); }

/** Petit générateur pseudo-aléatoire (la ville est identique à chaque partie). */
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function buildParis(scene, world, kit) {
  const OX = PARIS.x, OZ = PARIS.z;
  const rand = rng(1127);
  const tm = (t, color = 0xffffff, extra = {}) => mat(color, { map: t.map, normalMap: t.normalMap, ...extra });
  const T = { stone: Tex.stone(), stoneL: Tex.stoneLight(), plaster: Tex.plaster(), timber: Tex.timber(), slate: Tex.slate(), wood: Tex.wood(), dirt: Tex.dirt(), grass: Tex.grass(), thatch: Tex.thatch() };
  const M = {
    stone: tm(T.stone), stoneL: tm(T.stoneL), pave: tm(T.stone, 0x9a9488), plaster: tm(T.plaster), plasterW: tm(T.plaster, 0xe8dcc4),
    plasterO: tm(T.plaster, 0xd8b88a), timber: tm(T.timber), slate: tm(T.slate, 0x8a8e98), tile: tm(T.slate, 0xa0583a),
    thatch: tm(T.thatch), wood: tm(T.wood), dirt: tm(T.dirt), grass: tm(T.grass), dark: mat(0x1a1410), door: tm(T.wood, 0x6a4a2a),
    water: new THREE.MeshStandardMaterial({ color: 0x2e4c50, roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.92 }),
    awningR: mat(0x9a2a20, { side: THREE.DoubleSide }), awningB: mat(0x2a4a8a, { side: THREE.DoubleSide }), awningG: mat(0x3a6a2a, { side: THREE.DoubleSide }),
    hill: mat(0x5a6a3a, { roughness: 1 }), far: mat(0x6a7078, { roughness: 1 }),
  };
  M.windowLit = world.windowMat || M.dark;
  const B = new Batch();
  const colliders = [];
  const collide = (minX, maxX, minZ, maxZ, top = 99) => {
    const b = { minX: OX + minX, maxX: OX + maxX, minZ: OZ + minZ, maxZ: OZ + maxZ, top };
    world.boxes.push(b);
    colliders.push(b);
    return b;
  };
  // Hors des limites de Montclair : on autorise le déplacement dans tout ce rectangle
  world.indoor.push({ minX: OX - 160, maxX: OX + 160, minZ: OZ - 160, maxZ: OZ + 160 });
  const L = (x) => OX + x, Lz = (z) => OZ + z;

  // ================= Sol, Seine, quais =================
  const ground = (material, x0, x1, z0, z1, y = 0) => {
    const w = x1 - x0, d = z1 - z0;
    const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 3, uv.getY(i) * d / 3);
    B.geo(material, g, L((x0 + x1) / 2), y, Lz((z0 + z1) / 2));
  };
  const ISL = { x0: -74, x1: 74, z0: -20, z1: 20 };
  const NB = -40, SB = 34;           // bords des rives (nord et sud)
  ground(M.pave, ISL.x0, ISL.x1, ISL.z0, ISL.z1);                 // l'île, pavée
  ground(M.dirt, -150, 150, -150, NB);                               // rive droite
  ground(M.dirt, -150, 150, SB, 150);                                // rive gauche
  ground(M.grass, -150, 150, 110, 150, 0.01);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(320, 80).rotateX(-Math.PI / 2), M.water);
  water.position.set(L(0), -0.75, Lz(-3));
  water.receiveShadow = true;
  scene.add(water);
  // Murs de quai (sous le niveau du sol) et parapets
  const quayWall = (x0, x1, z, face) => B.box(M.stone, x1 - x0, 0.9, 0.6, L((x0 + x1) / 2), -0.9, Lz(z + face * 0.3));
  const parapet = (x0, x1, z) => {
    B.box(M.stoneL, x1 - x0, 0.55, 0.45, L((x0 + x1) / 2), 0, Lz(z));
    collide(x0, x1, z - 0.4, z + 0.4, 1.4);
  };
  const parapetZ = (z0, z1, x) => {
    B.box(M.stoneL, 0.45, 0.55, z1 - z0, L(x), 0, Lz((z0 + z1) / 2));
    collide(x - 0.4, x + 0.4, z0, z1, 1.4);
  };
  // Île : bord nord (ouverture du Grand Pont x ∈ [-3.5, 3.5]) et bord sud (Petit Pont x ∈ [7, 13])
  quayWall(ISL.x0, ISL.x1, ISL.z0, -1); quayWall(ISL.x0, ISL.x1, ISL.z1, 1);
  B.box(M.stone, 0.6, 0.9, 40, L(ISL.x0 - 0.3), -0.9, Lz(0)); B.box(M.stone, 0.6, 0.9, 40, L(ISL.x1 + 0.3), -0.9, Lz(0));
  parapet(ISL.x0, -3.5, ISL.z0 + 0.25); parapet(3.5, ISL.x1, ISL.z0 + 0.25);
  parapet(ISL.x0, 7, ISL.z1 - 0.25); parapet(13, ISL.x1, ISL.z1 - 0.25);
  parapetZ(ISL.z0, ISL.z1, ISL.x0 + 0.25); parapetZ(ISL.z0, ISL.z1, ISL.x1 - 0.25);
  // Rives
  quayWall(-150, 150, NB, 1); quayWall(-150, 150, SB, -1);
  parapet(-60, -3.5, NB - 0.25); parapet(3.5, 60, NB - 0.25);
  parapet(-60, 7, SB + 0.25); parapet(13, 60, SB + 0.25);

  // ================= Ponts =================
  // Grand Pont (au nord, x ∈ [-3.5, 3.5]) : bordé de maisons, de moulins et d'échoppes
  ground(M.wood, -3.6, 3.6, NB, ISL.z0, 0.02);
  for (let z = NB + 2; z < ISL.z0; z += 6) {
    B.box(M.stone, 8.5, 0.8, 1.6, L(0), -1.6, Lz(z));                  // piles
  }
  B.box(M.stone, 8.2, 0.5, ISL.z0 - NB, L(0), -0.5, Lz((NB + ISL.z0) / 2));
  // Petit Pont (au sud, x ∈ [7, 13]) : en pierre, avec parapets
  ground(M.pave, 7, 13, ISL.z1, SB, 0.02);
  B.box(M.stone, 6.6, 0.6, SB - ISL.z1, L(10), -0.6, Lz((ISL.z1 + SB) / 2));
  for (const sx of [7, 13]) parapetZ(ISL.z1, SB, sx + (sx === 7 ? -0.2 : 0.2));

  // ================= Maisons =================
  const plasters = [M.plaster, M.plasterW, M.plasterO];
  const roofs = [M.slate, M.slate, M.tile, M.thatch];
  /** Pignon triangulaire (plan, face +z). */
  const gable = (w, rh) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, rh); s.closePath();
    const g = new THREE.ShapeGeometry(s);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
    return g;
  };
  /**
   * Maison parisienne à pignon sur rue. (x, z) : centre ; front : direction de la façade
   * ('n', 's', 'e', 'w') ; w : largeur de façade ; d : profondeur ; floors : étages.
   */
  function house(x, z, w, d, floors, front, opts = {}) {
    const ry = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 }[front];
    const cos = Math.cos(ry), sin = Math.sin(ry);
    const at = (lx, lz) => [x + lx * cos + lz * sin, z - lx * sin + lz * cos];
    const fh = 2.7;
    const h = floors * fh + 0.4;
    const wall = opts.wall || plasters[Math.floor(rand() * plasters.length)];
    // Rez-de-chaussée en pierre, étages en pan de bois légèrement en encorbellement
    let [px, pz] = at(0, 0);
    B.box(M.stoneL, w, fh, d, L(px), 0, Lz(pz), ry);
    for (let f = 1; f < floors; f++) {
      [px, pz] = at(0, 0.25 * f);
      B.box(wall, w, fh, d, L(px), f * fh, Lz(pz), ry);
      // colombages de façade
      const fz = d / 2 + 0.25 * f + 0.04;
      for (const bx of [-w / 2 + 0.1, w / 2 - 0.1, 0]) { [px, pz] = at(bx, fz); B.box(M.timber, 0.16, fh, 0.08, L(px), f * fh, Lz(pz), ry); }
      [px, pz] = at(0, fz); B.box(M.timber, w, 0.16, 0.1, L(px), f * fh, Lz(pz), ry);
      for (const s of [-1, 1]) { [px, pz] = at(s * w / 4, fz); B.box(M.timber, 0.12, fh * 0.95, 0.06, L(px), f * fh + 0.05, Lz(pz), ry, 0, s * 0.45); }
      // fenêtres
      for (const s of [-1, 1]) {
        [px, pz] = at(s * w / 4.2, fz + 0.02);
        B.box(rand() < 0.35 ? M.windowLit : M.dark, 0.55, 0.75, 0.05, L(px), f * fh + 0.9, Lz(pz), ry);
      }
    }
    // Porte ou échoppe
    [px, pz] = at(-w / 5, d / 2 + 0.03);
    B.box(M.door, 1.0, 1.9, 0.06, L(px), 0, Lz(pz), ry);
    if (opts.shop) {
      [px, pz] = at(w / 5, d / 2 + 0.03);
      B.box(M.dark, 1.4, 1.1, 0.05, L(px), 0.8, Lz(pz), ry);
      [px, pz] = at(w / 5, d / 2 + 0.55);
      B.box(M.wood, 1.6, 0.08, 0.9, L(px), 0.75, Lz(pz), ry);
      const aw = [M.awningR, M.awningB, M.awningG][Math.floor(rand() * 3)];
      [px, pz] = at(w / 5, d / 2 + 0.6);
      B.box(aw, 1.8, 0.04, 1.2, L(px), 2.15, Lz(pz), ry, 0.35);
    }
    // Toit à deux pans, faîtage perpendiculaire à la rue
    const top = floors * fh;
    const dd = d + 0.25 * (floors - 1);
    const rh = w * (0.55 + rand() * 0.25);
    const slope = Math.atan2(rh, w / 2), len = Math.hypot(rh, w / 2) + 0.3;
    const roofMat = opts.roof || roofs[Math.floor(rand() * roofs.length)];
    for (const s of [-1, 1]) {
      [px, pz] = at(s * w / 4, 0.12 * (floors - 1));
      const g = metricBoxUV(new THREE.BoxGeometry(len, 0.14, dd + 0.6), len, 0.14, dd + 0.6);
      g.rotateZ(-s * slope);
      g.rotateY(ry);
      B.geo(roofMat, g, L(px), top + rh / 2, Lz(pz));
    }
    for (const s of [-1, 1]) {
      [px, pz] = at(0, 0.12 * (floors - 1) + s * dd / 2);
      const g = gable(w, rh);
      g.rotateY(ry + (s < 0 ? Math.PI : 0));
      B.geo(wall, g, L(px), top, Lz(pz));
    }
    // Cheminée
    if (rand() < 0.5) { [px, pz] = at(w * 0.2, -d * 0.2); B.box(M.stone, 0.5, rh + 0.9, 0.5, L(px), top, Lz(pz), ry); }
    // Obstacle
    const hw = (front === 'e' || front === 'w' ? d : w) / 2 + 0.1, hd = (front === 'e' || front === 'w' ? w : d) / 2 + 0.1;
    collide(x - hw, x + hw, z - hd, z + hd);
  }
  /** Rangée de maisons le long d'une rue, de a à b sur l'axe donné. */
  function row(axis, a, b, fixed, front, d, opts = {}) {
    let p = a;
    while (p < b - 2.5) {
      const w = Math.min(b - p, 4.2 + rand() * 2.4);
      const c = p + w / 2;
      const floors = opts.floors || 2 + (rand() < 0.55 ? 1 : 0);
      if (axis === 'x') house(c, fixed, w - 0.12, d, floors, front, { shop: opts.shops && rand() < 0.6 });
      else house(fixed, c, w - 0.12, d, floors, front, { shop: opts.shops && rand() < 0.6 });
      p += w;
    }
  }
  /** Bloc plein derrière les façades (cours, jardins invisibles). */
  function filler(x0, x1, z0, z1, h = 7) {
    B.box(M.plaster, x1 - x0, h, z1 - z0, L((x0 + x1) / 2), 0, Lz((z0 + z1) / 2));
    const s = metricBoxUV(new THREE.BoxGeometry(x1 - x0 + 0.4, 0.2, z1 - z0 + 0.4), x1 - x0, 0.2, z1 - z0);
    B.geo(M.tile, s, L((x0 + x1) / 2), h + 0.1, Lz((z0 + z1) / 2));
    collide(x0, x1, z0, z1);
  }

  // Rues de l'île :
  //  - grand-rue est-ouest z ∈ [-3, 3], du palais (x = -40) au parvis (x = 22)
  //  - rue nord-sud du Grand Pont x ∈ [-3.5, 3.5], de z = -20 à -3
  //  - marché Palu x ∈ [4, 18], z ∈ [6, 20], relié à la grand-rue
  //  - ruelle des Marmousets x ∈ [-22, -19], z ∈ [-19, -3] (cul-de-sac)
  // Bloc nord-ouest (x -38 → -3.5, z -20 → -3), coupé par la ruelle
  row('x', -38, -22, -6.5, 's', 6, { shops: true });
  row('x', -19, -3.5, -6.5, 's', 6, { shops: true });
  row('z', -19.5, -9.5, -25.5, 'e', 6);
  row('z', -19.5, -9.5, -15.5, 'w', 6);
  row('z', -19.5, -9.5, -6.5, 'e', 6);
  filler(-38, -28.5, -19.6, -9.5); filler(-12.5, -3.6, -19.6, -9.5);
  // Bloc nord-est (x 3.5 → 22, z -20 → -3)
  row('x', 3.5, 22, -6.5, 's', 6, { shops: true });
  row('z', -19.5, -9.5, 6.5, 'w', 6);
  filler(9.5, 22, -19.6, -9.5);
  // Bloc sud-ouest (x -38 → 4, z 3 → 20)
  row('x', -38, 4, 6.5, 'n', 6, { shops: true });
  filler(-38, 4, 9.5, 19.6);
  // Marché : maisons à l'est
  row('z', 6, 19.5, 21, 'w', 6, { shops: true });
  filler(24, 30, 12, 19.6);
  // Autour de la cathédrale (maisons des chanoines, Hôtel-Dieu au sud)
  row('x', 24, 72, -16.5, 's', 6);
  row('x', 31, 72, 16.5, 'n', 6, { floors: 2 });
  // Maisons sur le Grand Pont (au-dessus de l'eau)
  for (const s of [-1, 1]) {
    for (let z = NB + 0.5; z < ISL.z0 - 2; z += 5.2) {
      house(s * 6.1, z + 2.5, 5, 5, 2 + (z > -30 ? 1 : 0), s < 0 ? 'e' : 'w');
    }
  }

  // ================= Palais du roi (pointe ouest) =================
  const PX0 = -72, PX1 = -40, PZ0 = -18, PZ1 = 18;
  const wallH = 7;
  B.box(M.stone, PX1 - PX0, wallH, 1.2, L((PX0 + PX1) / 2), 0, Lz(PZ0)); collide(PX0, PX1, PZ0 - 0.6, PZ0 + 0.6);
  B.box(M.stone, PX1 - PX0, wallH, 1.2, L((PX0 + PX1) / 2), 0, Lz(PZ1)); collide(PX0, PX1, PZ1 - 0.6, PZ1 + 0.6);
  B.box(M.stone, 1.2, wallH, PZ1 - PZ0, L(PX0), 0, Lz(0)); collide(PX0 - 0.6, PX0 + 0.6, PZ0, PZ1);
  // mur est avec la porte (ouverture z ∈ [-3, 3])
  for (const [a, b] of [[PZ0, -3], [3, PZ1]]) { B.box(M.stone, 1.2, wallH, b - a, L(PX1), 0, Lz((a + b) / 2)); collide(PX1 - 0.6, PX1 + 0.6, a, b); }
  B.box(M.stone, 1.4, 2.2, 6, L(PX1), wallH - 2.2 + 2.2, Lz(0));
  for (const s of [-1, 1]) {
    const t = new THREE.CylinderGeometry(2.2, 2.4, 11, 14);
    B.geo(M.stone, t, L(PX1 + 0.5), 5.5, Lz(s * 4.6));
    B.geo(M.slate, new THREE.ConeGeometry(2.6, 3.4, 14), L(PX1 + 0.5), 12.7, Lz(s * 4.6));
    world.circles.push({ x: L(PX1 + 0.5), z: Lz(s * 4.6), r: 2.3, top: 99 });
  }
  // créneaux
  for (let x = PX0; x < PX1; x += 1.6) { B.box(M.stone, 0.8, 0.8, 1.2, L(x + 0.4), wallH, Lz(PZ0)); B.box(M.stone, 0.8, 0.8, 1.2, L(x + 0.4), wallH, Lz(PZ1)); }
  // Grande salle (porte au sud, en (-55, -3.4))
  B.box(M.stoneL, 20, 10, 9, L(-55), 0, Lz(-8)); collide(-65, -45, -12.5, -3.5);
  {
    const rh = 4.5, len = Math.hypot(rh, 4.5) + 0.4, slope = Math.atan2(rh, 4.5);
    for (const s of [-1, 1]) {
      const g = metricBoxUV(new THREE.BoxGeometry(21, 0.18, len), 21, 0.18, len);
      g.rotateX(s * slope);
      B.geo(M.slate, g, L(-55), 10 + rh / 2, Lz(-8 + s * 2.25));
    }
    for (const s of [-1, 1]) { const g = gable(9, rh); g.rotateY(Math.PI / 2 * s); B.geo(M.stoneL, g, L(-55 + s * 10), 10, Lz(-8)); }
    for (let k = -8; k <= 8; k += 4) B.box(M.dark, 1.0, 2.6, 0.1, L(-55 + k), 5, Lz(-3.45));
    B.box(M.door, 2.0, 3.2, 0.12, L(-55), 0, Lz(-3.44));
    B.box(M.stone, 2.8, 0.4, 0.4, L(-55), 3.2, Lz(-3.4));
  }
  // Donjon carré et chapelle royale
  B.box(M.stone, 9, 22, 9, L(-63), 0, Lz(9)); collide(-67.5, -58.5, 4.5, 13.5);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 5; k++) {
    const side = [[0, -4.5], [0, 4.5], [-4.5, 0], [4.5, 0]][i];
    const along = (k - 2) * 1.9;
    B.box(M.stone, i < 2 ? 0.9 : 1, 1, i < 2 ? 1 : 0.9, L(-63 + side[0] + (i < 2 ? along : 0)), 22, Lz(9 + side[1] + (i < 2 ? 0 : along)));
  }
  B.box(M.stoneL, 12, 8, 6, L(-48, 0), 0, Lz(11)); collide(-54, -42, 8, 14);
  {
    const g = new THREE.ConeGeometry(4.6, 4, 4); g.rotateY(Math.PI / 4); g.scale(1.4, 1, 0.7);
    B.geo(M.slate, g, L(-48), 10, Lz(11));
    B.geo(M.slate, new THREE.ConeGeometry(0.9, 4, 8), L(-43), 12, Lz(11));
    B.box(M.stoneL, 1.6, 4, 1.6, L(-43), 8, Lz(11));
  }
  // jardin du palais
  ground(M.grass, -70, -60, -1, 3, 0.015);

  // ================= Cathédrale (pointe est) =================
  // Nef romane x ∈ [36, 64], z ∈ [-7, 7], façade à l'ouest (x = 34) avec deux tours
  B.box(M.stoneL, 28, 15, 12, L(50), 0, Lz(0)); collide(36, 64, -6, 6);
  B.box(M.stoneL, 28, 8, 3.5, L(50), 0, Lz(-7.7)); B.box(M.stoneL, 28, 8, 3.5, L(50), 0, Lz(7.7)); collide(36, 64, -9.5, 9.5);
  {
    const rh = 4, len = Math.hypot(rh, 6) + 0.4, slope = Math.atan2(rh, 6);
    for (const s of [-1, 1]) {
      const g = metricBoxUV(new THREE.BoxGeometry(28.6, 0.2, len), 28.6, 0.2, len);
      g.rotateX(s * slope);
      B.geo(M.slate, g, L(50), 15 + rh / 2, Lz(s * 3));
      const g2 = metricBoxUV(new THREE.BoxGeometry(28.6, 0.2, 4.4), 28.6, 0.2, 4.4);
      g2.rotateX(-s * 0.45);
      B.geo(M.slate, g2, L(50), 8.9, Lz(s * 7.8));
    }
    const ge = gable(12, rh); ge.rotateY(-Math.PI / 2); B.geo(M.stoneL, ge, L(36), 15, Lz(0));
    // Abside en demi-cercle
    B.geo(M.stoneL, new THREE.CylinderGeometry(6, 6, 15, 18, 1, false, 0, Math.PI), L(64), 7.5, Lz(0));
    B.geo(M.slate, new THREE.ConeGeometry(6.4, 4, 18, 1, false, 0, Math.PI), L(64), 17, Lz(0));
    world.circles.push({ x: L(64), z: Lz(0), r: 6.2, top: 99 });
    // Tours de la façade
    for (const s of [-1, 1]) {
      B.box(M.stoneL, 6, 26, 6, L(37), 0, Lz(s * 5)); collide(34, 40, s < 0 ? -8 : 2, s < 0 ? -2 : 8);
      const c = new THREE.ConeGeometry(4.3, 7, 4); c.rotateY(Math.PI / 4);
      B.geo(M.slate, c, L(37), 29.5, Lz(s * 5));
      for (let k = 0; k < 3; k++) B.box(M.dark, 0.9, 2.2, 0.1, L(34 + 0.02 - 0.06), 9 + k * 5.5, Lz(s * 5)) ;
    }
    // Portail et rosace
    B.box(M.stoneL, 0.8, 6, 6, L(35.6), 0, Lz(0));
    B.box(M.door, 0.2, 4, 2.6, L(35.15), 0, Lz(0));
    B.geo(M.dark, new THREE.CircleGeometry(1.8, 20).rotateY(-Math.PI / 2), L(35.05), 9.5, Lz(0));
    collide(35, 36.5, -3, 3);
  }
  // Parvis
  ground(M.pave, 22, 35, -12, 12, 0.012);
  ground(M.grass, 66, 72, -6, 6, 0.015);

  // ================= Les Châtelets =================
  // Grand Châtelet sur la rive droite, au bout du Grand Pont (passage x ∈ [-3.5, 3.5])
  for (const s of [-1, 1]) {
    B.box(M.stone, 7, 12, 10, L(s * 7), 0, Lz(NB - 6.5)); collide(s < 0 ? -10.5 : 3.5, s < 0 ? -3.5 : 10.5, NB - 11.5, NB - 1.5);
    B.geo(M.stone, new THREE.CylinderGeometry(2.6, 2.8, 15, 14), L(s * 9.5), 7.5, Lz(NB - 2));
    B.geo(M.slate, new THREE.ConeGeometry(3, 4, 14), L(s * 9.5), 17, Lz(NB - 2));
    world.circles.push({ x: L(s * 9.5), z: Lz(NB - 2), r: 2.7, top: 99 });
  }
  B.box(M.stone, 7, 4, 10, L(0), 6, Lz(NB - 6.5));
  // Petit Châtelet sur la rive gauche, au bout du Petit Pont (passage x ∈ [7, 13])
  for (const s of [-1, 1]) {
    B.box(M.stone, 5, 10, 7, L(10 + s * 5.5), 0, Lz(SB + 4.5)); collide(s < 0 ? 2 : 13, s < 0 ? 7 : 18, SB + 1, SB + 8);
    B.geo(M.slate, new THREE.ConeGeometry(3.6, 3.5, 4).rotateY(Math.PI / 4), L(10 + s * 5.5), 11.7, Lz(SB + 4.5));
  }
  B.box(M.stone, 6, 3.5, 7, L(10), 6.5, Lz(SB + 4.5));

  // ================= Rives =================
  // Rive gauche : la route du sud, quelques maisons et l'église Saint-Julien
  row('x', -40, 2, SB + 12, 'n', 6);
  row('x', 18, 56, SB + 12, 'n', 6, { shops: true });
  ground(M.dirt, 6, 14, SB + 8, 150, 0.012);
  row('z', SB + 18, 100, 1.5, 'e', 6);
  row('z', SB + 18, 100, 18.5, 'w', 6);
  filler(-40, -2, SB + 15, SB + 24, 6); filler(22, 56, SB + 15, SB + 24, 6);
  B.box(M.stoneL, 10, 9, 18, L(-25), 0, Lz(SB + 1 + 9 + 30)); // Saint-Julien, au loin
  // limites de la rive gauche
  collide(-44, -40, SB, SB + 26); collide(56, 60, SB, SB + 26); collide(-2, 6, SB + 24, 110); collide(14, 22, SB + 24, 110); collide(6, 14, 108, 112);
  // Rive droite : le port de Grève, des maisons, l'église Saint-Gervais
  row('x', -36, -12, NB - 14, 's', 6, { shops: true });
  row('x', 12, 40, NB - 14, 's', 6, { shops: true });
  filler(-36, -12, NB - 26, NB - 17, 7); filler(12, 40, NB - 26, NB - 17, 7);
  collide(-40, -36, NB - 26, NB); collide(40, 44, NB - 26, NB); collide(-12, 12, NB - 30, NB - 26);
  ground(M.dirt, -12, 12, NB - 26, NB - 11, 0.012);
  B.box(M.stoneL, 10, 12, 20, L(52), 0, Lz(NB - 30));
  B.box(M.stoneL, 5, 24, 5, L(48), 0, Lz(NB - 22));
  B.geo(M.slate, new THREE.ConeGeometry(3.4, 8, 4).rotateY(Math.PI / 4), L(48), 28, Lz(NB - 22));

  // ================= Arrière-plan : collines, abbaye Sainte-Geneviève, Montmartre =================
  const hill = (x, z, r, h, m = M.hill) => B.geo(m, new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / r, 1), L(x), 0, Lz(z));
  hill(-30, 190, 70, 26);   // montagne Sainte-Geneviève
  hill(20, -230, 90, 45);   // Montmartre
  hill(-200, -60, 80, 18); hill(200, 40, 90, 22); hill(150, 200, 80, 20, M.far); hill(-200, 200, 90, 24, M.far);
  B.box(M.stoneL, 14, 10, 24, L(-30), 22, Lz(175));                // abbaye sur la colline
  B.box(M.stoneL, 5, 22, 5, L(-24), 22, Lz(165));
  // Moulins et bateaux sur la Seine
  const boat = (x, z, ry) => {
    const g = new THREE.Group();
    g.position.set(L(x), -0.6, Lz(z));
    g.rotation.y = ry;
    scene.add(g);
    const hull = new THREE.Mesh(metricBoxUV(new THREE.BoxGeometry(2, 0.6, 7), 2, 0.6, 7), M.wood);
    hull.castShadow = true;
    g.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1, 1.6, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4), M.wood);
    bow.scale.set(1, 0.42, 1);
    bow.position.set(0, 0, 4.2);
    g.add(bow);
    for (let i = 0; i < 3; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), M.wood);
      crate.position.set((i % 2) * 0.4 - 0.2, 0.55, -1.8 + i * 1.3);
      g.add(crate);
    }
    return g;
  };
  const boats = [boat(-28, -31, 0.1), boat(30, -30, -0.15), boat(-40, 27, 1.5), boat(46, 27, 1.62), boat(-12, -36, 1.57)];
  // Moulin flottant contre le Grand Pont
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(L(s * 12), -0.4, Lz(-31));
    scene.add(g);
    const hut = new THREE.Mesh(metricBoxUV(new THREE.BoxGeometry(4, 3, 4), 4, 3, 4), M.wood);
    hut.position.y = 1.5;
    hut.castShadow = true;
    g.add(hut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.5, 12), M.timber);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(s * 2.4, 0.4, 0);
    g.add(wheel);
    boats.push({ wheel });
  }

  // ================= Marché Palu : étals =================
  const stall = (x, z, aw) => {
    B.box(M.wood, 2.4, 0.9, 1.1, L(x), 0, Lz(z));
    for (const sx of [-1.1, 1.1]) for (const sz of [-0.5, 0.5]) B.box(M.timber, 0.1, 2.3, 0.1, L(x + sx), 0, Lz(z + sz));
    B.box(aw, 2.7, 0.05, 1.6, L(x), 2.3, Lz(z), 0, 0.2);
    for (let i = 0; i < 4; i++) B.box([M.awningR, M.awningG, M.plasterO, M.wood][i % 4], 0.3, 0.25, 0.3, L(x - 0.9 + i * 0.6), 0.9, Lz(z));
    collide(x - 1.25, x + 1.25, z - 0.6, z + 0.6, 1.2);
  };
  stall(6.5, 9, M.awningR); stall(6.5, 15, M.awningB); stall(16, 9, M.awningG); stall(16, 15.5, M.awningR);
  // Puits du marché
  B.geo(M.stone, new THREE.CylinderGeometry(0.9, 0.9, 0.9, 14), L(11), 0.45, Lz(9));
  world.circles.push({ x: L(11), z: Lz(9), r: 1, top: 1 });
  // Croix du parvis et bancs
  B.box(M.stoneL, 0.3, 3, 0.3, L(27), 0, Lz(8)); B.box(M.stoneL, 1.2, 0.3, 0.3, L(27), 2.2, Lz(8));
  collide(26.6, 27.4, 7.6, 8.4);
  // Tonneaux et caisses le long des quais
  for (let i = 0; i < 10; i++) {
    const x = -55 + rand() * 105, z = rand() < 0.5 ? NB - 2 : SB + 2.5;
    if (Math.abs(x) < 6 || Math.abs(x - 10) < 6) continue;
    B.geo(M.wood, new THREE.CylinderGeometry(0.4, 0.4, 0.95, 10), L(x), 0.47, Lz(z));
    world.circles.push({ x: L(x), z: Lz(z), r: 0.45, top: 1 });
  }

  // Limites extérieures de l'île (rien après les parapets) et de la ville
  collide(-150, 150, 108, 112); collide(-150, 150, -82, -78);

  B.build(scene);

  // ================= Habitants =================
  const npcs = [];
  const people = [];
  const looks = [
    { outfit: 'peasant', tunic: 0x6a5a3a, trousers: 0x3a3028, hair: 0x3a2618 },
    { outfit: 'peasant', tunic: 0x4a5a6a, trousers: 0x2a2a30, hair: 0x6a4a2a, hood: true },
    { outfit: 'dress', tunic: 0x8a3a3a, hair: 0x5a3a1a },
    { outfit: 'dress', tunic: 0x3a5a3a, hair: 0x2a1a10 },
    { outfit: 'lord', tunic: 0x5a2a4a, trousers: 0x2a2a30, hair: 0x4a3020, cloak: 0x3a3a3a },
    { outfit: 'peasant', tunic: 0x1c1a1a, trousers: 0x1c1a1a, hood: true, hair: 0x4a3020 },   // clerc
    { outfit: 'peasant', tunic: 0x8a7a5a, trousers: 0x4a3a2a, hair: 0x8a8070, beard: 0x8a8070 },
  ];
  const LINES = [
    'Place, place ! Laissez passer la charrette !',
    'Du drap de Flandre, du drap fin ! Approchez, sire chevalier !',
    'On dit que le roi a chassé le sénéchal de Garlande du palais. La reine ne pouvait plus le souffrir.',
    'Méfie-toi des coupe-bourses du marché Palu, étranger. Ils ont des doigts de fée.',
    'Je suis clerc de l\'école de la cathédrale. Nous étudions la logique… et le vin du Grand Pont.',
    'Les eaux de la Seine sont hautes cette année. Les moulins tournent jour et nuit.',
    'Le roi Louis est bien gros, dit-on, mais c\'est un rude guerrier. Il ne craint ni les barons ni l\'Anglais.',
    'L\'abbé Suger est l\'homme le plus sage du royaume. C\'est lui qui conseille le roi.',
  ];
  // Itinéraires des passants (coordonnées locales)
  const routes = [
    [[-36, 0], [18, 0]], [[0, -18], [0, 1], [-20, 1]], [[11, 18], [11, 4], [-10, -1]], [[24, -10], [24, 10], [8, 1]],
    [[10, 24], [10, 31], [10, 50], [10, 70]], [[0, -22], [0, -38], [0, -50]], [[-30, -1], [14, 1], [28, 5]], [[6, 11], [16, 12], [12, 18]],
    [[-20, SB + 9], [50, SB + 8]], [[-30, NB - 8], [35, NB - 9]],
  ];
  routes.forEach((r, i) => {
    const look = looks[i % looks.length];
    const n = makeNPC(scene, world, { id: 'parisien', name: ['Un bourgeois', 'Un passant', 'Une marchande', 'Une lavandière', 'Un marchand', 'Un clerc', 'Un vieil homme'][i % 7], x: L(r[0][0]), z: Lz(r[0][1]), rotY: 0, look });
    n.lines = [[LINES[i % LINES.length]], [LINES[(i + 3) % LINES.length]]];
    n.route = r.map(([x, z]) => new THREE.Vector3(L(x), 0, Lz(z)));
    n.leg = 1;
    n.dir = 1;
    n.phase = rand() * 6;
    n.walker = true;
    people.push(n);
    npcs.push(n);
  });
  // Marchands immobiles derrière leurs étals
  for (const [x, z, rot, name, line] of [
    [6.5, 7.9, Math.PI, 'Une marchande de poisson', 'Du poisson de Seine, frais du matin ! Des anguilles, des brochets !'],
    [16, 7.9, Math.PI, 'Un marchand d\'épices', 'Du poivre venu d\'Outremer, par Venise et la foire de Troyes. Plus cher que l\'argent !'],
    [6.5, 16.4, 0, 'Un boulanger', 'Pain de Gonesse, le meilleur de Paris !'],
  ]) {
    const n = makeNPC(scene, world, { id: 'marchand', name, x: L(x), z: Lz(z), rotY: rot, look: looks[(x * 7 | 0) % looks.length] });
    n.lines = [[line]];
    npcs.push(n);
  }
  // Gardes du palais et des Châtelets
  const guard = (x, z, rot, name, line) => {
    const n = makeNPC(scene, world, { id: 'garde-paris', name, x: L(x), z: Lz(z), rotY: rot, look: { outfit: 'mail', trousers: 0x2a2a30, helmet: true, coif: true, shield: true, arms: { field: 'azur', charge: 'or', pattern: 'etoile' } } });
    n.lines = [[line]];
    npcs.push(n);
    return n;
  };
  const guards = {
    palace1: guard(-38.6, -2.6, Math.PI / 2, 'Un garde du roi', 'Halte ! Le palais du roi. On n\'entre pas sans affaire.'),
    palace2: guard(-38.6, 2.6, Math.PI / 2, 'Un garde du roi', 'Le roi tient sa cour dans la grande salle.'),
    petit: guard(6.4, SB + 9.5, 0, 'Le guet du Petit Châtelet', 'Bienvenue à Paris, voyageur. Le Petit Pont mène à la Cité.'),
    grand: guard(-4.3, NB - 12, 0, 'Le guet du Grand Châtelet', 'La nuit, les rues de la Cité ne sont pas sûres. Garde la main sur ton épée.'),
  };

  // ================= Intérieurs : palais, cathédrale, taverne du Grand Pont =================
  ROOMS.palais = {
    name: 'la grande salle du palais', origin: { x: 250, z: 230 }, w: 18, d: 22, h: 10,
    door: { x: L(SPOTS.hallDoor.x), z: Lz(SPOTS.hallDoor.z + 0.6), rot: 0 }, locked: true,
  };
  ROOMS.cathedrale = {
    name: 'la cathédrale', origin: { x: 250, z: 290 }, w: 13, d: 28, h: 14,
    door: { x: L(SPOTS.cathedralDoor.x - 0.6), z: Lz(0), rot: -Math.PI / 2 },
  };
  ROOMS.pontTavern = {
    name: 'la taverne du Grand Pont', origin: { x: 250, z: 350 }, w: 12, d: 9, h: 4.2,
    door: { x: L(SPOTS.tavernDoor.x + 0.2), z: Lz(SPOTS.tavernDoor.z), rot: Math.PI / 2 },
  };
  const { room, box, fire, candle, banner, sit } = kit;
  const KM = kit.M;
  // Palais : grande salle royale
  const royal = {};
  {
    const R = ROOMS.palais;
    room(R, KM.stoneLight, KM.stone);
    const { x, z } = R.origin;
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 18).rotateX(-Math.PI / 2), mat(0x1f3a8f, { roughness: 1 }));
    carpet.position.set(x, 0.02, z + 1);
    scene.add(carpet);
    for (let k = -8; k <= 8; k += 4) for (const sx of [-5.2, 5.2]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, R.h, 14), KM.stoneLight);
      c.position.set(x + sx, R.h / 2, z + k);
      c.castShadow = c.receiveShadow = true;
      scene.add(c);
      world.circles.push({ x: x + sx, z: z + k, r: 0.55, top: 99 });
    }
    box(7, 0.35, 3.4, x, 0, z - 9.2, KM.wood);
    box(4.5, 0.3, 2, x, 0.35, z - 9.8, KM.wood);
    for (const sx of [-0.9, 0.9]) { box(1.2, 0.7, 1.0, x + sx, 0.65, z - 10.1, KM.timber); box(1.2, 2.2, 0.25, x + sx, 0.65, z - 10.55, KM.timber); }
    const blue = mat(0x1f3a8f, { side: THREE.DoubleSide });
    const dais = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4), blue);
    dais.position.set(x, 5.4, z - 10.9);
    scene.add(dais);
    for (let i = 0; i < 6; i++) banner(x + (i % 2 ? 1 : -1) * 8.9, 6, z - 7 + Math.floor(i / 2) * 7, (i % 2 ? -1 : 1) * Math.PI / 2, blue);
    for (const [dx, dz] of [[-2.4, -7], [2.4, -7], [-2.4, 0], [2.4, 0], [-2.4, 7], [2.4, 7]]) {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, 1.6, 8), mat(0x6a5020, { metalness: 0.7, roughness: 0.4 }));
      stand.position.set(x + dx, 0.8, z + dz);
      scene.add(stand);
      candle(x + dx, 1.6, z + dz);
    }
    fire(x - 8, 0, z + 3, 1.3);
    box(0.8, 3, 2.4, x - 8.6, 0, z + 3, KM.stone, { collide: false });
    // Le roi Louis VI, la reine Adélaïde, l'abbé Suger
    const crown = (h) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.09, 12, 1, true), mat(0xe0b040, { metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }));
      c.position.y = 0.2;
      h.head.add(c);
      for (let i = 0; i < 6; i++) {
        const p = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 4), c.material);
        p.position.set(Math.cos(i) * 0.145, 0.27, Math.sin(i) * 0.145);
        h.head.add(p);
      }
    };
    royal.king = makeNPC(scene, world, {
      id: 'roi', name: 'Louis VI, roi des Francs', x: x - 0.9, z: z - 9.6, rotY: 0,
      look: { outfit: 'lord', tunic: 0x1f3a8f, trousers: 0x2a2a30, hair: 0x8a6a4a, beard: 0x8a6a4a, cloak: 0x8a1f18 },
      pose: (h) => { sit(h); h.root.position.y = 0.25; h.spine.scale.set(1.3, 1, 1.35); crown(h); },
    });
    royal.queen = makeNPC(scene, world, {
      id: 'reine', name: 'Adélaïde, reine des Francs', x: x + 0.9, z: z - 9.6, rotY: 0,
      look: { outfit: 'dress', tunic: 0x6a2a6a, hair: 0x6a3a1a, cloak: 0x1f3a8f },
      pose: (h) => { sit(h); h.root.position.y = 0.25; crown(h); },
    });
    royal.suger = makeNPC(scene, world, {
      id: 'suger', name: 'L\'abbé Suger', x: x + 3, z: z - 6.6, rotY: -0.5,
      look: { outfit: 'peasant', tunic: 0x1c1a1a, trousers: 0x1c1a1a, hood: true, hair: 0x6a5a4a },
      pose: (h) => { h.armL.rotation.x = -0.5; h.elbowL.rotation.x = -1.3; h.armR.rotation.x = -0.5; h.elbowR.rotation.x = -1.3; },
    });
    for (const [dx, dz] of [[-4, -8], [4, -8]]) {
      const g = makeNPC(scene, world, { id: 'garde-paris', name: 'Un garde du roi', x: x + dx, z: z + dz, rotY: 0, look: { outfit: 'mail', trousers: 0x2a2a30, helmet: true, coif: true, shield: true, arms: { field: 'azur', charge: 'or', pattern: 'etoile' } } });
      g.lines = [['Silence devant le roi.']];
      npcs.push(g);
    }
    npcs.push(royal.king, royal.queen, royal.suger);
    royal.king.markerHeight = 2.2;
    R.light = { x: x - 7, y: 1.5, z: z + 3, color: 0xff8a40, intensity: 16, distance: 18 };
    R.light2 = { x, y: 6, z: z - 5, color: 0xffd8a0, intensity: 14, distance: 22 };
    R.spawn = { x: x, z: z + R.d / 2 - 3.4, rot: Math.PI };
  }
  // Cathédrale (nef romane)
  {
    const R = ROOMS.cathedrale;
    room(R, KM.stoneLight, KM.stone);
    const { x, z } = R.origin;
    for (let k = -10; k <= 10; k += 4) for (const sx of [-3.6, 3.6]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, R.h, 14), KM.stoneLight);
      c.position.set(x + sx, R.h / 2, z + k);
      c.castShadow = c.receiveShadow = true;
      scene.add(c);
      world.circles.push({ x: x + sx, z: z + k, r: 0.6, top: 99 });
    }
    box(3, 1.0, 1.2, x, 0, z - 12, KM.stoneLight);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.06), KM.gold);
    cross.position.set(x, 1.4, z - 12.2);
    scene.add(cross);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.06), KM.gold);
    bar.position.set(x, 1.5, z - 12.2);
    scene.add(bar);
    for (const dx of [-1.1, 1.1]) candle(x + dx, 1.0, z - 12);
    for (let k = -6; k <= 8; k += 2.2) for (const sx of [-1.7, 1.7]) box(2.2, 0.45, 0.4, x + sx, 0, z + k, KM.wood);
    const priest = makeNPC(scene, world, {
      id: 'chanoine', name: 'Un chanoine', x: x - 1.5, z: z - 10.5, rotY: 0.3,
      look: { outfit: 'peasant', tunic: 0xe8e0d0, trousers: 0x1c1a1a, hair: 0x8a8070 },
    });
    priest.lines = [['Cette église est bien vieille, mon fils. L\'évêque rêve d\'en bâtir une plus grande, plus haute, pleine de lumière…'], ['Prie pour le roi, et pour la paix du royaume. On murmure que les Garlande ne se soumettront pas.']];
    npcs.push(priest);
    R.light = { x, y: 2, z: z - 11, color: 0xffb060, intensity: 10, distance: 14 };
    R.light2 = { x, y: 9, z, color: 0xc8d8ff, intensity: 10, distance: 28 };
    R.spawn = { x: x, z: z + R.d / 2 - 3.4, rot: Math.PI };
  }
  // Taverne du Grand Pont « Au Cheval Blanc »
  const tav = {};
  {
    const R = ROOMS.pontTavern;
    room(R, KM.timber, KM.floor);
    const { x, z } = R.origin;
    fire(x - 5, 0, z - 3.2);
    box(0.9, 2.6, 1.8, x - 5.6, 0, z - 3.2, KM.stone, { collide: false });
    box(4, 1.1, 0.7, x + 3, 0, z - 2.6, KM.wood);
    for (const [tx, tz] of [[-2.2, 1.5], [2.6, 1.8], [-2, -2], [0.6, -2.6]]) {
      box(1.6, 0.8, 0.9, x + tx, 0, z + tz, KM.wood);
      for (const s of [-1, 1]) box(1.6, 0.45, 0.35, x + tx, 0, z + tz + s * 0.8, KM.wood, { collide: false });
      candle(x + tx, 0.8, z + tz);
    }
    tav.keeper = makeNPC(scene, world, {
      id: 'taverniere-paris', name: 'Perrine, tavernière', x: x + 3, z: z - 3.3, rotY: 0,
      look: { outfit: 'dress', tunic: 0x7a5a3a, hair: 0x8a3a1a },
    });
    tav.keeper.lines = [['Du vin d\'Argenteuil, du vin de Suresnes… ou de la cervoise, si tu as le gosier moins fin.'], ['Sur le Grand Pont, on entend tout ce qui se dit dans Paris. Et on se tait.']];
    npcs.push(tav.keeper);
    // Les conspirateurs (table du fond) : l'homme au manteau vert et deux hommes de main
    tav.green = makeNPC(scene, world, {
      id: 'vert', name: 'L\'homme au manteau vert', x: x - 2.2, z: z - 2.8, rotY: 0,
      look: { outfit: 'lord', tunic: 0x2a4a2a, trousers: 0x2a2a20, hair: 0x2a1a10, beard: 0x2a1a10, cloak: 0x2a5a2a, hood: true },
      pose: sit,
    });
    tav.thug1 = makeNPC(scene, world, {
      id: 'sbire', name: 'Un homme de main', x: x - 2.9, z: z - 1.2, rotY: Math.PI,
      look: { outfit: 'gambeson', trousers: 0x3a3028, hair: 0x3a2a1a, beard: 0x3a2a1a },
      pose: sit,
    });
    tav.thug2 = makeNPC(scene, world, {
      id: 'sbire', name: 'Un homme de main', x: x - 1.5, z: z - 1.2, rotY: Math.PI,
      look: { outfit: 'gambeson', trousers: 0x2a2a30, hair: 0x6a4a2a, hood: true },
      pose: sit,
    });
    for (const n of [tav.green, tav.thug1, tav.thug2]) { n.seated = true; npcs.push(n); }
    tav.eavesdrop = { x: x - 2.2, z: z + 2.3 };  // banc de la table voisine, dos aux conspirateurs
    R.light = { x: x - 4.5, y: 1.2, z: z - 3, color: 0xff8a40, intensity: 12, distance: 14 };
    R.light2 = { x: x + 1, y: 3.2, z: z + 1, color: 0xffb060, intensity: 6, distance: 12 };
  }
  // Enseigne de la taverne sur le pont
  {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 1.1), mat(0xe8e4da));
    sign.position.set(L(3.6), 3, Lz(SPOTS.tavernDoor.z - 1.4));
    scene.add(sign);
    const horse = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.6), mat(0x8a7a6a));
    horse.position.set(L(3.62), 3, Lz(SPOTS.tavernDoor.z - 1.4));
    scene.add(horse);
  }

  // ================= Animation des passants et des moulins =================
  const tmp = new THREE.Vector3();
  function update(dt, playerPos, night) {
    if (!inParis(playerPos)) return;
    for (const b of boats) if (b.wheel) b.wheel.rotation.x += dt * 0.8;
    for (const n of people) {
      if (n.inCombat) continue;
      n.object.visible = !night || n.route.length > 3;
      if (!n.object.visible) { n.circle.top = -99; continue; }
      n.circle.top = 99;
      const p = n.object.position;
      const target = n.route[n.leg];
      const close = tmp.copy(playerPos).sub(p).setY(0).length() < 2.2;
      if (close) { animateWalk(n.h, n.phase, 0); n.update(dt, playerPos); continue; }
      const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.4) {
        if (n.leg + n.dir >= n.route.length || n.leg + n.dir < 0) n.dir *= -1;
        n.leg += n.dir;
        continue;
      }
      const sp = 1.3;
      const nx = p.x + (dx / d) * sp * dt, nz = p.z + (dz / d) * sp * dt;
      n.moveTo(nx, nz, Math.atan2(dx, dz));
      n.phase += dt * sp * 2.6;
      animateWalk(n.h, n.phase, 1);
    }
  }

  return { npcs, guards, royal, tav, update, SPOTS, L, Lz };
}
