// Chapitre IV : le traître. Croix de pierre, rencontre nocturne, filature, affrontement.
import * as THREE from 'three';
import { Tex, metricBoxUV } from './textures.js?v=202611261148';
import { CROSS, HIDE, BORGNE_FROM, STEWARD_PATH } from './layout.js?v=202611261148';
import { makeNPC } from './npcs.js?v=202611261148';
import { createHumanoid, animateWalk, createSword } from './humanoid.js?v=202611261148';

const rand = (a, b) => a + Math.random() * (b - a);
const STEWARD_HOME = { x: 6.5, z: -39, rot: -Math.PI / 2 };
const SEE_DIST = 13;      // distance à laquelle l'intendant te repère quand il se retourne
const TOO_CLOSE = 3.5;    // trop près : il t'entend
const LOST_DIST = 34;     // trop loin : tu le perds de vue

function walkTo(h, target, speed, dt, state) {
  const p = h.root.position;
  const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
  if (d < 0.15) { animateWalk(h, state.phase, 0); return true; }
  const step = Math.min(d, speed * dt);
  p.x += (dx / d) * step;
  p.z += (dz / d) * step;
  const want = Math.atan2(dx, dz);
  h.root.rotation.y += Math.atan2(Math.sin(want - h.root.rotation.y), Math.cos(want - h.root.rotation.y)) * Math.min(1, dt * 6);
  state.phase += dt * 7.5 * (speed / 1.5);
  animateWalk(h, state.phase, 0.6);
  return false;
}

function faceTowards(h, target, dt, rate = 5) {
  const p = h.root.position;
  const want = Math.atan2(target.x - p.x, target.z - p.z);
  h.root.rotation.y += Math.atan2(Math.sin(want - h.root.rotation.y), Math.cos(want - h.root.rotation.y)) * Math.min(1, dt * rate);
}

