// Point d'entrée du jeu : assemble le monde, le joueur, les PNJ, la caméra et la boucle de jeu.
import * as THREE from 'three';
import { buildWorld } from './world.js?v=202611261748';
import { Player } from './player.js?v=202611261748';
import { Input } from './input.js?v=202611261748';
import { UI } from './ui.js?v=202611261748';
import { createNPCs } from './npcs.js?v=202611261748';
import { QuestManager } from './quests.js?v=202611261748';
import { initAudio, playHit, playSwing, playLanceHit, setVolumes, playStep } from './audio.js?v=202611261748';
import { Activities } from './activities.js?v=202611261748';
import { Tutorial } from './tutorial.js?v=202611261748';
import { buildParis, PARIS, inParis } from './paris.js?v=202611261748';
import { Chapter6 } from './chapter6.js?v=202611261748';
import { MountedCombat } from './mounted.js?v=202611261748';
import { Tournament } from './tournament.js?v=202611261748';
import { openCreator, defaultHero, fieldColor, drawShield } from './hero.js?v=202611261748';
import { createEnvironment } from './sky.js?v=202611261748';
import { createPostFX } from './postfx.js?v=202611261748';
import { createGrass } from './grass.js?v=202611261748';
import { createParticles } from './particles.js?v=202611261748';
import { Duel } from './duel.js?v=202611261748';
import { Battle } from './battle.js?v=202611261748';
import { loadSave, writeSave, clearSave } from './save.js?v=202611261748';
import { Horse } from './horse.js?v=202611261748';
import { createCourse } from './course.js?v=202611261748';
import { createLife } from './life.js?v=202611261748';
import { createChapter3 } from './chapter3.js?v=202611261748';
import { createChapter4 } from './chapter4.js?v=202611261748';
import { createInteriors, ROOMS } from './interiors.js?v=202611261748';
import { createChapter5 } from './chapter5.js?v=202611261748';
import { Economy } from './economy.js?v=202611261748';
import { TimeOfDay } from './timeofday.js?v=202611261748';
import { STABLE_HORSE, HIDE } from './layout.js?v=202611261748';
import { createSword } from './humanoid.js?v=202611261748';
import { Music } from './music.js?v=202611261748';
import { Ambience } from './ambience.js?v=202611261748';
import { loadSettings, saveSettings } from './settings.js?v=202611261748';
import { drawMap, drawParisMap } from './map.js?v=202611261748';

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
const ch4 = createChapter4(scene, world);
const interiors = createInteriors(scene, world);
const npcs = createNPCs(scene, world);
const ch5 = createChapter5(scene, world, { godefroy: npcs.godefroy, bertrand: npcs.bertrand, borgneH: ch4.borgneH, oldLordHorse: ch3.lordHorse });
if (HIGH) world.sun.shadow.mapSize.set(4096, 4096);
scene.environment = createEnvironment(renderer, world.sunDir);
scene.environmentIntensity = 1.0;
const grass = createGrass(scene, world.isBare, { count: HIGH ? 120000 : 35000, radius: HIGH ? 75 : 55 });
const particles = createParticles(scene, { dust: HIGH ? 400 : 150, leaves: HIGH ? 90 : 40 });
const fx = createPostFX(renderer, scene, camera, { high: HIGH });
const tod = new TimeOfDay({ scene, world, renderer, maxLights: HIGH ? 6 : 3 });

// ---------- Personnages, interface, histoire ----------
const ui = new UI(isTouch);
const input = new Input(renderer.domElement, isTouch);
input.sens = settings.sens;
const player = new Player(scene, world);
npcs.list.push(...life.npcs, ch4.aymeric, ch4.anselme, ...interiors.npcs, ch5.count, ...ch5.nobles);
ch3.setLord(npcs.godefroy);
ch3.placeHome();
const quests = new QuestManager({ ui, npcs, world });
quests.horse = horse;
quests.course = course;
quests.onChapter = (title, subtitle) => showChapter(title, subtitle);

// ---------- Deniers et équipement ----------
const economy = new Economy();
economy.onChange = () => player.applyEquipment(economy.owned, economy.stats());
economy.onBuy = (id) => { ui.toast('Équipement acheté et porté !', 2200); save(false); };
quests.onReward = (n, reason) => { economy.earn(n, ui, reason); };
quests.onPay = (n) => { if (economy.money < n) return false; economy.money -= n; economy.updateHUD(); return true; };
quests.onShop = () => economy.openShop(ui, () => { relock(); save(false); });
ui.onModalClosed = () => relock();

// ---------- Activités : arc, chasse, dés, course, quêtes secondaires ----------
const activities = new Activities({ scene, world, ui, npcs, quests, economy, horse, course, player, interiors, rooms: ROOMS, save: (i) => save(i) });
npcs.list.push(...activities.extraNPCs);
activities.onCamReset = (yaw) => { cam.yaw = yaw; };
const tutorial = new Tutorial(isTouch);

