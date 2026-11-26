// Chapitre V : la Pentecôte. Départ avec Sire Godefroy et Bertrand, piège du Borgne,
// cour du comte et adoubement.
import * as THREE from 'three';
import { Tex } from './textures.js?v=202611261414';
import { ROAD2, AMBUSH2, onRoad2 } from './layout.js?v=202611261414';
import { Horse } from './horse.js?v=202611261414';
import { makeNPC } from './npcs.js?v=202611261414';
import { createHumanoid, createSword, createAxe, createClub, animateWalk } from './humanoid.js?v=202611261414';
import { Fighter, DIRS } from './combat.js?v=202611261414';
import { ROOMS } from './interiors.js?v=202611261414';
import { playBlock, playVictory } from './audio.js?v=202611261414';

const rand = (a, b) => a + Math.random() * (b - a);
const GATE_WAIT = { lord: { x: -1.6, z: -11, rot: Math.PI / 2 }, bertrand: { x: 1.8, z: -11.5, rot: Math.PI / 2 } };

export function createChapter5(scene, world, { godefroy, bertrand, borgneH, oldLordHorse }) {
  // ---------- Route de l'est et clairière ----------
  const dirtT = Tex.dirt();
  const roadMat = new THREE.MeshStandardMaterial({
    map: dirtT.map, normalMap: dirtT.normalMap, roughness: 1,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  for (let i = 1; i < ROAD2.length; i++) {
    const a = ROAD2[i - 1], b = ROAD2[i];
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
    const geo = new THREE.CircleGeometry(AMBUSH2.r, 32).rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * AMBUSH2.r * 2, uv.getY(k) * AMBUSH2.r * 2);
    const m = new THREE.Mesh(geo, roadMat);
    m.position.set(AMBUSH2.x, 0.02, AMBUSH2.z);
    m.receiveShadow = true;
    scene.add(m);
  }
  world.addBareFn((x, z) => onRoad2(x, z, 1.9) || Math.hypot(x - AMBUSH2.x, z - AMBUSH2.z) < AMBUSH2.r - 1);

  // ---------- Chevaux ----------
  const lordHorse = new Horse(scene, world, { ...GATE_WAIT.lord, coat: 0xb8b2a8, blanket: 0x7a1a1a });
  const bertHorse = new Horse(scene, world, { ...GATE_WAIT.bertrand, coat: 0x2a2220, blanket: 0x3a3a3a });
  for (const h of [lordHorse, bertHorse]) { h.object.visible = false; h.circle.top = h.circle2.top = -99; }

  // ---------- Brigands du Borgne ----------
  const brigLooks = [
    { outfit: 'peasant', tunic: 0x3a3a2a, trousers: 0x2a2a28, hair: 0x2a1a10, beard: 0x2a1a10, hood: 0x2a2a1e },
    { outfit: 'gambeson', trousers: 0x3a3028, hair: 0x5a3a1a, beard: 0x5a3a1a },
    { outfit: 'peasant', tunic: 0x4a3a2a, trousers: 0x2a2a28, hair: 0x1a1410, hood: 0x3a2a1a },
    { outfit: 'gambeson', trousers: 0x2a2a28, hair: 0x3a2a1a, hood: 0x3a3a30 },
  ];
  const brigWeapons = [createAxe, createClub, createAxe, createClub];
  const brigands = brigLooks.map((look, i) => {
    const h = createHumanoid(look);
    const w = brigWeapons[i]();
    w.rotation.x = 0.45;
    h.handR.add(w);
    h.root.visible = false;
    scene.add(h.root);
    return { h, sword: w, name: i < 2 ? 'Homme du Borgne' : 'Brigand', hp: 50, speed: 1.3, damageMul: 0.65 };
  });
  const borgneSword = createSword(false);
  borgneSword.rotation.x = 0.45;

  // ---------- Cour du comte ----------
  const C = ROOMS.court.origin;
  const count = makeNPC(scene, world, {
    id: 'comte', name: 'Thibaut, comte de Champagne', x: C.x, z: C.z - 10.4, rotY: 0,
    look: { outfit: 'lord', tunic: 0x6a1a2a, trousers: 0x2a2a30, hair: 0x5a4030, beard: 0x5a4030, cloak: 0x22386e },
  });
  {
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd4a843, metalness: 1, roughness: 0.3 }));
    crown.position.y = 0.11;
    count.h.head.add(crown);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const pt = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 4), crown.material);
      pt.position.set(Math.cos(a) * 0.12, 0.15, Math.sin(a) * 0.12);
      count.h.head.add(pt);
    }
  }
  count.h.root.position.y = 0.6; // sur l'estrade
  const countSword = createSword(false);
  countSword.rotation.x = 0.45;
  countSword.visible = false;
  count.h.handR.add(countSword);
  count.lines = [['Sois preux, chevalier. Et que Dieu garde Montclair.']];
  const nobleLooks = [
    { outfit: 'lord', tunic: 0x2a5a2a, trousers: 0x2a2a28, hair: 0x2a1a10, cloak: 0x3a3a2a },
    { outfit: 'dress', tunic: 0x6a2a4a, hair: 0x8a5a2a },
    { outfit: 'lord', tunic: 0x22386e, trousers: 0x3a3028, hair: 0x8a8070, beard: 0x8a8070, cloak: 0x7a1a1a },
    { outfit: 'mail', trousers: 0x3a3028, helmet: true, coif: true, shield: true },
    { outfit: 'dress', tunic: 0x3a5a6a, hair: 0x2a1a10 },
    { outfit: 'lord', tunic: 0x7a5a2a, trousers: 0x2a2a30, hair: 0x4a3020, beard: 0x4a3020 },
  ];
  const nobleLines = [
    ['Un écuyer qui a capturé le Borgne ? On en parlera dans tout le comté.'],
    ['Quelle belle cérémonie… Mon fils sera adoubé l\'an prochain.'],
    ['Montclair a de la chance d\'avoir de tels hommes.'],
    ['Bienvenue parmi nous, chevalier.'],
    ['On dit que tu as démasqué un traître sous le toit de ton seigneur. Bravo.'],
    ['Le comte ne fait pas cet honneur à n\'importe qui.'],
  ];
  const nobles = nobleLooks.map((look, i) => {
    const side = i % 2 ? 1 : -1;
    const n = makeNPC(scene, world, {
      id: 'noble', name: i % 3 === 1 || i === 4 ? 'Une dame de la cour' : 'Un seigneur', x: C.x + side * 2.9, z: C.z - 4.5 + Math.floor(i / 2) * 4.2,
      rotY: -side * Math.PI / 2, look,
    });
    n.lines = [nobleLines[i]];
    return n;
  });

  // ---------- État ----------
  const S = { mode: 'idle', wp: 1, waited: false, started: false, kneeling: false, acc: 0, cheer: 0 };
  const seat = new THREE.Vector3();
  let sideFights = [];

  function mount(npc, horse) {
    npc.inCombat = true;
    npc.circle.top = -99;
    horse.object.visible = true;
    horse.setMounted(true);
  }
  function placeOn(npc, horse) {
    horse.parts.seat.getWorldPosition(seat);
    npc.h.root.position.set(seat.x, seat.y - 0.9, seat.z);
    npc.h.root.rotation.y = horse.heading;
    horse.poseRider(npc.h, false);
  }
  function resetPose(h) {
    for (const part of [h.legL, h.legR, h.armL, h.armR, h.spine]) part.rotation.set(0, 0, 0);
    h.kneeL.rotation.x = h.kneeR.rotation.x = 0;
    h.elbowR.rotation.x = -0.25;
    h.elbowL.rotation.x = -0.5;
    h.root.position.y = 0;
  }
  function dismount(npc, horse, spot) {
    horse.setMounted(false);
    const p = horse.position, hd = horse.heading;
    const x = spot ? spot.x : p.x + Math.cos(hd) * 1.4, z = spot ? spot.z : p.z - Math.sin(hd) * 1.4;
    resetPose(npc.h);
    npc.moveTo(x, z, spot ? spot.rot : hd);
    npc.circle.top = 99;
  }
  function steer(horse, target, dt, speedCap = 0.7) {
    const p = horse.position;
    const want = Math.atan2(target.x - p.x, target.z - p.z);
    const diff = Math.atan2(Math.sin(want - horse.heading), Math.cos(want - horse.heading));
    const d = Math.hypot(target.x - p.x, target.z - p.z);
    const throttle = d < 1.5 ? 0 : Math.abs(diff) > 0.8 ? 0.3 : speedCap;
    horse.update(dt, { throttle, turn: THREE.MathUtils.clamp(-diff * 2.2, -1, 1) });
    return d;
  }

  function sideFight(npcH, foe) {
    const sword = createSword(false);
    sword.rotation.x = 0.45;
    npcH.handR.add(sword);
    const f = {
      a: new Fighter(npcH, sword, { maxHp: 999 }), b: new Fighter(foe.h, foe.sword, { maxHp: 999, speed: 1.3 }),
      sword, npcH, foe, nextIn: rand(0.8, 1.6), turn: 0, fleeing: false, t: 0,
      fightT: 0, downAt: rand(15, 22), mode: 'duel', cool: 2, walk: 0, target: null,
    };
    f.a.active = f.b.active = true;
    return f;
  }

  function updateSideFights(dt, playerPos, events) {
    for (const f of sideFights) {
      const ap = f.npcH.root.position, bp = f.foe.h.root.position;
      // Au bout d'un moment, Godefroy et Bertrand battent leur adversaire… puis viennent t'aider
      if (f.mode === 'duel' && !f.fleeing) {
        f.fightT += dt;
        if (f.fightT > f.downAt) {
          f.mode = 'help';
          f.b.active = false;
          f.foe.h.root.rotation.x = -1.45;
          f.foe.h.root.position.y = 0.15;
          if (events.helperFree) events.helperFree(f.npcH === godefroy.h ? godefroy.name : bertrand.name);
        }
      }
      if (f.mode === 'help') {
        const targets = events.targets ? events.targets() : [];
        if (!f.target || !targets.includes(f.target)) f.target = targets[Math.floor(Math.random() * targets.length)] || null;
        let moving = 0;
        if (f.target) {
          const tp = f.target.obj.position;
          const dx = tp.x - ap.x, dz = tp.z - ap.z, d = Math.hypot(dx, dz);
          f.npcH.root.rotation.y = Math.atan2(dx, dz);
          if (d > 2.0) { ap.x += (dx / d) * 2.6 * dt; ap.z += (dz / d) * 2.6 * dt; moving = 1; }
          f.cool -= dt;
          if (d < 2.4 && f.cool < 0 && !f.a.busy) { f.a.tryAttack('light'); f.cool = rand(4, 6); }
          for (const ev of f.a.events) if (ev.type === 'impact' && events.assist) events.assist(f.target, f.npcH === godefroy.h ? godefroy.name : bertrand.name);
        }
        f.walk += dt * 7 * moving;
        animateWalk(f.npcH, f.walk, moving * 0.7, true);
        f.a.update(dt); f.a.applyPose(dt);
        continue;
      }
      if (f.fleeing) {
        const dx = bp.x - AMBUSH2.x, dz = bp.z - AMBUSH2.z, d = Math.hypot(dx, dz) || 1;
        bp.x += (dx / d) * 5 * dt;
        bp.z += (dz / d) * 5 * dt;
        f.foe.h.root.rotation.y = Math.atan2(dx, dz);
        f.t += dt;
        if (f.t > 3) f.foe.h.root.visible = false;
        f.b.active = false;
      } else {
        f.npcH.root.rotation.y = Math.atan2(bp.x - ap.x, bp.z - ap.z);
        f.foe.h.root.rotation.y = Math.atan2(ap.x - bp.x, ap.z - bp.z);
        f.nextIn -= dt;
        if (f.nextIn < 0) {
          f.turn++;
          const att = f.turn % 2 ? f.b : f.a;
          att.tryAttack(Math.random() < 0.7 ? 'light' : 'heavy');
          f.nextIn = rand(1.1, 2.0);
        }
        for (const [att, def] of [[f.a, f.b], [f.b, f.a]]) {
          for (const ev of att.events) if (ev.type === 'impact') {
            def.blockedHit();
            att.wasBlocked();
            if (Math.hypot(playerPos.x - ap.x, playerPos.z - ap.z) < 15) playBlock();
          }
        }
      }
      f.a.update(dt); f.a.applyPose(dt);
      f.b.update(dt); f.b.applyPose(dt);
    }
  }

  function setCourtVisible(on) {
    count.object.visible = on;
    for (const n of nobles) n.object.visible = on;
  }
  setCourtVisible(false);

  return {
    state: S, lordHorse, bertHorse, count, nobles,

    /** Remet chacun à sa place selon l'étape (chargement d'une partie). */
    placeForStep(step) {
      // L'ancien cheval de Godefroy (chapitre III) laisse la place à celui-ci
      if (step >= 25 && oldLordHorse) { oldLordHorse.object.visible = false; oldLordHorse.circle.top = oldLordHorse.circle2.top = -99; }
      if (step === 25 || step === 26) this.prepareDeparture();
      if (step === 27) setCourtVisible(true);
    },

    /** Étape 25 : Godefroy et Bertrand attendent à cheval devant la porte. */
    prepareDeparture() {
      if (oldLordHorse) { oldLordHorse.object.visible = false; oldLordHorse.circle.top = oldLordHorse.circle2.top = -99; }
      for (const [npc, horse, spot] of [[godefroy, lordHorse, GATE_WAIT.lord], [bertrand, bertHorse, GATE_WAIT.bertrand]]) {
        horse.position.set(spot.x, 0, spot.z);
        horse.object.rotation.y = spot.rot;
        mount(npc, horse);
        placeOn(npc, horse);
      }
      S.mode = 'waiting';
      S.wp = 1;
      S.started = false;
    },

    /** Le Borgne et ses hommes surgissent. Renvoie les adversaires du joueur. */
    springAmbush() {
      S.mode = 'ambush';
      dismount(godefroy, lordHorse);
      dismount(bertrand, bertHorse);
      godefroy.inCombat = bertrand.inCombat = true;
      const spawn = (a, r = AMBUSH2.r + 1.5) => ({ x: AMBUSH2.x + Math.cos(a) * r, z: AMBUSH2.z + Math.sin(a) * r });
      borgneH.root.visible = true;
      borgneH.root.rotation.set(0, 0, 0);
      if (!borgneSword.parent) borgneH.handR.add(borgneSword);
      const foes = [
        { name: 'Le Borgne', h: borgneH, sword: borgneSword, hp: 110, speed: 1.1, damageMul: 0.85, spawn: spawn(-1.2) },
        { ...brigands[0], spawn: spawn(-0.3) },
        { ...brigands[1], spawn: spawn(-2.1) },
      ];
      for (const f of foes) { f.h.root.visible = true; f.h.root.position.set(f.spawn.x, 0, f.spawn.z); }
      // Godefroy et Bertrand affrontent chacun un brigand, un peu à l'écart
      const gp = godefroy.object.position, bp = bertrand.object.position;
      brigands[2].h.root.visible = true;
      brigands[2].h.root.position.set(gp.x + 1.9, 0, gp.z + 0.8);
      brigands[3].h.root.visible = true;
      brigands[3].h.root.position.set(bp.x + 1.9, 0, bp.z + 0.8);
      sideFights = [sideFight(godefroy.h, brigands[2]), sideFight(bertrand.h, brigands[3])];
      return foes;
    },

    /** Après la victoire : les derniers brigands s'enfuient. */
    endAmbush() {
      for (const f of sideFights) if (f.mode === 'duel') f.fleeing = true;
      setTimeout(() => {
        for (const f of sideFights) { f.npcH.handR.remove(f.sword); resetPose(f.npcH); }
        sideFights = [];
      }, 3200);
    },

    /** La cour du comte : chacun prend sa place. */
    enterCourt() {
      S.mode = 'court';
      setCourtVisible(true);
      for (const b of brigands) b.h.root.visible = false;
      borgneH.root.visible = false;
      lordHorse.object.visible = bertHorse.object.visible = false;
      lordHorse.circle.top = lordHorse.circle2.top = bertHorse.circle.top = bertHorse.circle2.top = -99;
      godefroy.inCombat = bertrand.inCombat = false;
      resetPose(godefroy.h); resetPose(bertrand.h);
      godefroy.moveTo(C.x - 2.0, C.z - 8.4, Math.PI / 2);
      bertrand.moveTo(C.x + 2.0, C.z - 8.4, -Math.PI / 2);
      count.h.root.position.set(C.x, 0.6, C.z - 10.4);
      count.h.root.rotation.y = 0;
      S.kneeling = false;
      S.acc = 0;
    },

    nearKneel(pos) {
      const k = ROOMS.court.kneel;
      return S.mode === 'court' && !S.kneeling && Math.hypot(pos.x - k.x, pos.z - k.z) < 1.6;
    },

    /** Le joueur s'agenouille devant le comte. */
    kneel(player) {
      const k = ROOMS.court.kneel;
      S.kneeling = true;
      player.position.set(k.x, 0, k.z);
      player.object.rotation.y = Math.PI; // face au trône
      player.sword.visible = false;
    },

    /** Le comte frappe l'épaule du nouveau chevalier du plat de son épée. */
    accolade() { S.mode = 'accolade'; S.acc = 0; S.accDone = false; countSword.visible = true; count.inCombat = true; },

    rise(player) {
      S.kneeling = false;
      S.mode = 'knighted';
      countSword.visible = false;
      count.inCombat = false;
      player.sword.visible = true;
      resetPose(player.h);
      S.cheer = 4;
      for (const n of nobles) n.inCombat = true;
      playVictory();
    },

    /** Retour à Montclair après la cérémonie. */
    goHome() {
      S.mode = 'idle';
      setCourtVisible(false);
    },

    update(dt, player, events) {
      const P = player.position;
      if (S.mode === 'waiting' || S.mode === 'riding') {
        // Les deux cavaliers partent quand le joueur est en selle, près d'eux
        const near = Math.hypot(P.x - lordHorse.position.x, P.z - lordHorse.position.z);
        if (S.mode === 'waiting') {
          lordHorse.update(dt, { throttle: 0 });
          bertHorse.update(dt, { throttle: 0 });
          if (player.mounted && near < 12) { S.mode = 'riding'; events.depart && events.depart(); }
        } else {
          const waiting = near > 22;
          const target = ROAD2[Math.min(S.wp, ROAD2.length - 1)];
          if (waiting) {
            lordHorse.update(dt, { throttle: 0 });
            if (!S.waited) { S.waited = true; events.wait && events.wait(); }
          } else {
            S.waited = false;
            const d = steer(lordHorse, target, dt, near < 10 ? 0.75 : 0.6);
            if (d < 2.5 && S.wp < ROAD2.length - 1) S.wp++;
          }
          // Bertrand suit derrière Godefroy
          const h = lordHorse.heading;
          const follow = { x: lordHorse.position.x - Math.sin(h) * 4 + Math.cos(h) * 1.8, z: lordHorse.position.z - Math.cos(h) * 4 - Math.sin(h) * 1.8 };
          const fd = Math.hypot(follow.x - bertHorse.position.x, follow.z - bertHorse.position.z);
          steer(bertHorse, follow, dt, fd > 6 ? 0.9 : fd > 2 ? 0.6 : 0);
          // Arrivée à la clairière : le piège
          if (Math.hypot(lordHorse.position.x - AMBUSH2.x, lordHorse.position.z - AMBUSH2.z) < 5 && Math.hypot(P.x - AMBUSH2.x, P.z - AMBUSH2.z) < 26) {
            S.mode = 'stopping';
            events.ambush && events.ambush();
          }
        }
        placeOn(godefroy, lordHorse);
        placeOn(bertrand, bertHorse);
      } else {
        if (lordHorse.object.visible) lordHorse.update(dt);
        if (bertHorse.object.visible) bertHorse.update(dt);
      }
      if (sideFights.length) updateSideFights(dt, P, events);

      // Cérémonie
      if (S.kneeling) {
        const h = player.h;
        h.root.position.y = -0.45;
        h.legL.rotation.set(-1.45, 0, 0); h.kneeL.rotation.x = 1.5;
        h.legR.rotation.set(0.05, 0, 0); h.kneeR.rotation.x = 1.55;
        h.spine.rotation.set(0.35, 0, 0);
        h.armL.rotation.set(0, 0, 0); h.armR.rotation.set(0, 0, 0);
      }
      if (S.mode === 'accolade') {
        S.acc += dt;
        const k = ROOMS.court.kneel;
        const cp = count.h.root.position;
        // Le comte descend vers le chevalier, lève l'épée, touche l'épaule droite puis la gauche
        const toward = Math.min(1, S.acc / 1.2);
        cp.set(C.x + 0.25 * toward, 0.6 * (1 - toward), C.z - 10.4 + (k.z - 1.25 - (C.z - 10.4)) * toward);
        count.h.root.rotation.y = 0; // face au chevalier agenouillé
        const t = S.acc - 1.2;
        const a = count.h.armR;
        if (t < 0) a.rotation.x = -0.3;
        else if (t < 0.8) a.rotation.x = -0.3 - t * 3;
        else if (t < 1.4) { a.rotation.x = -1.4; a.rotation.z = 0.5; }
        else if (t < 2.0) { a.rotation.x = -2.6; a.rotation.z = 0; }
        else if (t < 2.6) { a.rotation.x = -1.4; a.rotation.z = -0.4; }
        else { a.rotation.x = -0.4; a.rotation.z = 0; if (!S.accDone) { S.accDone = true; events.accoladeDone && events.accoladeDone(); } }
      }
      if (S.cheer > 0) {
        S.cheer -= dt;
        const k = Math.abs(Math.sin(S.cheer * 7));
        for (const n of nobles) { n.h.armR.rotation.x = -2.5 - k * 0.4; n.h.armL.rotation.x = -2.5 - k * 0.4; }
        if (S.cheer <= 0) for (const n of nobles) { n.h.armR.rotation.x = 0; n.h.armL.rotation.x = 0; n.inCombat = false; }
      }
    },
  };
}
