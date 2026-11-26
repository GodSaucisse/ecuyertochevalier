// Le grand tournoi de la Saint-Martin (après l'adoubement) :
// 1. la joute contre Sire Hugues de Vaudrey, 2. la mêlée à cheval, 3. la finale à pied contre le champion.
import * as THREE from 'three';
import { makeNPC } from './npcs.js?v=202611261508';
import { createHumanoid, createSword } from './humanoid.js?v=202611261508';
import { EnemyRider } from './mounted.js?v=202611261508';
import { LISTS } from './layout.js?v=202611261508';
import { playLanceHit, playHurt, playBlock, playBell, playSuccess, playVictory } from './audio.js?v=202611261508';

const $ = (id) => document.getElementById(id);
const TILT = { x: LISTS.x + 2, z0: -16, z1: 36 }; // à l'est de la quintaine du chapitre II
const LANE = { me: TILT.x + 2, him: TILT.x - 2 };
const HERALD = { x: LISTS.x - 4.5, z: LISTS.z0 - 3.5 };

const JOUSTER = { name: 'Sire Hugues de Vaudrey', arms: { field: 'or', charge: 'gueules', pattern: 'croix' }, blanket: 0xa82020, skill: 0.55 };
const MELEE = [
  { name: 'Sire Gui de Brancion', arms: { field: 'sinople', charge: 'argent', pattern: 'bande' }, blanket: 0x2a6a2a, skill: 0.5 },
  { name: 'Sire Eudes de Rochefort', arms: { field: 'gueules', charge: 'or', pattern: 'fasce' }, blanket: 0xa82020, skill: 0.55 },
  { name: 'Sire Aimery de Lusignan', arms: { field: 'pourpre', charge: 'argent', pattern: 'etoile' }, blanket: 0x6a2a6a, skill: 0.6 },
];
const CHAMPION = { name: 'Sire Raimbaud le Noir', arms: { field: 'sable', charge: 'argent', pattern: 'sautoir' } };
const REWARD = { joute: 40, melee: 60, finale: 100 };

