// Activités hors de l'histoire : arc et concours de tir, chasse, dés, course à cheval,
// quêtes secondaires (poules d'Aude, lettre pour frère Odon, gibier pour le banquet) et journal.
import * as THREE from 'three';
import { makeNPC } from './npcs.js?v=202611261414';
import { createHumanoid } from './humanoid.js?v=202611261414';
import { Horse } from './horse.js?v=202611261414';
import { BowSystem } from './bow.js?v=202611261414';
import { Hunt } from './hunt.js?v=202611261414';
import { HERMIT } from './layout.js?v=202611261414';
import { playSuccess, playCluck, playBell } from './audio.js?v=202611261414';

const ARCHER_SPOT = { x: 19.9, z: 6.2 };
const AUDE_SPOT = { x: -8.5, z: 27.5 };
const CHICKEN_SPOTS = [{ x: -9, z: 7 }, { x: 15, z: 7 }, { x: 31, z: 21 }, { x: -22, z: 52 }];
const RACE_START = { player: { x: 1.8, z: -15.5 }, rival: { x: -1.8, z: -15.5 } };
const DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function mat(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }); }

/** Panneau « ! » (quête à prendre) ou « ? » (quête à rendre) au-dessus d'un personnage. */
function questSign() {
  const make = (ch) => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 54px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 6;
    g.strokeStyle = '#3a2408';
    g.strokeText(ch, 32, 34);
    g.fillStyle = '#f0c850';
    g.fillText(ch, 32, 34);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const tex = { '!': make('!'), '?': make('?') };
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex['!'], depthTest: false, transparent: true }));
  s.scale.set(0.5, 0.5, 0.5);
  s.position.y = 2.45;
  s.renderOrder = 10;
  s.visible = false;
  s.userData.set = (ch) => {
    s.visible = !!ch;
    if (ch && s.material.map !== tex[ch]) { s.material.map = tex[ch]; s.material.needsUpdate = true; }
  };
  return s;
}

function buildChicken() {
  const g = new THREE.Group();
  const feathers = mat(0xc8b090), yellow = mat(0xd8a030), red = mat(0xb02018);
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(new THREE.SphereGeometry(0.15, 10, 8), feathers, 0, 0.22, 0).scale.set(0.85, 0.9, 1.15);
  add(new THREE.ConeGeometry(0.08, 0.16, 6), feathers, 0, 0.32, -0.15).rotation.x = -0.9;
  add(new THREE.SphereGeometry(0.065, 8, 6), feathers, 0, 0.36, 0.13);
  add(new THREE.ConeGeometry(0.02, 0.06, 4).rotateX(Math.PI / 2), yellow, 0, 0.35, 0.2);
  add(new THREE.BoxGeometry(0.015, 0.05, 0.06), red, 0, 0.425, 0.14);
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4), yellow, s * 0.05, 0.07, 0);
  return g;
}

/** Petite cabane d'ermite en bois, porte à l'est. */
function buildHut(scene, world, { x, z }) {
  const wood = mat(0x6a4a2c), dark = mat(0x3a2818), thatch = mat(0x8a7440);
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  scene.add(g);
  const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(4, 2.2, 3.6), wood, -0.4, 1.1, 0);
  const roof = add(new THREE.ConeGeometry(3.4, 1.8, 4), thatch, -0.4, 3.1, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.9);
  add(new THREE.BoxGeometry(0.06, 1.6, 0.9), dark, 1.62, 0.8, 0.4);
  // Croix de bois et tas de bûches
  add(new THREE.BoxGeometry(0.1, 1.4, 0.1), dark, 2.6, 0.7, -1.6);
  add(new THREE.BoxGeometry(0.1, 0.1, 0.6), dark, 2.6, 1.1, -1.6);
  for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.12, 0.12, 1.1, 7).rotateZ(Math.PI / 2), wood, -0.4 + (i % 3) * 0.26 - 0.26, 0.12 + Math.floor(i / 3) * 0.22, 2.2);
  world.boxes.push({ minX: x - 2.4, maxX: x + 1.6, minZ: z - 1.8, maxZ: z + 1.8, top: 4 });
  world.addBare({ minX: x - 3, maxX: x + 5, minZ: z - 3, maxZ: z + 3 });
}