// ---------- Héros, combat à cheval et tournoi ----------
let hero = defaultHero();
function applyHero(h) {
  hero = h;
  activities.stowBow();
  player.setHero({ ...h, cloakColor: fieldColor(h) });
  horse.setBlanket(fieldColor(h));
}
function fadeTo(fn, text) {
  $('fade').classList.add('on');
  setTimeout(() => {
    fn();
    if (text) ui.toast(text, 1800);
    setTimeout(() => $('fade').classList.remove('on'), 120);
  }, 420);
}
const mounted = new MountedCombat(scene, world);
mounted.addDummies([{ x: 44.5, z: -8 }, { x: 44.5, z: 1 }, { x: 44.5, z: 10 }, { x: 44.5, z: 19 }]);
mounted.onDummyHit = (dmg) => ui.toast(dmg > 15 ? 'Coup puissant !' : 'Touché !', 700);
const tournament = new Tournament({
  scene, world, ui, quests, economy, horse, player, course, mounted, battle: null, save: (i) => save(i),
  hero: () => hero, fadeTo, setCam: (yaw) => { cam.yaw = yaw; },
});
npcs.list.push(tournament.herald);
const GREETINGS = { tavernier: 'Qu\'est-ce que je te sers, écuyer ?', anselme: 'Oui, mon fils ?', hersende: 'Oui, écuyer ?', bertrand: 'Qu\'y a-t-il, écuyer ?' };
/** Parler à un personnage : l'histoire d'abord, puis les activités. */
function talkTo(npc) {
  if (npc === tournament.herald) { tournament.talk(); return; }
  if (activities.talk(npc)) return;
  const story = quests.target === npc || (quests.step === 19 && ['forgeron', 'anselme', 'mathilde'].includes(npc.id));
  const extra = story ? null : activities.extraOptions(npc);
  if (!extra) { quests.talkTo(npc); return; }
  const opts = extra.map((o, i) => ({ label: o.label, value: i }));
  opts.push({ label: npc.name === 'Un vieux soldat' ? 'Bavarder' : 'Autre chose', value: 'talk' });
  ui.showChoice(npc.name, GREETINGS[npc.id] || (npc.name === 'Un vieux soldat' ? 'Hé, l\'écuyer ! Une partie de dés ?' : 'Oui ?'), opts, (v) => {
    if (v === 'talk') quests.talkTo(npc); else extra[v].run();
  });
}
function relock() {
  if (isTouch || paused) return;
  try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* rien */ }
}

const music = new Music();
const ambience = new Ambience();
setVolumes(settings.music, settings.sfx);

// ---------- Combats ----------
const duel = new Duel({
  scene, camera, player, npc: npcs.bertrand, world, ui, isTouch,
  onWin: () => quests.onDuelWon(),
  onLose: (retry) => quests.onDuelLost(retry),
});
quests.onStartDuel = () => {
  duel.onWin = () => quests.onDuelWon();
  duel.onLose = (retry) => quests.onDuelLost(retry);
  duel.start(0);
};
quests.onRematch = () => {
  duel.onWin = () => { economy.earn(15, ui, 'revanche gagnée'); ui.showDialog([[npcs.bertrand.name, 'Joli ! Tiens, tes deniers. Tu les as mérités.']]); save(false); };
  duel.onLose = (retry) => { ui.showDialog([[npcs.bertrand.name, 'Ha ! Pas aujourd\'hui, écuyer. Reviens quand tu veux.']]); duel.end(); };
  duel.start(3);
};
quests.duelRunning = () => duel.running;

const battle = new Battle({ scene, camera, player, world, ui, isTouch });
tournament.battle = battle;

// ---------- Paris et chapitre VI ----------
let paris = null;
function ensureParis() {
  if (paris) return paris;
  paris = buildParis(scene, world, interiors.kit);
  npcs.list.push(...paris.npcs);
  npcs.list.push(...ch6.attach(paris));
  return paris;
}
/** Sortie immédiate d'une pièce (sans passer par la porte). */
function leaveRoom() {
  if (!interiors.current) return;
  interiors.exit(player);
  tod.indoor = false;
  cam.yaw = player.object.rotation.y + Math.PI;
  cam.pitch = 0.18;
  cam.dist = 4.6;
  camTarget.copy(player.position).add(new THREE.Vector3(0, 1.55, 0));
}
const ch6 = new Chapter6({
  scene, world, ui, quests, npcs, player, horse, interiors, battle, economy, tod,
  timeJump: (...a) => timeJump(...a), fadeTo, showChapter: (t, s) => showChapter(t, s), setCam: (yaw) => { cam.yaw = yaw; },
  leaveRoom, save: (i) => save(i), hero: () => hero, ensureParis,
});
quests.ext = ch6;
function ambushCallbacks() {
  battle.onWin = () => {
    ch3.endSideFight(true);
    setTimeout(() => { ch3.clearSideFight(); }, 2500);
    economy.earn(40, ui, 'bourses des brigands');
    quests.goTo(15);
    setTimeout(() => quests.afterAmbushDialog(), 1200);
  };
  battle.onLose = (retry) => {
    ui.showDialog([[npcs.godefroy.name, 'Debout, écuyer ! Ils ne sont que des brigands, et tu es un homme de Montclair !']], retry);
  };
}
const fight = () => (duel.running ? duel : battle.running ? battle : null);

