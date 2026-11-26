// La plaine au nord de Paris (chapitre VII) : la route de Saint-Denis, la butte de Montmartre
// et ses vignes, le hameau de La Chapelle, et l'abbaye de Saint-Denis.
import * as THREE from 'three';
import { metricBoxUV } from './textures.js?v=202611261852';
import { Batch, PARIS } from './paris.js?v=202611261852';
import { makeNPC } from './npcs.js?v=202611261852';

/** Repères (coordonnées locales de Paris). */
export const NORTH = {
  start: { x: 0, z: -58 },          // place de Grève, devant le Grand Châtelet
  trunk: { x: 0, z: -194 },         // l'arbre abattu en travers de la route
  ambush: { x: 1, z: -186 },
  montmartre: { x: 55, z: -205, r: 44, h: 34 },
  abbeyGate: { x: 0, z: -312 },
};
export const ROUTE_A = [[0, -62], [0, -76], [-2, -110], [2, -140], [1, -168], [0, -187]];
export const ROUTE_B = [[0, -200], [-1, -240], [1, -280], [0, -306]];

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

export function buildNorth(scene, world, M) {
  const OX = PARIS.x, OZ = PARIS.z;
  const L = (x) => OX + x, Lz = (z) => OZ + z;
  const rand = rng(1128);
  const B = new Batch();
  const collide = (minX, maxX, minZ, maxZ, top = 99) => {
    const b = { minX: L(minX), maxX: L(maxX), minZ: Lz(minZ), maxZ: Lz(maxZ), top };
    world.boxes.push(b);
    return b;
  };
  world.indoor.push({ minX: OX - 170, maxX: OX + 210, minZ: OZ - 410, maxZ: OZ - 150 });
  const G = { field: mat(0x8a7a4a), field2: mat(0x6a7a3a), leaf: mat(0x3d5a2a), leaf2: mat(0x4a6a30), bark: mat(0x4a3424), vine: mat(0x4a6a2a), bush: mat(0x35502a) };

  const ground = (material, x0, x1, z0, z1, y = 0) => {
    const w = x1 - x0, d = z1 - z0;
    const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 3, uv.getY(i) * d / 3);
    B.geo(material, g, L((x0 + x1) / 2), y, Lz((z0 + z1) / 2));
  };
  ground(M.grass, -170, 210, -410, -150, 0);
  ground(M.grass, -150, 150, -150, -72, 0.006);
  ground(M.dirt, -3.5, 3.5, -330, -66, 0.014);
  // Champs en lanières le long de la route
  for (let z = -80; z > -300; z -= 18) {
    for (const side of [-1, 1]) {
      if (side > 0 && z < -165 && z > -245) continue; // vignes et butte
      const x0 = side < 0 ? -55 : 8, x1 = side < 0 ? -8 : 100;
      ground(rand() < 0.5 ? G.field : G.field2, x0, x1, z - 15, z - 1, 0.01);
    }
  }
  // Montmartre : la butte, ses vignes et l'église Saint-Pierre au sommet
  const MM = NORTH.montmartre;
  B.geo(M.hill, new THREE.SphereGeometry(MM.r, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, MM.h / MM.r, 1), L(MM.x), 0, Lz(MM.z));
  world.circles.push({ x: L(MM.x), z: Lz(MM.z), r: MM.r - 2, top: 99 });
  B.box(M.stoneL, 6, 5, 10, L(MM.x), MM.h - 1, Lz(MM.z));
  B.box(M.stoneL, 3, 9, 3, L(MM.x), MM.h - 1, Lz(MM.z + 4));
  B.geo(M.slate, new THREE.ConeGeometry(2.4, 3, 4).rotateY(Math.PI / 4), L(MM.x), MM.h + 9.5, Lz(MM.z + 4));
  // Vignes au pied de la butte (rangs de ceps), le long de la route (côté est)
  for (let r = 0; r < 6; r++) {
    const x = 7 + r * 1.6;
    for (let z = -176; z > -216; z -= 1.2) {
      B.box(G.bark, 0.08, 1.0, 0.08, L(x), 0, Lz(z));
      B.geo(G.vine, new THREE.SphereGeometry(0.42, 6, 4), L(x), 1.0, Lz(z));
    }
    collide(x - 0.3, x + 0.3, -216, -176, 1.3);
  }
  // Petit muret de pierre entre la route et les vignes
  B.box(M.stoneL, 0.5, 0.7, 40, L(5.4), 0, Lz(-196));
  collide(5.1, 5.7, -216, -176, 0.9);
  // Fourrés côté ouest, où se cachent les hommes de Garlande
  for (let i = 0; i < 16; i++) {
    const x = -6 - rand() * 7, z = -178 - rand() * 22, r = 0.9 + rand() * 0.8;
    B.geo(rand() < 0.5 ? G.bush : G.leaf2, new THREE.SphereGeometry(r, 8, 6).scale(1, 0.75, 1), L(x), r * 0.5, Lz(z));
    world.circles.push({ x: L(x), z: Lz(z), r: r * 0.8, top: 1.4 });
  }
  // Arbres de la plaine
  const tree = (x, z, s) => {
    B.geo(G.bark, new THREE.CylinderGeometry(0.18 * s, 0.26 * s, 2.6 * s, 7), L(x), 1.3 * s, Lz(z));
    if (rand() < 0.4) B.geo(G.leaf, new THREE.ConeGeometry(1.6 * s, 4.5 * s, 8), L(x), 4.6 * s, Lz(z));
    else B.geo(rand() < 0.5 ? G.leaf : G.leaf2, new THREE.SphereGeometry(1.8 * s, 9, 7), L(x), 3.6 * s, Lz(z));
    world.circles.push({ x: L(x), z: Lz(z), r: 0.3 * s, top: 99 });
  };
  for (let i = 0; i < 140; i++) {
    const x = -58 + rand() * 166, z = -78 - rand() * 280;
    if (Math.abs(x) < 9) continue;
    if (Math.hypot(x - MM.x, z - MM.z) < MM.r + 3) continue;
    if (x > 4 && x < 18 && z < -170 && z > -220) continue;
    if (Math.abs(x) < 42 && z < -296) continue; // abords de l'abbaye
    tree(x, z, 0.8 + rand() * 0.6);
  }
  // Rangées d'arbres en bordure (limites du monde)
  for (let z = -76; z > -360; z -= 7) { tree(-60 + rand() * 2, z, 1.1); tree(108 + rand() * 2, z, 1.1); }
  collide(-64, -58, -362, -72); collide(108, 114, -362, -72); collide(-64, 114, -366, -360);
  // L'arbre abattu en travers de la route
  const trunkMesh = new THREE.Group();
  {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 8, 10).rotateZ(Math.PI / 2), G.bark);
    log.position.y = 0.4;
    log.castShadow = true;
    trunkMesh.add(log);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1.1, 7, 5), G.leaf);
      b.position.set(-4.5 + i * 0.6, 0.8 + (i % 2) * 0.3, (i % 2 ? 0.6 : -0.5));
      trunkMesh.add(b);
    }
    trunkMesh.position.set(L(NORTH.trunk.x + 0.5), 0, Lz(NORTH.trunk.z));
    scene.add(trunkMesh);
  }
  const trunkBox = collide(-4, 4.5, NORTH.trunk.z - 0.5, NORTH.trunk.z + 0.5, 0.8);

  // Hameau de La Chapelle, à mi-chemin
  const hut = (x, z, ry) => {
    B.box(M.plaster, 5, 2.8, 4, L(x), 0, Lz(z), ry);
    const roof = new THREE.ConeGeometry(3.9, 2.2, 4).rotateY(Math.PI / 4);
    roof.scale(1.1, 1, 0.85);
    roof.rotateY(ry);
    B.geo(M.thatch, roof, L(x), 3.9, Lz(z));
    collide(x - 2.6, x + 2.6, z - 2.6, z + 2.6);
  };
  hut(-12, -126, 0); hut(-13, -136, 0); hut(13, -129, 0); hut(-12, -146, 0.3);
  B.box(M.stoneL, 5, 5, 7, L(14), 0, Lz(-142));
  B.box(M.stoneL, 2, 8, 2, L(14), 0, Lz(-139));
  collide(11.5, 16.5, -145.5, -138.5);
  // Borne et croix au carrefour
  B.box(M.stoneL, 0.3, 2.6, 0.3, L(-4.6), 0, Lz(-150)); B.box(M.stoneL, 1, 0.25, 0.25, L(-4.6), 1.9, Lz(-150));

  // ================= L'abbaye de Saint-Denis =================
  const AZ0 = -312, AZ1 = -356, AX = 36, WH = 6;
  for (const [a, b] of [[-AX, -3.5], [3.5, AX]]) { B.box(M.stone, b - a, WH, 1.2, L((a + b) / 2), 0, Lz(AZ0)); collide(a, b, AZ0 - 0.6, AZ0 + 0.6); }
  B.box(M.stone, AX * 2, WH, 1.2, L(0), 0, Lz(AZ1)); collide(-AX, AX, AZ1 - 0.6, AZ1 + 0.6);
  for (const s of [-1, 1]) { B.box(M.stone, 1.2, WH, AZ0 - AZ1, L(s * AX), 0, Lz((AZ0 + AZ1) / 2)); collide(s * AX - 0.6, s * AX + 0.6, AZ1, AZ0); }
  for (let x = -AX; x < AX; x += 1.6) if (Math.abs(x) > 4) B.box(M.stone, 0.8, 0.8, 1.2, L(x + 0.4), WH, Lz(AZ0));
  for (const s of [-1, 1]) {
    B.geo(M.stone, new THREE.CylinderGeometry(2, 2.2, 9, 12), L(s * 5.6), 4.5, Lz(AZ0));
    B.geo(M.slate, new THREE.ConeGeometry(2.4, 3.2, 12), L(s * 5.6), 10.6, Lz(AZ0));
    world.circles.push({ x: L(s * 5.6), z: Lz(AZ0), r: 2.1, top: 99 });
  }
  B.box(M.stone, 7, 2.5, 1.6, L(0), 4.5, Lz(AZ0));
  // Basilique carolingienne : nef, transept, clocher-porche au sud (côté route)
  B.box(M.stoneL, 14, 13, 26, L(0), 0, Lz(-338)); collide(-7, 7, -351, -325);
  {
    const rh = 4.5, len = Math.hypot(rh, 7) + 0.4, slope = Math.atan2(rh, 7);
    for (const s of [-1, 1]) {
      const g = metricBoxUV(new THREE.BoxGeometry(len, 0.2, 26.6), len, 0.2, 26.6);
      g.rotateZ(-s * slope);
      B.geo(M.slate, g, L(s * 3.5), 13 + rh / 2, Lz(-338));
    }
  }
  B.box(M.stoneL, 24, 11, 7, L(0), 0, Lz(-342)); collide(-12, 12, -345.5, -338.5);
  B.box(M.stoneL, 7, 24, 7, L(0), 0, Lz(-322)); collide(-3.5, 3.5, -325.5, -318.5);
  B.geo(M.slate, new THREE.ConeGeometry(5, 7, 4).rotateY(Math.PI / 4), L(0), 27.5, Lz(-322));
  B.box(M.door, 2.4, 3.6, 0.2, L(0), 0, Lz(-318.4));
  B.geo(M.dark, new THREE.CircleGeometry(1.2, 16), L(0), 9, Lz(-318.44));
  // Bâtiments des moines
  B.box(M.plaster, 10, 6, 6, L(-22), 0, Lz(-330)); collide(-27, -17, -333, -327);
  B.box(M.plaster, 10, 6, 6, L(22), 0, Lz(-330)); collide(17, 27, -333, -327);
  // Le bourg devant l'abbaye
  for (const [x, z] of [[-10, -298], [-16, -298], [-22, -300], [10, -297], [16, -299], [23, -298]]) hut(x, z, 0);

  B.build(scene);

  // ================= Personnages de Saint-Denis =================
  const npcs = [];
  const monk = (x, z, rot, name, lines) => {
    const n = makeNPC(scene, world, { id: 'moine', name, x: L(x), z: Lz(z), rotY: rot, look: { outfit: 'peasant', tunic: 0x1c1a1a, trousers: 0x1c1a1a, hood: true, hair: 0x6a5a4a } });
    n.lines = lines;
    npcs.push(n);
    return n;
  };
  const monks = [
    monk(-2.4, -310.5, 0, 'Frère portier', [['Bienvenue à Saint-Denis, où reposent les rois de France.']]),
    monk(2.6, -314, 0.4, 'Un moine', [['L\'abbé Suger veut rebâtir notre église, plus grande, pleine de lumière. Il en parle comme d\'un rêve.']]),
    monk(-8, -316, -0.5, 'Un jeune moine', [['Saint Denis a marché, sa tête entre les mains, depuis Montmartre jusqu\'ici. C\'est vrai ! Enfin… c\'est ce qu\'on raconte.']]),
  ];
  const villager = makeNPC(scene, world, { id: 'villageois-sd', name: 'Un paysan', x: L(-9), z: Lz(-131), rotY: Math.PI / 2, look: { outfit: 'peasant', tunic: 0x6a5a3a, trousers: 0x3a3028, hair: 0x6a4a2a } });
  villager.lines = [['Des hommes armés traînent du côté de Montmartre depuis hier. Ils disent chasser… sans chiens ni faucons.']];
  npcs.push(villager);

  return {
    npcs, monks,
    setTrunk(on) { trunkMesh.visible = on; trunkBox.top = on ? 0.8 : -99; },
  };
}
