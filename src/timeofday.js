// Le temps qui passe : course du soleil et de la lune, couleurs du ciel, étoiles,
// torches et fenêtres éclairées la nuit, et météo (clair, nuageux, brume, pluie).
import * as THREE from 'three';
import { Tex } from './textures.js?v=202611261414';

const C = (hex) => new THREE.Color(hex);
// Ambiances de référence, selon la hauteur du soleil
const PALETTES = {
  night: {
    zenith: C(0x050912), horizon: C(0x111a2c), ground: C(0x05070a), fog: C(0x0c121e),
    sun: C(0x000000), light: C(0x9ab0e0), lightI: 0.85, hemiSky: C(0x3e4c70), hemiGround: C(0x10131a), hemiI: 0.7,
    env: 0.2, exposure: 1.6, cloud: C(0x2a3244), shade: C(0x0a0e16),
  },
  dusk: {
    zenith: C(0x1e2a4a), horizon: C(0xc86a48), ground: C(0x2a2420), fog: C(0x5a4448),
    sun: C(0xff8a50), light: C(0xff9a60), lightI: 0.9, hemiSky: C(0x6a6a8a), hemiGround: C(0x2a2420), hemiI: 0.4,
    env: 0.4, exposure: 1.15, cloud: C(0xd88a6a), shade: C(0x4a3a4a),
  },
  golden: {
    zenith: C(0x5f7fa6), horizon: C(0xe2c49a), ground: C(0x7a6a52), fog: C(0xd2b48c),
    sun: C(0xffd29a), light: C(0xffd6a0), lightI: 3.4, hemiSky: C(0xa8bcd6), hemiGround: C(0x4a3f2e), hemiI: 0.5,
    env: 1.0, exposure: 1.05, cloud: C(0xf0e6d8), shade: C(0x8a8070),
  },
  day: {
    zenith: C(0x4a7cc0), horizon: C(0xbcd2e6), ground: C(0x7a7a62), fog: C(0xc4d0da),
    sun: C(0xfff4e0), light: C(0xfff2e0), lightI: 3.6, hemiSky: C(0xb8cce6), hemiGround: C(0x4a4a38), hemiI: 0.6,
    env: 1.0, exposure: 1.0, cloud: C(0xffffff), shade: C(0x9aa0a8),
  },
};

const WEATHERS = {
  clair: { cover: 0.12, rain: 0, fog: 0, icon: '☀️', name: 'Temps clair' },
  nuageux: { cover: 0.65, rain: 0, fog: 0, icon: '⛅', name: 'Nuageux' },
  brume: { cover: 0.4, rain: 0, fog: 1, icon: '🌫️', name: 'Brume' },
  pluie: { cover: 0.9, rain: 1, fog: 0.05, icon: '🌧️', name: 'Pluie' },
};

const TORCHES = [[-2.3, -19.6], [2.3, -19.6], [5.5, -30], [-5.5, -38], [-2.2, 22], [2.2, 38]];