export class Activities {
  /**
   * ctx : { scene, world, ui, npcs, quests, economy, horse, course, player, interiors, save }
   */
  constructor(ctx) {
    Object.assign(this, ctx);
    this.save = ctx.save;
    const { scene, world } = ctx;
    this.hasBow = false;
    this.venison = 0;
    this.records = { archery: 0, race: 0, diceWins: 0, deer: 0, raceWins: 0 };
    this.side = {
      poules: { state: 'none', caught: [] },
      lettre: { state: 'none' },
      gibier: { state: 'none' },
    };
    this.contest = null;
    this.race = null;
    this.freezeMount = false;

    // --- Personnages ---
    this.guillaume = makeNPC(scene, world, {
      id: 'archer', name: 'Guillaume, archer', x: ARCHER_SPOT.x, z: ARCHER_SPOT.z, rotY: Math.PI / 2,
      look: { outfit: 'gambeson', tunic: 0x4a5a2a, trousers: 0x3a3028, hood: true, hair: 0x6a4a2a, beard: 0x6a4a2a },
      pose: (h) => { h.elbowL.rotation.x = -0.3; },
    });
    this.aude = makeNPC(scene, world, {
      id: 'aude', name: 'Aude, fermière', x: AUDE_SPOT.x, z: AUDE_SPOT.z, rotY: Math.PI / 2,
      look: { outfit: 'dress', tunic: 0x8a6a3a, hair: 0x3a2618 },
      pose: (h) => { h.elbowL.rotation.x = -1.2; h.elbowR.rotation.x = -1.2; },
    });
    buildHut(scene, world, HERMIT);
    this.odon = makeNPC(scene, world, {
      id: 'odon', name: 'Frère Odon, ermite', x: HERMIT.x + 3, z: HERMIT.z + 0.4, rotY: Math.PI / 2,
      look: { outfit: 'peasant', tunic: 0x4a3a2a, hood: true, beard: 0xc8c0b0, hair: 0xc8c0b0 },
      pose: (h) => { h.armL.rotation.x = -0.5; h.elbowL.rotation.x = -1.3; h.armR.rotation.x = -0.5; h.elbowR.rotation.x = -1.3; },
    });
    this.extraNPCs = [this.guillaume, this.aude, this.odon];
    this.signs = new Map();
    for (const n of [this.guillaume, this.aude, this.odon, ...this.npcsById(['anselme', 'hersende'])]) {
      const s = questSign();
      n.object.add(s);
      this.signs.set(n, s);
    }

    // --- Arc et cibles ---
    this.bow = new BowSystem(scene, world);
    for (const z of [-4, 4]) {
      this.bow.addRing(new THREE.Vector3(31.84, 1, z), new THREE.Vector3(-1, 0, 0), 0.7, (score) => this.onTargetHit(score));
    }
    this.bow.onShot = () => this.onShot();

    // --- Gibier ---
    this.hunt = new Hunt(scene, world, (x, z) => {
      if (world.isBare(x, z) || (Math.abs(x) < 32 && z < -12)) return false;
      const p = new THREE.Vector3(x, 0, z);
      world.resolve(p, 1.2);
      return Math.hypot(p.x - x, p.z - z) < 0.01;
    });
    for (const d of this.hunt.deer) {
      const c = new THREE.Vector3();
      this.bow.addSphere(() => this.hunt.center(d, c), 0.75, () => d.alive, () => this.hunt.kill(d));
    }
    this.hunt.onKill = () => {
      this.records.deer++;
      this.ui.toast('Cerf abattu ! Approche-toi pour récupérer la venaison.', 2600);
    };

    // --- Poules échappées ---
    this.chickens = CHICKEN_SPOTS.map((p) => {
      const g = buildChicken();
      g.position.set(p.x, 0, p.z);
      g.visible = false;
      scene.add(g);
      return { g, home: p, hop: 0, cluck: 2 + Math.random() * 4 };
    });
  }

  npcsById(ids) {
    return ids.map((id) => this.npcs.list.find((n) => n.id === id)).filter(Boolean);
  }

  get unlocked() { return this.quests.step >= 5; }

  // ================= Arc =================
  toggleBow() {
    if (!this.hasBow) return;
    this.bow.setAiming(!this.bow.aiming, this.player);
    document.getElementById('crosshair').classList.toggle('hidden', !this.bow.aiming);
  }
  stowBow() {
    if (this.bow.aiming) this.toggleBow();
  }

  onShot() {
    const c = this.contest;
    if (!c) return;
    if (this.player.position.x > 25.5 || Math.abs(this.player.position.z) > 7 || this.player.position.x < 15) {
      this.ui.toast('Cette flèche ne compte pas : tire depuis la ligne, dans l\'enclos.', 2000);
      return;
    }
    c.shots++;
    c.counted = true;
    if (c.shots >= 5) c.endIn = 2.2;
  }

  onTargetHit(score) {
    const c = this.contest;
    this.ui.toast(score >= 9 ? `🎯 ${score} points !` : `${score} point${score > 1 ? 's' : ''}`, 1000);
    if (c && c.counted) { c.score += score; c.counted = false; }
  }

