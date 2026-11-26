// Textures générées par le code : aucune image à télécharger.
// Chaque texture a une carte de couleur et une carte de relief (normal map)
// pour que la lumière accroche les détails (joints de pierre, mailles, coutures…).
import * as THREE from 'three';

// ---------- Bruit (pour les variations naturelles) ----------
function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Bruit de valeur qui se répète (période p) : la texture se raccorde sans couture. */
function valueNoise(x, y, p, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = (a) => ((a % p) + p) % p;
  const a = hash(m(xi), m(yi), seed), b = hash(m(xi + 1), m(yi), seed);
  const c = hash(m(xi), m(yi + 1), seed), d = hash(m(xi + 1), m(yi + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Bruit fractal (plusieurs octaves). x, y entre 0 et 1. */
function fbm(x, y, basePeriod, octaves, seed) {
  let sum = 0, amp = 0.5, norm = 0, p = basePeriod;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * p, y * p, p, seed + o * 17) * amp;
    norm += amp;
    amp *= 0.5;
    p *= 2;
  }
  return sum / norm;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Construit les textures à partir d'une fonction (x, y) -> { r, g, b, h }. */
function generate(w, h, fn) {
  const col = makeCanvas(w, h), nrm = makeCanvas(w, h);
  const cctx = col.getContext('2d'), nctx = nrm.getContext('2d');
  const cimg = cctx.createImageData(w, h), nimg = nctx.createImageData(w, h);
  const height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = fn(x / w, y / h, x, y);
      const i = (y * w + x);
      cimg.data[i * 4] = p.r; cimg.data[i * 4 + 1] = p.g; cimg.data[i * 4 + 2] = p.b; cimg.data[i * 4 + 3] = 255;
      height[i] = p.h;
    }
  }
  cctx.putImageData(cimg, 0, 0);
  return { col, nrm, nctx, nimg, height, w, h };
}

function finishNormals(g, strength) {
  const { w, h, height, nimg, nctx } = g;
  const at = (x, y) => height[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      nimg.data[i] = (nx * 0.5 + 0.5) * 255;
      nimg.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      nimg.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      nimg.data[i + 3] = 255;
    }
  }
  nctx.putImageData(nimg, 0, 0);
}

