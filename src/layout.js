// Emplacements du chapitre II, partagés entre le décor (pour ne pas y planter d'arbres)
// et le parcours.

/** Portes du parcours d'équitation, dans l'ordre. */
export const GATES = [
  { x: -6, z: -12 },
  { x: -28, z: -14 },
  { x: -36, z: 10 },
  { x: -32, z: 36 },
  { x: -12, z: 60 },
  { x: 18, z: 62 },
  { x: 42, z: 58 },
  { x: 56, z: 46 },
];

/** La lice (piste de joute) : couloir nord-sud. */
export const LISTS = { x: 56, z0: -22, z1: 42, halfWidth: 7 };
export const JOUST_QUINTAIN = { x: 54.6, z: 8 };

/** Écuries du château (cheval au départ). */
export const STABLE_HORSE = { x: -11, z: -34, rot: Math.PI / 2 };

/** Chapitre III : route forestière vers l'abbaye, et clairière de l'embuscade. */
export const ROAD = [
  { x: 0, z: -27 }, { x: 0, z: -15 }, { x: -14, z: -15 }, { x: -32, z: -24 },
  { x: -44, z: -36 }, { x: -51, z: -47 }, { x: -55, z: -54 },
];
export const AMBUSH = { x: -55, z: -54, r: 10 };

/** Chapitre IV : la vieille croix de pierre, les buissons où se cacher, et le chemin de l'intendant. */
export const CROSS = { x: -44, z: 24 };
export const HIDE = { x: -38.5, z: 29.5 };
export const BORGNE_FROM = { x: -64, z: 16 };
export const STEWARD_PATH = [
  { x: -43, z: 23 }, { x: -36, z: 14 }, { x: -26, z: -4 }, { x: -11, z: -16 },
  { x: 0, z: -17 }, { x: 0, z: -24 }, { x: 3, z: -28 }, { x: 4, z: -38 }, { x: 3.5, z: -39.5 },
];

/** Distance d'un point à un segment, au sol. */
export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/** Vrai si le point est sur le tracé du parcours ou dans la lice (pas d'arbres ni de rochers). */
export function onCourse(x, z, margin = 4.5) {
  let prev = { x: 0, z: -18 };
  for (const g of GATES) {
    if (distToSegment(x, z, prev.x, prev.z, g.x, g.z) < margin) return true;
    prev = g;
  }
  if (distToSegment(x, z, prev.x, prev.z, LISTS.x, LISTS.z1) < margin) return true;
  if (onRoad(x, z, margin)) return true;
  if (Math.hypot(x - CROSS.x, z - CROSS.z) < 9 || Math.hypot(x - HIDE.x, z - HIDE.z) < 4) return true;
  for (let i = 1; i < 4; i++) {
    const a = STEWARD_PATH[i - 1], b = STEWARD_PATH[i];
    if (distToSegment(x, z, a.x, a.z, b.x, b.z) < 3) return true;
  }
  if (Math.hypot(x - AMBUSH.x, z - AMBUSH.z) < AMBUSH.r + 2) return true;
  return Math.abs(x - LISTS.x) < LISTS.halfWidth + 6 && z > LISTS.z0 - 5 && z < LISTS.z1 + 8;
}

/** Vrai si le point est sur la route forestière. */
export function onRoad(x, z, margin = 2) {
  for (let i = 1; i < ROAD.length; i++) {
    if (distToSegment(x, z, ROAD[i - 1].x, ROAD[i - 1].z, ROAD[i].x, ROAD[i].z) < margin) return true;
  }
  return false;
}