  startContest() {
    this.contest = { shots: 0, score: 0, endIn: -1, counted: false };
    if (!this.bow.aiming) this.toggleBow();
    this.ui.toast('Concours : 5 flèches. Vise le centre des cibles de paille !', 3000);
  }

  endContest() {
    const c = this.contest;
    this.contest = null;
    const N = this.guillaume.name;
    const best = c.score > this.records.archery;
    if (best) this.records.archery = c.score;
    const lines = [[N, `${c.score} points sur 50. ${c.score >= 40 ? 'Par saint Hubert, un vrai archer !' : c.score >= 30 ? 'Belle adresse, écuyer.' : c.score >= 15 ? 'Pas mal, mais il faut viser plus au centre.' : 'Hmm… le bois de la cible ne t\'a rien fait, pourtant.'}`]];
    let reward = 0;
    if (c.score >= 30) reward = this.records.archeryPaid ? 4 : 10;
    if (reward) {
      lines.push([N, this.records.archeryPaid ? 'Tiens, quelques deniers pour la peine.' : 'Comme promis : dix deniers pour qui dépasse trente points.']);
      this.records.archeryPaid = true;
    }
    if (best && c.score > 0) lines.push(['', `Nouveau record au tir à l'arc : ${c.score} points.`]);
    this.ui.showDialog(lines, () => { if (reward) this.economy.earn(reward, this.ui, 'concours de tir'); this.save(false); });
  }

  // ================= Dés =================
  playDice(npc) {
    const N = npc.name;
    if (this.economy.money < 5) { this.ui.showDialog([[N, 'Sans le sou ? Reviens quand ta bourse sonnera, petit.']]); return; }
    const roll = () => [0, 0, 0].map(() => 1 + Math.floor(Math.random() * 6));
    const me = roll(), him = roll();
    const sum = (r) => r.reduce((a, b) => a + b, 0);
    const show = (r) => r.map((v) => DICE[v - 1]).join(' ');
    const a = sum(me), b = sum(him);
    this.economy.money -= 5;
    let result;
    if (a > b) { result = `Tu gagnes ! (+10 deniers)`; this.economy.money += 10; this.records.diceWins++; playSuccess(); }
    else if (a === b) { result = 'Égalité : chacun reprend sa mise.'; this.economy.money += 5; }
    else result = 'Tu perds ta mise de 5 deniers.';
    this.economy.updateHUD();
    this.ui.showDialog([
      [N, 'Trois dés chacun, le plus gros total l\'emporte. Mise : cinq deniers.'],
      ['', `Tes dés : ${show(me)}  =  ${a}`],
      [N, `Les miens : ${show(him)}  =  ${b}`],
      ['', result],
      [N, a > b ? 'Saleté de dés ! Encore une ?' : a === b ? 'Ha ! Les dés sont capricieux.' : 'Hé hé, merci pour la bière, écuyer !'],
    ], () => this.save(false));
  }

  // ================= Course à cheval =================
  get raceAllowed() {
    const s = this.quests.step;
    return s >= 11 && !(s >= 24 && s <= 27) && s !== 19 && s !== 13 && s !== 14;
  }

  offerRace() {
    const B = this.npcs.bertrand.name;
    if (!this.horse.mounted) {
      this.ui.showDialog([[B, 'Une course à cheval jusqu\'à la lice, par les portes à bannières ? Va chercher Tonnerre et reviens me voir en selle !']]);
      return;
    }
    this.ui.showChoice(B, 'Une course par les huit portes, jusqu\'à la lice ? Vingt deniers si tu me bats.', [
      { label: 'En avant !', value: 'go' },
      { label: 'Une autre fois', value: 'no' },
    ], (v) => { if (v === 'go') this.startRace(); });
  }

  startRace() {
    const { horse, scene, world, course } = this;
    const fade = document.getElementById('fade');
    fade.classList.add('on');
    setTimeout(() => {
      if (!this.rival) {
        this.rival = new Horse(scene, world, { x: RACE_START.rival.x, z: RACE_START.rival.z, rot: 0, coat: 0x2a2220, blanket: 0x7a1a1a });
        this.rival.maxSpeed = 9.8;
        this.rider = createHumanoid({ outfit: 'mail', trousers: 0x3a3028, helmet: true, coif: true, beard: 0x3a2a1a, shield: true, scabbard: true });
        scene.add(this.rider.root);
      }
      const r = this.rival;
      const g0 = course.gates[0];
      const face = (p) => Math.atan2(g0.x - p.x, g0.z - p.z);
      r.object.visible = this.rider.root.visible = true;
      r.position.set(RACE_START.rival.x, 0, RACE_START.rival.z);
      r.object.rotation.y = face(RACE_START.rival);
      r.setMounted(true);
      r.speed = 0;
      horse.position.set(RACE_START.player.x, 0, RACE_START.player.z);
      horse.object.rotation.y = face(RACE_START.player);
      horse.speed = 0;
      horse.syncColliders();
      this.player.updateMounted(0, horse, false);
      const b = this.npcs.bertrand;
      b.object.visible = false;
      this.bertTop = b.circle.top;
      b.circle.top = -99;
      this.race = { t: -3.5, me: 0, him: 0, prev: new THREE.Vector3().copy(horse.position), count: 4 };
      this.freezeMount = true;
      course.setActiveGate(0);
      if (this.onCamReset) this.onCamReset(horse.heading + Math.PI);
      fade.classList.remove('on');
    }, 400);
  }