function mixPalette(a, b, t, out) {
  for (const k of Object.keys(a)) {
    if (a[k] instanceof THREE.Color) out[k] = (out[k] || new THREE.Color()).copy(a[k]).lerp(b[k], t);
    else out[k] = a[k] + (b[k] - a[k]) * t;
  }
  return out;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class TimeOfDay {
  constructor({ scene, world, renderer, maxLights = 6 }) {
    this.scene = scene;
    this.world = world;
    this.renderer = renderer;
    this.hour = 15;
    this.speed = 1 / 120;          // une heure de jeu = deux minutes
    this.frozen = false;
    this.kind = 'clair';
    this.locked = false;
    this.w = { ...WEATHERS.clair };  // valeurs actuelles (lissées)
    this.nextChange = this.hour + 3;
    this.pal = {};
    this.night = 0;
    this.time = 0;
    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();

    // Étoiles
    const N = 1400, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
      const y = Math.abs(u) * 0.95 + 0.05, r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * r * 380, y * 380, Math.sin(a) * r * 380], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({
      color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false,
    }));
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -0.5;
    scene.add(this.stars);

    // Fenêtres éclairées la nuit
    world.windowMat.emissive = new THREE.Color(0xffa050);
    world.windowMat.emissiveIntensity = 0;

    // Torches (toujours présentes : leur lumière s'allume la nuit)
    const woodT = Tex.wood();
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3b22, map: woodT.map });
    this.flameMat = new THREE.MeshStandardMaterial({ color: 0x331000, emissive: 0xff7a20, emissiveIntensity: 0, roughness: 1 });
    this.torches = TORCHES.map(([x, z], i) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6), wood);
      pole.position.set(x, 1.2, z);
      pole.castShadow = true;
      scene.add(pole);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.08, 0.18, 8), new THREE.MeshStandardMaterial({ color: 0x2a2826, metalness: 0.7, roughness: 0.5 }));
      cup.position.set(x, 2.45, z);
      scene.add(cup);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 8), this.flameMat);
      flame.position.set(x, 2.7, z);
      scene.add(flame);
      // Sur les appareils modestes, seule une partie des torches éclaire vraiment
      let light = null;
      if (i < maxLights) {
        light = new THREE.PointLight(0xff9a40, 0, 16, 2);
        light.position.set(x, 2.9, z);
        scene.add(light);
      }
      world.circles.push({ x, z, r: 0.15, top: 99 });
      return { flame, light, seed: Math.random() * 10 };
    });

    // Pluie : de fins traits qui tombent autour de la caméra
    const R = 1600;
    this.rainPos = new Float32Array(R * 6);
    this.rainBox = { w: 34, h: 18 };
    for (let i = 0; i < R; i++) this.resetDrop(i, true);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: 0, depthWrite: false }));
    this.rain.frustumCulled = false;
    scene.add(this.rain);
  }

  resetDrop(i, randomY = false) {
    const { w, h } = this.rainBox;
    const x = (Math.random() - 0.5) * w, z = (Math.random() - 0.5) * w;
    const y = randomY ? Math.random() * h : h;
    this.rainPos.set([x, y, z, x - 0.05, y - 0.55, z - 0.02], i * 6);
  }

  get weather() { return WEATHERS[this.kind]; }
  get isNight() { return this.night > 0.5; }
  get rainAmount() { return this.w.rain; }

  setTime(h) { this.hour = ((h % 24) + 24) % 24; }

  /** Change la météo. immediate : sans transition. */
  setWeather(kind, immediate = false) {
    this.kind = kind;
    if (immediate) Object.assign(this.w, WEATHERS[kind]);
    this.nextChange = this.hour + 2 + Math.random() * 3;
  }

  /** L'histoire impose une météo (null pour la libérer). */
  lockWeather(kind) {
    this.locked = !!kind;
    if (kind) this.setWeather(kind, true);
  }

  label() {
    const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
    const icon = this.isNight && this.kind === 'clair' ? '🌙' : this.weather.icon;
    return `${icon} ${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
  }

  update(dt, camPos) {
    this.time += dt;
    if (!this.frozen) {
      const before = this.hour;
      this.hour = (this.hour + dt * this.speed) % 24;
      // Météo qui change d'elle-même
      const passed = this.hour < before ? this.hour + 24 : this.hour;
      if (!this.locked && passed >= this.nextChange) {
        const r = Math.random();
        this.setWeather(r < 0.45 ? 'clair' : r < 0.72 ? 'nuageux' : r < 0.85 ? 'brume' : 'pluie');
        if (this.nextChange >= 24) this.nextChange -= 24;
      }
    }
    // Les valeurs de météo glissent doucement vers la cible
    const target = WEATHERS[this.kind];
    const k = Math.min(1, dt * 0.08);
    for (const key of ['cover', 'rain', 'fog']) this.w[key] += (target[key] - this.w[key]) * k;

    // Position du soleil : lever à 6 h à l'est, coucher à 18 h à l'ouest, 40° à midi
    const th = ((this.hour - 6) / 12) * Math.PI;
    const elev = Math.asin(Math.sin(th) * Math.sin(THREE.MathUtils.degToRad(40)));
    const ce = Math.cos(elev);
    this.sunDir.set(Math.cos(th) * ce, Math.sin(elev), Math.sin(th) * ce * 0.6 + 0.25).normalize();
    this.moonDir.copy(this.sunDir).multiplyScalar(-1);
    this.moonDir.y = Math.abs(this.moonDir.y) * 0.8 + 0.25;
    this.moonDir.normalize();
    const e = THREE.MathUtils.radToDeg(elev);

    // Mélange des ambiances
    const P = PALETTES, pal = this.pal;
    if (e < -8) mixPalette(P.night, P.night, 0, pal);
    else if (e < -1) mixPalette(P.night, P.dusk, smooth(-8, -1, e), pal);
    else if (e < 6) mixPalette(P.dusk, P.golden, smooth(-1, 6, e), pal);
    else if (e < 16) mixPalette(P.golden, P.golden, 0, pal);
    else mixPalette(P.golden, P.day, smooth(16, 32, e), pal);
    this.night = 1 - smooth(-9, -1, e);

    // Les nuages ternissent tout
    const cover = this.w.cover, fogW = this.w.fog, rain = this.w.rain;
    const grey = (c, amount) => { const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11; c.lerp(new THREE.Color(l, l, l * 1.03), amount); };
    for (const key of ['zenith', 'horizon', 'fog', 'light', 'hemiSky']) grey(pal[key], cover * 0.55);
    if (fogW > 0.01) pal.fog.lerp(pal.horizon, 0.4);
    if (rain > 0.01) pal.fog.lerp(new THREE.Color(0x6a7078), rain * 0.5);

    // Application : lumière du soleil, ou de la lune la nuit
    const W = this.world;
    const sunUp = e > -2;
    const dir = sunUp ? this.sunDir : this.moonDir;
    W.sunOffset.copy(dir).multiplyScalar(85);
    const fade = sunUp ? smooth(-2, 3, e) : smooth(-2, -7, e);
    W.sun.color.copy(pal.light);
    W.sun.intensity = pal.lightI * fade * (1 - cover * 0.62);
    W.hemi.color.copy(pal.hemiSky);
    W.hemi.groundColor.copy(pal.hemiGround);
    W.hemi.intensity = pal.hemiI * (1 + cover * 0.4);
    this.scene.environmentIntensity = pal.env * (1 - cover * 0.35);
    this.renderer.toneMappingExposure = pal.exposure;
    this.scene.fog.color.copy(pal.fog);
    this.scene.fog.density = 0.0095 + this.night * 0.003 + cover * 0.002 + fogW * (0.024 - this.night * 0.008) + rain * 0.005;

    const u = W.sky.material.uniforms;
    u.sunDir.value.copy(this.sunDir);
    u.zenith.value.copy(pal.zenith);
    u.horizon.value.copy(pal.horizon);
    u.ground.value.copy(pal.ground);
    u.sunColor.value.copy(pal.sun);
    u.sunVisible.value = smooth(-3, 1, e);
    u.moonDir.value.copy(this.moonDir);
    u.moonGlow.value = this.night;
    u.cloudCover.value = cover;
    u.cloudColor.value.copy(pal.cloud);
    u.cloudShade.value.copy(pal.shade);
    u.time.value = this.time;

    // Étoiles, fenêtres, torches
    this.stars.position.copy(camPos);
    this.stars.material.opacity = this.night * (1 - cover * 0.9) * (1 - fogW * 0.7);
    W.windowMat.emissiveIntensity = this.night * 1.6;
    const torchOn = smooth(0.15, 0.6, this.night + cover * 0.15);
    this.flameMat.emissiveIntensity = 0.4 + torchOn * 3.5;
    for (const t of this.torches) {
      const flick = 0.85 + Math.sin(this.time * 13 + t.seed) * 0.08 + Math.sin(this.time * 29 + t.seed * 3) * 0.07;
      if (t.light) t.light.intensity = torchOn * 7 * flick;
      t.flame.scale.set(1, flick, 1);
    }

    // À l'intérieur : pas de pluie, pas d'étoiles, une brume légère
    if (this.indoor) {
      this.scene.fog.density = 0.006;
      this.scene.fog.color.setHex(0x1a1410);
      this.stars.material.opacity = 0;
      this.rain.visible = false;
      return;
    }
    // Pluie
    this.rain.material.opacity = rain * 0.6;
    this.rain.visible = rain > 0.03;
    if (this.rain.visible) {
      const a = this.rainPos, fall = 17 * dt;
      for (let i = 0; i < a.length / 6; i++) {
        const o = i * 6;
        a[o + 1] -= fall; a[o + 4] -= fall;
        a[o] -= fall * 0.05; a[o + 3] -= fall * 0.05;
        if (a[o + 4] < 0) this.resetDrop(i);
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.position.set(camPos.x, Math.max(0, camPos.y - 6), camPos.z);
    }
  }
}
