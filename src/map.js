// Carte du monde, dessinée vue du dessus (le nord, avec le château, en haut).
import { GATES, LISTS, ROAD, AMBUSH } from './layout.js?v=202611261748';
import { WORLD_RADIUS } from './world.js?v=202611261748';

export function drawMap(canvas, { world, player, horse, target, step }) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const R = WORLD_RADIUS + 6;
  const s = Math.min(W, H) / (2 * R);
  const X = (x) => W / 2 + x * s;
  const Y = (z) => H / 2 + z * s;

  // Parchemin
  const grd = ctx.createRadialGradient(W / 2, H / 2, W * 0.1, W / 2, H / 2, W * 0.7);
  grd.addColorStop(0, '#e9d9b0');
  grd.addColorStop(1, '#b89a64');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // Forêt (troncs = petits points verts)
  ctx.fillStyle = 'rgba(70, 90, 40, 0.55)';
  for (const c of world.circles) {
    if (c.r > 0.15 && c.r < 0.6 && c.top >= 99) {
      ctx.beginPath();
      ctx.arc(X(c.x), Y(c.z), 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Chemins, cours, lice
  ctx.fillStyle = 'rgba(140, 105, 60, 0.6)';
  for (const b of world.bare) ctx.fillRect(X(b.minX), Y(b.minZ), (b.maxX - b.minX) * s, (b.maxZ - b.minZ) * s);
  // Route forestière (chapitre III)
  if (step >= 12) {
    ctx.strokeStyle = 'rgba(120, 85, 45, 0.8)';
    ctx.lineWidth = 3.2 * s;
    ctx.beginPath();
    ROAD.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.z)) : ctx.moveTo(X(p.x), Y(p.z))));
    ctx.stroke();
    ctx.fillStyle = 'rgba(120, 85, 45, 0.35)';
    ctx.beginPath();
    ctx.arc(X(AMBUSH.x), Y(AMBUSH.z), AMBUSH.r * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bâtiments et murailles
  ctx.fillStyle = 'rgba(60, 45, 30, 0.85)';
  for (const b of world.boxes) {
    if (b.top < 2) continue; // clôtures basses
    ctx.fillRect(X(b.minX), Y(b.minZ), Math.max(1.5, (b.maxX - b.minX) * s), Math.max(1.5, (b.maxZ - b.minZ) * s));
  }
  // Tours
  for (const c of world.circles) {
    if (c.r >= 2) { ctx.beginPath(); ctx.arc(X(c.x), Y(c.z), c.r * s, 0, Math.PI * 2); ctx.fill(); }
  }
  // Portes du parcours
  if (step === 8) {
    GATES.forEach((g, i) => {
      ctx.fillStyle = i < (world._gateIndex ?? 0) ? 'rgba(140,40,30,0.8)' : '#22386e';
      ctx.fillRect(X(g.x) - 3, Y(g.z) - 3, 6, 6);
    });
  }

  // Noms des lieux
  ctx.fillStyle = '#3a2414';
  ctx.textAlign = 'center';
  ctx.font = `italic ${Math.round(W / 34)}px Georgia, serif`;
  const label = (t, x, z) => ctx.fillText(t, X(x), Y(z));
  label('Château de Montclair', 0, -62);
  label('Village', 0, 55);
  label('Église', -20, 18);
  label('Terrain d\'armes', 26, -10);
  label('Lice', LISTS.x, LISTS.z0 - 3);
  label('Champ', 38, 52);
  if (step >= 12) label('Vers l\'abbaye', AMBUSH.x + 4, AMBUSH.z - 12);
  ctx.font = `${Math.round(W / 40)}px Georgia, serif`;
  // Rose des vents (simple)
  ctx.beginPath();
  ctx.moveTo(X(R - 10), Y(-R + 4)); ctx.lineTo(X(R - 12), Y(-R + 10)); ctx.lineTo(X(R - 8), Y(-R + 10)); ctx.closePath();
  ctx.fill();
  ctx.fillText('N', X(R - 10), Y(-R + 3));

  // Objectif
  if (target) {
    ctx.fillStyle = '#e8b030';
    ctx.strokeStyle = '#5a3a10';
    ctx.lineWidth = 1.5;
    star(ctx, X(target.x), Y(target.z), 9, 4);
    ctx.fill(); ctx.stroke();
  }
  // Cheval
  if (horse && !horse.mounted) {
    ctx.fillStyle = '#7a4626';
    ctx.beginPath();
    ctx.arc(X(horse.position.x), Y(horse.position.z), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Joueur (flèche dans la direction du regard)
  const p = player.position, r = player.object.rotation.y;
  ctx.save();
  ctx.translate(X(p.x), Y(p.z));
  ctx.rotate(-r + Math.PI);
  ctx.fillStyle = '#a01810';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function star(ctx, x, y, r1, r2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? r2 : r1, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

/** Plan de Paris (île de la Cité et les deux rives). Coordonnées du monde, origine de Paris en `origin`. */
export function drawParisMap(canvas, { origin, player, target }) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const R = 82;
  const s = Math.min(W, H) / (2 * R);
  const cz = -8; // centre vertical du plan (un peu au nord pour voir les deux rives)
  const X = (x) => W / 2 + (x - origin.x) * s;
  const Y = (z) => H / 2 + (z - origin.z - cz) * s;
  const rect = (x0, x1, z0, z1, color) => { ctx.fillStyle = color; ctx.fillRect(X(origin.x + x0), Y(origin.z + z0), (x1 - x0) * s, (z1 - z0) * s); };
  const grd = ctx.createRadialGradient(W / 2, H / 2, W * 0.1, W / 2, H / 2, W * 0.7);
  grd.addColorStop(0, '#e9d9b0');
  grd.addColorStop(1, '#b89a64');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
  // La Seine
  rect(-160, 160, -40, 34, 'rgba(70, 110, 130, 0.55)');
  // L'île et les rives
  rect(-74, 74, -20, 20, 'rgba(200, 180, 140, 0.9)');
  // Maisons (pâtés)
  const block = 'rgba(140, 100, 70, 0.55)';
  for (const [x0, x1, z0, z1] of [[-38, -22.5, -19.5, -3.5], [-18.5, -3.5, -19.5, -3.5], [3.5, 22, -19.5, -3.5], [-38, 4, 3.5, 19.5], [18, 30, 6, 19.5], [24, 72, -19.5, -13.5], [31, 72, 13.5, 19.5],
    [-40, 2, 43, 58], [18, 56, 43, 58], [-1.5, 4.5, 52, 100], [15.5, 21.5, 52, 100], [-36, -12, -66, -51], [12, 40, -66, -51]]) rect(x0, x1, z0, z1, block);
  // Ponts
  rect(-3.5, 3.5, -40, -20, 'rgba(120, 90, 60, 0.9)');
  rect(-8.7, -3.5, -40, -19, block); rect(3.5, 8.7, -40, -19, block);
  rect(7, 13, 20, 34, 'rgba(150, 140, 120, 0.95)');
  // Palais, cathédrale, Châtelets
  rect(-72, -40, -18, 18, 'rgba(110, 110, 120, 0.35)');
  rect(-65, -45, -12.5, -3.5, 'rgba(90, 90, 110, 0.9)');
  rect(-67.5, -58.5, 4.5, 13.5, 'rgba(90, 90, 110, 0.9)');
  rect(34, 64, -9.5, 9.5, 'rgba(150, 150, 160, 0.95)');
  rect(-10.5, 10.5, -51.5, -41.5, 'rgba(90, 90, 110, 0.9)');
  rect(2, 18, 35, 42, 'rgba(90, 90, 110, 0.9)');
  ctx.fillStyle = '#3a2a18';
  ctx.font = `bold ${Math.round(W / 38)}px Georgia, serif`;
  ctx.textAlign = 'center';
  const label = (t, x, z) => ctx.fillText(t, X(origin.x + x), Y(origin.z + z));
  label('Palais du roi', -56, 0);
  label('Cathédrale', 50, 1);
  label('Marché', 11, 13);
  label('Grand Pont', 0, -29);
  label('Petit Pont', 10, 28);
  label('Grand Châtelet', 0, -56);
  label('Petit Châtelet', 10, 47);
  ctx.font = `italic ${Math.round(W / 34)}px Georgia, serif`;
  ctx.fillStyle = 'rgba(30, 60, 80, 0.8)';
  label('La Seine', -45, -30);
  label('La Seine', 45, 28);
  ctx.fillStyle = '#3a2a18';
  label('Rive droite', 50, -60);
  label('Rive gauche', -40, 66);
  label('N', 70, -78);
  if (target) {
    ctx.fillStyle = '#e8b030';
    ctx.strokeStyle = '#5a3a10';
    ctx.lineWidth = 1.5;
    star(ctx, X(target.x), Y(target.z), 9, 4);
    ctx.fill(); ctx.stroke();
  }
  const p = player.position, r = player.object.rotation.y;
  ctx.save();
  ctx.translate(X(p.x), Y(p.z));
  ctx.rotate(-r + Math.PI);
  ctx.fillStyle = '#a01810';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}