  updateRace(dt) {
    const R = this.race, { horse, course, rival, rider } = this;
    R.t += dt;
    if (R.t < 0) {
      const n = Math.ceil(-R.t);
      if (n !== R.count && n <= 3) { R.count = n; this.ui.toast(String(n), 800); playBell(0.3); }
      rival.update(dt, { throttle: 0 });
    } else {
      if (this.freezeMount) { this.freezeMount = false; this.ui.toast('Partez !', 1000); playBell(0.8); }
      // Bertrand vise la porte suivante
      const g = course.gates[R.him];
      if (g) {
        const want = Math.atan2(g.x - rival.position.x, g.z - rival.position.z);
        const diff = Math.atan2(Math.sin(want - rival.heading), Math.cos(want - rival.heading));
        rival.update(dt, { throttle: 1, gallop: Math.abs(diff) < 0.9, turn: THREE.MathUtils.clamp(-diff * 2.5, -1, 1) });
        if (Math.hypot(g.x - rival.position.x, g.z - rival.position.z) < 3.2) R.him++;
      } else rival.update(dt, { throttle: 0 });
      // Le joueur franchit les portes dans l'ordre
      if (course.crossed(R.me, R.prev, horse.position)) {
        R.me++;
        playBell(0.5);
        course.setActiveGate(R.me);
      }
    }
    R.prev.copy(horse.position);
    const seat = rival.parts.seat.getWorldPosition(new THREE.Vector3());
    rider.root.position.set(seat.x, seat.y - 0.9, seat.z);
    rider.root.rotation.y = rival.heading;
    rival.poseRider(rider, false);
    if (!horse.mounted) { this.endRace('abandon'); return; }
    if (R.me >= course.gates.length) this.endRace('win');
    else if (R.him >= course.gates.length) this.endRace('lose');
  }

  endRace(result) {
    const R = this.race;
    this.race = null;
    this.freezeMount = false;
    this.course.setActiveGate(-1);
    const B = this.npcs.bertrand.name;
    const time = R.t.toFixed(1).replace('.', ',');
    const done = () => {
      this.rival.object.visible = this.rider.root.visible = false;
      this.rival.setMounted(false);
      this.rival.circle.top = this.rival.circle2.top = -99;
      const b = this.npcs.bertrand;
      b.object.visible = true;
      b.circle.top = this.bertTop;
      this.save(false);
    };
    if (result === 'abandon') { this.ui.toast('Course abandonnée.', 2000); done(); return; }
    if (result === 'win') {
      const best = !this.records.race || R.t < this.records.race;
      if (best) this.records.race = +R.t.toFixed(1);
      const reward = this.records.raceWins ? 8 : 20;
      this.records.raceWins++;
      playSuccess();
      this.ui.showDialog([
        [B, `Par tous les saints… Tu m'as battu ! ${time} secondes.`],
        [B, reward === 20 ? 'Une promesse est une promesse : voilà tes vingt deniers.' : 'Tiens, pour la peine. Mais la prochaine fois, je ne te laisserai rien !'],
        ...(best ? [['', `Nouveau record de la course : ${time} s.`]] : []),
      ], () => { this.economy.earn(reward, this.ui, 'course gagnée'); done(); });
    } else {
      this.ui.showDialog([[B, 'Ha ! Tonnerre a des jambes, mais il faut un cavalier pour les mener. Serre tes virages !']], done);
    }
  }

