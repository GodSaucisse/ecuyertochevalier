// Ciel de fin d'après-midi d'automne, avec halo et disque solaire.
import * as THREE from 'three';

export const SKY = {
  zenith: new THREE.Color(0x5f7fa6),
  horizon: new THREE.Color(0xe2c49a),
  ground: new THREE.Color(0x7a6a52),
  sun: new THREE.Color(0xffd29a),
  fog: new THREE.Color(0xd2b48c),
};

export function createSky(sunDir) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      sunDir: { value: sunDir.clone().normalize() },
      zenith: { value: SKY.zenith },
      horizon: { value: SKY.horizon },
      ground: { value: SKY.ground },
      sunColor: { value: SKY.sun },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // toujours au fond
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 sunDir, zenith, horizon, ground, sunColor;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.45));
        col = mix(col, ground, smoothstep(0.0, -0.2, h));
        float s = max(dot(d, sunDir), 0.0);
        // Halo autour du soleil, plus large près de l'horizon
        col += sunColor * (pow(s, 6.0) * 0.45 + pow(s, 60.0) * 0.8);
        col += sunColor * smoothstep(0.9994, 0.9997, s) * 12.0;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

/** Carte d'environnement (reflets sur les métaux, lumière ambiante) calculée à partir du ciel. */
export function createEnvironment(renderer, sunDir) {
  const envScene = new THREE.Scene();
  envScene.add(createSky(sunDir));
  // Un "sol" sombre pour que le bas des objets reflète la terre et non le ciel
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(300, 16).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x4a4030 }),
  );
  floor.position.y = -5;
  envScene.add(floor);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose();
  return env;
}
