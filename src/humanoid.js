// Personnages : corps articulé (hanches, genoux, épaules, coudes, buste)
// et équipements d'époque (1126) : cotte de mailles, casque à nasal,
// écu en amande, gambison, manteau, robe…
import * as THREE from 'three';
import { Tex } from './textures.js?v=202611261508';

// ---------- Matériaux (partagés entre personnages) ----------
const matCache = {};

function withRepeat(tex, rx, ry = rx) {
  const t = tex.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

function M(key) {
  if (matCache[key]) return matCache[key];
  let m;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
  const fabric = (color, texName = 'cloth', rep = 4) => {
    const t = Tex[texName]();
    return std({ color, map: withRepeat(t.map, rep), normalMap: withRepeat(t.normalMap, rep), roughness: 0.95 });
  };
  switch (key) {
    case 'skin': m = std({ color: 0xd9a383, roughness: 0.7 }); break;
    case 'eye': m = std({ color: 0x1a1410, roughness: 0.3 }); break;
    case 'mail': {
      const t = Tex.chainmail();
      m = std({
        color: 0xa8acb0, metalness: 0.85, roughness: 0.42,
        map: withRepeat(t.map, 14), normalMap: withRepeat(t.normalMap, 14),
        normalScale: new THREE.Vector2(1.4, 1.4),
      });
      break;
    }
    case 'steel': {
      const t = Tex.steel();
      m = std({ color: 0xc8ccd0, metalness: 1, roughness: 0.28, map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.4, 0.4) });
      break;
    }
    case 'steelDark': m = std({ color: 0x6d7075, metalness: 0.9, roughness: 0.45 }); break;
    case 'gold': m = std({ color: 0xd4a843, metalness: 1, roughness: 0.35 }); break;
    case 'leather': {
      const t = Tex.leather();
      m = std({ color: 0x5a3a22, map: withRepeat(t.map, 3), normalMap: withRepeat(t.normalMap, 3), roughness: 0.75 });
      break;
    }
    case 'leatherDark': {
      const t = Tex.leather();
      m = std({ color: 0x33231a, map: withRepeat(t.map, 3), normalMap: withRepeat(t.normalMap, 3), roughness: 0.7 });
      break;
    }
    case 'gambeson': {
      const t = Tex.quilted();
      m = std({ color: 0x9c8058, map: withRepeat(t.map, 2, 2), normalMap: withRepeat(t.normalMap, 2, 2), normalScale: new THREE.Vector2(1.5, 1.5), roughness: 1 });
      break;
    }
    case 'wood': m = std({ color: 0x9a6e44, roughness: 0.8 }); break;
    case 'fur': m = std({ color: 0x8a7560, roughness: 1, map: withRepeat(Tex.leather().map, 6) }); break;
    case 'heraldry': m = std({ map: Tex.heraldry(), roughness: 0.6, metalness: 0.05 }); break;
    default:
      // "cloth:0xRRGGBB" ou "trousers:0xRRGGBB"
      if (key.startsWith('cloth:')) m = fabric(parseInt(key.slice(6)), 'cloth', 5);
      else if (key.startsWith('hair:')) m = std({ color: parseInt(key.slice(5)), roughness: 0.9 });
      else if (key.startsWith('skin:')) m = std({ color: parseInt(key.slice(5)), roughness: 0.7 });
      else if (key.startsWith('arms:')) m = std({ map: Tex.arms(JSON.parse(key.slice(5))), roughness: 0.6, metalness: 0.05 });
      else m = std({ color: 0xff00ff });
  }
  matCache[key] = m;
  return m;
}

// ---------- Géométries de base ----------
function mesh(geo, material, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function capsule(r, len, material, parent, y) {
  return mesh(new THREE.CapsuleGeometry(r, len, 4, 10), material, parent, 0, y, 0);
}

/** Buste de forme organique (tour de taille → poitrine → épaules). */
function torsoGeo(scale = 1) {
  const pts = [
    [0.0, 0.0], [0.15, 0.0], [0.155, 0.08], [0.165, 0.18], [0.185, 0.3],
    [0.195, 0.4], [0.185, 0.47], [0.15, 0.52], [0.08, 0.56], [0.0, 0.57],
  ].map(([r, y]) => new THREE.Vector2(r * scale, y));
  const g = new THREE.LatheGeometry(pts, 18);
  g.scale(1.18, 1, 0.78);
  return g;
}

/** Jupe tronconique (bas de cotte ou de gambison), ouverte. */
function skirtGeo(rTop, rBottom, h, thetaStart = 0, thetaLength = Math.PI * 2) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, 18, 1, true, thetaStart, thetaLength);
  return g;
}