  // ================= Quêtes secondaires =================
  /** Options supplémentaires quand on parle à un personnage (null = rien de spécial). */
  extraOptions(npc) {
    if (!this.unlocked) return null;
    const S = this.side, opts = [];
    const id = npc.id;
    if (id === 'tavernier' && this.venison > 0) opts.push({ label: `Vendre ta venaison (${this.venison} × 8 deniers)`, run: () => this.sellVenison(npc) });
    if (npc.name === 'Un vieux soldat') opts.push({ label: 'Jouer aux dés (5 deniers)', run: () => this.playDice(npc) });
    if (id === 'bertrand' && this.raceAllowed && !this.race) opts.push({ label: 'Course à cheval', run: () => this.offerRace() });
    if (id === 'anselme' && S.lettre.state === 'none') opts.push({ label: 'Puis-je vous rendre service, mon père ?', run: () => this.lettreGive(npc) });
    if (id === 'anselme' && S.lettre.state === 'answer') opts.push({ label: 'Remettre la réponse de frère Odon', run: () => this.lettreDone(npc) });
    if (id === 'hersende' && S.gibier.state === 'none') opts.push({ label: 'Tu as l\'air soucieuse ?', run: () => this.gibierGive(npc) });
    if (id === 'hersende' && S.gibier.state === 'active') opts.push({ label: this.venison >= 2 ? 'Livrer deux pièces de venaison' : `Le gibier (${this.venison}/2)`, run: () => this.gibierDone(npc) });
    return opts.length ? opts : null;
  }

  /** Personnages entièrement gérés ici. Renvoie true si la conversation est prise en charge. */
  talk(npc) {
    if (npc === this.guillaume) { this.talkGuillaume(); return true; }
    if (npc === this.aude) { this.talkAude(); return true; }
    if (npc === this.odon) { this.talkOdon(); return true; }
    return false;
  }

  talkGuillaume() {
    const N = this.guillaume.name, ui = this.ui;
    if (!this.unlocked) {
      ui.showDialog([[N, 'Un écuyer ? Fais d\'abord tes preuves à l\'épée auprès de Bertrand. Ensuite, je t\'apprendrai l\'arc.']]);
      return;
    }
    if (!this.hasBow) {
      ui.showDialog([
        [N, 'Je suis Guillaume, archer de la garde. Un chevalier dédaigne l\'arc, dit-on… mais un chevalier affamé, en forêt, change vite d\'avis !'],
        [N, 'Prends cet arc, je l\'ai taillé dans de l\'if. ' + (ui.isTouch ? 'Touche 🏹 pour le prendre en main, puis ⚔️ pour tirer.' : 'Appuie sur B pour le prendre en main, vise avec la souris et tire avec le clic gauche.')],
        [N, 'Les flèches retombent avec la distance : vise un peu plus haut quand la cible est loin. Et il y a des cerfs dans la forêt…'],
      ], () => {
        this.hasBow = true;
        playSuccess();
        ui.toast('🏹 Tu as reçu un arc !', 2500);
        this.updateTouch();
        this.save(false);
      });
      return;
    }
    ui.showChoice(N, `Alors, on s'entraîne ? Dix deniers à qui dépasse trente points en cinq flèches.${this.records.archery ? ` (Ton record : ${this.records.archery})` : ''}`, [
      { label: 'Concours de tir (5 flèches)', value: 'go' },
      { label: 'Un conseil ?', value: 'tip' },
      { label: 'Rien, merci', value: 'no' },
    ], (v) => {
      if (v === 'go') this.startContest();
      else if (v === 'tip') ui.showDialog([[N, ['Les cerfs ont l\'oreille fine. À cheval, ils te repèrent de bien plus loin : approche-toi à pied.', 'Plus tu attends avant de tirer, plus la corde est tendue. Ne te précipite pas.', 'Raoul, le tavernier, t\'achètera la venaison. Et Hersende en cherche toujours pour la table du seigneur.'][Math.floor(Math.random() * 3)]]]);
    });
  }

  talkAude() {
    const N = this.aude.name, ui = this.ui, S = this.side.poules;
    if (!this.unlocked) { ui.showDialog([[N, 'Bonjour, écuyer ! Fais attention où tu mets les pieds, mes poules sont partout.']]); return; }
    if (S.state === 'none') {
      ui.showDialog([
        [N, 'Ah, écuyer, le ciel t\'envoie ! Quatre de mes poules se sont sauvées par un trou de la clôture.'],
        [N, 'Une est partie vers l\'église, une vers le terrain d\'entraînement, une vers le champ à l\'est… et la dernière s\'est perdue au nord du village, au bord du bois.'],
        [N, 'Ramène-les-moi, s\'il te plaît ! Approche-toi doucement et attrape-les.'],
      ], () => {
        S.state = 'active';
        S.caught = [];
        this.placeChickens();
        ui.toast('Quête : Les poules d\'Aude', 2200);
        this.save(false);
      });
      return;
    }
    if (S.state === 'active') {
      const n = S.caught.length;
      if (n >= 4) {
        ui.showDialog([
          [N, 'Les voilà toutes ! Mes belles… Tu es un ange, écuyer.'],
          [N, 'Tiens, ce n\'est pas grand-chose : quinze deniers, et des œufs frais quand tu voudras.'],
        ], () => { S.state = 'done'; playSuccess(); this.economy.earn(15, ui, 'les poules d\'Aude'); this.save(false); });
      } else ui.showDialog([[N, `Tu en as attrapé ${n} sur 4. Les autres doivent picorer quelque part…`]]);
      return;
    }
    ui.showDialog([[N, 'Mes poules n\'ont plus bougé depuis que tu as bouché le trou… enfin, que mon mari l\'a bouché !']]);
  }

