// Carte du monde, dessinée vue du dessus (le nord, avec le château, en haut).
import { GATES, LISTS, ROAD, AMBUSH } from './layout.js?v=202611261218';
import { WORLD_RADIUS } from './world.js?v=202611261218';

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
