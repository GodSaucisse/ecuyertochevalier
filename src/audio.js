// Petits effets sonores générés par le navigateur (aucun fichier audio nécessaire).
let ctx = null;

export function initAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (_) { ctx = null; }
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
  gain.gain.setValueAtTime(0.8, t);
  src.connect(filter).connect(gain).connect(ctx.destination);
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
  gain.gain.value = 0.12;
  src.connect(filter).connect(gain).connect(ctx.destination);
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
    g.gain.linearRampToValueAtTime(0.18, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
    osc.connect(g).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.55);
  });
}