  placeChickens() {
    const S = this.side.poules;
    this.chickens.forEach((c, i) => {
      c.g.visible = S.state === 'active' && !S.caught.includes(i);
      c.g.position.set(c.home.x, 0, c.home.z);
    });
  }

  nearChicken(pos) {
    if (this.side.poules.state !== 'active') return -1;
    return this.chickens.findIndex((c) => c.g.visible && Math.hypot(c.g.position.x - pos.x, c.g.position.z - pos.z) < 1.9);
  }

  catchChicken(i) {
    const S = this.side.poules;
    S.caught.push(i);
    this.chickens[i].g.visible = false;
    playCluck(0.6);
    this.ui.toast(S.caught.length >= 4 ? 'Toutes les poules sont attrapées ! Retourne voir Aude.' : `Poule attrapée (${S.caught.length}/4)`, 2200);
    this.save(false);
  }

  lettreGive(npc) {
    const S = this.side.lettre;
    this.ui.showDialog([
      [npc.name, 'Justement, mon fils. Frère Odon vit en ermite, loin dans la forêt de l\'ouest, au-delà de la vieille croix.'],
      [npc.name, 'Il ne vient jamais au village. Porte-lui cette lettre, veux-tu ? Elle vient de l\'abbaye, et il attend des nouvelles de son frère.'],
    ], () => { S.state = 'carry'; this.ui.toast('Quête : La lettre', 2200); this.save(false); });
  }

  talkOdon() {
    const N = this.odon.name, ui = this.ui, S = this.side.lettre;
    if (S.state === 'carry') {
      ui.showDialog([
        [N, 'Un visiteur ? Voilà bien des saisons… Une lettre ? De l\'abbaye !'],
        ['', 'Le vieil homme lit en silence. Ses yeux s\'embuent.'],
        [N, 'Mon frère est guéri de sa fièvre. Dieu soit loué. Attends, je vais écrire un mot pour le père Anselme.'],
        [N, 'Voilà. Et prends ceci pour ta peine : une prière, et le conseil d\'un vieux soldat devenu moine. La vraie force d\'un chevalier, c\'est de savoir épargner.'],
      ], () => { S.state = 'answer'; playSuccess(); ui.toast('Rapporte la réponse au père Anselme.', 2200); this.save(false); });
      return;
    }
    ui.showDialog([[N, ['Que la paix soit avec toi, mon fils. La forêt est silencieuse, ici. On y entend Dieu.', 'J\'ai porté l\'épée, autrefois. Maintenant, je porte du bois pour l\'hiver.', 'Les cerfs viennent boire au ruisseau, à l\'aube. Mais ne les chasse pas sous ma fenêtre, veux-tu ?'][Math.floor(Math.random() * 3)]]]);
  }

  lettreDone(npc) {
    this.ui.showDialog([
      [npc.name, 'Une réponse d\'Odon ! Son frère est guéri… Quelle bonne nouvelle.'],
      [npc.name, 'Merci, mon fils. Voici vingt deniers de l\'aumônerie. Dépense-les sagement.'],
    ], () => { this.side.lettre.state = 'done'; playSuccess(); this.economy.earn(20, this.ui, 'la lettre'); this.save(false); });
  }

  gibierGive(npc) {
    this.ui.showDialog([
      [npc.name, 'Le seigneur veut de la venaison pour le banquet de la Saint-Michel, et le chasseur est malade…'],
      [npc.name, 'Si tu pouvais m\'en rapporter deux pièces, je t\'en serais bien reconnaissante. ' + (this.hasBow ? 'Il y a des cerfs dans les bois.' : 'Guillaume l\'archer pourrait t\'apprendre à tirer, au terrain d\'entraînement.')],
    ], () => { this.side.gibier.state = 'active'; this.ui.toast('Quête : Gibier pour le banquet', 2200); this.save(false); });
  }

  gibierDone(npc) {
    if (this.venison < 2) {
      this.ui.showDialog([[npc.name, `Il m'en faut deux pièces, et tu en as ${this.venison}. Les cerfs broutent loin du village, dans les bois.`]]);
      return;
    }
    this.venison -= 2;
    this.ui.showDialog([[npc.name, 'Magnifique ! Le cuisinier va être ravi. Voilà vingt-cinq deniers, et une part du banquet pour toi !']],
      () => { this.side.gibier.state = 'done'; playSuccess(); this.economy.earn(25, this.ui, 'gibier pour le banquet'); this.save(false); });
  }

