// Point d'entrée du jeu : assemble le monde, le joueur, les PNJ, la caméra et la boucle de jeu.
import * as THREE from 'three';
import { buildWorld } from './world.js?v=202611261106';
import { Player } from './player.js?v=202611261106';
import { Input } from './input.js?v=202611261106';
import { UI } from './ui.js?v=202611261106';
import { createNPCs } from './npcs.js?v=202611261106';
import { QuestManager } from './quests.js?v=202611261106';
import { initAudio, playHit, playSwing, playLanceHit, setVolumes } from './audio.js?v=202611261106';
import { createEnvironment } from './sky.js?v=202611261106';
import { createPostFX } from './postfx.js?v=202611261106';
import { createGrass } from './grass.js?v=202611261106';
import { createParticles } from './particles.js?v=202611261106';
import { Duel } from './duel.js?v=202611261106';
import { Battle } from './battle.js?v=202611261106';
import { loadSave, writeSave, clearSave } from './save.js?v=202611261106';
import { Horse } from './horse.js?v=202611261106';
import { createCourse } from './course.js?v=202611261106';
import { createLife } from './life.js?v=202611261106';
import { createChapter3 } from './chapter3.js?v=202611261106';
import { STABLE_HORSE } from './layout.js?v=202611261106';
import { createSword } from './humanoid.js?v=202611261106';
import { Music } from './music.js?v=202611261106';
import { Ambience } from './ambience.js?v=202611261106';
import { loadSettings, saveSettings } from './settings.js?v=202611261106';
import { drawMap } from './map.js?v=202611261106';

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
const settings = loadSettings();
// Qualité graphique : l'adresse (?qualite=haute / basse) passe avant les réglages
const params = new URLSearchParams(location.search);
const qualityChoice = params.get('qualite') || settings.quality;
const HIGH = qualityChoice === 'auto' ? !isTouch : qualityChoice === 'haute';

// ---------- Rendu ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, HIGH ? 1.5 : 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 600);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  fx.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Monde ----------
const world = buildWorld(scene);
// Tout ce qui a des obstacles est créé avant l'herbe, pour qu'elle les évite
const course = createCourse(scene, world);
const horse = new Horse(scene, world, STABLE_HORSE);
horse.parts.root.add(course.lance);
const life = createLife(scene, world);
const ch3 = createChapter3(scene, world);
if (HIGH) world.sun.shadow.mapSize.set(4096, 4096);
scene.environment = createEnvironment(renderer, world.sunDir);
scene.environmentIntensity = 1.0;
const grass = createGrass(scene, world.isBare, { count: HIGH ? 120000 : 35000, radius: HIGH ? 75 : 55 });
const particles = createParticles(scene, { dust: HIGH ? 400 : 150, leaves: HIGH ? 90 : 40 });
const fx = createPostFX(renderer, scene, camera, { high: HIGH });

// ---------- Personnages, interface, histoire ----------
const ui = new UI(isTouch);
const input = new Input(renderer.domElement, isTouch);
input.sens = settings.sens;
const player = new Player(scene, world);
const npcs = createNPCs(scene, world);
npcs.list.push(...life.npcs);
ch3.setLord(npcs.godefroy);
ch3.placeHome();
const quests = new QuestManager({ ui, npcs, world });
quests.horse = horse;
quests.course = course;
quests.onChapter = (title, subtitle) => showChapter(title, subtitle);

const music = new Music();
const ambience = new Ambience();
setVolumes(settings.music, settings.sfx);

// ---------- Combats ----------
const duel = new Duel({
  scene, camera, player, npc: npcs.bertrand, world, ui, isTouch,
  onWin: () => quests.onDuelWon(),
  onLose: (retry) => quests.onDuelLost(retry),
});
quests.onStartDuel = () => duel.start(0);
quests.duelRunning = () => duel.running;