// Chapitre III : événements de l'histoire
quests.onSwordGiven = () => economy.give('epee');
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
    ], () => { ambushCallbacks(); battle.start(foes, { title: 'Embuscade !' }); });
  },
  home: () => {
    if (quests.step === 16) quests.goTo(17);
  },
};

// ---------- Chapitre IV ----------
/** Fondu au noir avec un texte, pendant lequel l'heure (et la météo) changent. */
function timeJump(hour, weather, text, after) {
  const el = $('chapter');
  $('chapter-title').textContent = '';
  $('chapter-sub').textContent = text;
  el.classList.remove('hidden');
  el.classList.add('show');
  setTimeout(() => {
    tod.setTime(hour);
    if (weather === null) { tod.lockWeather(null); tod.setWeather('clair', true); } else if (weather) tod.lockWeather(weather);
    if (after) after();
  }, 1100);
  setTimeout(() => el.classList.remove('show'), 2600);
  setTimeout(() => el.classList.add('hidden'), 3600);
}
const AYMERIC = ch4.aymeric.name, BORGNE = 'Le Borgne';
const ch4Events = {
  meeting: () => {
    ui.showDialog([
      [BORGNE, 'T\'es en retard, l\'intendant.'],
      [AYMERIC, 'Les gardes changent de tour à minuit, je ne pouvais pas partir avant. Ma part, maintenant.'],
      [BORGNE, 'Ta part ? Tes renseignements nous ont coûté trois hommes. Le gamin du seigneur se bat comme un diable.'],
      [AYMERIC, 'Alors prenez plus d\'hommes. À la Pentecôte, Godefroy part pour la cour du comte. La route est longue…'],
      [BORGNE, 'On y sera. Tiens, ta bourse. Et l\'écuyer… on s\'en occupera aussi.'],
      ['', 'Le Borgne disparaît dans la forêt. L\'intendant reprend le chemin du château… Suis-le sans te faire voir !'],
    ], () => { quests.goTo(22); ch4.beginFollow(); });
  },
  spotted: (when) => {
    ui.toast(when === 'meeting' ? 'Tu as quitté ta cachette : ils t\'ont repéré ! Reviens dans les buissons.' : 'Repéré ! L\'intendant t\'a vu. Recommence depuis les buissons.', 3200);
    restartStealth(when);
  },
  lost: () => {
    ui.toast('Tu l\'as perdu de vue… Recommence depuis les buissons.', 3000);
    restartStealth('follow');
  },
  reached: () => {
    ui.showDialog([['', 'L\'intendant ouvre un coffre au pied du donjon et y cache la bourse du Borgne. Tu tiens ta preuve !']], () => quests.goTo(23));
  },
};
function restartStealth(when) {
  if (horse.mounted) { horse.setMounted(false); player.dismount(horse); }
  player.position.set(HIDE.x, 0, HIDE.z);
  if (when === 'meeting') ch4.startMeeting();
  else ch4.restartFollow();
}
quests.onFinalFight = () => {
  const sword = ch4.arm();
  const a = ch4.aymeric.object.position;
  battle.onWin = () => quests.onTraitorDefeated();
  battle.onLose = (retry) => quests.onTraitorLost(retry);
  battle.start([{ name: AYMERIC, h: ch4.aymeric.h, sword, spawn: { x: a.x, z: a.z }, hp: 90, speed: 1.15, damageMul: 0.9 }], { title: 'Le traître', label: 'Ne le laisse pas s\'enfuir !' });
};
quests.onMorning = () => timeJump(8, null, 'Au petit matin…', () => ch4.arrest());