function toTextures(g, strength, repeat = 1) {
  finishNormals(g, strength);
  const map = new THREE.CanvasTexture(g.col);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(g.nrm);
  for (const t of [map, normalMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.repeat.set(repeat, repeat);
  }
  return { map, normalMap };
}

const clamp255 = (v) => Math.max(0, Math.min(255, v));
const mix = (a, b, t) => a + (b - a) * t;

// ---------- Les textures ----------

/** Murs de pierre de taille (1 texture = 2,5 m). */
function stone(seed = 1, tint = [150, 143, 130]) {
  const S = 512, ROW = 64, MORTAR = 4;
  // Pré-calcul des blocs de chaque rangée
  const rows = [];
  for (let r = 0; r < S / ROW; r++) {
    const cuts = [0];
    let x = Math.floor(hash(r, 0, seed) * 60);
    cuts[0] = x;
    while (x < cuts[0] + S) { x += 70 + Math.floor(hash(r, x, seed) * 80); cuts.push(x); }
    rows.push(cuts);
  }
  const g = generate(S, S, (u, v, px, py) => {
    const r = Math.floor(py / ROW);
    const cuts = rows[r];
    let xx = px; if (xx < cuts[0]) xx += S;
    let k = 0; while (k < cuts.length - 1 && xx >= cuts[k + 1]) k++;
    const left = xx - cuts[k], right = cuts[k + 1] - xx;
    const top = py - r * ROW, bottom = (r + 1) * ROW - py;
    const edge = Math.min(left, right, top, bottom);
    const n = fbm(u, v, 8, 5, seed);
    const blockShade = 0.82 + hash(r, k, seed + 3) * 0.3;
    const grime = fbm(u, v, 3, 3, seed + 9);
    if (edge < MORTAR) {
      const m = 95 + n * 30;
      return { r: m, g: m * 0.97, b: m * 0.9, h: 0.1 + n * 0.1 };
    }
    const bevel = Math.min(1, (edge - MORTAR) / 6);
    const s = blockShade * (0.75 + n * 0.45) * (0.85 + grime * 0.25);
    return {
      r: clamp255(tint[0] * s), g: clamp255(tint[1] * s), b: clamp255(tint[2] * s * 0.97),
      h: 0.35 + bevel * 0.45 + n * 0.25,
    };
  });
  return toTextures(g, 2.2, 1 / 2.5);
}

/** Ardoises de toiture (1 texture = 2 m). */
function slate() {
  const S = 256, ROW = 24;
  const g = generate(S, S, (u, v, px, py) => {
    const r = Math.floor(py / ROW);
    const off = (r % 2) * 16;
    const colw = 32;
    const c = Math.floor((px + off) / colw);
    const inRow = (py % ROW) / ROW;
    const inCol = ((px + off) % colw) / colw;
    const n = fbm(u, v, 8, 4, 31);
    const shade = 0.7 + hash(r, c, 5) * 0.35;
    const edge = Math.min(inCol, 1 - inCol) < 0.05 ? 0.5 : 1;
    const base = 70 * shade * edge * (0.8 + n * 0.4);
    return { r: base * 0.95, g: base, b: base * 1.12, h: inRow * 0.8 + n * 0.2 };
  });
  return toTextures(g, 3, 1 / 2);
}

/** Enduit des maisons (1 texture = 3 m). */
function plaster() {
  const g = generate(256, 256, (u, v) => {
    const n = fbm(u, v, 4, 5, 41);
    const stain = fbm(u, v, 2, 3, 43);
    const s = 0.78 + n * 0.22 - Math.max(0, stain - 0.55) * 0.5;
    return { r: clamp255(228 * s), g: clamp255(214 * s), b: clamp255(184 * s), h: n };
  });
  return toTextures(g, 1.5, 1 / 3);
}

/** Planches de bois (1 texture = 1,5 m). */
function wood(base = [120, 84, 52]) {
  const g = generate(256, 256, (u, v, px) => {
    const plank = Math.floor(u * 5);
    const inPlank = (u * 5) % 1;
    const grain = fbm(u * 0.15 + plank * 0.37, v, 6, 4, 51 + plank);
    const lines = Math.sin((v * 40 + grain * 8 + plank * 3) * Math.PI) * 0.5 + 0.5;
    const shade = (0.75 + hash(plank, 0, 52) * 0.3) * (0.82 + lines * 0.18);
    const gap = inPlank < 0.03 || inPlank > 0.97 ? 0.45 : 1;
    return {
      r: clamp255(base[0] * shade * gap), g: clamp255(base[1] * shade * gap), b: clamp255(base[2] * shade * gap),
      h: gap < 1 ? 0 : 0.6 + lines * 0.2,
    };
  });
  return toTextures(g, 2, 1 / 1.5);
}

/** Chaume (1 texture = 1,5 m). */
function thatch() {
  const g = generate(512, 512, (u, v) => {
    const strands = fbm(u * 6, v * 0.25, 16, 3, 61);
    const clumps = fbm(u, v, 5, 3, 62);
    const t = strands * 0.7 + clumps * 0.3;
    const dark = Math.pow(t, 1.6);
    return { r: clamp255(mix(70, 205, dark)), g: clamp255(mix(52, 168, dark)), b: clamp255(mix(25, 88, dark)), h: t };
  });
  return toTextures(g, 4, 1 / 1.5);
}

/** Herbe et terre du sol (1 texture = 8 m). */
function grassGround() {
  const g = generate(512, 512, (u, v) => {
    const n = fbm(u, v, 4, 6, 71);
    const patch = fbm(u, v, 2, 3, 72);
    const dry = Math.max(0, patch - 0.5) * 2;
    const r = mix(62, 118, dry) * (0.75 + n * 0.5);
    const gg = mix(88, 104, dry) * (0.75 + n * 0.5);
    const b = mix(38, 58, dry) * (0.75 + n * 0.5);
    return { r: clamp255(r), g: clamp255(gg), b: clamp255(b), h: n };
  });
  return toTextures(g, 1.5, 1 / 8);
}

/** Terre battue des chemins (1 texture = 3 m). */
function dirt(tint = [128, 102, 72]) {
  const g = generate(256, 256, (u, v) => {
    const n = fbm(u, v, 6, 5, 81);
    const ruts = fbm(u, v, 3, 3, 85);
    const pebble = Math.max(0, valueNoise(u * 64, v * 64, 64, 83) - 0.8) * 5;
    const s = (0.72 + n * 0.4) * (0.9 + ruts * 0.2) * (1 + pebble * 0.12);
    return { r: clamp255(tint[0] * s), g: clamp255(tint[1] * s), b: clamp255(tint[2] * s), h: n * 0.7 + pebble * 0.3 };
  });
  return toTextures(g, 1.2, 1 / 3);
}

/** Cotte de mailles : anneaux entrelacés (gris, teinté par le matériau). */
function chainmail() {
  const S = 128, N = 8, cell = S / N;
  const g = generate(S, S, (u, v, px, py) => {
    let best = 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const cy = Math.floor(py / cell) + oy;
        const shift = (cy % 2) * cell / 2;
        const cx = Math.floor((px - shift) / cell) + ox;
        const centerX = cx * cell + cell / 2 + shift, centerY = cy * cell + cell / 2;
        const d = Math.hypot(px - centerX, (py - centerY) * 1.15);
        const ring = 1 - Math.abs(d - cell * 0.42) / (cell * 0.16);
        if (ring > best) best = ring;
      }
    }
    const h = Math.max(0, best);
    const s = 40 + h * 200;
    return { r: s, g: s, b: s, h };
  });
  return toTextures(g, 6, 1);
}