export class Tournament {
  /**
   * ctx : { scene, world, ui, quests, economy, horse, player, course, mounted, battle, save, hero, fadeTo, setCam }
   */
  constructor(ctx) {
    Object.assign(this, ctx);
    const { scene, world } = ctx;
    this.done = { joute: false, melee: false, finale: false };
    this.event = null;
    this.lanceUp = false;
    this.freeze = false;
    this.blockHeld = false;

    this.herald = makeNPC(scene, world, {
      id: 'heraut', name: 'Le héraut du comte', x: HERALD.x, z: HERALD.z, rotY: 0.6,
      look: { outfit: 'lord', tunic: 0xa82020, trousers: 0xd8b04a, hair: 0x4a3020, cloak: 0xd8b04a },
      pose: (h) => { h.armR.rotation.x = -0.3; h.elbowR.rotation.x = -1.2; },
    });

    // Barrière centrale de la joute (la « toile »), seulement pendant le tournoi
    this.tilt = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 0.8 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0xa82020, roughness: 0.95 });
    const len = TILT.z1 - TILT.z0;
    for (let z = TILT.z0; z <= TILT.z1; z += 4) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.4, 0.14), wood);
      post.position.set(TILT.x, 0.7, z);
      post.castShadow = true;
      this.tilt.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, len), wood);
    rail.position.set(TILT.x, 1.35, (TILT.z0 + TILT.z1) / 2);
    this.tilt.add(rail);
    const drape = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, len), cloth);
    drape.position.set(TILT.x, 0.85, (TILT.z0 + TILT.z1) / 2);
    drape.castShadow = true;
    this.tilt.add(drape);
    this.tilt.visible = false;
    scene.add(this.tilt);
    this.tiltBox = { minX: TILT.x - 0.15, maxX: TILT.x + 0.15, minZ: TILT.z0, maxZ: TILT.z1, top: -99 };
    world.boxes.push(this.tiltBox);

    // Adversaires
    this.jouster = new EnemyRider(scene, world, { ...JOUSTER, hp: 999 });
    this.jousterLance = ctx.course.lance.clone(true);
    this.jousterLance.visible = true;
    this.jouster.horse.object.add(this.jousterLance);
    this.jouster.sword.visible = false;
    this.riders = MELEE.map((m) => new EnemyRider(scene, world, { ...m, hp: 28, speed: 8.8 }));
    this.riderTargets = this.riders.map((r) => ({
      pos: () => new THREE.Vector3(r.position.x, 2, r.position.z), radius: 0.5, alive: () => !r.down && !!this.event,
      hit: (dmg) => this.onRiderHit(r, dmg),
    }));
    // Champion (combat à pied)
    this.champion = createHumanoid({ outfit: 'mail', trousers: 0x1c1a1a, helmet: true, coif: true, shield: true, arms: CHAMPION.arms, cloak: 0x1c1a1a });
    this.championSword = createSword(false);
    this.championSword.rotation.x = 0.45;
    this.champion.handR.add(this.championSword);
    this.champion.root.visible = false;
    scene.add(this.champion.root);
  }

  get open() { return this.quests.step >= 28; }
  get name() { return this.hero().name; }
  get next() { return ['joute', 'melee', 'finale'].find((k) => !this.done[k]) || null; }

  // ================= Héraut =================
  talk() {
    const ui = this.ui, N = this.herald.name;
    if (!this.open) {
      ui.showDialog([[N, 'Le comte Thibaut donnera bientôt un grand tournoi. Mais la lice est réservée aux chevaliers, écuyer.']]);
      return;
    }
    const titles = { joute: 'La joute contre Sire Hugues de Vaudrey', melee: 'La mêlée à cheval (trois chevaliers)', finale: 'La finale à pied contre Sire Raimbaud le Noir' };
    if (!this.introduced) {
      this.introduced = true;
      ui.showDialog([
        [N, `Oyez, oyez ! Sire ${this.name}, nouveau chevalier de Montclair, le comte Thibaut ouvre en ton honneur le tournoi de la Saint-Martin !`],
        [N, 'Trois épreuves : la joute, la mêlée à cheval, puis la finale à pied contre le champion du comté, Sire Raimbaud le Noir. Invaincu depuis sept ans…'],
        [N, 'Chaque victoire rapporte des deniers et de la gloire. Dis-moi quand tu es prêt.'],
      ], () => this.talk());
      return;
    }
    const opts = [];
    const nx = this.next;
    if (nx) opts.push({ label: `${titles[nx]}`, value: nx });
    for (const k of ['joute', 'melee', 'finale']) if (this.done[k]) opts.push({ label: `Rejouer : ${titles[k].split(' (')[0]}`, value: k });
    opts.push({ label: 'Rappelle-moi les règles', value: 'rules' });
    opts.push({ label: 'Plus tard', value: 'no' });
    const intro = nx ? `Prochaine épreuve : ${titles[nx].toLowerCase()}.` : `Gloire à Sire ${this.name}, champion du tournoi de la Saint-Martin !`;
    ui.showChoice(N, intro, opts.slice(0, 5), (v) => {
      if (v === 'rules') this.rules(nx);
      else if (v !== 'no') this.start(v);
    });
  }

  rules(k) {
    const N = this.herald.name, T = this.ui.isTouch;
    const lines = {
      joute: [
        'La joute : charge au galop en longeant la barrière. Ton adversaire arrive de l\'autre côté.',
        `Quand il est tout près, ${T ? 'touche ⚔️' : 'clique'} pour abaisser ta lance : au bon moment, c'est un coup parfait (2 points), et parfois tu le désarçonnes !`,
        `${T ? 'Maintiens 🛡' : 'Maintiens E'} pendant le passage pour te protéger. Trois passes : le plus de points l'emporte.`,
      ],
      melee: [
        'La mêlée : trois chevaliers contre toi, à cheval, à l\'épée.',
        `${T ? '⚔️ et 💥' : 'Clic gauche et clic droit'} pour frapper en passant. Plus tu vas vite, plus le coup est rude. ${T ? '🛡' : 'E'} pour lever ton écu.`,
        'Ne reste pas immobile : un cavalier à l\'arrêt est une cible facile.',
      ],
      finale: [
        'La finale se dispute à pied, à l\'épée, comme un vrai duel. Sire Raimbaud frappe fort et pare bien.',
        'Garde ton souffle, pare ses coups lourds, et frappe quand il baisse sa garde.',
      ],
    }[k || 'finale'];
    this.ui.showDialog(lines.map((t) => [N, t]));
  }

  // ================= Démarrage d'une épreuve =================
  start(kind) {
    this.fadeTo(() => {
      const { horse, player } = this;
      if (kind === 'finale') {
        if (horse.mounted) { horse.setMounted(false); player.dismount(horse); }
        horse.position.set(LISTS.x + 4.5, 0, LISTS.z1 - 4);
        horse.syncColliders();
        this.startFinale();
        return;
      }
      if (!horse.mounted) horse.setMounted(true);
      if (kind === 'joute') this.startJoust(); else this.startMelee();
    });
  }

  placePlayer(x, z, rot) {
    const { horse, player } = this;
    horse.position.set(x, 0, z);
    horse.object.rotation.y = rot;
    horse.speed = 0;
    horse.syncColliders();
    player.updateMounted(0, horse, this.lanceUp);
    this.setCam(rot + Math.PI);
  }

  countdown(then) {
    this.freeze = true;
    let n = 3;
    const tick = () => {
      if (!this.event) return;
      if (n > 0) { this.ui.toast(String(n), 800); playBell(); n--; setTimeout(tick, 900); }
      else { this.freeze = false; this.ui.toast(this.event.kind === 'joute' ? 'Chargez !' : 'Au combat !', 1100); playBell(); if (then) then(); }
    };
    setTimeout(tick, 600);
  }

  showHud(title) {
    $('mounted-hud').classList.remove('hidden');
    $('mh-title').textContent = title;
    document.body.classList.add('mounted-fight');
  }

  hideHud() {
    $('mounted-hud').classList.add('hidden');
    document.body.classList.remove('mounted-fight');
  }

  // ================= Joute =================
  startJoust() {
    this.event = { kind: 'joute', pass: 0, me: 0, him: 0, phase: 'ready' };
    this.tilt.visible = true;
    this.tiltBox.top = 1.4;
    this.lanceUp = true;
    this.showHud('Joute · ' + JOUSTER.name);
    this.resetPass();
  }

  resetPass() {
    const E = this.event;
    E.pass++;
    E.phase = 'ready';
    E.press = null;
    E.blockedAt = -9;
    E.t = 0;
    this.placePlayer(LANE.me, TILT.z1 + 4, Math.PI);
    this.jouster.place(LANE.him, TILT.z0 - 4, 0);
    this.updateJoustHud();
    this.countdown(() => { E.phase = 'charge'; });
  }

  updateJoustHud(extra = '') {
    const E = this.event;
    $('mh-me').parentElement.parentElement.style.display = 'none';
    $('mh-info').textContent = `Passe ${Math.min(E.pass, 3)}${E.pass > 3 ? ' (décisive)' : '/3'} · Toi ${E.me} – ${E.him} ${JOUSTER.name.replace('Sire ', '')}${extra ? ' · ' + extra : ''}`;
  }

  couch() {
    const E = this.event;
    if (!E || E.kind !== 'joute' || E.phase !== 'charge' || E.press) return;
    E.press = { d: Math.abs(this.horse.position.z - this.jouster.position.z) };
  }

  updateJoust(dt) {
    const E = this.event, J = this.jouster, H = this.horse;
    E.t += dt;
    if (this.blockHeld) E.blockedAt = E.t;
    if (E.phase === 'ready') { J.seat(); J.horse.update(dt, { throttle: 0 }); return; }
    // L'adversaire galope tout droit le long de la barrière
    const jp = J.position;
    if (!J.down) {
      const want = Math.atan2(LANE.him - jp.x, 10);
      const diff = Math.atan2(Math.sin(want - J.horse.heading), Math.cos(want - J.horse.heading));
      const go = E.phase === 'charge' || jp.z < TILT.z1 + 6;
      J.horse.update(dt, { throttle: go ? 1 : 0, gallop: go, turn: THREE.MathUtils.clamp(-diff * 2, -1, 1) });
      J.seat();
      J.h.armR.rotation.set(-0.25, 0, 0.15);
      J.h.elbowR.rotation.x = -1.45;
    } else J.update(dt, { target: H.position });
    if (E.phase === 'charge') {
      const before = E.lastDz ?? (H.position.z - jp.z);
      const dz = H.position.z - jp.z;
      E.lastDz = dz;
      if (Math.sign(before) !== Math.sign(dz) || Math.abs(dz) < 0.3) { E.lastDz = null; this.resolvePass(); }
      else if (Math.abs(dz) < 22 && !E.hinted) { E.hinted = true; this.updateJoustHud(this.ui.isTouch ? '⚔️ abaisse ta lance !' : 'clic : abaisse ta lance !'); }
    } else if (E.phase === 'after') {
      E.wait -= dt;
      if (E.wait <= 0) this.afterPass();
    }
  }

  resolvePass() {
    const E = this.event, H = this.horse, J = this.jouster, ui = this.ui;
    E.phase = 'after';
    E.wait = 2.6;
    E.hinted = false;
    const speed = Math.abs(H.speed);
    const lat = Math.abs(H.position.x - J.position.x);
    let msg, mine = 0;
    const d = E.press ? E.press.d : null;
    if (lat > 6.2) msg = 'Trop loin de la barrière : ta lance ne l\'atteint pas.';
    else if (speed < 6.5) msg = 'Pas assez d\'élan ! Charge au galop (Maj).';
    else if (d === null) msg = 'Tu n\'as pas abaissé ta lance !';
    else if (d <= 9.5) { mine = 2; msg = 'Coup parfait, en plein écu !'; }
    else if (d <= 18) { mine = 1; msg = 'Lance brisée sur son écu !'; }
    else msg = 'Trop tôt : ta lance est retombée avant le choc.';
    let unhorse = mine === 2 && speed > 9.5 && Math.random() < 0.45;
    // Son coup à lui
    const guarded = E.t - E.blockedAt < 0.6;
    const hisHit = Math.random() < JOUSTER.skill;
    let meDown = false;
    if (hisHit) {
      E.him += 1;
      if (guarded) { playBlock(); msg += ' Il te touche, mais ton écu encaisse le choc.'; }
      else { playHurt(); $('hurt').style.opacity = 1; setTimeout(() => { $('hurt').style.opacity = 0; }, 200); meDown = !unhorse && Math.random() < 0.3; msg += meDown ? ' Son coup te jette à bas de ta selle !' : ' Il te touche durement !'; }
    } else msg += ' Sa lance glisse sur toi.';
    if (mine) { playLanceHit(); this.course.cheer(); }
    E.me += mine;
    if (unhorse) { J.hit(9999); msg = 'Coup parfait ! Sire Hugues vide les étriers !'; this.course.cheer(); }
    ui.toast(msg, 2600);
    E.result = unhorse ? 'win' : meDown ? 'lose' : null;
    this.updateJoustHud();
  }

  afterPass() {
    const E = this.event;
    E.phase = 'reset';
    if (!E.result) {
      if (E.pass >= 3 && E.me !== E.him) E.result = E.me > E.him ? 'win' : 'lose';
      else if (E.pass >= 5) E.result = E.me >= E.him ? 'win' : 'lose';
    }
    if (E.result) { this.finish(E.result); return; }
    this.fadeTo(() => this.resetPass(), 'Les chevaliers regagnent leur place…');
  }

  // ================= Mêlée à cheval =================
  startMelee() {
    this.event = { kind: 'melee', hp: 100, phase: 'ready' };
    this.tilt.visible = false;
    this.tiltBox.top = -99;
    this.lanceUp = false;
    this.showHud('Mêlée à cheval');
    $('mh-me').parentElement.parentElement.style.display = '';
    this.placePlayer(LISTS.x, LISTS.z1 - 6, Math.PI);
    this.riders.forEach((r, i) => r.place(LISTS.x - 4 + i * 4, LISTS.z0 + 4, 0));
    for (const t of this.riderTargets) this.mounted.addTarget(t);
    this.updateMeleeHud();
    this.countdown(() => { this.event.phase = 'fight'; });
  }

  updateMeleeHud() {
    const E = this.event;
    $('mh-me').style.width = Math.max(0, E.hp) + '%';
    const left = this.riders.filter((r) => !r.down).length;
    $('mh-info').textContent = left ? `Chevaliers en selle : ${left}` : 'Victoire !';
  }

  onRiderHit(r, dmg) {
    const down = r.hit(dmg);
    if (down) { this.ui.toast(`${r.name} vide les étriers !`, 2000); this.course.cheer(); }
    this.updateMeleeHud();
    if (this.riders.every((x) => x.down)) { this.event.phase = 'end'; setTimeout(() => this.finish('win'), 2200); }
  }

  updateMelee(dt) {
    const E = this.event;
    // Deux chevaliers au plus chargent en même temps ; le troisième attend son tour au bout de la lice
    const p = this.horse.position;
    const order = this.riders.filter((r) => !r.down).sort((a, b) => a.position.distanceTo(p) - b.position.distanceTo(p));
    for (const r of this.riders) {
      if (E.phase === 'ready') { r.seat(); r.horse.update(dt, { throttle: 0 }); continue; }
      const waiting = order.indexOf(r) >= 2;
      const spot = this.waitSpot || (this.waitSpot = new THREE.Vector3());
      if (waiting) spot.set(LISTS.x, 0, p.z > 10 ? LISTS.z0 + 3 : LISTS.z1 - 3);
      r.update(dt, {
        target: waiting ? spot : p,
        onStrike: () => {
          if (E.phase !== 'fight' || waiting || r.position.distanceTo(p) > 3.6) return;
          const guarded = this.blockHeld;
          const dmg = 6 + r.skill * 6;
          if (guarded) { playBlock(); E.hp -= dmg * (this.player.fighter.shield ? 0.2 : 0.5); }
          else {
            E.hp -= dmg;
            playHurt();
            $('hurt').style.opacity = 1;
            setTimeout(() => { $('hurt').style.opacity = 0; }, 200);
          }
          this.updateMeleeHud();
          if (E.hp <= 0) { E.phase = 'end'; this.ui.toast('Tu vides les étriers…', 2000); setTimeout(() => this.finish('lose'), 1800); }
        },
      });
    }
  }

  // ================= Finale à pied =================
  startFinale() {
    this.tilt.visible = false;
    this.tiltBox.top = -99;
    this.lanceUp = false;
    this.event = { kind: 'finale' };
    const { player, battle } = this;
    player.position.set(LISTS.x, 0, 14);
    player.object.rotation.y = Math.PI;
    this.setCam(0);
    this.champion.root.visible = true;
    battle.onWin = () => { this.champion.root.visible = false; this.finish('win'); };
    battle.onLose = (retry) => {
      this.ui.showChoice(CHAMPION.name, 'Rends-toi, chevalier ! Tu t\'es bien battu… Veux-tu une revanche ?', [
        { label: 'Je me relève !', value: 'retry' },
        { label: 'Je me rends', value: 'quit' },
      ], (v) => { if (v === 'retry') retry(); else { battle.end(); this.champion.root.visible = false; this.finish('lose'); } });
    };
    battle.start([{ name: CHAMPION.name, h: this.champion, sword: this.championSword, spawn: { x: LISTS.x, z: 7 }, hp: 170, speed: 1.35, damageMul: 1.0 }],
      { title: 'Finale du tournoi', label: 'Bats le champion du comté !' });
  }

  // ================= Fin d'une épreuve =================
  finish(result) {
    const E = this.event;
    const kind = E.kind;
    this.event = null;
    this.freeze = false;
    this.lanceUp = false;
    this.hideHud();
    for (const t of this.riderTargets) this.mounted.removeTarget(t);
    const N = this.herald.name, ui = this.ui;
    const cleanup = () => {
      this.jouster.hide();
      for (const r of this.riders) r.hide();
      this.tilt.visible = false;
      this.tiltBox.top = -99;
      this.save(false);
    };
    if (result === 'win') {
      const first = !this.done[kind];
      this.done[kind] = true;
      const reward = first ? REWARD[kind] : Math.round(REWARD[kind] / 4);
      playVictory();
      this.course.cheer();
      const lines = {
        joute: [[N, `Victoire de Sire ${this.name} ! La foule acclame le chevalier de Montclair !`]],
        melee: [[N, `Trois chevaliers à terre ! Sire ${this.name} est le dernier en selle !`]],
        finale: [
          [N, `Incroyable ! Sire Raimbaud le Noir est vaincu ! Sire ${this.name} est le champion du tournoi de la Saint-Martin !`],
          [CHAMPION.name, 'Je n\'avais pas mordu la poussière depuis sept ans… Bien joué, Montclair. Tu as gagné mon respect.'],
        ],
      }[kind];
      if (!first) lines.push([N, 'Le public ne s\'en lasse pas !']);
      ui.showDialog(lines, () => {
        this.economy.earn(reward, ui, 'tournoi');
        if (kind === 'finale' && first) { playSuccess(); ui.toast('🏆 Tu es le champion du tournoi !', 3500); }
        cleanup();
      });
    } else {
      const lines = {
        joute: 'Sire Hugues remporte la joute ! Mais la lice reste ouverte : reviens me voir quand tu veux.',
        melee: 'Te voilà à terre… La mêlée est rude. Repose-toi, et reviens tenter ta chance.',
        finale: 'Le champion conserve son titre… pour cette fois. Reviens quand tu voudras !',
      }[kind];
      ui.showDialog([[N, lines]], cleanup);
    }
  }

  // ================= Boucle =================
  update(dt) {
    const E = this.event;
    if (!E) return;
    if (E.kind === 'joute') this.updateJoust(dt);
    else if (E.kind === 'melee') this.updateMelee(dt);
    else if (E.kind === 'finale' && !this.battle.running && !this.ui.dialogOpen && !this.ui.modalOpen) { /* attente */ }
    // Abandon : le joueur est descendu de cheval
    if ((E.kind === 'joute' || E.kind === 'melee') && !this.horse.mounted && this.event) {
      this.event = null;
      this.freeze = false;
      this.lanceUp = false;
      this.hideHud();
      for (const t of this.riderTargets) this.mounted.removeTarget(t);
      this.jouster.hide();
      for (const r of this.riders) r.hide();
      this.tilt.visible = false;
      this.tiltBox.top = -99;
      this.ui.toast('Épreuve abandonnée.', 2000);
    }
  }

  get target() {
    if (!this.open || this.event || this.introduced) return null;
    return this.herald;
  }

  serialize() { return { done: this.done, introduced: !!this.introduced }; }
  restore(d) {
    if (!d) return;
    Object.assign(this.done, d.done || {});
    this.introduced = !!d.introduced;
  }
}