/** Écu normand en amande. */
export function createKiteShield(arms = null) {
  const group = new THREE.Group();
  const w = 0.5, h = 0.92;
  const shape = new THREE.Shape();
  shape.moveTo(0, -h / 2);
  shape.quadraticCurveTo(w * 0.5, -h * 0.05, w / 2, h * 0.3);
  shape.quadraticCurveTo(w * 0.42, h / 2, 0, h / 2);
  shape.quadraticCurveTo(-w * 0.42, h / 2, -w / 2, h * 0.3);
  shape.quadraticCurveTo(-w * 0.5, -h * 0.05, 0, -h / 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.025, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 16,
  });
  // Coordonnées de texture : l'armoirie couvre tout l'écu
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + w / 2) / w, (uv.getY(i) + h / 2) / h);
  // Légère courbure de l'écu
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - Math.pow(p.getX(i) / (w / 2), 2) * 0.06);
  geo.computeVertexNormals();
  mesh(geo, arms ? M('arms:' + JSON.stringify(arms)) : M('heraldry'), group);
  // Bordure de fer et umbo (bosse centrale)
  const rimPts = shape.getSpacedPoints(48).map((v) => new THREE.Vector3(v.x, v.y, 0.04 - Math.pow(v.x / (w / 2), 2) * 0.06));
  const rim = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 64, 0.012, 5, true);
  mesh(rim, M('steelDark'), group);
  mesh(new THREE.SphereGeometry(0.055, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), M('steel'), group, 0, h * 0.12, 0.04);
  return group;
}

/** Épée (lame d'acier ou de bois). La lame pointe vers +Z. */
export function createSword(wooden = false) {
  const g = new THREE.Group();
  const bladeMat = wooden ? M('wood') : M('steel');
  const blade = new THREE.CylinderGeometry(0.001, 0.028, 0.08, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4);
  mesh(new THREE.BoxGeometry(0.05, 0.012, 0.78), bladeMat, g, 0, 0, 0.47);
  mesh(blade, bladeMat, g, 0, 0, 0.9);
  if (!wooden) mesh(new THREE.BoxGeometry(0.012, 0.014, 0.6), M('steelDark'), g, 0, 0, 0.42); // gouttière
  mesh(new THREE.BoxGeometry(0.24, 0.025, 0.035), wooden ? M('leatherDark') : M('steelDark'), g, 0, 0, 0.06);
  mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.14, 8).rotateX(Math.PI / 2), M('leatherDark'), g, 0, 0, -0.03);
  mesh(new THREE.SphereGeometry(0.032, 10, 8), wooden ? M('leatherDark') : M('steelDark'), g, 0, 0, -0.12);
  return g;
}

/**
 * Crée un personnage, pieds à y = 0, regard vers +Z.
 * outfit : 'gambeson' (écuyer), 'mail' (homme d'armes), 'lord' (seigneur), 'dress' (villageoise)
 */
