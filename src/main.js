// Point d'entrée du jeu : assemble le monde, le joueur, les PNJ, la caméra et la boucle de jeu.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { createNPCs } from './npcs.js';
import { QuestManager } from './quests.js';
import { initAudio, playHit, playSwing } from './audio.js';

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

// ---------- Rendu ----------
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Jeu ----------
const world = buildWorld(scene);
const ui = new UI(isTouch);
const input = new Input(renderer.domElement, isTouch);
const player = new Player(scene, world);
const npcs = createNPCs(scene, world);
const quests = new QuestManager({ ui, npcs, world });

// Losange doré au-dessus de l'objectif
const marker = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.22),
  new THREE.MeshStandardMaterial({ color: 0xe8c66a, emissive: 0x8a6a1a, roughness: 0.4, metalness: 0.5 }),
);
scene.add(marker);

// ---------- Caméra à la 3e personne ----------
const cam = { yaw: 0, pitch: 0.35, dist: 6 };
const camTarget = new THREE.Vector3().copy(player.position).add(new THREE.Vector3(0, 1.5, 0));

function updateCamera(dt) {
  const look = input.consumeLook();
  cam.yaw -= look.dx * 0.0025;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + look.dy * 0.0025, -0.25, 1.25);
  cam.dist = THREE.MathUtils.clamp(cam.dist + look.zoom * 0.005, 2.5, 12);

  const desired = player.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  camTarget.lerp(desired, 1 - Math.exp(-dt * 12));
  const cp = Math.cos(cam.pitch);
  camera.position.set(
    camTarget.x + Math.sin(cam.yaw) * cp * cam.dist,
    camTarget.y + Math.sin(cam.pitch) * cam.dist,
    camTarget.z + Math.cos(cam.yaw) * cp * cam.dist,
  );
  if (camera.position.y < 0.3) camera.position.y = 0.3;
  camera.lookAt(camTarget);
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
let time = 0;
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  if (started) {
    const actions = input.consumeActions();
    const talking = ui.dialogOpen;
    if (talking) {
      if (actions.interact || actions.attack || actions.jump) ui.advanceDialog();
    } else {
      const near = nearestNPC();
      if (actions.interact && near) quests.talkTo(near);
      if (actions.attack) player.startAttack();
      if (actions.jump) player.jump();
    }

    const frozen = ui.dialogOpen;
    player.update(dt, frozen ? { x: 0, y: 0 } : input.move, input.run, cam.yaw);
    checkStrike();

    // Invite "Parler"
    const near = ui.dialogOpen ? null : nearestNPC();
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
  }

  for (const n of npcs.list) n.update(dt, player.position);
  updateCamera(dt);
  world.update(dt, player.position, camera.position);
  renderer.render(scene, camera);
}
frame();

// ---------- Écran titre ----------
if (isTouch) {
  document.getElementById('controls-desktop').classList.add('hidden');
  document.getElementById('controls-touch').classList.remove('hidden');
}
document.getElementById('start').addEventListener('click', () => {
  initAudio();
  document.getElementById('intro').classList.add('hidden');
  ui.showHUD();
  if (isTouch) document.getElementById('touch').classList.remove('hidden');
  input.enabled = true;
  started = true;
  ui.toast('Montclair, automne 1126', 3000);
});

// Accès pour le débogage depuis la console du navigateur
window.game = { player, world, npcs, quests, cam };
