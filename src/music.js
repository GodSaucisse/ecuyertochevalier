// Musique médiévale composée en direct par le jeu (aucun fichier audio).
// Mode dorien de ré : luth en arpèges et flûte à bec (plus rapides pendant les combats).
// La mélodie varie à chaque reprise.
import { audio } from './audio.js?v=202611261148';

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const ROOT = 62; // ré 4

/** Hauteur (midi) d'un degré de la gamme (0 = ré, 7 = ré à l'octave…). */
function degree(d, base = ROOT) {
  const oct = Math.floor(d / 7);
  const idx = ((d % 7) + 7) % 7;
  return base + oct * 12 + DORIAN[idx];
}

// Accords (degré de la fondamentale) : Rém, Do, Rém, Lam / Rém, Fa, Do, Rém
const EXPLORE_CHORDS = [0, 6, 0, 4, 0, 2, 6, 0];
const COMBAT_CHORDS = [0, 0, 6, 0, 0, 5, 6, 0];

function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Music {
  constructor() {
    this.mood = 'explore';
    this.targetMood = 'explore';
    this.started = false;
    this.step = 0;
    this.loop = 0;
    this.pluckCache = new Map();
    this.phrases = null;
  }

  start() {
    const ctx = audio.ctx;
    if (!ctx || this.started) return;
    this.started = true;
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(audio.music);
    this.nextTime = ctx.currentTime + 0.3;
    this.newPhrases();
    this.timer = setInterval(() => this.tick(), 50);
  }

  setMood(m) { this.targetMood = m; }

  get stepDur() { return this.mood === 'combat' ? 60 / 140 / 2 : 60 / 84 / 2; }
  get barLen() { return this.mood === 'combat' ? 6 : 8; }

  /** Compose de nouvelles phrases mélodiques (A, A', B). */
  newPhrases() {
    const rnd = mulberry(1126 + this.loop * 97 + (this.mood === 'combat' ? 5000 : 0));
    const chords = this.mood === 'combat' ? COMBAT_CHORDS : EXPLORE_CHORDS;
    const barLen = this.barLen;
    const make = (barIndex) => {
      // Rythmes possibles (en croches) pour deux mesures
      const rhythms = this.mood === 'combat'
        ? [[1, 1, 1, 1, 2, 1, 1, 1, 1, 2], [2, 1, 2, 1, 1, 1, 1, 3], [1, 1, 1, 3, 1, 1, 1, 3]]
        : [[2, 1, 1, 2, 2, 4, 2, 2], [3, 1, 2, 2, 4, 2, 2], [2, 2, 1, 1, 2, 6, 2], [4, 2, 2, 3, 1, 4]];
      const rhythm = rhythms[Math.floor(rnd() * rhythms.length)];
      const notes = [];
      let pos = 0;
      let d = 7 + chords[barIndex] + (rnd() < 0.5 ? 2 : 0);
      for (const len of rhythm) {
        const bar = barIndex + Math.floor(pos / barLen);
        const chordRoot = chords[bar % chords.length];
        const strong = pos % (barLen / 2) === 0;
        if (strong) {
          // Sur les temps forts : une note de l'accord, proche de la précédente
          const options = [0, 2, 4, 7].map((k) => chordRoot + k + 7).flatMap((v) => [v, v - 7, v + 7]);
          d = options.reduce((best, v) => (Math.abs(v - d) < Math.abs(best - d) ? v : best), options[0]);
        } else {
          const r = rnd();
          d += r < 0.35 ? 1 : r < 0.7 ? -1 : r < 0.85 ? 2 : -2;
        }
        d = Math.max(5, Math.min(15, d));
        const rest = !strong && rnd() < 0.12;
        notes.push({ pos, len, d, rest });
        pos += len;
      }
      return notes;
    };
    const A = make(0);
    const A2 = A.map((n, i) => (i >= A.length - 2 ? { ...n, d: n.d + (i === A.length - 1 ? 0 : 1) } : n));
    const B = make(4);
    this.phrases = [A, A2, B, A];
  }

  tick() {
    const ctx = audio.ctx;
    if (!ctx) return;
    while (this.nextTime < ctx.currentTime + 0.3) {
      this.schedule(this.step, this.nextTime);
      this.nextTime += this.stepDur;
      this.step++;
      const bars = 8;
      if (this.step >= this.barLen * bars) {
        this.step = 0;
        this.loop++;
        if (this.targetMood !== this.mood) this.mood = this.targetMood;
        this.newPhrases();
      }
      // Passage immédiat au combat (au début de la mesure suivante)
      if (this.targetMood === 'combat' && this.mood !== 'combat' && this.step % this.barLen === 0) {
        this.mood = 'combat'; this.step = 0; this.newPhrases();
      }
    }
  }

  schedule(step, t) {
    if (this.mood === 'silence') return;
    const barLen = this.barLen;
    const bar = Math.floor(step / barLen);
    const inBar = step % barLen;
    const combat = this.mood === 'combat';
    const chords = combat ? COMBAT_CHORDS : EXPLORE_CHORDS;
    const root = chords[bar % chords.length];
    // Toutes les 4 reprises, une respiration : seulement luth et bourdon
    const breathe = !combat && this.loop % 4 === 3;

    // Luth : arpège (les percussions et le bourdon ont été retirés à la demande du joueur)
    const pattern = combat ? [0, 4, 7, 0, 4, 7] : [0, 4, 7, 2, 4, 7, 2, 4];
    const lutePitch = degree(root + pattern[inBar], 50);
    if (!breathe || inBar % 2 === 0) this.pluck(midiToFreq(lutePitch), t, inBar === 0 ? 0.2 : 0.13);

    // Flûte : mélodie
    if (!breathe) {
      const phrase = this.phrases[Math.floor(bar / 2) % 4];
      const posInPhrase = (bar % 2) * barLen + inBar;
      const n = phrase.find((x) => x.pos === posInPhrase);
      if (n && !n.rest) {
        const f = midiToFreq(degree(n.d));
        const dur = n.len * this.stepDur * 0.95;
        this.recorder(f, t, dur, combat ? 0.1 : 0.09);
      }
    }
  }

  // ---------- Instruments ----------
  pluck(freq, t, vol) {
    const ctx = audio.ctx;
    const key = Math.round(freq);
    let buf = this.pluckCache.get(key);
    if (!buf) {
      // Corde pincée (algorithme de Karplus-Strong)
      const sr = ctx.sampleRate, len = Math.floor(sr * 1.6);
      buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      const N = Math.round(sr / freq);
      for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
      for (let i = N; i < len; i++) d[i] = 0.497 * (d[i - N] + d[i - N + 1]);
      this.pluckCache.set(key, buf);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2600;
    src.connect(f).connect(g).connect(this.out);
    src.start(t);
  }

  recorder(freq, t, dur, vol) {
    const ctx = audio.ctx;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sine'; o2.type = 'triangle';
    o1.frequency.value = freq; o2.frequency.value = freq;
    const vib = ctx.createOscillator(), vibG = ctx.createGain();
    vib.frequency.value = 5;
    vibG.gain.setValueAtTime(0, t);
    vibG.gain.linearRampToValueAtTime(freq * 0.004, t + Math.min(0.3, dur));
    vib.connect(vibG);
    vibG.connect(o1.frequency); vibG.connect(o2.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.04);
    g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.05, dur - 0.08));
    g.gain.linearRampToValueAtTime(0, t + dur);
    const g2 = ctx.createGain();
    g2.gain.value = 0.3;
    o1.connect(g);
    o2.connect(g2).connect(g);
    g.connect(this.out);
    for (const o of [o1, o2, vib]) { o.start(t); o.stop(t + dur + 0.05); }
  }

  fiddle(freq, t, dur, vol) {
    const ctx = audio.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const vib = ctx.createOscillator(), vibG = ctx.createGain();
    vib.frequency.value = 6;
    vibG.gain.value = freq * 0.006;
    vib.connect(vibG).connect(o.frequency);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.05);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(bp).connect(g).connect(this.out);
    o.start(t); vib.start(t);
    o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
  }

  drum(t, vol) {
    const ctx = audio.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(this.out);
    o.start(t); o.stop(t + 0.4);
    this.noise(t, 0.08, 'lowpass', 900, 0.25 * vol);
  }

  tek(t, vol) { this.noise(t, 0.05, 'highpass', 2500, 0.12 * vol); }

  noise(t, len, type, freq, vol) {
    const ctx = audio.ctx;
    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.3, len + 0.02);
  }
}
