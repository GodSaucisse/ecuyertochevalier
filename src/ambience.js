// Ambiance sonore : vent, oiseaux, cloche de l'église.
import { audio, atDistance, playBell } from './audio.js?v=202611261852';

const CHURCH_BELL = { x: -20, z: -1.8 };

export class Ambience {
  constructor() {
    this.started = false;
    this.birdIn = 2;
    this.bellIn = 25;
    this.quiet = false; // pendant les combats, les oiseaux se taisent
  }

  start() {
    const ctx = audio.ctx;
    if (!ctx || this.started) return;
    this.started = true;
    // Vent : bruit filtré en boucle, qui souffle par vagues
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const d = buf.getChannelData(0);
    // Bruit blanc : la boucle se raccorde sans « tic » (le filtre en fait un souffle doux)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.35;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    lp.Q.value = 0.3;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.05;
    src.connect(lp).connect(this.windGain).connect(audio.ambience);
    src.start();
    this.windFilter = lp;
    // Pluie : bruit blanc plus aigu, dont le volume suit la météo
    const rsrc = ctx.createBufferSource();
    rsrc.buffer = buf;
    rsrc.loop = true;
    rsrc.playbackRate.value = 1.3;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.4;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rsrc.connect(bp).connect(this.rainGain).connect(audio.ambience);
    rsrc.start();
    this.cricketIn = 1;
    this.owlIn = 30;
  }

  /** Grillon : petites salves très aiguës. */
  cricket() {
    const ctx = audio.ctx;
    const t0 = ctx.currentTime;
    const f = 4200 + Math.random() * 600;
    const g = ctx.createGain();
    g.gain.value = 0.012;
    g.connect(audio.ambience);
    for (let i = 0; i < 3; i++) {
      const t = t0 + i * 0.07;
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(1, t + 0.01);
      e.gain.linearRampToValueAtTime(0, t + 0.045);
      o.connect(e).connect(g);
      o.start(t);
      o.stop(t + 0.05);
    }
  }

  /** Chouette : « hou… hou-hou ». */
  owl() {
    const ctx = audio.ctx;
    const t0 = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    g.connect(audio.ambience);
    [[0, 0.45], [0.75, 0.2], [1.0, 0.5]].forEach(([at, len]) => {
      const t = t0 + at;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(390, t);
      o.frequency.linearRampToValueAtTime(350, t + len);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(1, t + 0.06);
      e.gain.linearRampToValueAtTime(0, t + len);
      o.connect(e).connect(g);
      o.start(t);
      o.stop(t + len + 0.05);
    });
  }

  /** Un oiseau chante (petites glissades aiguës). */
  bird() {
    const ctx = audio.ctx;
    const t0 = ctx.currentTime;
    const base = 2200 + Math.random() * 1800;
    const notes = 2 + Math.floor(Math.random() * 5);
    const g = ctx.createGain();
    g.gain.value = 0.025 + Math.random() * 0.02;
    g.connect(audio.ambience);
    for (let i = 0; i < notes; i++) {
      const t = t0 + i * (0.09 + Math.random() * 0.06);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.3), t);
      o.frequency.exponentialRampToValueAtTime(base * (1.1 + Math.random() * 0.4), t + 0.06);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(1, t + 0.01);
      e.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(e).connect(g);
      o.start(t);
      o.stop(t + 0.1);
    }
  }

  update(dt, listener, { night = 0, rain = 0, indoor = false } = {}) {
    if (!this.started) return;
    // Dedans, les bruits du dehors sont étouffés
    audio.ambience.gain.setTargetAtTime(indoor ? 0.2 : 1, audio.ctx.currentTime, 0.3);
    this.rainGain.gain.setTargetAtTime(rain * 0.12, audio.ctx.currentTime, 1);
    // La nuit : grillons et chouette ; le jour : oiseaux
    if (night > 0.5 && rain < 0.3 && !this.quiet) {
      this.cricketIn -= dt;
      if (this.cricketIn < 0) { this.cricketIn = 0.3 + Math.random() * 1.2; this.cricket(); }
      this.owlIn -= dt;
      if (this.owlIn < 0) { this.owlIn = 25 + Math.random() * 40; this.owl(); }
    }
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    // Le vent monte et descend doucement
    const gust = 0.04 + Math.max(0, Math.sin(t * 0.13) * Math.sin(t * 0.07)) * 0.06;
    this.windGain.gain.setTargetAtTime(gust, t, 1);
    this.windFilter.frequency.setTargetAtTime(380 + gust * 3000, t, 1);

    this.birdIn -= dt;
    if (this.birdIn < 0) {
      this.birdIn = 1.5 + Math.random() * 5;
      if (!this.quiet && night < 0.4 && rain < 0.4) this.bird();
    }
    // Cloche de l'église de temps en temps (trois coups)
    this.bellIn -= dt;
    if (this.bellIn < 0) {
      this.bellIn = 75 + Math.random() * 45;
      const dist = Math.hypot(listener.x - CHURCH_BELL.x, listener.z - CHURCH_BELL.z);
      for (let i = 0; i < 3; i++) setTimeout(() => atDistance(dist, playBell, 140), i * 1600);
    }
  }
}
