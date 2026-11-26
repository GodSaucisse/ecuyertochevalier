// Chapitre III : la route de l'abbaye, l'escorte de Sire Godefroy et l'embuscade.
import * as THREE from 'three';
import { Tex } from './textures.js?v=202611261148';
import { ROAD, AMBUSH, onRoad } from './layout.js?v=202611261148';
import { Horse } from './horse.js?v=202611261148';
import { createHumanoid, createSword, createAxe, createClub } from './humanoid.js?v=202611261148';
import { Fighter, DIRS } from './combat.js?v=202611261148';
import { playBlock } from './audio.js?v=202611261148';

const rand = (a, b) => a + Math.random() * (b - a);
const COURT_SPOT = { x: 0, z: -31, rot: 0 };
const GODEFROY_HORSE_START = { x: -4, z: -28, rot: Math.PI };

export function createChapter3(scene, world) {
  // ---------- Route et clairière ----------
  const dirtT = Tex.dirt();
  const roadMat = new THREE.MeshStandardMaterial({
    map: dirtT.map, normalMap: dirtT.normalMap, roughness: 1,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  for (let i = 1; i < ROAD.length; i++) {
    const a = ROAD[i - 1], b = ROAD[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z) + 3;
    const geo = new THREE.PlaneGeometry(3.4, len).rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 3.4, uv.getY(k) * len);
    const m = new THREE.Mesh(geo, roadMat);
    m.position.set((a.x + b.x) / 2, 0.021, (a.z + b.z) / 2);
    m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    m.receiveShadow = true;
    scene.add(m);
  }
  {
    const geo = new THREE.CircleGeometry(AMBUSH.r, 32).rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * AMBUSH.r * 2, uv.getY(k) * AMBUSH.r * 2);
    const m = new THREE.Mesh(geo, roadMat);
    m.position.set(AMBUSH.x, 0.02, AMBUSH.z);
    m.receiveShadow = true;
    scene.add(m);
  }
  world.addBareFn((x, z) => onRoad(x, z, 1.9) || Math.hypot(x - AMBUSH.x, z - AMBUSH.z) < AMBUSH.r - 1);

  // Arbre abattu en travers de la route : le piège des brigands
  {
    const barkT = Tex.timber();
    const bark = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, map: barkT.map, normalMap: barkT.normalMap });
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 9, 10).rotateZ(Math.PI / 2), bark);
    log.position.set(AMBUSH.x - 3, 0.4, AMBUSH.z - 6);
    log.rotation.y = -0.65;
    log.castShadow = log.receiveShadow = true;
    scene.add(log);
    for (let k = -3; k <= 3; k++) {
      world.circles.push({ x: log.position.x + Math.cos(-log.rotation.y) * k * 1.3, z: log.position.z + Math.sin(-log.rotation.y) * k * 1.3, r: 0.5, top: 99 });
    }
    // Restes d'un feu de camp
    const stones = new THREE.MeshStandardMaterial({ color: 0x6a645a });
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), stones);
      st.position.set(AMBUSH.x + 5 + Math.cos(a) * 0.55, 0.08, AMBUSH.z + 2 + Math.sin(a) * 0.55);
      st.castShadow = true;
      scene.add(st);
    }
    const ash = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a2622 }));
    ash.position.set(AMBUSH.x + 5, 0.03, AMBUSH.z + 2);
    scene.add(ash);
  }

  // ---------- Cheval de Sire Godefroy ----------
  const lordHorse = new Horse(scene, world, { ...GODEFROY_HORSE_START, coat: 0xb8b2a8, blanket: 0x7a1a1a });

  // ---------- Brigands ----------
  const looks = [
    { outfit: 'peasant', tunic: 0x4a4434, trousers: 0x3a3028, hair: 0x2a1a10, beard: 0x2a1a10, hood: 0x3a3a2a },
    { outfit: 'gambeson', trousers: 0x3a3a3a, hair: 0x6a4a2a, beard: 0x5a3a1a },
    { outfit: 'peasant', tunic: 0x5a3a2a, trousers: 0x2a2a28, hair: 0x1a1410, hood: 0x2a3020 },
    { outfit: 'peasant', tunic: 0x3a3a30, trousers: 0x3a3028, hair: 0x4a3020, beard: 0x4a3020, hood: 0x4a3a2a },
  ];
  const weapons = [createAxe, createClub, () => createSword(false), createAxe];
  const names = ['Brigand à la hache', 'Brigand au gourdin', 'Chef des brigands', 'Brigand'];
  const brigands = looks.map((look, i) => {
    const h = createHumanoid(look);
    const weapon = weapons[i]();
    weapon.rotation.x = 0.45;
    h.handR.add(weapon);
    h.root.visible = false;
    scene.add(h.root);
    return { h, sword: weapon, name: names[i], hp: i === 2 ? 80 : 60, speed: i === 2 ? 1.1 : 1.3, damageMul: i === 2 ? 0.85 : 0.7 };
  });
  // Positions d'apparition : à la lisière de la clairière
  const spawnAt = (a, r = AMBUSH.r + 1.5) => ({ x: AMBUSH.x + Math.cos(a) * r, z: AMBUSH.z + Math.sin(a) * r });
  brigands[0].spawn = spawnAt(-0.4);
  brigands[1].spawn = spawnAt(1.4);
  brigands[2].spawn = spawnAt(3.6);
  brigands[3].spawn = spawnAt(2.4);

  // ---------- Escorte ----------
  const state = {
    mode: 'idle', // idle | riding | ambush | fight | returning | home
    wp: 1,
    waitedToast: false,
  };
  let npc = null; // Sire Godefroy (PNJ), branché par setLord
  const seat = new THREE.Vector3();
  let sideFight = null;

  function mountLord() {
    npc.inCombat = true; // désactive son comportement habituel
    npc.circle.top = -99;
    lordHorse.setMounted(true);
  }

  function dismountLord(spot) {
    lordHorse.setMounted(false);
    const p = lordHorse.position, h = lordHorse.heading;
    const x = spot ? spot.x : p.x + Math.cos(h) * 1.4;
    const z = spot ? spot.z : p.z - Math.sin(h) * 1.4;
    npc.moveTo(x, z, spot ? spot.rot : h);
    const b = npc.h;
    for (const part of [b.legL, b.legR, b.armL, b.armR, b.spine]) part.rotation.set(0, 0, 0);
    b.kneeL.rotation.x = b.kneeR.rotation.x = 0;
    b.root.position.y = 0;
    npc.circle.top = 99;
  }

  /** Le cheval de Godefroy suit la route dans un sens ou dans l'autre. */
  function steer(dt, player, forward) {
    const pts = forward ? ROAD : ROAD.slice().reverse();
    const target = pts[Math.min(state.wp, pts.length - 1)];
    const p = lordHorse.position;
    const d = Math.hypot(target.x - p.x, target.z - p.z);
    if (d < 2.5 && state.wp < pts.length - 1) state.wp++;
    const last = state.wp >= pts.length - 1 && d < 3;
    const playerDist = Math.hypot(player.x - p.x, player.z - p.z);
    const waiting = playerDist > 22;
    let throttle = 0, turn = 0;
    if (!last && !waiting) {
      const want = Math.atan2(target.x - p.x, target.z - p.z);
      const diff = Math.atan2(Math.sin(want - lordHorse.heading), Math.cos(want - lordHorse.heading));
      turn = THREE.MathUtils.clamp(-diff * 2.2, -1, 1);
      throttle = Math.abs(diff) > 0.8 ? 0.3 : (playerDist < 10 ? 0.75 : 0.6);
    }
    lordHorse.update(dt, { throttle, turn, gallop: false });
    return { arrived: last && Math.abs(lordHorse.speed) < 0.5, waiting };
  }

  function clearSideFight() {
    if (!sideFight) return;
    npc.h.handR.remove(sideFight.sword);
    sideFight = null;
    brigands[3].h.root.visible = false;
    const b = npc.h;
    for (const part of [b.armL, b.armR, b.spine]) part.rotation.set(0, 0, 0);
    b.elbowR.rotation.x = -0.25;
    b.elbowL.rotation.x = -0.5;
    if (!lordHorse.mounted) npc.inCombat = false;
  }

  function placeLordOnHorse() {
    lordHorse.parts.seat.getWorldPosition(seat);
    npc.h.root.position.set(seat.x, seat.y - 0.9, seat.z);
    npc.h.root.rotation.y = lordHorse.heading;
    lordHorse.poseRider(npc.h, false);
  }

  return {
    lordHorse, brigands, state,
    setLord(n) { npc = n; },

    /** Prépare l'escorte (étape 13) : Godefroy en selle dans la cour. */
    beginEscort() {
      lordHorse.position.set(GODEFROY_HORSE_START.x, 0, GODEFROY_HORSE_START.z);
      lordHorse.object.rotation.y = GODEFROY_HORSE_START.rot;
      mountLord();
      state.mode = 'riding';
      state.wp = 1;
      state.started = false;
      for (const b of brigands) { b.h.root.visible = false; b.h.root.rotation.set(0, 0, 0); b.h.root.position.y = 0; }
    },

    /** Retour (étape 16) : Godefroy remonte en selle à la clairière. */
    beginReturn() {
      clearSideFight();
      if (state.mode !== 'fightDone') {
        lordHorse.position.set(AMBUSH.x + 2, 0, AMBUSH.z + 2);
        lordHorse.object.rotation.y = 0.6;
      }
      mountLord();
      state.mode = 'returning';
      state.wp = 1;
    },

    /** Après l'embuscade, Godefroy reste à pied dans la clairière. */
    placeAfterFight() {
      lordHorse.position.set(AMBUSH.x + 2, 0, AMBUSH.z + 2);
      lordHorse.object.rotation.y = 0.6;
      lordHorse.setMounted(false);
      dismountLord({ x: AMBUSH.x + 0.5, z: AMBUSH.z + 3, rot: Math.PI });
      npc.inCombat = false;
      state.mode = 'fightDone';
    },

    /** Godefroy chez lui, dans la cour (début et fin du chapitre). */
    placeHome() {
      lordHorse.setMounted(false);
      lordHorse.position.set(-4, 0, -36);
      lordHorse.object.rotation.y = Math.PI / 2;
      lordHorse.syncColliders();
      if (npc) { npc.inCombat = false; npc.moveTo(COURT_SPOT.x, COURT_SPOT.z, COURT_SPOT.rot); npc.circle.top = 99; }
      state.mode = 'idle';
    },

    /** Prépare l'embuscade : brigands visibles, Godefroy à pied face au sien. */
    springAmbush(playerPos) {
      state.mode = 'ambush';
      dismountLord();
      npc.inCombat = true;
      for (const b of brigands) { b.h.root.visible = true; b.h.root.position.set(b.spawn.x, 0, b.spawn.z); }
      // Godefroy affronte le 4e brigand à l'écart
      const lb = brigands[3];
      const lordSword = createSword(false);
      lordSword.rotation.x = 0.45;
      npc.h.handR.add(lordSword);
      sideFight = {
        lord: new Fighter(npc.h, lordSword, { maxHp: 999 }),
        foe: new Fighter(lb.h, lb.sword, { maxHp: 999, speed: 1.3 }),
        sword: lordSword, nextIn: 1.5, t: 0, turn: 0,
      };
      sideFight.lord.active = sideFight.foe.active = true;
      const gp = npc.h.root.position;
      lb.h.root.position.set(gp.x + 2.0, 0, gp.z - 0.6);
      return brigands.slice(0, 3);
    },

    /** Fin du combat : le brigand de Godefroy s'enfuit. */
    endSideFight(win) {
      if (!sideFight) return;
      const lb = brigands[3];
      if (win) {
        sideFight.fleeing = true;
      } else {
        lb.h.root.position.set(npc.h.root.position.x + 2.0, 0, npc.h.root.position.z - 0.6);
      }
    },

    clearSideFight,

    hideBrigands() {
      for (const b of brigands) b.h.root.visible = false;
    },

    update(dt, player, events) {
      if (!npc) return;
      if (state.mode === 'riding') {
        const r = steer(dt, player, true);
        placeLordOnHorse();
        if (r.waiting && !state.waitedToast && state.started) { state.waitedToast = true; events.wait && events.wait(); }
        if (!r.waiting) state.waitedToast = false;
        if (Math.abs(lordHorse.speed) > 0.5) state.started = true;
        if (r.arrived || Math.hypot(lordHorse.position.x - AMBUSH.x, lordHorse.position.z - AMBUSH.z) < 4) {
          lordHorse.update(dt, { throttle: 0 });
          if (Math.abs(lordHorse.speed) < 0.6 && Math.hypot(player.x - AMBUSH.x, player.z - AMBUSH.z) < 22) {
            events.ambush && events.ambush();
          }
        }
      } else if (state.mode === 'returning') {
        const r = steer(dt, player, false);
        placeLordOnHorse();
        if (r.arrived) {
          dismountLord(COURT_SPOT);
          // Le cheval du seigneur retourne près du donjon
          lordHorse.position.set(-4, 0, -36);
          lordHorse.object.rotation.y = Math.PI / 2;
          lordHorse.syncColliders();
          npc.inCombat = false;
          state.mode = 'home';
          events.home && events.home();
        }
      } else {
        lordHorse.update(dt);
      }

      // Combat de Godefroy contre le 4e brigand (mis en scène)
      if (sideFight) {
        const s = sideFight, lb = brigands[3];
        const lp = npc.h.root.position, bp = lb.h.root.position;
        if (s.fleeing) {
          // Le brigand s'enfuit dans la forêt
          const ax = bp.x - AMBUSH.x, az = bp.z - AMBUSH.z, ad = Math.hypot(ax, az) || 1;
          bp.x += (ax / ad) * 5 * dt;
          bp.z += (az / ad) * 5 * dt;
          lb.h.root.rotation.y = Math.atan2(ax, az);
          s.t += dt;
          s.foe.active = false;
          if (s.t > 3) lb.h.root.visible = false;
        } else {
          npc.h.root.rotation.y = Math.atan2(bp.x - lp.x, bp.z - lp.z);
          lb.h.root.rotation.y = Math.atan2(lp.x - bp.x, lp.z - bp.z);
          s.nextIn -= dt;
          if (s.nextIn < 0) {
            s.turn++;
            const att = s.turn % 2 ? s.foe : s.lord, def = s.turn % 2 ? s.lord : s.foe;
            att.setGuard(DIRS[Math.floor(Math.random() * 3)]);
            att.tryAttack(Math.random() < 0.7 ? 'light' : 'heavy');
            def.setGuard(att.guard === 'L' ? 'R' : att.guard === 'R' ? 'L' : 'T');
            s.nextIn = rand(1.2, 2.2);
          }
          for (const [att, def] of [[s.lord, s.foe], [s.foe, s.lord]]) {
            for (const ev of att.events) if (ev.type === 'impact') { def.blockedHit(); att.wasBlocked(); if (Math.hypot(player.x - lp.x, player.z - lp.z) < 15) playBlock(); }
          }
        }
        s.lord.update(dt); s.lord.applyPose(dt);
        s.foe.update(dt); s.foe.applyPose(dt);
      }
    },
  };
}