const battle = new Battle({
  scene, camera, player, world, ui, isTouch,
  onWin: () => {
    ch3.endSideFight(true);
    setTimeout(() => { ch3.clearSideFight(); }, 2500);
    quests.goTo(15);
    setTimeout(() => quests.afterAmbushDialog(), 1200);
  },
  onLose: (retry) => {
    ui.showDialog([[npcs.godefroy.name, 'Debout, écuyer ! Ils ne sont que des brigands, et tu es un homme de Montclair !']], retry);
  },
});
const fight = () => (duel.running ? duel : battle.running ? battle : null);

// Chapitre III : événements de l'histoire
quests.onSwordGiven = () => player.setSword(createSword(false));
quests.onEscort = () => startEscort();
quests.onReturn = () => ch3.beginReturn();
function startEscort() {
  ch3.beginEscort();
  // Tonnerre attend près de la cour s'il est loin
  if (!horse.mounted && horse.position.distanceTo(ch3.lordHorse.position) > 25) {
    horse.position.set(3, 0, -25);
    horse.object.rotation.y = Math.PI;
    horse.syncColliders();
  }
}
const ch3Events = {
  wait: () => ui.toast('Sire Godefroy t\'attend. Ne traîne pas !', 2500),
  ambush: () => {
    if (quests.step !== 13) return;
    if (horse.mounted) { horse.setMounted(false); player.dismount(horse); course.lance.visible = false; }
    const foes = ch3.springAmbush(player.position);
    quests.goTo(14);
    ui.showDialog([
      [npcs.godefroy.name, 'Halte ! Un arbre en travers de la route… C\'est un piège !'],
      [npcs.godefroy.name, 'Des brigands ! Pied à terre, écuyer, et l\'épée au clair !'],
    ], () => battle.start(foes, { title: 'Embuscade !' }));
  },
  home: () => {
    if (quests.step === 16) quests.goTo(17);
  },
};