// ---------- Chapitre V ----------
quests.kneelSpot = new THREE.Vector3(ROOMS.court.kneel.x, 0, ROOMS.court.kneel.z);
quests.onDeparture = () => ch5.prepareDeparture();
const G = npcs.godefroy.name, BE = npcs.bertrand.name;
const ch5Events = {
  depart: () => { quests.goTo(26); ui.toast('En route pour la cour du comte !', 2500); },
  wait: () => ui.toast('Sire Godefroy t\'attend. Ne traîne pas !', 2500),
  ambush: () => {
    if (quests.step !== 26) return;
    if (horse.mounted) { horse.setMounted(false); player.dismount(horse); course.lance.visible = false; }
    const foes = ch5.springAmbush();
    ui.showDialog([
      [BORGNE, 'Halte-là, Godefroy de Montclair ! Je t\'avais promis qu\'on se reverrait.'],
      [G, 'Le Borgne… Ton espion croupit dans mon cachot. Rends-toi, et tu auras un procès.'],
      [BORGNE, 'Un procès ? Je préfère ta bourse… et la tête de ton écuyer !'],
      [G, 'Montclair ! À moi !'],
    ], () => {
      battle.onWin = () => {
        ch5.endAmbush();
        economy.earn(80, ui, 'la bourse du Borgne');
        setTimeout(() => ui.showDialog([
          [BORGNE, 'Assez… assez ! Je me rends…'],
          [BE, 'Par saint Georges, petit ! Tu as mis le Borgne à genoux !'],
          [G, 'Ligotez-le. Le comte le jugera. Et toi, écuyer… le comte voudra te voir.'],
        ], () => timeJump(11, null, 'Le lendemain, à la cour du comte…', () => enterCourt())), 1500);
      };
      battle.onLose = (retry) => ui.showDialog([[G, 'Relève-toi, écuyer ! Pour Montclair !']], retry);
      battle.start(foes, { title: 'Le piège du Borgne', label: 'Bats le Borgne et ses hommes !' });
    });
  },
  targets: () => (battle.running ? battle.alive : []),
  assist: (entry, name) => battle.allyHit(entry, name, 10),
  helperFree: (name) => { if (battle.running) ui.toast(`${name.split(',')[0]} a vaincu son adversaire et vient t'aider !`, 2500); },
  accoladeDone: () => {
    ui.showDialog([
      [COUNT, 'Au nom de Dieu, de saint Michel et de saint Georges, je te fais chevalier. Sois preux !'],
      [COUNT, `Relève-toi, Sire ${hero.name}, chevalier de Montclair !`],
    ], () => {
      ch5.rise(player);
      setTimeout(() => ui.showDialog([
        [G, 'Voici ton manteau, à tes propres couleurs. Porte-le avec honneur… et voici cent deniers pour ton équipement.'],
        [BE, `Je savais que tu y arriverais. Enfin… je l'espérais. Bienvenue parmi nous, Sire ${hero.name}.`],
      ], () => {
        economy.give('manteau');
        economy.earn(100, ui, 'cadeau de Sire Godefroy');
        save(false);
        showEnding();
      }), 2200);
    });
  },
};
const COUNT = ch5.count.name;
function enterCourt() {
  if (horse.mounted) { horse.setMounted(false); player.dismount(horse); }
  // Tonnerre rentre au château
  horse.position.set(-11, 0, -34);
  horse.object.rotation.y = Math.PI / 2;
  horse.syncColliders();
  interiors.enter('court', player);
  tod.indoor = true;
  ch5.enterCourt();
  cam.yaw = player.object.rotation.y + Math.PI;
  cam.pitch = 0.3;
  cam.dist = 3.6;
  quests.goTo(27);
}
function startCeremony() {
  ch5.kneel(player);
  ui.showDialog([
    [COUNT, 'Approche, écuyer de Montclair. Sire Godefroy m\'a tout conté : les brigands de la forêt, le traître démasqué, et le Borgne enfin capturé.'],
    [COUNT, 'Un tel courage mérite récompense. Mais d\'abord, un serment.'],
  ], () => ui.showChoice(COUNT, 'Jures-tu de servir ton seigneur avec loyauté, de protéger les faibles, et de ne jamais tirer l\'épée sans juste cause ?', [
    { label: 'Je le jure.', value: 'oui' },
  ], () => ch5.accolade()));
}
function showEnding() {
  const owned = Object.keys(economy.owned).filter((k) => k !== 'manteau').length;
  $('ending-stats').innerHTML = `🪙 ${economy.money} deniers · ⚔️ ${owned} pièce${owned > 1 ? 's' : ''} d'équipement · 🛡 Sire ${hero.name}, chevalier de Montclair`;
  $('ending').classList.remove('hidden');
  ui.modalOpen = true;
  if (document.pointerLockElement) document.exitPointerLock();
}
$('ending-continue').addEventListener('click', () => {
  $('ending').classList.add('hidden');
  ui.modalOpen = false;
  $('fade').classList.add('on');
  setTimeout(() => {
    interiors.exit(player);
    tod.indoor = false;
    ch5.goHome();
    ch3.placeHome();
    tod.setTime(17);
    quests.goTo(28);
    cam.yaw = player.object.rotation.y + Math.PI;
    $('fade').classList.remove('on');
    relock();
  }, 450);
});