/** Gambison matelassé : coutures verticales. */
function quilted() {
  const g = generate(256, 256, (u, v) => {
    const ch = Math.pow(Math.abs(Math.sin(u * Math.PI * 6)), 0.5);
    const n = fbm(u, v, 8, 4, 91);
    const stitch = ch < 0.25 && Math.abs(Math.sin(v * Math.PI * 48)) > 0.7 ? 0.85 : 1;
    const s = (185 + ch * 35 + (n - 0.5) * 50) * stitch;
    return { r: s, g: s, b: s, h: ch * 0.9 + n * 0.1 };
  });
  return toTextures(g, 2.5, 1);
}

/** Tissu tissé. */
function cloth() {
  const g = generate(128, 128, (u, v, px, py) => {
    const weave = ((px + py) % 4 < 2 ? 1 : 0.88) * ((px % 2) ? 1 : 0.95);
    const n = fbm(u, v, 4, 4, 101);
    const s = (175 + n * 70) * weave;
    return { r: s, g: s, b: s, h: weave * 0.5 + n * 0.5 };
  });
  return toTextures(g, 1.2, 1);
}

/** Cuir patiné. */
function leather() {
  const g = generate(256, 256, (u, v) => {
    const n = fbm(u, v, 8, 6, 111);
    const crease = Math.pow(1 - Math.abs(fbm(u, v, 4, 3, 113) - 0.5) * 2, 8);
    const s = 150 + n * 90 - crease * 60;
    return { r: s, g: s, b: s, h: n - crease * 0.5 };
  });
  return toTextures(g, 2, 1);
}

/** Acier martelé : légères irrégularités qui font vivre les reflets. */
function steel() {
  const g = generate(256, 256, (u, v) => {
    const n = fbm(u, v, 6, 5, 121);
    const s = 185 + n * 60;
    return { r: s, g: s, b: s * 1.02, h: n };
  });
  return toTextures(g, 0.8, 1);
}

/** Couleurs du blason (émaux). */
export const TINCTURES = {
  azur: '#1f3f8f', gueules: '#a82020', sinople: '#2a6a2a', sable: '#1c1a1a', pourpre: '#6a2a6a',
  or: '#d8b04a', argent: '#e8e4da',
};