// ---------- Sauvegarde ----------
let savedTimer = null;
function save(showIndicator = true) {
  const ok = writeSave({
    ...quests.serialize(),
    pos: [player.position.x, player.position.z],
    horse: { x: horse.position.x, z: horse.position.z, rot: horse.heading, mounted: horse.mounted },
    rot: player.object.rotation.y,
  });
  if (ok && showIndicator) {
    const el = $('saved');
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
  const f = fight();
  if (f && f.lockTarget) {
    // Caméra de combat : derrière le joueur, l'adversaire dans le champ
    const e = f.lockTarget, p = player.position;
    const wanted = Math.atan2(p.x - e.x, p.z - e.z);
    const diff = Math.atan2(Math.sin(wanted - cam.yaw), Math.cos(wanted - cam.yaw));
    cam.yaw += diff * Math.min(1, dt * 6);
    cam.pitch += (0.24 - cam.pitch) * Math.min(1, dt * 4);
    const portrait = camera.aspect < 1;
    cam.dist += ((portrait ? 5.6 : (f === battle ? 4.8 : 4.1)) - cam.dist) * Math.min(1, dt * 4);
    lookAtBias = e;
  } else if (horse.mounted) {
    // À cheval : la caméra se replace derrière le cheval quand il avance
    cam.yaw -= look.dx * 0.0025;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + look.dy * 0.0025, -0.1, 1.0);
    if (Math.abs(horse.speed) > 1 && Math.abs(look.dx) < 1) {
      const wanted = horse.heading + Math.PI;
      const diff = Math.atan2(Math.sin(wanted - cam.yaw), Math.cos(wanted - cam.yaw));
      cam.yaw += diff * Math.min(1, dt * 2.5);
    }
    cam.dist += ((camera.aspect < 1 ? 8.5 : 6.8) - cam.dist) * Math.min(1, dt * 3);
  } else {
    cam.yaw -= look.dx * 0.0025;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + look.dy * 0.0025, -0.25, 1.25);
    cam.dist = THREE.MathUtils.clamp(cam.dist + look.zoom * 0.005, 2.5, 12);
  }

  const desired = player.position.clone().add(new THREE.Vector3(0, horse.mounted ? 1.7 : 1.55, 0));
  if (lookAtBias) desired.lerp(new THREE.Vector3(lookAtBias.x, 1.4, lookAtBias.z), 0.3);
  camTarget.lerp(desired, 1 - Math.exp(-dt * 12));
  const cp = Math.cos(cam.pitch);
  // Caméra par-dessus l'épaule (le héros légèrement à gauche de l'écran, comme dans For Honor)
  const shoulder = (f ? (camera.aspect < 1 ? 0.35 : 0.95) : 0.55) * Math.min(1, cam.dist / 4.6);
  const rx = Math.cos(cam.yaw) * shoulder, rz = -Math.sin(cam.yaw) * shoulder;
  camera.position.set(
    camTarget.x + Math.sin(cam.yaw) * cp * cam.dist + rx,
    camTarget.y + Math.sin(cam.pitch) * cam.dist,
    camTarget.z + Math.cos(cam.yaw) * cp * cam.dist + rz,
  );
  const shake = f ? f.shake : 0;
  if (shake > 0) {
    const k = shake * 0.06;
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
    if (n.inCombat || !n.object.visible) continue;
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

// Joute : la pointe de la lance passe-t-elle près de l'écu ?
const tipPrev = new THREE.Vector3(), tipNow = new THREE.Vector3(), closest = new THREE.Vector3();
let joustCooldown = 0;
function checkJoust(dt) {
  joustCooldown -= dt;
  if (joustCooldown > 0) return;
  horse.lanceTip(tipNow);
  const shield = course.joust.shieldPos();
  const seg = tipNow.clone().sub(tipPrev);
  const len2 = seg.lengthSq() || 1e-6;
  const t = THREE.MathUtils.clamp(shield.clone().sub(tipPrev).dot(seg) / len2, 0, 1);
  closest.copy(tipPrev).addScaledVector(seg, t);
  if (course.joust.ready && closest.distanceTo(shield) < 1.2) {
    joustCooldown = 1.5;
    const fast = Math.abs(horse.speed) > 8;
    if (fast) {
      course.joust.hit(Math.sign(horse.speed) || 1);
      playLanceHit();
    } else playHit();
    quests.onJoustHit(fast);
  }
}

function showChapter(title, subtitle) {
  const el = $('chapter');
  $('chapter-title').textContent = title;
  $('chapter-sub').textContent = subtitle;
  el.classList.remove('hidden');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3800);
  setTimeout(() => el.classList.add('hidden'), 4800);
}

// ---------- Pause, carte et réglages ----------
let paused = false;
let pausedTab = 'carte';
let wasLocked = false;

function selectTab(tab) {
  pausedTab = tab;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + tab));
  if (tab === 'carte') renderMap();
}

function renderMap() {
  world._gateIndex = quests.gateIndex;
  const t = quests.target;
  drawMap($('map'), { world, player, horse, step: quests.step, target: t ? targetPosition(t) : null });
}

function openPause(tab = 'carte') {
  if (!started || paused) return;
  paused = true;
  input.enabled = false;
  input.keys.clear();
  input.joy.x = input.joy.y = 0;
  $('pause').classList.remove('hidden');
  selectTab(tab);
  if (document.pointerLockElement) document.exitPointerLock();
}

function closePause() {
  if (!paused) return;
  paused = false;
  $('pause').classList.add('hidden');
  input.enabled = true;
  clock.getDelta();
  if (!isTouch) {
    try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* rien */ }
  }
}

document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));
$('resume').addEventListener('click', closePause);
$('to-title').addEventListener('click', () => { save(false); location.reload(); });
$('btn-pause').addEventListener('click', () => openPause('reglages'));
$('btn-map').addEventListener('click', () => openPause('carte'));
window.addEventListener('keydown', (e) => {
  if (!paused) return;
  if (e.code === 'Escape' || e.code === 'KeyP' || (e.code === 'KeyM' && pausedTab === 'carte')) { e.preventDefault(); closePause(); }
});
document.addEventListener('pointerlockchange', () => {
  const locked = !!document.pointerLockElement;
  // Échap libère la souris : on ouvre le menu pause
  if (wasLocked && !locked && started && !paused && !isTouch) openPause('reglages');
  wasLocked = locked;
});