// ---------- Sauvegarde ----------
let savedTimer = null;
function save(showIndicator = true) {
  const ok = writeSave({
    ...quests.serialize(),
    act: activities.serialize(),
    tour: tournament.serialize(),
    hero,
    ch6: ch6.serialize(),
    pos: interiors.current ? [ROOMS[interiors.current].door.x, ROOMS[interiors.current].door.z] : [player.position.x, player.position.z],
    eco: economy.serialize(),
    horse: { x: horse.position.x, z: horse.position.z, rot: horse.heading, mounted: horse.mounted },
    rot: player.object.rotation.y,
    hour: tod.hour,
    weather: tod.kind,
    weatherLocked: tod.locked,
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
  } else if (activities.bow.aiming) {
    // Visée à l'arc : caméra rapprochée, par-dessus l'épaule
    cam.yaw -= look.dx * 0.0018;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + look.dy * 0.0018, -0.5, 0.8);
    cam.dist += (2.1 - cam.dist) * Math.min(1, dt * 8);
  } else {
    cam.yaw -= look.dx * 0.0025;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + look.dy * 0.0025, -0.25, 1.25);
    cam.dist = THREE.MathUtils.clamp(cam.dist + look.zoom * 0.005, 2.2, interiors.current ? 3.2 : 12);
    if (interiors.current) cam.pitch = Math.max(cam.pitch, 0.22); // regarder par-dessus la tête dans les pièces
  }

  const desired = player.position.clone().add(new THREE.Vector3(0, horse.mounted ? 1.7 : 1.55, 0));
  if (lookAtBias) desired.lerp(new THREE.Vector3(lookAtBias.x, 1.4, lookAtBias.z), 0.3);
  camTarget.lerp(desired, 1 - Math.exp(-dt * 12));
  const cp = Math.cos(cam.pitch);
  // Caméra par-dessus l'épaule (le héros légèrement à gauche de l'écran, comme dans For Honor)
  const shoulder = activities.bow.aiming && !f ? 0.62 : (f ? (camera.aspect < 1 ? 0.35 : 0.95) : 0.55) * Math.min(1, cam.dist / 4.6);
  const rx = Math.cos(cam.yaw) * shoulder, rz = -Math.sin(cam.yaw) * shoulder;
  camera.position.set(
    camTarget.x + Math.sin(cam.yaw) * cp * cam.dist + rx,
    camTarget.y + Math.sin(cam.pitch) * cam.dist,
    camTarget.z + Math.cos(cam.yaw) * cp * cam.dist + rz,
  );
  if (!interiors.room) avoidWalls(camTarget.x + rx, camTarget.y, camTarget.z + rz);
  const shake = f ? f.shake : 0;
  if (shake > 0) {
    const k = shake * 0.06;
    shakeOffset.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    camera.position.add(shakeOffset);
  }
  if (camera.position.y < 0.3) camera.position.y = 0.3;
  // À l'intérieur, la caméra reste entre les murs
  const room = interiors.room;
  if (room) {
    const b = room.bounds, m = 0.35;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, b.minX + m, b.maxX - m);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, b.minZ + m, b.maxZ - m);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.5, b.h - 0.4);
  }
  camera.lookAt(camTarget.x + rx, camTarget.y, camTarget.z + rz);
}

/** Dehors : la caméra se rapproche du héros plutôt que de traverser un mur ou un tronc. */
const camFrom = new THREE.Vector3(), camProbe = new THREE.Vector3();
function avoidWalls(px, py, pz) {
  camFrom.set(px, py, pz);
  const to = camera.position;
  const N = 14;
  let hit = 1;
  for (let i = 1; i <= N && hit === 1; i++) {
    const t = i / N;
    camProbe.lerpVectors(camFrom, to, t);
    const x = camProbe.x, y = camProbe.y, z = camProbe.z, m = 0.25;
    for (const b of world.boxes) {
      if (y < b.top + 0.2 && x > b.minX - m && x < b.maxX + m && z > b.minZ - m && z < b.maxZ + m) { hit = t; break; }
    }
    if (hit !== 1) break;
    for (const c of world.circles) {
      if (c.r < 0.3 || y > c.top + 0.2) continue;
      const dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz < (c.r + 0.2) ** 2) { hit = t; break; }
    }
  }
  if (hit < 1) {
    const k = Math.max(0.12, hit - 1 / N);
    to.lerpVectors(camFrom, to, k);
  }
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
  if (tab === 'journal') $('journal').innerHTML = activities.journalHTML() + tournamentJournal();
  if (tab === 'heros') renderHeroTab();
}

function tournamentJournal() {
  if (quests.step < 28) return '';
  const d = tournament.done;
  const li = (ok, t) => `<li class="${ok ? 'done' : ''}">${t} — ${ok ? 'remportée ✔' : 'à disputer'}</li>`;
  return `<h3>Tournoi de la Saint-Martin</h3><ul>${li(d.joute, 'La joute')}${li(d.melee, 'La mêlée à cheval')}${li(d.finale, 'La finale à pied')}</ul>${d.finale ? '<p>🏆 Champion du tournoi !</p>' : '<p class="muted">Le héraut du comte attend près de la lice, à l\'est.</p>'}`;
}
function renderHeroTab() {
  const box = $('hero-summary');
  box.innerHTML = `<canvas width="90" height="114"></canvas><div><b>${hero.name.replace(/[<>&]/g, '')}</b><br>${quests.step >= 28 ? 'Chevalier de Montclair' : 'Écuyer de Montclair'}${tournament.done.finale ? '<br>🏆 Champion du tournoi' : ''}</div>`;
  drawShield(box.querySelector('canvas'), hero.arms);
}
$('edit-hero').addEventListener('click', () => {
  openCreator(hero, (h) => { applyHero(h); save(false); renderHeroTab(); }, { title: 'Ton héros', button: 'Enregistrer', cancel: () => {} });
});