  sellVenison(npc) {
    const n = this.venison;
    this.venison = 0;
    this.ui.showDialog([[npc.name, `${n > 1 ? 'De la belle venaison' : 'Une belle pièce'} ! Ça fera un bon ragoût. Voilà ${n * 8} deniers.`]],
      () => { this.economy.earn(n * 8, this.ui, 'venaison'); this.save(false); });
  }

  takeVenison(d) {
    this.hunt.take(d);
    this.venison++;
    playSuccess();
    this.ui.toast(`🦌 Venaison récupérée (${this.venison})`, 2000);
    this.save(false);
  }

  /** Objectif secondaire à montrer quand l'histoire n'en propose pas. */
  get target() {
    if (this.race) {
      const g = this.course.gates[this.race.me];
      return g ? { position: new THREE.Vector3(g.x, 0, g.z), markerHeight: 4.5 } : null;
    }
    if (this.contest) return null;
    const S = this.side;
    if (S.poules.state === 'active') {
      if (S.poules.caught.length >= 4) return this.aude;
      const p = this.player.position;
      let best = null, bd = 1e9;
      for (const c of this.chickens) {
        if (!c.g.visible) continue;
        const d = c.g.position.distanceTo(p);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) return { position: best.g.position, markerHeight: 1.1 };
    }
    if (S.lettre.state === 'carry') return this.odon;
    if (S.lettre.state === 'answer') return this.npcsById(['anselme'])[0] || null;
    if (S.gibier.state === 'active' && this.venison >= 2) return this.npcsById(['hersende'])[0] ? { position: this.interiorDoor('hall'), markerHeight: 3 } : null;
    return null;
  }

  interiorDoor(id) {
    const d = this.rooms && this.rooms[id] && this.rooms[id].door;
    return d ? new THREE.Vector3(d.x, 0, d.z) : new THREE.Vector3();
  }

  /** Lignes affichées sous l'objectif principal. */
  hudLines() {
    const L = [];
    if (this.race) {
      const R = this.race;
      L.push(R.t < 0 ? 'Course : préparez-vous…' : `Course : porte ${Math.min(R.me + 1, 8)}/8 · ${R.t.toFixed(1).replace('.', ',')} s · Bertrand ${Math.min(R.him, 8)}/8`);
      return L;
    }
    if (this.contest) { L.push(`Concours de tir : flèche ${Math.min(this.contest.shots + 1, 5)}/5 · ${this.contest.score} points`); return L; }
    const S = this.side;
    if (S.poules.state === 'active') L.push(S.poules.caught.length >= 4 ? 'Les poules d\'Aude : retourne voir Aude.' : `Les poules d'Aude : ${S.poules.caught.length}/4`);
    if (S.lettre.state === 'carry') L.push('La lettre : porte-la à frère Odon (forêt de l\'ouest).');
    if (S.lettre.state === 'answer') L.push('La lettre : rapporte la réponse au père Anselme.');
    if (S.gibier.state === 'active') L.push(`Gibier pour le banquet : ${Math.min(this.venison, 2)}/2 (pour Hersende, au château)`);
    if (this.venison > 0 && S.gibier.state !== 'active') L.push(`Venaison : ${this.venison} (à vendre à la taverne)`);
    return L;
  }