export function createChapter4(scene, world) {
  // ---------- La vieille croix de pierre et les buissons ----------
  const stoneT = Tex.stone();
  const stone = new THREE.MeshStandardMaterial({ color: 0x8a847a, map: stoneT.map, normalMap: stoneT.normalMap, roughness: 0.95 });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  add(metricBoxUV(new THREE.BoxGeometry(1.6, 0.35, 1.6), 1.6, 0.35, 1.6), stone, CROSS.x, 0.17, CROSS.z);
  add(metricBoxUV(new THREE.BoxGeometry(1.0, 0.3, 1.0), 1.0, 0.3, 1.0), stone, CROSS.x, 0.5, CROSS.z);
  add(metricBoxUV(new THREE.BoxGeometry(0.28, 2.4, 0.28), 0.28, 2.4, 0.28), stone, CROSS.x, 1.85, CROSS.z);
  add(metricBoxUV(new THREE.BoxGeometry(1.1, 0.26, 0.26), 1.1, 0.26, 0.26), stone, CROSS.x, 2.55, CROSS.z);
  world.circles.push({ x: CROSS.x, z: CROSS.z, r: 0.9, top: 99 });
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x2e4a22, roughness: 1, flatShading: true });
  const bushGeo = new THREE.IcosahedronGeometry(1, 1);
  for (const [dx, dz, s] of [[-1.3, -0.6, 1.0], [1.2, -0.9, 0.9], [-0.2, 1.3, 1.1], [1.4, 0.9, 0.8], [-1.5, 0.9, 0.85]]) {
    const b = add(bushGeo, bushMat, HIDE.x + dx, 0.55 * s, HIDE.z + dz);
    b.scale.set(s * 1.1, s * 0.85, s);
    b.rotation.set(Math.random(), Math.random() * 3, 0);
  }
  world.addBare({ minX: CROSS.x - 2, maxX: CROSS.x + 2, minZ: CROSS.z - 2, maxZ: CROSS.z + 2 });

  // ---------- Personnages ----------
  const aymeric = makeNPC(scene, world, {
    id: 'aymeric', name: 'Aymeric, l\'intendant', ...STEWARD_HOME, rotY: STEWARD_HOME.rot,
    look: { outfit: 'lord', tunic: 0x2f4a2a, trousers: 0x2a2a28, hair: 0x1a1410, cloak: 0x4a3a2a },
  });
  const anselme = makeNPC(scene, world, {
    id: 'anselme', name: 'Père Anselme', x: -18.4, z: -5.2, rotY: Math.PI,
    look: { outfit: 'lord', tunic: 0x3a2a1e, trousers: 0x3a2a1e, hair: 0x8a8070, hood: 0x3a2a1e },
  });
  // Le Borgne, chef des brigands qui s'était enfui
  const borgneH = createHumanoid({ outfit: 'peasant', tunic: 0x3a3a30, trousers: 0x2a2a28, hair: 0x2a1a10, beard: 0x2a1a10, hood: 0x2a2a22 });
  borgneH.root.visible = false;
  scene.add(borgneH.root);
  // Bandeau sur l'œil
  {
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    patch.position.set(0.04, 0.02, 0.105);
    borgneH.head.add(patch);
  }

  // Lanterne de l'intendant
  const lantern = new THREE.Group();
  {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.12), new THREE.MeshStandardMaterial({ color: 0x2a2620, metalness: 0.6, roughness: 0.5, wireframe: false }));
    lantern.add(frame);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.09), new THREE.MeshStandardMaterial({ color: 0x331a00, emissive: 0xffa040, emissiveIntensity: 3 }));
    lantern.add(glow);
    const light = new THREE.PointLight(0xffa050, 0, 9, 2);
    lantern.add(light);
    lantern.userData.light = light;
    lantern.position.set(0, -0.12, 0.05);
    lantern.visible = false;
    aymeric.h.handL.add(lantern);
  }

  // ---------- Scène et filature ----------
  const S = {
    mode: 'idle', // idle | meeting | talk | follow | done
    walkA: { phase: 0 }, walkB: { phase: 0 },
    wp: 1, lookIn: 8, lookT: 0, looking: false, warn: 0, meter: 0, wait: 0,
  };
  const playerPos = new THREE.Vector3();

  function setLantern(on) {
    lantern.visible = on;
    lantern.userData.light.intensity = on ? 3.5 : 0;
    aymeric.h.armL.rotation.x = on ? -0.4 : 0;
    aymeric.h.elbowL.rotation.x = on ? -0.9 : -0.5;
  }

  function resetPose(h) {
    for (const part of [h.legL, h.legR, h.armR, h.spine]) part.rotation.set(0, 0, 0);
    h.kneeL.rotation.x = h.kneeR.rotation.x = 0;
  }

  const api = {
    aymeric, anselme, borgneH, state: S,

    /** Place les personnages selon l'étape (au chargement d'une partie). */
    placeForStep(step) {
      S.mode = 'idle';
      setLantern(false);
      borgneH.root.visible = false;
      aymeric.inCombat = false;
      aymeric.object.visible = true;
      aymeric.object.rotation.x = 0;
      aymeric.object.position.y = 0;
      aymeric.moveTo(STEWARD_HOME.x, STEWARD_HOME.z, STEWARD_HOME.rot);
      aymeric.circle.top = 99;
      if (step === 23) aymeric.moveTo(STEWARD_PATH[STEWARD_PATH.length - 1].x, STEWARD_PATH[STEWARD_PATH.length - 1].z, Math.PI);
      if (step >= 24) {
        // Arrêté : il n'est plus là
        aymeric.object.visible = false;
        aymeric.inCombat = true;
        aymeric.circle.top = -99;
      }
    },

    /** Le joueur est caché : l'intendant et le Borgne arrivent à la croix. */
    startMeeting() {
      S.mode = 'meeting';
      aymeric.inCombat = true;
      aymeric.circle.top = -99;
      aymeric.object.visible = true;
      aymeric.object.position.set(STEWARD_PATH[2].x, 0, STEWARD_PATH[2].z);
      setLantern(true);
      borgneH.root.visible = true;
      borgneH.root.position.set(BORGNE_FROM.x, 0, BORGNE_FROM.z);
      S.wp = 1;
    },

    /** Recommencer la filature depuis la croix (après avoir été repéré). */
    restartFollow() {
      aymeric.object.position.set(CROSS.x + 1.2, 0, CROSS.z - 0.5);
      S.mode = 'follow';
      S.wp = 1;
      S.lookIn = rand(6, 9);
      S.looking = false;
      S.warn = 0;
      S.meter = 0;
      S.wait = 2.5;
    },

    beginFollow() {
      S.mode = 'follow';
      S.wp = 1;
      S.lookIn = rand(7, 10);
      S.looking = false;
      S.warn = 0;
      S.meter = 0;
      S.wait = 1.5;
      S.borgneLeaving = 0;
    },

    /** Donne une épée à l'intendant pour le combat final. */
    arm() {
      const sword = createSword(false);
      sword.rotation.x = 0.45;
      aymeric.h.handR.add(sword);
      setLantern(false);
      aymeric.inCombat = true;
      aymeric.circle.top = -99;
      return sword;
    },

    arrest() {
      aymeric.object.visible = false;
      aymeric.inCombat = true;
      aymeric.circle.top = -99;
    },

    update(dt, player, events) {
      playerPos.copy(player.position);
      const A = aymeric.h, ap = A.root.position;
      const d = Math.hypot(playerPos.x - ap.x, playerPos.z - ap.z);

      if (S.mode === 'meeting') {
        // L'intendant remonte le chemin jusqu'à la croix ; le Borgne sort de la forêt
        const aDone = walkTo(A, { x: CROSS.x + 1.2, z: CROSS.z - 0.5 }, 1.6, dt, S.walkA);
        const bDone = walkTo(borgneH, { x: CROSS.x - 1.0, z: CROSS.z + 0.2 }, 1.8, dt, S.walkB);
        // Le joueur doit rester caché
        const hd = Math.hypot(playerPos.x - HIDE.x, playerPos.z - HIDE.z);
        if (hd > 4 || d < 7) { events.spotted && events.spotted('meeting'); return; }
        if (aDone && bDone) {
          faceTowards(A, borgneH.root.position, dt);
          faceTowards(borgneH, A.root.position, dt);
          S.mode = 'talk';
          events.meeting && events.meeting();
        }
      } else if (S.mode === 'talk') {
        faceTowards(A, borgneH.root.position, dt);
        faceTowards(borgneH, A.root.position, dt);
      } else if (S.mode === 'follow') {
        // Le Borgne repart dans la forêt
        if (borgneH.root.visible) {
          S.borgneLeaving = (S.borgneLeaving || 0) + dt;
          walkTo(borgneH, BORGNE_FROM, 2.0, dt, S.walkB);
          if (S.borgneLeaving > 12) borgneH.root.visible = false;
        }
        if (S.wait > 0) { S.wait -= dt; animateWalk(A, S.walkA.phase, 0); return; }
        const target = STEWARD_PATH[S.wp];
        if (S.looking) {
          // Il s'est retourné : est-ce qu'il voit le joueur ?
          S.lookT -= dt;
          faceTowards(A, playerPos, dt, 3);
          animateWalk(A, S.walkA.phase, 0);
          const see = SEE_DIST + (player.mounted ? 6 : 0);
          if (d < see) S.meter += dt * (0.7 + 1.8 * (1 - d / see));
          if (S.lookT <= 0) { S.looking = false; S.lookIn = rand(6, 10); }
        } else if (S.warn > 0) {
          // Il ralentit avant de se retourner : il faut se cacher !
          S.warn -= dt;
          animateWalk(A, S.walkA.phase, 0);
          if (S.warn <= 0) { S.looking = true; S.lookT = 2.6; }
        } else {
          const arrived = walkTo(A, target, 1.5, dt, S.walkA);
          if (arrived) {
            if (S.wp >= STEWARD_PATH.length - 1) { S.mode = 'done'; events.reached && events.reached(); return; }
            S.wp++;
          }
          S.lookIn -= dt;
          if (S.lookIn <= 0 && S.wp < STEWARD_PATH.length - 2) S.warn = 1.0;
          S.meter = Math.max(0, S.meter - dt * 0.25);
        }
        if (d < TOO_CLOSE) S.meter = 1;
        if (S.meter >= 1) { events.spotted && events.spotted('follow'); return; }
        if (d > LOST_DIST) { events.lost && events.lost(); }
      }
    },

    /** Infos pour l'interface de discrétion. */
    stealthInfo() {
      return { active: S.mode === 'follow', meter: S.meter, warn: S.warn > 0, looking: S.looking };
    },
  };
  api.placeForStep(0);
  return api;
}