// Réglages
$('set-music').value = settings.music;
$('set-sfx').value = settings.sfx;
$('set-sens').value = settings.sens;
$('set-quality').value = settings.quality;
const onSettings = () => {
  settings.music = +$('set-music').value;
  settings.sfx = +$('set-sfx').value;
  settings.sens = +$('set-sens').value;
  settings.quality = $('set-quality').value;
  setVolumes(settings.music, settings.sfx);
  input.sens = settings.sens;
  saveSettings(settings);
  const wantHigh = settings.quality === 'auto' ? !isTouch : settings.quality === 'haute';
  $('quality-note').classList.toggle('hidden', wantHigh === HIGH || !!params.get('qualite'));
};
for (const id of ['set-music', 'set-sfx', 'set-sens', 'set-quality']) $(id).addEventListener('input', onSettings);
$('apply-quality').addEventListener('click', () => { save(false); location.reload(); });

// ---------- Boucle principale ----------
let started = false;
let autoSaveIn = 8;
let time = 0;
let mapRefresh = 0;
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (paused) {
    mapRefresh -= dt;
    if (pausedTab === 'carte' && mapRefresh < 0) { mapRefresh = 0.5; renderMap(); }
    return; // le jeu est figé
  }
  time += dt;
  const look = input.consumeLook();
  const f = fight();
  const dtGame = dt * (f ? f.timeScale : 1);

  if (started) {
    const actions = input.consumeActions();
    if (actions.pause) { openPause('reglages'); return; }
    if (actions.map && !f) { openPause('carte'); return; }
    if (ui.dialogOpen) {
      if (actions.interact || actions.attack || actions.jump || actions.heavy) ui.advanceDialog();
    } else if (f) {
      f.handleActions(actions, input.move, input.blockHeld);
    } else {
      const near = nearestNPC();
      const nearHorse = !horse.mounted && horse.position.distanceTo(player.position) < 2.6 && quests.step >= 7;
      if (horse.mounted) {
        if (actions.interact) {
          if (near && Math.abs(horse.speed) < 1.5) quests.talkTo(near);
          else if (Math.abs(horse.speed) < 1.5) { horse.setMounted(false); player.dismount(horse); course.lance.visible = false; save(false); }
          else ui.toast('Ralentis pour descendre.', 1200);
        }
      } else if (actions.interact && near && (!nearHorse || near.object.position.distanceTo(player.position) < horse.position.distanceTo(player.position))) {
        quests.talkTo(near);
      } else if (actions.interact && nearHorse) {
        horse.setMounted(true);
        quests.onMounted();
      } else {
        if (actions.attack) player.startAttack();
        if (actions.jump) player.jump();
      }
    }

    const frozen = ui.dialogOpen && !f;
    if (f) {
      player.update(dtGame, ui.dialogOpen ? { x: 0, y: 0 } : input.move, false, cam.yaw, f.lockTarget);
      f.update(dtGame);
      horse.update(dt);
    } else if (horse.mounted) {
      const m = frozen ? { x: 0, y: 0 } : input.move;
      const prev = horse.position.clone();
      tipPrev.copy(horse.lanceTip(tipNow));
      horse.update(dt, { throttle: m.y, turn: m.x, gallop: input.run });
      const withLance = quests.step >= 9 && quests.step <= 11;
      course.lance.visible = withLance;
      player.updateMounted(dt, horse, withLance);
      if (quests.step === 8 && course.crossed(quests.gateIndex, prev, horse.position)) quests.onGatePassed();
      if (withLance) checkJoust(dt);
    } else {
      horse.update(dt);
      player.update(dt, frozen ? { x: 0, y: 0 } : input.move, input.run, cam.yaw);
      checkStrike();
    }
    ch3.update(dtGame, player.position, ch3Events);

    // Invite "Parler" / "Monter"
    const near = ui.dialogOpen || f ? null : nearestNPC();
    const key = isTouch ? '💬' : '[E]';
    if (ui.dialogOpen || f) ui.setPrompt(null);
    else if (horse.mounted) ui.setPrompt(near ? `${key} Parler à ${near.name}` : (Math.abs(horse.speed) < 1.5 ? `${key} Descendre de cheval` : null));
    else if (quests.step >= 7 && horse.position.distanceTo(player.position) < 2.6) ui.setPrompt(`${key} Monter sur Tonnerre`);
    else if (near) ui.setPrompt(`${key} Parler à ${near.name}`);
    else ui.setPrompt(null);

    // Objectif : losange + boussole
    const target = quests.target;
    if (target && !f) {
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

    // Musique et ambiance
    music.setMood(f ? 'combat' : 'explore');
    ambience.quiet = !!f;
    ambience.update(dt, player.position);

    // Sauvegarde discrète de la position toutes les 8 secondes
    autoSaveIn -= dt;
    if (autoSaveIn < 0) {
      autoSaveIn = 8;
      if (!f && !ui.dialogOpen) save(false);
    }
  }

  for (const n of npcs.list) if (!n.inCombat && n.id !== 'forgeron' && n.id !== 'villageois') n.update(dt, player.position);
  life.update(dt, player.position);
  course.update(dt);
  updateCamera(dt, look);
  world.update(dt, player.position, camera.position);
  grass.update(time);
  particles.update(dt, player.position);
  fx.render(time);
}
frame();

