// Point d'entrée du jeu : assemble le monde, le joueur, les PNJ, la caméra et la boucle de jeu.
import * as THREE from 'three';
import { buildWorld } from './world.js?v=202611252021';
import { Player } from './player.js?v=202611252021';
import { Input } from './input.js?v=202611252021';
import { UI } from './ui.js?v=202611252021';
import { createNPCs } from './npcs.js?v=202611252021';
import { QuestManager } from './quests.js?v=202611252021';
import { initAudio, playHit, playSwing } from './audio.js?v=202611252021';
import { createEnvironment } from './sky.js?v=202611252021';
import { createPostFX } from './postfx.js?v=202611252021';
import { createGrass } from './grass.js?v=202611252021';
import { createParticles } from './particles.js?v=202611252021';
import { Duel } from './duel.js?v=202611252021';
import { loadSave, writeSave, clearSave } from './save.js?v=202611252021';

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
// Qualité graphique : "haute" sur ordinateur, allégée sur mobile. On peut forcer avec ?qualite=basse ou ?qualite=haute
const params = new URLSearchParams(location.search);
const HIGH = params.get('qualite') ? params.get('qualite') === 'haute' : !isTouch;

// ---------- Rendu ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, HIGH ? 1.5 : 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 600);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  fx.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Jeu ----------
const world = buildWorld(scene);
if (HIGH) world.sun.shadow.mapSize.set(4096, 4096);
scene.environment = createEnvironment(renderer, world.sunDir);
scene.environmentIntensity = 1.0;
const grass = createGrass(scene, world.isBare, { count: HIGH ? 120000 : 35000, radius: HIGH ? 75 : 55 });
const particles = createParticles(scene, { dust: HIGH ? 400 : 150, leaves: HIGH ? 90 : 40 });
const fx = createPostFX(renderer, scene, camera, { high: HIGH });
const ui = new UI(isTouch);
const input = new Input(renderer.domElement, isTouch);
const player = new Player(scene, world);
const npcs = createNPCs(scene, world);
const quests = new QuestManager({ ui, npcs, world });

// ---------- Duel ----------
const duel = new Duel({
  scene, camera, player, npc: npcs.bertrand, world, ui, isTouch,
  onWin: () => quests.onDuelWon(),
  onLose: (retry) => quests.onDuelLost(retry),
});
quests.onStartDuel = () => duel.start(0);
quests.duelRunning = () => duel.running;

// ---------- Sauvegarde ----------
let savedTimer = null;
function save(showIndicator = true) {
  const ok = writeSave({
    ...quests.serialize(),
    pos: [player.position.x, player.position.z],
    rot: player.object.rotation.y,
  });
  if (ok && showIndicator) {
    const el = document.getElementById('saved');
    el.classList.remove('hidden');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => el.classList.add('hidden'), 1800);
  }
}
quests.onChange = () => save(true);

// Losange doré au-dessus de l'objectif
const marker = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.22),
  new THREE.MeshStandardMaterial({ color: 0xe8c66a, emissive: 0x8a6a1a, roughness: 0.4, metalness: 0.5 }),
);
scene.add(marker);

// ---------- Caméra à la 3e personne ----------
const cam = { yaw: 0, pitch: 0.22, dist: 4.6 };
const camTarget = new THREE.Vector3().copy(player.position).add(new THREE.Vector3(0, 1.5, 0));

const shakeOffset = new THREE.Vector3();
function updateCamera(dt, look) {
  let lookAtBias = null;
  if (duel.running) {
    // Caméra de duel : derrière le joueur, l'adversaire dans le champ
    const e = npcs.bertrand.object.position, p = player.position;
    const wanted = Math.atan2(p.x - e.x, p.z - e.z);
    const diff = Math.atan2(Math.sin(wanted - cam.yaw), Math.cos(wanted - cam.yaw));
    cam.yaw += diff * Math.min(1, dt * 6);
    cam.pitch += (0.24 - cam.pitch) * Math.min(1, dt * 4);
    const portrait = camera.aspect < 1;
    cam.dist += ((portrait ? 5.6 : 4.1) - cam.dist) * Math.min(1, dt * 4);
    lookAtBias = e;
  } else {
    cam.yaw -= look.dx * 0.0025;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + look.dy * 0.0025, -0.25, 1.25);
    cam.dist = THREE.MathUtils.clamp(cam.dist + look.zoom * 0.005, 2.5, 12);
  }

  const desired = player.position.clone().add(new THREE.Vector3(0, 1.55, 0));
  if (lookAtBias) desired.lerp(new THREE.Vector3(lookAtBias.x, 1.4, lookAtBias.z), 0.3);
  camTarget.lerp(desired, 1 - Math.exp(-dt * 12));
  const cp = Math.cos(cam.pitch);
  // Caméra par-dessus l'épaule (le héros légèrement à gauche de l'écran, comme dans For Honor)
  const shoulder = (duel.running ? (camera.aspect < 1 ? 0.35 : 0.95) : 0.55) * Math.min(1, cam.dist / 4.6);
  const rx = Math.cos(cam.yaw) * shoulder, rz = -Math.sin(cam.yaw) * shoulder;
  camera.position.set(
    camTarget.x + Math.sin(cam.yaw) * cp * cam.dist + rx,
    camTarget.y + Math.sin(cam.pitch) * cam.dist,
    camTarget.z + Math.cos(cam.yaw) * cp * cam.dist + rz,
  );
  // Tremblement lors des chocs
  if (duel.shake > 0) {
    const k = duel.shake * 0.06;
    shakeOffset.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    camera.position.add(shakeOffset);
  }
  if (camera.position.y < 0.3) camera.position.y = 0.3;
  camera.lookAt(camTarget.x + rx, camTarget.y, camTarget.z + rz);
}

