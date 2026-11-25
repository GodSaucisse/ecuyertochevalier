// Personnages non-joueurs (PNJ).
import * as THREE from 'three';
import { createHumanoid } from './humanoid.js';

function makeNPC(scene, world, { id, name, x, z, rotY, look }) {
  const h = createHumanoid(look);
  h.root.position.set(x, 0, z);
  h.root.rotation.y = rotY;
  scene.add(h.root);
  world.circles.push({ x, z, r: 0.45, top: 99 });
  const baseRot = rotY;
  let t = Math.random() * 10;
  return {
    id, name, h,
    object: h.root,
    markerHeight: 2.5,
    update(dt, playerPos) {
      t += dt;
      // Légère respiration
      h.armL.rotation.x = Math.sin(t * 1.5) * 0.04;
      h.armR.rotation.x = -Math.sin(t * 1.5) * 0.04;
      // Se tourne vers le joueur quand il est proche
      const dx = playerPos.x - x, dz = playerPos.z - z;
      const near = dx * dx + dz * dz < 36;
      const target = near ? Math.atan2(dx, dz) : baseRot;
      let diff = target - h.root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      h.root.rotation.y += diff * Math.min(1, dt * 4);
    },
  };
}

export function createNPCs(scene, world) {
  const godefroy = makeNPC(scene, world, {
    id: 'godefroy', name: 'Sire Godefroy de Montclair', x: 0, z: -31, rotY: 0,
    look: { tunic: 0x2b4a9a, legs: 0x6e6e72, boots: 0x2a1d14, hair: 0x8f8a84, beard: 0x8f8a84, cape: 0x7a1f1f, belt: 0xc9a24a },
  });
  const bertrand = makeNPC(scene, world, {
    id: 'bertrand', name: "Bertrand, maître d'armes", x: 23, z: -3, rotY: -Math.PI / 2,
    look: { tunic: 0x6e7378, legs: 0x4a3a2a, boots: 0x2a1d14, helmet: true, beard: 0x3a2a1a, belt: 0x2a1d14 },
  });
  const mathilde = makeNPC(scene, world, {
    id: 'mathilde', name: 'Mathilde, villageoise', x: 6, z: 27, rotY: -Math.PI / 2,
    look: { tunic: 0x7a8f4a, legs: 0x7a8f4a, boots: 0x3b2a1c, hair: 0x9a5a2a, belt: 0x5a3b22 },
  });
  // Bertrand tient un bouclier
  {
    const shield = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.05, 16),
      new THREE.MeshStandardMaterial({ color: 0x2b4a9a, roughness: 0.8 }),
    );
    shield.position.set(-0.12, 0.1, 0.05);
    shield.rotation.z = Math.PI / 2;
    shield.castShadow = true;
    bertrand.h.handL.add(shield);
  }
  return { godefroy, bertrand, mathilde, list: [godefroy, bertrand, mathilde] };
}
