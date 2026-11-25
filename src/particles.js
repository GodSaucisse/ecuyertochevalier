// Ambiance : poussière dorée dans la lumière et feuilles mortes qui tombent.
import * as THREE from 'three';

export function createParticles(scene, { dust = 300, leaves = 70 } = {}) {
  const AREA = 28;

  // Poussière en suspension
  const dustGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(dust * 3);
  for (let i = 0; i < dust; i++) {
    dPos[i * 3] = (Math.random() - 0.5) * AREA;
    dPos[i * 3 + 1] = Math.random() * 6;
    dPos[i * 3 + 2] = (Math.random() - 0.5) * AREA;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dustPts = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xffe0a8, size: 0.04, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  dustPts.frustumCulled = false;
  scene.add(dustPts);

  // Feuilles mortes
  const leafGeo = new THREE.PlaneGeometry(0.09, 0.07);
  const leafMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 });
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, leaves);
  leafMesh.frustumCulled = false;
  const colors = [0xb5651d, 0xc8902e, 0x8e3b1b, 0xd4a03a, 0x7a4a1e];
  const L = [];
  const col = new THREE.Color();
  for (let i = 0; i < leaves; i++) {
    L.push({
      x: (Math.random() - 0.5) * AREA, y: Math.random() * 8, z: (Math.random() - 0.5) * AREA,
      speed: 0.4 + Math.random() * 0.5, phase: Math.random() * 10, spin: 1 + Math.random() * 3,
    });
    leafMesh.setColorAt(i, col.set(colors[i % colors.length]));
  }
  scene.add(leafMesh);
  const dummy = new THREE.Object3D();
  let t = 0;

  return {
    update(dt, center) {
      t += dt;
      // La poussière flotte et suit la caméra (en se répétant dans l'espace)
      for (let i = 0; i < dust; i++) {
        dPos[i * 3] += Math.sin(t * 0.3 + i) * 0.002 + 0.003;
        dPos[i * 3 + 1] += Math.sin(t * 0.5 + i * 1.7) * 0.002;
      }
      dustGeo.attributes.position.needsUpdate = true;
      dustPts.position.set(Math.floor(center.x / AREA) * AREA, 0, Math.floor(center.z / AREA) * AREA);
      // Les positions sont ramenées dans une boîte autour du joueur
      const ox = center.x - dustPts.position.x, oz = center.z - dustPts.position.z;
      for (let i = 0; i < dust; i++) {
        let x = dPos[i * 3], z = dPos[i * 3 + 2];
        if (x - ox > AREA / 2) x -= AREA; else if (x - ox < -AREA / 2) x += AREA;
        if (z - oz > AREA / 2) z -= AREA; else if (z - oz < -AREA / 2) z += AREA;
        dPos[i * 3] = x; dPos[i * 3 + 2] = z;
      }

      L.forEach((l, i) => {
        l.y -= l.speed * dt;
        l.x += (Math.sin(t * 1.3 + l.phase) * 0.6 + 0.4) * dt;
        l.z += Math.cos(t * 0.9 + l.phase) * 0.3 * dt;
        if (l.y < 0.02 || Math.abs(l.x - center.x) > AREA / 2 || Math.abs(l.z - center.z) > AREA / 2) {
          l.x = center.x + (Math.random() - 0.5) * AREA;
          l.z = center.z + (Math.random() - 0.5) * AREA;
          l.y = 5 + Math.random() * 4;
        }
        dummy.position.set(l.x, l.y, l.z);
        dummy.rotation.set(t * l.spin + l.phase, t * l.spin * 0.7, Math.sin(t * 2 + l.phase));
        dummy.updateMatrix();
        leafMesh.setMatrixAt(i, dummy.matrix);
      });
      leafMesh.instanceMatrix.needsUpdate = true;
    },
  };
}