// ---------- Écran titre ----------
if (isTouch) {
  $('controls-desktop').classList.add('hidden');
  $('controls-touch').classList.remove('hidden');
}
function beginPlay(message) {
  initAudio();
  music.start();
  ambience.start();
  $('intro').classList.add('hidden');
  ui.showHUD();
  if (isTouch) $('touch').classList.remove('hidden');
  input.enabled = true;
  started = true;
  ui.toast(message, 3000);
}

/** Remet le monde dans l'état de l'étape sauvegardée. */
function restoreWorld(data) {
  let step = data.step;
  if (step === 14) step = 13; // une embuscade interrompue recommence au départ de l'escorte
  quests.restore({ ...data, step });
  if (step >= 13) player.setSword(createSword(false));
  if (data.horse) {
    horse.position.set(data.horse.x, 0, data.horse.z);
    horse.object.rotation.y = data.horse.rot;
    horse.syncColliders();
  }
  if (step === 13) {
    startEscort();
    player.position.set(2, 0, -23);
    player.object.rotation.y = Math.PI;
    return;
  }
  if (step === 15) ch3.placeAfterFight();
  if (step === 16) { ch3.placeAfterFight(); ch3.beginReturn(); }
  if (data.horse && data.horse.mounted && step >= 8 && step !== 15) {
    horse.setMounted(true);
    player.updateMounted(0, horse, step >= 9 && step <= 11);
  } else if (step === 4) {
    // Reprise devant Bertrand pour relancer le duel
    player.position.set(21, 0, 0);
    player.object.rotation.y = Math.PI / 2;
  } else if (data.pos) {
    player.position.set(data.pos[0], 0, data.pos[1]);
    player.object.rotation.y = data.rot || 0;
  }
}

const existing = loadSave();
if (existing) {
  const cont = $('continue');
  cont.classList.remove('hidden');
  $('start').textContent = 'Nouvelle partie';
  cont.addEventListener('click', () => {
    restoreWorld(existing);
    cam.yaw = player.object.rotation.y + Math.PI;
    beginPlay('Partie reprise');
  });
}
$('start').addEventListener('click', () => {
  if (existing && !confirm('Commencer une nouvelle partie ? La partie sauvegardée sera effacée.')) return;
  clearSave();
  beginPlay('Montclair, automne 1126');
  save(false);
});

// Accès pour le débogage depuis la console du navigateur
window.game = { player, world, npcs, quests, cam, duel, battle, horse, course, input, ch3, life, music, openPause, closePause };