function targetPosition(t) {
  return t.object ? t.object.position : t.position;
}

// PNJ le plus proche à qui parler
function nearestNPC() {
  let best = null, bestD = 2.8;
  for (const n of npcs.list) {
    const d = n.object.position.distanceTo(player.position);
    if (d < bestD) { best = n; bestD = d; }
  }
  return best;
}

const tmpF = new THREE.Vector3();
function checkStrike() {
  if (!player.consumeStrike()) return;
  playSwing();
  const q = world.quintain;
  const dx = q.position.x - player.position.x, dz = q.position.z - player.position.z;
  const d = Math.hypot(dx, dz);
  if (d > 2.6) return;
  player.forward(tmpF);
  const facing = (tmpF.x * dx + tmpF.z * dz) / (d || 1);
  if (facing < 0.35) return;
  const side = Math.sign(tmpF.x * dz - tmpF.z * dx) || 1;
  q.hit(side);
  playHit();
  quests.onQuintainHit();
}

// ---------- Boucle principale ----------
let started = false;
let autoSaveIn = 8;
let time = 0;
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  const look = input.consumeLook();
  const dtGame = dt * (duel.running ? duel.timeScale : 1);

  if (started) {
    const actions = input.consumeActions();
    if (ui.dialogOpen) {
      if (actions.interact || actions.attack || actions.jump || actions.heavy) ui.advanceDialog();
    } else if (duel.running) {
      duel.handleActions(actions, input.move);
    } else {
      const near = nearestNPC();
      if (actions.interact && near) quests.talkTo(near);
      if (actions.attack) player.startAttack();
      if (actions.jump) player.jump();
    }

    const frozen = ui.dialogOpen && !duel.running;
    if (duel.running) {
      duel.guardFromLook(look.dx, look.dy);
      player.update(dtGame, ui.dialogOpen ? { x: 0, y: 0 } : input.move, false, cam.yaw, duel.lockTarget);
      duel.update(dtGame);
    } else {
      player.update(dt, frozen ? { x: 0, y: 0 } : input.move, input.run, cam.yaw);
      checkStrike();
    }

    // Invite "Parler"
    const near = ui.dialogOpen || duel.running ? null : nearestNPC();
    if (near) ui.setPrompt(`${isTouch ? '💬' : '[E]'} Parler à ${near.name}`);
    else ui.setPrompt(null);

    // Objectif : losange + boussole
    const target = quests.target;
    if (target) {
      const p = targetPosition(target);
      marker.visible = true;
      marker.position.set(p.x, target.markerHeight + Math.sin(time * 3) * 0.12, p.z);
      marker.rotation.y += dt * 2;
      const dx = p.x - player.position.x, dz = p.z - player.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 5) {
        const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
        const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
        ui.setCompass(Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz), dist);
      } else {
        ui.setCompass(null);
      }
    } else {
      marker.visible = false;
      ui.setCompass(null);
    }

    // Sauvegarde discrète de la position toutes les 8 secondes
    autoSaveIn -= dt;
    if (autoSaveIn < 0) {
      autoSaveIn = 8;
      if (!duel.running && !ui.dialogOpen) save(false);
    }
  }

  for (const n of npcs.list) if (!n.inCombat) n.update(dt, player.position);
  updateCamera(dt, look);
  world.update(dt, player.position, camera.position);
  grass.update(time);
  particles.update(dt, player.position);
  fx.render(time);
}
frame();

// ---------- Écran titre ----------
if (isTouch) {
  document.getElementById('controls-desktop').classList.add('hidden');
  document.getElementById('controls-touch').classList.remove('hidden');
}
function beginPlay(message) {
  initAudio();
  document.getElementById('intro').classList.add('hidden');
  ui.showHUD();
  if (isTouch) document.getElementById('touch').classList.remove('hidden');
  input.enabled = true;
  started = true;
  ui.toast(message, 3000);
}

const existing = loadSave();
if (existing) {
  const cont = document.getElementById('continue');
  cont.classList.remove('hidden');
  document.getElementById('start').textContent = 'Nouvelle partie';
  cont.addEventListener('click', () => {
    quests.restore(existing);
    if (existing.step === 4) {
      // Reprise devant Bertrand pour relancer le duel
      player.position.set(21, 0, 0);
      player.object.rotation.y = Math.PI / 2;
    } else if (existing.pos) {
      player.position.set(existing.pos[0], 0, existing.pos[1]);
      player.object.rotation.y = existing.rot || 0;
    }
    cam.yaw = player.object.rotation.y + Math.PI;
    beginPlay('Partie reprise');
  });
}
document.getElementById('start').addEventListener('click', () => {
  if (existing && !confirm('Commencer une nouvelle partie ? La partie sauvegardée sera effacée.')) return;
  clearSave();
  beginPlay('Montclair, automne 1126');
  save(false);
});

// Accès pour le débogage depuis la console du navigateur
window.game = { player, world, npcs, quests, cam, duel };