export function createHumanoid(o = {}) {
  const opt = {
    outfit: 'gambeson', tunic: 0x3a5a8a, trousers: 0x4a4038, hair: 0x5a3a1e,
    beard: null, helmet: false, coif: false, hood: null, cloak: null, shield: false, scabbard: false,
    skin: null, arms: null,
    ...o,
  };
  const root = new THREE.Group();
  const SKIN = opt.skin ? M('skin:' + opt.skin) : M('skin');
  const mail = opt.outfit === 'mail';
  const body = mail ? M('mail') : opt.outfit === 'gambeson' ? M('gambeson') : M('cloth:' + opt.tunic);
  const legMat = mail ? M('mail') : M('cloth:' + opt.trousers);
  const boot = M('leatherDark');
  const glove = mail ? M('leather') : SKIN;

  // ---- Jambes ----
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.105, 0.95, 0);
    root.add(hip);
    capsule(0.083, 0.3, legMat, hip, -0.21);
    const knee = new THREE.Group();
    knee.position.y = -0.45;
    hip.add(knee);
    capsule(0.068, 0.3, legMat, knee, -0.2);
    // Bottes en cuir
    mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.24, 10), boot, knee, 0, -0.34, 0);
    const foot = mesh(new THREE.CapsuleGeometry(0.055, 0.14, 3, 8).rotateX(Math.PI / 2), boot, knee, 0, -0.45, 0.05);
    foot.scale.set(1.1, 0.8, 1);
    // Pan de jupe accroché à la cuisse (suit la jambe sans la traverser)
    if (opt.outfit !== 'dress' && opt.outfit !== 'lord') {
      const panel = mesh(skirtGeo(0.12, 0.155, 0.42, side > 0 ? -0.3 : Math.PI - 0.3, Math.PI + 0.6), body, hip, 0, -0.19, 0);
      panel.material = body;
      panel.material.side = THREE.DoubleSide;
    }
    legs.push({ hip, knee });
  }

  // Bassin + ceinture
  const pelvisMat = body;
  mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.2, 18, 1, false), pelvisMat, root, 0, 0.92, 0).scale.z = 0.8;
  if (opt.outfit === 'dress') {
    // Robe longue
    const dress = mesh(skirtGeo(0.18, 0.36, 0.92, 0, Math.PI * 2), body, root, 0, 0.5, 0);
    dress.scale.z = 0.85;
    body.side = THREE.DoubleSide;
  }
  if (opt.outfit === 'lord') {
    // Tunique longue de seigneur, fendue
    for (const [start, len] of [[0.25, Math.PI - 0.5], [Math.PI + 0.25, Math.PI - 0.5]]) {
      const t = mesh(skirtGeo(0.2, 0.29, 0.6, start + Math.PI / 2, len), body, root, 0, 0.6, 0);
      t.scale.z = 0.85;
    }
    body.side = THREE.DoubleSide;
  }

  // ---- Buste (pivote pour les coups) ----
  const spine = new THREE.Group();
  spine.position.y = 0.98;
  root.add(spine);
  mesh(torsoGeo(1), body, spine, 0, 0, 0);
  // Ceinture
  const belt = mesh(new THREE.TorusGeometry(0.178, 0.022, 6, 24).rotateX(Math.PI / 2), M('leather'), spine, 0, 0.02, 0);
  belt.scale.z = 0.8;
  mesh(new THREE.BoxGeometry(0.055, 0.05, 0.02), mail || opt.outfit === 'lord' ? M('gold') : M('steelDark'), spine, 0, 0.02, 0.15);

  if (mail) {
    // Camail : capuche de mailles qui descend sur les épaules
    const mantle = mesh(new THREE.CylinderGeometry(0.1, 0.25, 0.16, 18, 1, true), M('mail'), spine, 0, 0.5, 0);
    mantle.scale.z = 0.82;
    M('mail').side = THREE.DoubleSide;
  }
  if (opt.outfit === 'lord') {
    // Bordure brodée
    mesh(new THREE.TorusGeometry(0.105, 0.016, 6, 18).rotateX(Math.PI / 2), M('gold'), spine, 0, 0.535, 0).scale.z = 0.85;
  }

  // ---- Tête ----
  const neck = mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.12, 10), SKIN, spine, 0, 0.6, 0);
  neck.castShadow = false;
  const head = new THREE.Group();
  head.position.y = 0.72;
  spine.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.112, 18, 14), SKIN, head);
  skull.scale.set(0.9, 1.08, 1);
  mesh(new THREE.BoxGeometry(0.03, 0.05, 0.04), SKIN, head, 0, -0.005, 0.11).rotation.x = -0.25; // nez
  mesh(new THREE.SphereGeometry(0.014, 6, 6), M('eye'), head, -0.038, 0.02, 0.096);
  mesh(new THREE.SphereGeometry(0.014, 6, 6), M('eye'), head, 0.038, 0.02, 0.096);
  mesh(new THREE.BoxGeometry(0.05, 0.01, 0.02), M('hair:' + opt.hair), head, -0.04, 0.045, 0.1);
  mesh(new THREE.BoxGeometry(0.05, 0.01, 0.02), M('hair:' + opt.hair), head, 0.04, 0.045, 0.1);
  if (opt.beard) {
    const b = mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.4), M('hair:' + opt.beard), head, 0, 0.005, 0.012);
    b.scale.set(0.95, 1.15, 1.05);
  }
  if (opt.coif) {
    // Capuche de mailles laissant le visage découvert
    const coif = mesh(new THREE.SphereGeometry(0.128, 20, 14, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, 0, Math.PI * 0.78), M('mail'), head, 0, 0.0, -0.005);
    coif.scale.set(0.95, 1.1, 1.02);
  } else if (opt.hood) {
    // Capuche de tissu (brigands, voyageurs)
    const hm = M('cloth:' + opt.hood);
    hm.side = THREE.DoubleSide;
    const hood = mesh(new THREE.SphereGeometry(0.14, 18, 12, Math.PI / 2 + 0.8, Math.PI * 2 - 1.6, 0, Math.PI * 0.8), hm, head, 0, 0.01, -0.012);
    hood.scale.set(0.97, 1.12, 1.05);
    const cowl = mesh(new THREE.CylinderGeometry(0.11, 0.24, 0.16, 16, 1, true), hm, spine, 0, 0.52, 0);
    cowl.scale.z = 0.8;
  } else if (!opt.helmet && opt.outfit !== 'dress') {
    const hair = mesh(new THREE.SphereGeometry(0.122, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M('hair:' + opt.hair), head, 0, 0.012, -0.018);
    hair.scale.set(0.95, 1.08, 1.02);
    hair.rotation.x = -0.45; // dégage le front
  }
  if (opt.outfit === 'dress') {
    // Voile (guimpe)
    const veil = mesh(new THREE.SphereGeometry(0.13, 18, 12, Math.PI / 2 + 0.8, Math.PI * 2 - 1.6, 0, Math.PI * 0.85), M('cloth:0xe8e0cc'), head, 0, 0, -0.01);
    veil.scale.set(0.95, 1.1, 1.02);
    veil.material.side = THREE.DoubleSide;
  }
  if (opt.helmet) {
    // Casque normand conique à nasal
    const prof = [[0.135, -0.02], [0.136, 0.03], [0.13, 0.07], [0.11, 0.12], [0.075, 0.17], [0.035, 0.205], [0.0, 0.225]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const helm = mesh(new THREE.LatheGeometry(prof, 20), M('steel'), head, 0, 0.03, 0);
    helm.scale.set(0.92, 1, 1.02);
    const band = mesh(new THREE.TorusGeometry(0.133, 0.012, 6, 24).rotateX(Math.PI / 2), M('steelDark'), head, 0, 0.02, 0);
    band.scale.set(0.92, 1, 1.02);
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const strip = mesh(new THREE.BoxGeometry(0.018, 0.2, 0.012), M('steelDark'), head);
      strip.position.set(Math.sin(a) * 0.1, 0.12, Math.cos(a) * 0.1);
      strip.rotation.set(Math.cos(a) * -0.6, a, Math.sin(a) * 0.6);
    }
    mesh(new THREE.BoxGeometry(0.026, 0.11, 0.012), M('steel'), head, 0, -0.02, 0.138); // nasal
  }

  // ---- Bras ----
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.24, 0.47, 0);
    spine.add(shoulder);
    capsule(0.062, 0.2, body, shoulder, -0.14);
    const elbow = new THREE.Group();
    elbow.position.y = -0.29;
    shoulder.add(elbow);
    capsule(0.052, 0.19, mail ? M('mail') : body, elbow, -0.12);
    if (mail) mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.1, 10), M('leather'), elbow, 0, -0.2, 0); // gant à crispin
    const hand = new THREE.Group();
    hand.position.y = -0.27;
    elbow.add(hand);
    mesh(new THREE.CapsuleGeometry(0.042, 0.03, 3, 8), glove, hand, 0, 0, 0.01);
    arms.push({ shoulder, elbow, hand });
  }

  // ---- Manteau ----
  if (opt.cloak) {
    const cm = M('cloth:' + opt.cloak);
    cm.side = THREE.DoubleSide;
    const cloakGeo = new THREE.CylinderGeometry(0.24, 0.42, 1.12, 16, 6, true, Math.PI - 1.35, 2.7);
    const cloak = mesh(cloakGeo, cm, spine, 0, -0.04, -0.01);
    cloak.scale.z = 0.75;
    const collar = mesh(new THREE.TorusGeometry(0.15, 0.045, 8, 20).rotateX(Math.PI / 2), M('fur'), spine, 0, 0.52, -0.01);
    collar.scale.z = 0.8;
    const brooch = mesh(new THREE.SphereGeometry(0.025, 8, 6), M('gold'), spine, 0.12, 0.5, 0.1);
    brooch.castShadow = false;
  }

  // ---- Fourreau d'épée à la hanche gauche ----
  if (opt.scabbard) {
    const sc = new THREE.Group();
    sc.position.set(-0.2, 0.0, 0.05);
    sc.rotation.set(0.35, 0, 0.12);
    spine.add(sc);
    mesh(new THREE.BoxGeometry(0.06, 0.82, 0.03), M('leatherDark'), sc, 0, -0.4, 0);
    mesh(new THREE.BoxGeometry(0.065, 0.06, 0.035), M('steelDark'), sc, 0, -0.8, 0);
    const hilt = createSword(false);
    hilt.children.forEach((c, i) => { if (i < 3) c.visible = false; }); // seulement la poignée dépasse
    hilt.rotation.x = Math.PI / 2;
    hilt.position.y = 0.02;
    sc.add(hilt);
  }

  // ---- Écu ----
  let shield = null;
  if (opt.shield) {
    shield = createKiteShield(opt.arms);
    shield.position.set(-0.1, -0.08, 0.16);
    shield.rotation.set(0.05, -0.75, 0);
    arms[0].elbow.add(shield);
  }

  const [legL, legR] = legs, [armL, armR] = arms;
  return {
    root, spine, head, shield,
    legL: legL.hip, legR: legR.hip, kneeL: legL.knee, kneeR: legR.knee,
    armL: armL.shoulder, armR: armR.shoulder, elbowL: armL.elbow, elbowR: armR.elbow,
    handL: armL.hand, handR: armR.hand,
  };
}

