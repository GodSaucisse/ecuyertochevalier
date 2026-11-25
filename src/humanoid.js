// Personnage "low-poly" construit à partir de formes simples.
// Utilisé pour le joueur et pour les personnages non-joueurs (PNJ).
import * as THREE from 'three';

function mat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
}

function addMesh(parent, geo, material, x, y, z) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/**
 * Crée un personnage. Il regarde vers +Z et a les pieds à y = 0.
 * Options : couleurs (tunic, legs, boots, skin, hair, belt), cape, helmet, beard.
 */
export function createHumanoid(options = {}) {
  const c = {
    tunic: 0x3a6ea5, legs: 0x5b4330, boots: 0x3b2a1c, skin: 0xe2b48f,
    hair: 0x5a3a1e, belt: 0x4a3020, cape: null, helmet: false, beard: null,
    ...options,
  };
  const root = new THREE.Group();
  const mTunic = mat(c.tunic), mSkin = mat(c.skin), mLegs = mat(c.legs);
  const mBoots = mat(c.boots), mHair = mat(c.hair), mBelt = mat(c.belt);

  // Jambes (pivot à la hanche)
  const legL = new THREE.Group(); legL.position.set(-0.12, 0.8, 0); root.add(legL);
  const legR = new THREE.Group(); legR.position.set(0.12, 0.8, 0); root.add(legR);
  for (const leg of [legL, legR]) {
    addMesh(leg, new THREE.BoxGeometry(0.17, 0.7, 0.19), mLegs, 0, -0.38, 0);
    addMesh(leg, new THREE.BoxGeometry(0.19, 0.12, 0.28), mBoots, 0, -0.74, 0.04);
  }

  // Corps
  addMesh(root, new THREE.BoxGeometry(0.5, 0.62, 0.3), mTunic, 0, 1.2, 0);
  addMesh(root, new THREE.CylinderGeometry(0.27, 0.34, 0.34, 10), mTunic, 0, 0.8, 0);
  addMesh(root, new THREE.BoxGeometry(0.52, 0.07, 0.32), mBelt, 0, 0.93, 0);
  addMesh(root, new THREE.CylinderGeometry(0.07, 0.08, 0.12, 8), mSkin, 0, 1.56, 0);

  // Tête
  addMesh(root, new THREE.SphereGeometry(0.17, 14, 10), mSkin, 0, 1.72, 0);
  const eyeMat = mat(0x1a1410);
  addMesh(root, new THREE.BoxGeometry(0.04, 0.035, 0.02), eyeMat, -0.06, 1.74, 0.163);
  addMesh(root, new THREE.BoxGeometry(0.04, 0.035, 0.02), eyeMat, 0.06, 1.74, 0.163);
  if (c.helmet) {
    // Casque à nasal, typique du XIIe siècle
    const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.4, metalness: 0.7 });
    addMesh(root, new THREE.ConeGeometry(0.2, 0.3, 14), steel, 0, 1.9, 0);
    addMesh(root, new THREE.CylinderGeometry(0.19, 0.19, 0.08, 14), steel, 0, 1.78, 0);
    addMesh(root, new THREE.BoxGeometry(0.035, 0.16, 0.03), steel, 0, 1.7, 0.18);
  } else {
    const hair = new THREE.SphereGeometry(0.185, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    addMesh(root, hair, mHair, 0, 1.73, -0.01);
  }
  if (c.beard) {
    addMesh(root, new THREE.BoxGeometry(0.22, 0.14, 0.1), mat(c.beard), 0, 1.6, 0.11);
  }
  if (c.cape) {
    const cape = addMesh(root, new THREE.BoxGeometry(0.5, 1.0, 0.04), mat(c.cape), 0, 1.0, -0.19);
    cape.rotation.x = 0.08;
  }

  // Bras (pivot à l'épaule)
  const armL = new THREE.Group(); armL.position.set(-0.32, 1.47, 0); root.add(armL);
  const armR = new THREE.Group(); armR.position.set(0.32, 1.47, 0); root.add(armR);
  for (const arm of [armL, armR]) {
    addMesh(arm, new THREE.BoxGeometry(0.14, 0.58, 0.15), mTunic, 0, -0.28, 0);
    addMesh(arm, new THREE.SphereGeometry(0.075, 8, 6), mSkin, 0, -0.62, 0);
  }
  const handR = new THREE.Group(); handR.position.set(0, -0.62, 0); armR.add(handR);
  const handL = new THREE.Group(); handL.position.set(0, -0.62, 0); armL.add(handL);

  return { root, legL, legR, armL, armR, handR, handL };
}

/** Anime la marche. amount = 0 (immobile) à 1 (pleine vitesse). */
export function animateWalk(h, phase, amount, skipRightArm = false) {
  const s = Math.sin(phase);
  h.legL.rotation.x = s * 0.75 * amount;
  h.legR.rotation.x = -s * 0.75 * amount;
  h.armL.rotation.x = -s * 0.55 * amount;
  if (!skipRightArm) h.armR.rotation.x = s * 0.55 * amount;
}
