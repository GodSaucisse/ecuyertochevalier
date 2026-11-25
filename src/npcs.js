// Personnages non-joueurs (PNJ).
import * as THREE from 'three';
import { createHumanoid } from './humanoid.js?v=202611252110';

function makeNPC(scene, world, { id, name, x, z, rotY, look, pose, talks = true }) {
  const h = createHumanoid(look);
  h.root.position.set(x, 0, z);
  h.root.rotation.y = rotY;
  scene.add(h.root);
  const circle = { x, z, r: 0.45, top: 99 };
  world.circles.push(circle);
  let baseRot = rotY;
  let t = Math.random() * 10;
  if (pose) pose(h);
  const base = {
    armL: h.armL.rotation.x, armR: h.armR.rotation.x, elbowL: h.elbowL.rotation.x, elbowR: h.elbowR.rotation.x,
  };
  return {
    id, name, h, talks,
    object: h.root,
    markerHeight: 2.35,
    circle,
    /** Déplace le personnage (et son obstacle) ailleurs dans le monde. */
    moveTo(nx, nz, rot) {
      h.root.position.set(nx, 0, nz);
      h.root.rotation.y = rot;
      baseRot = rot;
      circle.x = nx; circle.z = nz;
    },
    update(dt, playerPos) {
      t += dt;
      const { x, z } = h.root.position;
      // Respiration
      const b = Math.sin(t * 1.6);
      h.spine.position.y = 0.98 + b * 0.006;
      h.armL.rotation.x = base.armL + b * 0.025;
      h.armR.rotation.x = base.armR - b * 0.025;
      // Se tourne vers le joueur quand il est proche
      const dx = playerPos.x - x, dz = playerPos.z - z;
      const near = dx * dx + dz * dz < 30;
      const target = near ? Math.atan2(dx, dz) : baseRot;
      let diff = target - h.root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      h.root.rotation.y += diff * Math.min(1, dt * 3);
      // La tête suit un peu plus vite que le corps
      h.head.rotation.y = THREE.MathUtils.clamp(diff * 0.6, -0.7, 0.7);
    },
  };
}

/** Lance tenue verticalement dans la main droite. */
function giveSpear(h) {
  const spear = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, 2.3, 8),
    new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 0.8 }),
  );
  shaft.castShadow = true;
  spear.add(shaft);
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.035, 0.26, 4),
    new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 1, roughness: 0.3 }),
  );
  head.position.y = 1.28;
  head.castShadow = true;
  spear.add(head);
  h.armR.rotation.x = -0.35;
  h.elbowR.rotation.x = -1.15;
  // Compense l'angle du bras pour que la lance reste verticale
  spear.rotation.x = 1.5;
  spear.position.set(0, 0, 0.0);
  h.handR.add(spear);
}

export function createNPCs(scene, world) {
  const godefroy = makeNPC(scene, world, {
    id: 'godefroy', name: 'Sire Godefroy de Montclair', x: 0, z: -31, rotY: 0,
    look: { outfit: 'lord', tunic: 0x22386e, trousers: 0x3a3a40, hair: 0x9a948c, beard: 0x9a948c, cloak: 0x7a1a1a, scabbard: true },
    pose: (h) => { h.armL.rotation.x = 0.1; h.elbowL.rotation.x = -0.9; h.armL.rotation.z = -0.15; },
  });
  const bertrand = makeNPC(scene, world, {
    id: 'bertrand', name: "Bertrand, maître d'armes", x: 23, z: -3, rotY: -Math.PI / 2,
    look: { outfit: 'mail', trousers: 0x3a3028, helmet: true, coif: true, beard: 0x3a2a1a, shield: true, scabbard: true },
    pose: (h) => { h.elbowL.rotation.x = -0.5; },
  });
  const mathilde = makeNPC(scene, world, {
    id: 'mathilde', name: 'Mathilde, villageoise', x: 6, z: 27, rotY: -Math.PI / 2,
    look: { outfit: 'dress', tunic: 0x6e7f45, hair: 0x9a5a2a },
    pose: (h) => { h.elbowL.rotation.x = -0.6; h.elbowR.rotation.x = -0.6; },
  });
  const guards = [-3.3, 3.3].map((x, i) => makeNPC(scene, world, {
    id: 'garde', name: 'Garde du château', x, z: -19.1, rotY: 0,
    look: { outfit: 'mail', trousers: 0x3a3028, helmet: true, coif: true, beard: i ? 0x4a3020 : null, shield: true, scabbard: true },
    pose: (h) => { giveSpear(h); h.elbowL.rotation.x = -0.5; },
  }));
  return { godefroy, bertrand, mathilde, guards, list: [godefroy, bertrand, mathilde, ...guards] };
}