function renderMap() {
  world._gateIndex = quests.gateIndex;
  const t = quests.target || (inParis(player.position) ? null : activities.target);
  const outside = interiors.current
    ? { position: new THREE.Vector3(ROOMS[interiors.current].door.x, 0, ROOMS[interiors.current].door.z), object: player.object }
    : player;
  if (inParis(outside.position)) drawParisMap($('map'), { origin: PARIS, player: outside, target: t ? targetPosition(t) : null });
  else drawMap($('map'), { world, player: outside, horse, step: quests.step, target: t ? targetPosition(t) : null });
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
  if (!paused || e.target.tagName === 'INPUT') return;
  if (e.code === 'Escape' || e.code === 'KeyP' || (e.code === 'KeyM' && pausedTab === 'carte')) { e.preventDefault(); closePause(); }
});
document.addEventListener('pointerlockchange', () => {
  const locked = !!document.pointerLockElement;
  // Échap libère la souris : on ouvre le menu pause
  if (wasLocked && !locked && started && !paused && !isTouch && !ui.modalOpen && !economy.shopOpen) openPause('reglages');
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

// ---------- Portes des intérieurs ----------
let doorBusy = false;
function goThroughDoor(door) {
  if (doorBusy) return;
  doorBusy = true;
  input.enabled = false;
  $('fade').classList.add('on');
  setTimeout(() => {
    if (door.exit) { const was = interiors.current; interiors.exit(player); ch6.onRoomExit(was); } else interiors.enter(door.id, player);
    tod.indoor = !!interiors.current;
    cam.yaw = player.object.rotation.y + Math.PI;
    cam.pitch = interiors.current ? 0.3 : 0.18;
    cam.dist = interiors.current ? 2.9 : 4.6;
    camTarget.copy(player.position).add(new THREE.Vector3(0, 1.55, 0));
    $('fade').classList.remove('on');
    input.enabled = true;
    doorBusy = false;
  }, 380);
}

// ---------- Boucle principale ----------
let started = false;
let hideToastShown = false;
let clockIn = 0;
let autoSaveIn = 8;
let time = 0;
let mapRefresh = 0;
let lastStepIdx = 0;
let movedThisFrame = 0;
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
    if (actions.bow && !f && !ui.dialogOpen && !horse.mounted && !interiors.current) {
      if (activities.hasBow) activities.toggleBow(); else if (activities.unlocked) ui.toast('Tu n\'as pas encore d\'arc. Guillaume l\'archer, au terrain d\'entraînement, pourrait t\'en donner un.', 2600);
    }
    if (ui.dialogOpen) {
      if (actions.interact || actions.attack || actions.jump || actions.heavy) ui.advanceDialog();
    } else if (f) {
      f.handleActions(actions, input.move, input.blockHeld);
    } else {
      const near = nearestNPC();
      const nearHorse = !horse.mounted && horse.position.distanceTo(player.position) < 2.6 && quests.step >= 7;
      if (horse.mounted) {
        if (actions.attack) { if (tournament.lanceUp) tournament.couch(); else mounted.swing('light'); }
        if (actions.heavy && !tournament.lanceUp) mounted.swing('heavy');
        if (tournament.event) { /* pas de pied à terre pendant une épreuve */ } else if (actions.interact) {
          if (interiors.nearDoor(player.position) && Math.abs(horse.speed) < 1.5) ui.toast('Descends de cheval pour entrer.', 1800);
          else if (activities.race) { /* pas de pause pendant la course */ }
          else if (near && Math.abs(horse.speed) < 1.5) talkTo(near);
          else if (Math.abs(horse.speed) < 1.5) { horse.setMounted(false); player.dismount(horse); course.lance.visible = false; save(false); }
          else ui.toast('Ralentis pour descendre.', 1200);
        }
      } else if (actions.interact && quests.step === 27 && ch5.nearKneel(player.position)) {
        startCeremony();
      } else if (actions.interact && interiors.nearDoor(player.position)) {
        goThroughDoor(interiors.nearDoor(player.position));
      } else if (actions.interact && interiors.nearAltar(player.position)) {
        ui.showDialog([['', 'Tu t\'agenouilles devant l\'autel et pries pour Montclair, pour Sire Godefroy… et pour le jour de ton adoubement.'], ['', 'Le silence de l\'église t\'apaise.']]);
      } else if (actions.interact && ch6.interact(player.position)) {
        /* chapitre VI */
      } else if (actions.interact && activities.hunt.nearCarcass(player.position)) {
        activities.takeVenison(activities.hunt.nearCarcass(player.position));
      } else if (actions.interact && activities.nearChicken(player.position) >= 0) {
        activities.catchChicken(activities.nearChicken(player.position));
      } else if (actions.interact && near && (!nearHorse || near.object.position.distanceTo(player.position) < horse.position.distanceTo(player.position))) {
        talkTo(near);
      } else if (actions.interact && nearHorse) {
        activities.stowBow();
        horse.setMounted(true);
        quests.onMounted();
      } else if (activities.bow.aiming) {
        if (actions.attack) {
          const o = player.position.clone().add(new THREE.Vector3(Math.cos(cam.yaw) * 0.25, 1.5, -Math.sin(cam.yaw) * 0.25));
          activities.bow.shoot(o, camera);
        }
        if (actions.jump) player.jump();
      } else {
        if (actions.attack) player.startAttack();
        if (actions.jump) player.jump();
      }
    }

    const frozen = (ui.dialogOpen && !f) || ch5.state.kneeling;
    const blockKey = input.keys.has('KeyE') || !!input.touchBlock;
    if (f) {
      player.update(dtGame, ui.dialogOpen ? { x: 0, y: 0 } : input.move, false, cam.yaw, f.lockTarget);
      f.update(dtGame);
      horse.update(dt);
    } else if (horse.mounted) {
      const m = frozen || activities.freezeMount || tournament.freeze ? { x: 0, y: 0 } : input.move;
      const prev = horse.position.clone();
      tipPrev.copy(horse.lanceTip(tipNow));
      horse.update(dt, { throttle: m.y, turn: m.x, gallop: input.run });
      const withLance = (quests.step >= 9 && quests.step <= 11) || tournament.lanceUp;
      course.lance.visible = withLance;
      player.updateMounted(dt, horse, withLance);
      mounted.armed = !!economy.owned.epee && !withLance && !activities.race;
      mounted.blocking = !!tournament.event && blockKey;
      mounted.update(dt, player, horse);
      if (quests.step === 8 && course.crossed(quests.gateIndex, prev, horse.position)) quests.onGatePassed();
      if (withLance) checkJoust(dt);
    } else {
      horse.update(dt);
      const before = player.position.clone();
      player.update(dt, frozen ? { x: 0, y: 0 } : input.move, input.run && !activities.bow.aiming, cam.yaw);
      if (activities.bow.aiming) player.object.rotation.y = cam.yaw + Math.PI; // le héros regarde où il vise
      else checkStrike();
      // Bruits de pas
      const stepIdx = Math.floor(player.phase / Math.PI);
      if (stepIdx !== lastStepIdx && player.grounded && player.walkAmount > 0.2) playStep();
      lastStepIdx = stepIdx;
      movedThisFrame = Math.hypot(player.position.x - before.x, player.position.z - before.z);
    }
    tournament.blockHeld = blockKey;
    tournament.update(dt);
    activities.update(dt, { inFight: !!f, dialogOpen: ui.dialogOpen, mounted: horse.mounted, indoor: !!interiors.current, camPitch: cam.pitch });
    tutorial.update(dt, { moved: movedThisFrame, looked: Math.abs(look.dx) + Math.abs(look.dy), nearNPC: !!nearestNPC(), dialogOpen: ui.dialogOpen });
    movedThisFrame = 0;
    ch3.update(dtGame, player.position, ch3Events);
    ch4.update(dtGame, { position: player.position, mounted: horse.mounted }, ch4Events);
    ch5.update(dtGame, { position: player.position, mounted: horse.mounted, h: player.h }, ch5Events);
    // Chapitre IV : arrivée dans la cachette
    if (quests.step === 20 && !ui.dialogOpen && Math.hypot(player.position.x - HIDE.x, player.position.z - HIDE.z) < 2.5) {
      if (horse.mounted) {
        if (!hideToastShown) { ui.toast('Descends de cheval pour te cacher dans les buissons.', 2500); hideToastShown = true; }
      } else {
        quests.goTo(21);
        if (tod.night < 0.7) timeJump(22.5, 'brume', 'À la nuit tombée…', () => ch4.startMeeting());
        else { tod.lockWeather('brume'); ch4.startMeeting(); }
      }
    }
    // Interface de discrétion (filature)
    const si = ch4.stealthInfo();
    $('stealth').classList.toggle('hidden', !si.active);
    if (si.active) {
      $('stealth-fill').style.width = Math.min(100, si.meter * 100) + '%';
      $('stealth').classList.toggle('warn', si.warn);
      $('stealth').classList.toggle('looking', si.looking);
      $('stealth-label').textContent = si.looking ? '👁 Il regarde derrière lui !' : si.warn ? '👁 Il va se retourner…' : '👁 Discrétion';
    }

    // Invite "Parler" / "Monter"
    const near = ui.dialogOpen || f ? null : nearestNPC();
    const key = isTouch ? '💬' : '[E]';
    if (ui.dialogOpen || f || ch5.state.kneeling || ch5.state.mode === 'accolade') ui.setPrompt(null);
    else if (horse.mounted && tournament.event) ui.setPrompt(null);
    else if (horse.mounted) ui.setPrompt(near ? `${key} Parler à ${near.name}` : (Math.abs(horse.speed) < 1.5 ? `${key} Descendre de cheval` : null));
    else if (quests.step === 27 && ch5.nearKneel(player.position)) ui.setPrompt(`${key} T'agenouiller devant le comte`);
    else if (ch6.prompt(player.position, key)) ui.setPrompt(ch6.prompt(player.position, key));
    else if (activities.hunt.nearCarcass(player.position)) ui.setPrompt(`${key} Récupérer la venaison`);
    else if (activities.nearChicken(player.position) >= 0) ui.setPrompt(`${key} Attraper la poule`);
    else if (activities.bow.aiming && !near) ui.setPrompt(isTouch ? '⚔️ Tirer · 🏹 Ranger l\'arc' : '[Clic] Tirer · [B] Ranger l\'arc');
    else if (interiors.nearDoor(player.position)) {
      const d = interiors.nearDoor(player.position);
      ui.setPrompt(d.exit ? `${key} Sortir` : `${key} Entrer dans ${ROOMS[d.id].name}`);
    } else if (interiors.nearAltar(player.position)) ui.setPrompt(`${key} Prier`);
    else if (quests.step >= 7 && horse.position.distanceTo(player.position) < 2.6) ui.setPrompt(`${key} Monter sur Tonnerre`);
    else if (near) ui.setPrompt(`${key} Parler à ${near.name}`);
    else ui.setPrompt(null);

    // Objectif : losange + boussole
    const target = activities.race ? activities.target : tournament.event ? null : (quests.target || (inParis(player.position) || interiors.current ? null : tournament.target || activities.target));
    if (target && !f && !interiors.current) {
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
    ambience.update(dt, player.position, { night: tod.night, rain: tod.rainAmount, indoor: !!interiors.current });

    // Sauvegarde discrète de la position toutes les 8 secondes
    autoSaveIn -= dt;
    if (autoSaveIn < 0) {
      autoSaveIn = 8;
      if (!f && !ui.dialogOpen && !activities.race) save(false);
    }
  }

  for (const n of npcs.list) if (!n.inCombat && n.id !== 'forgeron' && n.id !== 'villageois') n.update(dt, player.position);
  life.update(dt, player.position, tod.night);
  if (paris) { paris.update(dt, player.position, tod.isNight); ch6.update(dt); }
  tod.update(dt, camera.position);
  clockIn -= dt;
  if (clockIn < 0) { clockIn = 0.5; $('clock').textContent = tod.label(); }
  course.update(dt);
  interiors.update(dt);
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
  economy.updateHUD();
  ui.toast(message, 3000);
}

/** Remet le monde dans l'état de l'étape sauvegardée. */
function restoreWorld(data) {
  let step = data.step;
  if (step === 30 || step === 31) step = 29; // le vol au marché recommence
  if (step === 34 || step === 35) step = 33; // la soirée à la taverne recommence
  if (step >= 29 || (data.pos && data.pos[0] < -380)) ensureParis();
  ch6.restore(data.ch6);
  if (step === 14) step = 13; // une embuscade interrompue recommence au départ de l'escorte
  if (step === 21 || step === 22) step = 20; // la rencontre nocturne recommence dans les buissons
  if (typeof data.hour === 'number') tod.setTime(data.hour);
  if (data.weather) { if (data.weatherLocked) tod.lockWeather(data.weather); else tod.setWeather(data.weather, true); }
  ch4.placeForStep(step);
  // Deniers et équipement (les anciennes sauvegardes reçoivent une bourse selon leur avancée)
  if (data.eco) economy.restore(data.eco);
  else {
    const s0 = data.step;
    economy.money = (s0 >= 3 ? 10 : 0) + (s0 >= 5 ? 25 : 0) + (s0 >= 9 ? 15 : 0) + (s0 >= 10 ? 35 : 0) + (s0 >= 15 ? 40 : 0) + (s0 >= 24 ? 60 : 0);
    if (s0 >= 13) economy.owned.epee = true;
  }
  if (Object.keys(economy.owned).length) player.applyEquipment(economy.owned, economy.stats());
  activities.restore(data.act);
  tournament.restore(data.tour);
  applyHero(data.hero || defaultHero());
  if (step === 23 && tod.night < 0.5) { tod.setTime(22.5); tod.lockWeather('brume'); }
  if (step === 26) step = 25; // la chevauchée recommence devant la porte
  ch5.placeForStep(step);
  quests.restore({ ...data, step });
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
  if (step === 27) enterCourt(); // reprise dans la grande salle du comte
  if (step >= 29) ch6.placeForStep();
  if (step === 33 && !tod.isNight) tod.setTime(21);
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
  $('intro').classList.add('hidden');
  openCreator(defaultHero(), (h) => {
    applyHero(h);
    beginPlay(`Montclair, automne 1126 · Bienvenue, ${h.name}`);
    save(false);
    setTimeout(() => tutorial.start(), 3200);
  });
});

// Accès pour le débogage depuis la console du navigateur
window.game = { ch6, ensureParis, getParis: () => paris, mounted, tournament, getHero: () => hero, applyHero, activities, tutorial, player, world, npcs, quests, cam, duel, battle, horse, course, input, ch3, ch4, ch5, tod, life, music, economy, interiors, openPause, closePause, goThroughDoor };