/** Animation de marche. amount : 0 (immobile) à 1 (course). */
export function animateWalk(h, phase, amount, skipRightArm = false) {
  const s = Math.sin(phase);
  h.legL.rotation.x = s * 0.65 * amount;
  h.legR.rotation.x = -s * 0.65 * amount;
  // Le genou plie quand la jambe revient vers l'avant
  h.kneeL.rotation.x = Math.max(0, -Math.cos(phase)) * 1.1 * amount + 0.05;
  h.kneeR.rotation.x = Math.max(0, Math.cos(phase)) * 1.1 * amount + 0.05;
  h.armL.rotation.x = -s * 0.5 * amount;
  h.elbowL.rotation.x = -0.25 - amount * 0.35;
  if (!skipRightArm) {
    h.armR.rotation.x = s * 0.5 * amount;
    h.elbowR.rotation.x = -0.25 - amount * 0.35;
  }
  h.spine.rotation.y = s * 0.08 * amount;
  h.spine.position.y = 0.98 - Math.abs(Math.cos(phase)) * 0.03 * amount;
}

/** Hache de brigand (fer vers +Z comme l'épée). */
export function createAxe() {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.85, 8).rotateX(Math.PI / 2), M('wood'), g, 0, 0, 0.3);
  const head = mesh(new THREE.BoxGeometry(0.02, 0.2, 0.16), M('steelDark'), g, 0, 0.07, 0.66);
  head.rotation.x = 0.1;
  return g;
}

/** Gourdin. */
export function createClub() {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.06, 0.025, 0.8, 8).rotateX(-Math.PI / 2), M('wood'), g, 0, 0, 0.32);
  return g;
}
