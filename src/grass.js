// Herbe : des dizaines de milliers de brins qui ondulent au vent.
import * as THREE from 'three';

function bladeGeometry() {
  const w = 0.045, h = 1; // hauteur normalisée, mise à l'échelle par brin
  const pos = [
    -w, 0, 0, w, 0, 0,
    -w * 0.75, h * 0.4, 0, w * 0.75, h * 0.4, 0,
    -w * 0.4, h * 0.75, 0, w * 0.4, h * 0.75, 0,
    0, h, 0,
  ];
  const col = [];
  for (let i = 0; i < pos.length; i += 3) {
    const t = pos[i + 1];
    const v = 0.35 + t * 0.65; // pied sombre, pointe claire
    col.push(v, v, v);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(7).fill([0, 1, 0]).flat(), 3));
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
  return g;
}

/**
 * isBare(x, z) : renvoie true là où il ne doit pas y avoir d'herbe (chemins, bâtiments…).
 */
export function createGrass(scene, isBare, { count = 60000, radius = 70, seed = 7 } = {}) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 });
  const uniforms = { time: { value: 0 } };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.time = uniforms.time;
    shader.vertexShader = 'uniform float time;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
       float sway = sin(time * 1.6 + wp.x * 0.35 + wp.z * 0.25) * 0.6 + sin(time * 3.3 + wp.x * 1.7 + wp.z) * 0.2;
       float k = position.y * position.y;
       transformed.x += sway * k * 0.25;
       transformed.z += sway * k * 0.12;`,
    );
    // Les deux faces du brin sont éclairées de la même façon
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'),
    );
  };

  const mesh = new THREE.InstancedMesh(bladeGeometry(), material, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = [new THREE.Color(0x6d8a3a), new THREE.Color(0x8a923e), new THREE.Color(0xa59a52), new THREE.Color(0x5d7a34)];
  let n = 0, tries = 0;
  while (n < count && tries < count * 4) {
    tries++;
    // Touffes de brins
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * radius;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    if (isBare(cx, cz)) continue;
    const tuft = 4 + Math.floor(rnd() * 6);
    const base = palette[Math.floor(rnd() * palette.length)];
    for (let i = 0; i < tuft && n < count; i++) {
      const x = cx + (rnd() - 0.5) * 0.5, z = cz + (rnd() - 0.5) * 0.5;
      dummy.position.set(x, 0, z);
      dummy.rotation.set((rnd() - 0.5) * 0.4, rnd() * Math.PI, (rnd() - 0.5) * 0.4);
      const h = 0.2 + rnd() * 0.32;
      dummy.scale.set(0.8 + rnd() * 0.6, h, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      color.copy(base).offsetHSL((rnd() - 0.5) * 0.03, 0, (rnd() - 0.5) * 0.08);
      mesh.setColorAt(n, color);
      n++;
    }
  }
  mesh.count = n;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { update(t) { uniforms.time.value = t; } };
}