/** Dessine des armoiries { field, charge, pattern } sur un contexte 2D de taille W × H. */
export function drawArms(ctx, W, H, arms) {
  const field = TINCTURES[arms.field] || arms.field || TINCTURES.azur;
  const charge = TINCTURES[arms.charge] || arms.charge || TINCTURES.or;
  ctx.fillStyle = field;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = charge;
  const poly = (pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H))); ctx.closePath(); ctx.fill(); };
  switch (arms.pattern) {
    case 'croix': ctx.fillRect(W * 0.4, 0, W * 0.2, H); ctx.fillRect(0, H * 0.3, W, H * 0.14); break;
    case 'fasce': ctx.fillRect(0, H * 0.33, W, H * 0.2); break;
    case 'pal': ctx.fillRect(W * 0.36, 0, W * 0.28, H); break;
    case 'bande': poly([[0, 0], [0.28, 0], [1, 0.82], [1, 1], [0.72, 1], [0, 0.18]]); break;
    case 'sautoir':
      poly([[0, 0], [0.2, 0], [1, 0.87], [1, 1], [0.8, 1], [0, 0.13]]);
      poly([[1, 0], [0.8, 0], [0, 0.87], [0, 1], [0.2, 1], [1, 0.13]]);
      break;
    case 'ecartele': ctx.fillRect(W / 2, 0, W / 2, H / 2); ctx.fillRect(0, H / 2, W / 2, H / 2); break;
    case 'etoile': {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 0.13 : 0.32) * W;
        const x = W / 2 + Math.cos(a) * r, y = H * 0.4 + Math.sin(a) * r;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'tour': {
      const x0 = W * 0.3, x1 = W * 0.7, y0 = H * 0.22, y1 = H * 0.66;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      for (let i = 0; i < 3; i++) ctx.fillRect(x0 + i * (x1 - x0) * 0.4 - (i === 2 ? (x1 - x0) * 0.0 : 0), y0 - H * 0.06, (x1 - x0) * 0.2, H * 0.07);
      ctx.fillStyle = field;
      ctx.beginPath(); ctx.arc(W / 2, y1, W * 0.08, Math.PI, 0); ctx.lineTo(W / 2 + W * 0.08, y1); ctx.fill();
      ctx.fillRect(W / 2 - W * 0.025, y0 + H * 0.08, W * 0.05, H * 0.08);
      break;
    }
    default: // chevron
      poly([[0, 0.62], [0.5, 0.3], [1, 0.62], [1, 0.78], [0.5, 0.46], [0, 0.78]]);
  }
}

/** Écu armorié avec usure. */
function heraldry(arms = { field: 'azur', charge: 'or', pattern: 'chevron' }) {
  const W = 256, H = 384;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  drawArms(ctx, W, H, arms);
  // Usure et salissures
  const img = ctx.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = fbm(x / W, y / H, 6, 5, 131);
      const scratch = valueNoise(x / 3, y / 40, 1000, 133) > 0.93 ? 0.6 : 1;
      const s = (0.7 + n * 0.45) * scratch;
      const i = (y * W + x) * 4;
      img.data[i] = clamp255(img.data[i] * s);
      img.data[i + 1] = clamp255(img.data[i + 1] * s);
      img.data[i + 2] = clamp255(img.data[i + 2] * s);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------- Accès avec mise en cache ----------
const cache = {};
function cached(key, make) {
  if (!cache[key]) cache[key] = make();
  return cache[key];
}

export const Tex = {
  stone: () => cached('stone', () => stone(1)),
  stoneLight: () => cached('stoneLight', () => stone(7, [176, 166, 146])),
  slate: () => cached('slate', slate),
  plaster: () => cached('plaster', plaster),
  wood: () => cached('wood', () => wood()),
  timber: () => cached('timber', () => wood([78, 52, 32])),
  thatch: () => cached('thatch', thatch),
  grass: () => cached('grass', grassGround),
  dirt: () => cached('dirt', () => dirt()),
  sand: () => cached('sand', () => dirt([150, 128, 96])),
  chainmail: () => cached('chainmail', chainmail),
  quilted: () => cached('quilted', quilted),
  cloth: () => cached('cloth', cloth),
  leather: () => cached('leather', leather),
  steel: () => cached('steel', steel),
  heraldry: () => cached('heraldry', () => heraldry()),
  /** Armoiries personnalisées (mises en cache selon leur description). */
  arms: (a) => cached('arms:' + a.field + a.charge + a.pattern, () => heraldry(a)),
};

/**
 * Remplace les coordonnées de texture d'une boîte par des coordonnées en mètres,
 * pour que la texture garde la même taille quelle que soit la taille de la boîte.
 */
export function metricBoxUV(geo, w, h, d) {
  const uv = geo.attributes.uv;
  // Ordre des faces de BoxGeometry : +x, -x, +y, -y, +z, -z (4 sommets chacune)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/** Même chose pour un cylindre (tour, puits…). */
export function metricCylinderUV(geo, r, h) {
  const uv = geo.attributes.uv;
  const circ = 2 * Math.PI * r;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * h);
  uv.needsUpdate = true;
  return geo;
}