  journalHTML() {
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const qt = document.getElementById('quest-title').textContent, qx = document.getElementById('quest-text').textContent;
    const S = this.side;
    const quest = (name, st, desc) => `<li class="${st === 'done' ? 'done' : ''}"><b>${name}</b> — ${st === 'done' ? 'terminée ✔' : esc(desc)}</li>`;
    const items = [];
    if (S.poules.state !== 'none') items.push(quest('Les poules d\'Aude', S.poules.state, `${S.poules.caught.length}/4 poules attrapées`));
    if (S.lettre.state !== 'none') items.push(quest('La lettre', S.lettre.state, S.lettre.state === 'carry' ? 'Porter la lettre à frère Odon, dans la forêt de l\'ouest' : 'Rapporter la réponse au père Anselme'));
    if (S.gibier.state !== 'none') items.push(quest('Gibier pour le banquet', S.gibier.state, `Apporter 2 pièces de venaison à Hersende (${Math.min(this.venison, 2)}/2)`));
    const hints = [];
    if (this.unlocked) {
      if (S.poules.state === 'none') hints.push('Aude, la fermière du village, semble chercher quelque chose.');
      if (S.lettre.state === 'none') hints.push('Le père Anselme, devant l\'église, aurait besoin d\'un service.');
      if (S.gibier.state === 'none') hints.push('Hersende, la servante du château, a l\'air soucieuse.');
      if (!this.hasBow) hints.push('Guillaume l\'archer s\'entraîne au terrain d\'armes.');
    }
    const r = this.records;
    return `
      <h3>${esc(qt)}</h3><p>${esc(qx)}</p>
      <h3>Quêtes secondaires</h3>
      ${items.length ? `<ul>${items.join('')}</ul>` : '<p class="muted">Aucune pour l\'instant.</p>'}
      ${hints.length ? `<ul class="hints">${hints.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
      <h3>Exploits</h3>
      <ul>
        <li>🎯 Record au tir à l'arc : ${r.archery ? r.archery + ' / 50' : '—'}</li>
        <li>🐎 Record de la course : ${r.race ? String(r.race).replace('.', ',') + ' s' : '—'} ${r.raceWins ? `(${r.raceWins} victoire${r.raceWins > 1 ? 's' : ''})` : ''}</li>
        <li>🎲 Parties de dés gagnées : ${r.diceWins}</li>
        <li>🦌 Cerfs chassés : ${r.deer} · venaison en poche : ${this.venison}</li>
      </ul>`;
  }

  updateTouch() {
    const b = document.getElementById('btn-bow');
    if (b) b.classList.toggle('hidden', !this.hasBow);
  }

  // ================= Boucle =================
  update(dt, { inFight, dialogOpen, mounted, indoor, camPitch }) {
    const player = this.player;
    // L'arc se range dans certaines situations
    if (this.bow.aiming && (inFight || mounted || indoor)) this.stowBow();
    this.bow.update(dt);
    if (this.bow.aiming) this.bow.applyPose(player.h, camPitch);
    this.hunt.update(dt, player.position, mounted);
    if (this.contest && this.contest.endIn > 0) {
      this.contest.endIn -= dt;
      if (this.contest.endIn <= 0 && !dialogOpen) this.endContest();
    }
    if (this.race) this.updateRace(dt);

    // Poules échappées : elles s'éloignent quand on approche
    if (this.side.poules.state === 'active') {
      for (const c of this.chickens) {
        if (!c.g.visible) continue;
        const p = c.g.position;
        const dx = p.x - player.position.x, dz = p.z - player.position.z, d = Math.hypot(dx, dz);
        c.cluck -= dt;
        if (c.cluck < 0 && d < 25) { c.cluck = 3 + Math.random() * 5; playCluck(0.4); }
        if (d < 3.5 && d > 0.01) {
          const run = d < 1.2 ? 1.2 : 2.0; // une poule acculée se laisse attraper
          p.x += (dx / d) * run * dt;
          p.z += (dz / d) * run * dt;
          c.g.rotation.y = Math.atan2(dx, dz);
          c.hop += dt * 14;
          p.y = Math.abs(Math.sin(c.hop)) * 0.08;
          this.world.resolve(p, 0.25);
        } else {
          p.y = 0;
          // Revient doucement vers son coin
          const hx = c.home.x - p.x, hz = c.home.z - p.z, hd = Math.hypot(hx, hz);
          if (hd > 4) { p.x += (hx / hd) * 0.6 * dt; p.z += (hz / hd) * 0.6 * dt; c.g.rotation.y = Math.atan2(hx, hz); }
        }
      }
    }

    // « ! » et « ? » au-dessus des personnages
    const S = this.side, on = this.unlocked;
    const set = (npc, ch) => { const s = npc && this.signs.get(npc); if (s) s.userData.set(on ? ch : null); };
    set(this.guillaume, !this.hasBow ? '!' : null);
    set(this.aude, S.poules.state === 'none' ? '!' : S.poules.state === 'active' && S.poules.caught.length >= 4 ? '?' : null);
    set(this.odon, S.lettre.state === 'carry' ? '?' : null);
    const [anselme, hersende] = this.npcsById(['anselme', 'hersende']);
    set(anselme, S.lettre.state === 'none' ? '!' : S.lettre.state === 'answer' ? '?' : null);
    set(hersende, S.gibier.state === 'none' ? '!' : S.gibier.state === 'active' && this.venison >= 2 ? '?' : null);

    const hud = document.getElementById('side-quests');
    const html = this.hudLines().map((l) => `<div>${l}</div>`).join('');
    if (hud.innerHTML !== html) hud.innerHTML = html;
  }

  serialize() {
    return { hasBow: this.hasBow, venison: this.venison, records: this.records, side: this.side };
  }

  restore(d) {
    if (!d) return;
    this.hasBow = !!d.hasBow;
    this.venison = d.venison || 0;
    Object.assign(this.records, d.records || {});
    if (d.side) for (const k of Object.keys(this.side)) if (d.side[k]) Object.assign(this.side[k], d.side[k]);
    this.placeChickens();
    this.updateTouch();
  }
}
