// Création du héros : nom, visage et blason. S'ouvre au début d'une nouvelle partie
// et depuis l'onglet « Héros » du menu pause.
import { TINCTURES, drawArms } from './textures.js?v=202611261852';

const $ = (id) => document.getElementById(id);

export const SKINS = [0xe8b896, 0xd9a383, 0xb57e5a, 0x7a4e32];
export const HAIRS = [0x1a1410, 0x4a2e18, 0x6b4423, 0xa0703a, 0xc8a060, 0x8a3a1a];
export const PATTERNS = [
  ['chevron', 'Chevron'], ['croix', 'Croix'], ['fasce', 'Fasce'], ['pal', 'Pal'],
  ['bande', 'Bande'], ['sautoir', 'Sautoir'], ['ecartele', 'Écartelé'], ['etoile', 'Étoile'], ['tour', 'Tour'],
];
const NAMES = { azur: 'Azur (bleu)', gueules: 'Gueules (rouge)', sinople: 'Sinople (vert)', sable: 'Sable (noir)', pourpre: 'Pourpre', or: 'Or', argent: 'Argent' };

export function defaultHero() {
  return { name: 'Arnaud', skin: SKINS[1], hair: HAIRS[2], beard: false, arms: { field: 'azur', charge: 'or', pattern: 'chevron' } };
}

/** Couleur (nombre) du champ du blason, pour le manteau et le caparaçon. */
export function fieldColor(hero) {
  return parseInt((TINCTURES[hero.arms.field] || '#22386e').slice(1), 16);
}

/** Dessine un écu en forme d'amande sur un canevas. */
export function drawShield(canvas, arms) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(W * 0.08, H * 0.04);
  ctx.lineTo(W * 0.92, H * 0.04);
  ctx.quadraticCurveTo(W * 0.96, H * 0.55, W * 0.5, H * 0.97);
  ctx.quadraticCurveTo(W * 0.04, H * 0.55, W * 0.08, H * 0.04);
  ctx.closePath();
  ctx.clip();
  drawArms(ctx, W, H, arms);
  ctx.restore();
  ctx.lineWidth = Math.max(2, W * 0.03);
  ctx.strokeStyle = '#5a5e64';
  ctx.beginPath();
  ctx.moveTo(W * 0.08, H * 0.04);
  ctx.lineTo(W * 0.92, H * 0.04);
  ctx.quadraticCurveTo(W * 0.96, H * 0.55, W * 0.5, H * 0.97);
  ctx.quadraticCurveTo(W * 0.04, H * 0.55, W * 0.08, H * 0.04);
  ctx.stroke();
}

/**
 * Ouvre l'écran de création. onDone(hero) est appelé à la validation.
 * opts : { title, button }
 */
export function openCreator(current, onDone, opts = {}) {
  const hero = JSON.parse(JSON.stringify(current || defaultHero()));
  const root = $('creator');
  $('creator-title').textContent = opts.title || 'Ton héros';
  $('creator-ok').textContent = opts.button || 'Partir pour Montclair';
  $('hero-name').value = hero.name;
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');

  const swatches = (id, values, get, set, color = (v) => v) => {
    const box = $(id);
    box.textContent = '';
    for (const v of values) {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = color(v);
      b.title = NAMES[v] || '';
      b.addEventListener('click', () => { set(v); refresh(); });
      b.dataset.v = String(v);
      box.appendChild(b);
    }
    box._sync = () => box.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('on', b.dataset.v === String(get())));
  };
  swatches('hero-skin', SKINS, () => hero.skin, (v) => { hero.skin = v; }, hex);
  swatches('hero-hair', HAIRS, () => hero.hair, (v) => { hero.hair = v; }, hex);
  swatches('hero-field', Object.keys(TINCTURES), () => hero.arms.field, (v) => { hero.arms.field = v; }, (v) => TINCTURES[v]);
  swatches('hero-charge', Object.keys(TINCTURES), () => hero.arms.charge, (v) => { hero.arms.charge = v; }, (v) => TINCTURES[v]);

  const pat = $('hero-pattern');
  pat.textContent = '';
  for (const [id, label] of PATTERNS) {
    const b = document.createElement('button');
    b.className = 'pattern';
    const c = document.createElement('canvas');
    c.width = 36; c.height = 44;
    b.appendChild(c);
    const span = document.createElement('span');
    span.textContent = label;
    b.appendChild(span);
    b.dataset.v = id;
    b.addEventListener('click', () => { hero.arms.pattern = id; refresh(); });
    pat.appendChild(b);
  }
  const beard = $('hero-beard');
  beard.onclick = () => { hero.beard = !hero.beard; refresh(); };

  function refresh() {
    for (const id of ['hero-skin', 'hero-hair', 'hero-field', 'hero-charge']) $(id)._sync();
    pat.querySelectorAll('.pattern').forEach((b) => {
      b.classList.toggle('on', b.dataset.v === hero.arms.pattern);
      drawShield(b.querySelector('canvas'), { ...hero.arms, pattern: b.dataset.v });
    });
    beard.textContent = hero.beard ? 'Barbe : oui' : 'Barbe : non';
    drawShield($('hero-shield'), hero.arms);
    // Petit portrait
    const p = $('hero-face').getContext('2d');
    p.clearRect(0, 0, 90, 90);
    p.fillStyle = hex(hero.hair);
    p.beginPath(); p.ellipse(45, 38, 27, 28, 0, Math.PI, 0); p.fill();
    p.fillStyle = hex(hero.skin);
    p.beginPath(); p.ellipse(45, 48, 23, 28, 0, 0, Math.PI * 2); p.fill();
    p.fillStyle = hex(hero.hair);
    p.fillRect(28, 32, 34, 7);
    if (hero.beard) { p.beginPath(); p.ellipse(45, 66, 21, 14, 0, 0, Math.PI); p.fill(); }
    p.fillStyle = '#1a1410';
    p.beginPath(); p.arc(36, 47, 2.6, 0, 7); p.arc(54, 47, 2.6, 0, 7); p.fill();
    const blazon = $('hero-blazon');
    const a = hero.arms;
    const art = (t) => (['or', 'argent', 'azur'].includes(t) ? "d'" : 'de ') + t;
    const pname = { chevron: 'au chevron', croix: 'à la croix', fasce: 'à la fasce', pal: 'au pal', bande: 'à la bande', sautoir: 'au sautoir', ecartele: 'écartelé', etoile: "à l'étoile", tour: 'à la tour' }[a.pattern];
    const art0 = (t) => (['or', 'argent', 'azur'].includes(t) ? "D'" : 'De ') + t;
    blazon.textContent = a.pattern === 'ecartele' ? `Écartelé ${art(a.field)} et ${art(a.charge)}` : `${art0(a.field)}, ${pname} ${art(a.charge)}`;
  }
  refresh();

  root.classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  const ok = $('creator-ok');
  ok.onclick = () => {
    hero.name = ($('hero-name').value || '').trim().slice(0, 18) || 'Arnaud';
    hero.name = hero.name.charAt(0).toUpperCase() + hero.name.slice(1);
    root.classList.add('hidden');
    onDone(hero);
  };
  $('creator-cancel').classList.toggle('hidden', !opts.cancel);
  $('creator-cancel').onclick = () => { root.classList.add('hidden'); if (opts.cancel) opts.cancel(); };
}
