// Post-traitement "cinéma" : occlusion ambiante, halo lumineux, étalonnage des couleurs,
// vignettage et grain de pellicule.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec2 resolution;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // Contraste en courbe douce
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.3);
      // Couleurs un peu désaturées, façon film
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 0.85);
      // Ombres froides, lumières chaudes
      c += mix(vec3(-0.012, 0.0, 0.022), vec3(0.025, 0.01, -0.02), smoothstep(0.15, 0.85, l));
      // Vignettage
      vec2 q = (vUv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
      c *= 1.0 - smoothstep(0.45, 1.25, length(q)) * 0.55;
      // Grain
      float n = fract(sin(dot(vUv * resolution + fract(time) * 97.0, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) * 0.022;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export function createPostFX(renderer, scene, camera, { high }) {
  const w = window.innerWidth, h = window.innerHeight;
  const target = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: high ? 4 : 0 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  let gtao = null;
  if (high) {
    gtao = new GTAOPass(scene, camera, w, h);
    gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1.2, samples: 12 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    gtao.blendIntensity = 0.9;
    composer.addPass(gtao);
  }

  const bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.32, 0.55, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  grade.uniforms.resolution.value.set(w, h);
  composer.addPass(grade);

  return {
    composer,
    setSize(width, height) {
      composer.setSize(width, height);
      if (gtao) gtao.setSize(width, height);
      grade.uniforms.resolution.value.set(width, height);
    },
    render(time) {
      grade.uniforms.time.value = time;
      composer.render();
    },
  };
}
