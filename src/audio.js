// Petits effets sonores générés par le navigateur (aucun fichier audio nécessaire).
let ctx = null;
let sfxBus = null, musicBus = null, ambienceBus = null;
let scale = 1; // volume relatif (sons lointains plus faibles)
const volumes = { music: 0.5, sfx: 0.8 };

export function initAudio() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      sfxBus = ctx.createGain();
      musicBus = ctx.createGain();
      ambienceBus = ctx.createGain();
      sfxBus.connect(ctx.destination);
      musicBus.connect(ctx.destination);
      ambienceBus.connect(sfxBus);
      applyVolumes();
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (_) { ctx = null; }
}

function applyVolumes() {
  if (!ctx) return;
  sfxBus.gain.value = volumes.sfx;
  musicBus.gain.value = volumes.music * 0.6;
}

export function setVolumes(music, sfx) {
  volumes.music = music;
  volumes.sfx = sfx;
  applyVolumes();
}

export const audio = {
  get ctx() { return ctx; },
  get music() { return musicBus; },
  get ambience() { return ambienceBus; },
  get sfx() { return sfxBus; },
};

/** Joue un son comme s'il venait de loin : plus faible avec la distance (en mètres). */
export function atDistance(distance, fn, maxDistance = 45) {
  const k = Math.max(0, 1 - distance / maxDistance);
  if (k <= 0) return;
  const prev = scale;
  scale = prev * k * k;
  try { fn(); } finally { scale = prev; }
}

/** Coup sourd de bois. */
export function playHit() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const len = 0.15;
  const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.8 * scale, t);
  src.connect(filter).connect(gain).connect(sfxBus);
  src.start(t);
}

/** Souffle de l'épée qui fend l'air. */
export function playSwing() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const len = 0.2;
  const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(600, t);
  filter.frequency.linearRampToValueAtTime(2200, t + len);
  const gain = ctx.createGain();
  gain.gain.value = 0.12 * scale;
  src.connect(filter).connect(gain).connect(sfxBus);
  src.start(t);
}

/** Petite fanfare quand un objectif est accompli. */
export function playSuccess() {
  if (!ctx) return;
  const t = ctx.currentTime;
  [523.25, 659.25, 783.99].forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const g = ctx.createGain();
    const start = t + i * 0.12;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(0.18 * scale, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
    osc.connect(g).connect(sfxBus);
    osc.start(start);
    osc.stop(start + 0.55);
  });
}

/** Bruit court filtré (utilitaire). */
function burst(len, type, freq, q, gainValue, decayPow = 3) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, decayPow);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.value = gainValue * scale;
  src.connect(filter).connect(gain).connect(sfxBus);
  src.start(t);
}

function tone(freq, len, gainValue, type = 'sine', slide = 1) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * slide, t + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(Math.max(0.0002, gainValue * scale), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(g).connect(sfxBus);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

/** Choc d'épées de bois qui se bloquent. */
export function playBlock() {
  burst(0.09, 'bandpass', 1400, 4, 1.2, 4);
  tone(620, 0.12, 0.15, 'triangle', 0.8);
}

/** Parade réussie : choc sec et résonant. */
export function playParry() {
  burst(0.12, 'bandpass', 2200, 6, 1.4, 3);
  tone(880, 0.35, 0.18, 'triangle', 0.7);
  tone(1320, 0.25, 0.08, 'sine', 0.8);
}

/** Coup reçu : impact sourd. */
export function playHurt() {
  burst(0.2, 'lowpass', 500, 1, 1.3, 2);
  tone(110, 0.18, 0.25, 'sine', 0.6);
}

/** Victoire. */
export function playVictory() {
  if (!ctx) return;
  [392, 523.25, 659.25, 783.99].forEach((f, i) => setTimeout(() => tone(f, 0.6, 0.15, 'triangle'), i * 140));
}

/** Bruit de sabot (plus fort au galop). */
export function playHoof(intensity = 0.5) {
  if (!ctx) return;
  burst(0.07, 'lowpass', 380 + intensity * 300, 1, 0.25 + intensity * 0.45, 3);
}

/** Lance qui frappe l'écu de la quintaine. */
export function playLanceHit() {
  burst(0.25, 'bandpass', 900, 2, 1.6, 2);
  tone(180, 0.3, 0.3, 'triangle', 0.5);
}

/** Cloche d'église (plusieurs harmoniques qui résonnent). */
export function playBell() {
  [[220, 1, 3.5], [440, 0.5, 2.5], [554, 0.25, 2], [660, 0.2, 1.6], [880, 0.12, 1.2]].forEach(([f, g, len]) => tone(f, len, 0.12 * g, 'sine', 0.998));
}

/** Marteau du forgeron sur l'enclume. */
export function playAnvil() {
  tone(1850, 0.35, 0.06, 'sine', 0.999);
  tone(2470, 0.25, 0.03, 'sine', 0.999);
  burst(0.04, 'highpass', 2500, 1, 0.5, 4);
}

/** Gloussement de poule. */
export function playCluck() {
  if (!ctx) return;
  const n = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) setTimeout(() => tone(520 + Math.random() * 200, 0.08, 0.05, 'square', 0.6), i * 110);
}

/** Pas sur la terre (villageois, joueur). */
export function playStep() {
  burst(0.05, 'lowpass', 700, 1, 0.12, 3);
}
