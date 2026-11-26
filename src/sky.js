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
      moonDir: { value: new THREE.Vector3(0, -1, 0) },
      moonGlow: { value: 0 },
      cloudCover: { value: 0.15 },
      cloudColor: { value: new THREE.Color(0xf0e6d8) },
      cloudShade: { value: new THREE.Color(0x8a8070) },
      sunVisible: { value: 1 },
      time: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // toujours au fond
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 sunDir, zenith, horizon, ground, sunColor, moonDir, cloudColor, cloudShade;
      uniform float moonGlow, cloudCover, sunVisible, time;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.45));
        col = mix(col, ground, smoothstep(0.0, -0.2, h));
        float s = max(dot(d, sunDir), 0.0);
        // Halo autour du soleil, plus large près de l'horizon (atténué par les nuages)
        float clear = 1.0 - cloudCover * 0.85;
        col += sunColor * (pow(s, 6.0) * 0.45 + pow(s, 60.0) * 0.8) * clear * sunVisible;
        col += sunColor * smoothstep(0.9994, 0.9997, s) * 12.0 * clear * sunVisible;
        // Lune
        float m = max(dot(d, moonDir), 0.0);
        col += vec3(0.75, 0.82, 1.0) * (smoothstep(0.9993, 0.9996, m) * 2.5 + pow(m, 40.0) * 0.12) * moonGlow * clear;
        // Nuages : bruit projeté sur un plafond, qui dérive avec le vent
        if (h > 0.0) {
          vec2 uv = d.xz / (h + 0.12) * 1.6 + vec2(time * 0.012, time * 0.005);
          float n = fbm(uv);
          float mask = smoothstep(1.0 - cloudCover * 0.95 - 0.05, 1.05 - cloudCover * 0.6, n);
          float lit = clamp(0.55 + (n - 0.5) * 1.5, 0.0, 1.0);
          vec3 cc = mix(cloudShade, cloudColor, lit);
          col = mix(col, cc, mask * smoothstep(0.0, 0.12, h) * 0.95);
        }
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
