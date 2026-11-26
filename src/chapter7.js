// Chapitre VII « La route de Saint-Denis » (étapes 37 à 42) : escorter l'abbé Suger et les chartes
// du trésor jusqu'à l'abbaye, déjouer l'embuscade des hommes de Garlande au pied de Montmartre.
import * as THREE from 'three';
import { createHumanoid, createSword, createAxe, createClub, animateWalk } from './humanoid.js?v=202611261852';
import { Horse } from './horse.js?v=202611261852';
import { PARIS, inParis } from './paris.js?v=202611261852';
import { NORTH, ROUTE_A, ROUTE_B } from './north.js?v=202611261852';
import { metricBoxUV } from './textures.js?v=202611261852';
import { playSuccess, playVictory } from './audio.js?v=202611261852';

const NARR = '';
const RENAUD = 'Renaud le Vert';

export class Chapter7 {
  /** ctx : { scene, world, ui, quests, player, interiors, battle, economy, timeJump, showChapter, setCam, leaveRoom, save, hero, ch6, getParis, getNorth } */
  constructor(ctx) {
    Object.assign(this, ctx);
    this.convoy = null;
    this.flags = { warned: false };
  }

  get step() { return this.quests.step; }
  W(x, z) { return new THREE.Vector3(PARIS.x + x, 0, PARIS.z + z); }

  /** Construit le convoi (mule, chariot, Suger et le frère convers) et les assaillants. */
  attach() {
    if (this.convoy) return;
    const { scene, world } = this;
    const mule = new Horse(scene, world, { x: PARIS.x, z: PARIS.z + ROUTE_A[0][1], rot: Math.PI, coat: 0x6a5a4a, blanket: 0x1c1a1a });
    mule.object.scale.setScalar(0.82);
    // Chariot
    const cart = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.9 });
    const add = (geo, m, x, y, z, parent = cart) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
    add(metricBoxUV(new THREE.BoxGeometry(1.9, 0.18, 3), 1.9, 0.18, 3), wood, 0, 0.85, 0);
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.08, 0.45, 3), wood, s * 0.92, 1.15, 0);
      const wh = add(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 14).rotateZ(Math.PI / 2), dark, s * 1.05, 0.6, -0.4);
      wh.userData.wheel = true;
      add(new THREE.BoxGeometry(0.07, 0.07, 2.4), wood, s * 0.45, 0.85, 2.3);
    }
    // Le coffre des chartes
    add(new THREE.BoxGeometry(0.9, 0.6, 0.7), new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.6 }), 0, 1.25, -0.8);
    add(new THREE.BoxGeometry(0.95, 0.08, 0.75), new THREE.MeshStandardMaterial({ color: 0xb89040, metalness: 0.8, roughness: 0.4 }), 0, 1.58, -0.8);
    scene.add(cart);
    const sit = (h) => {
      h.legL.rotation.x = h.legR.rotation.x = -1.5;
      h.kneeL.rotation.x = h.kneeR.rotation.x = 1.4;
      h.armL.rotation.x = h.armR.rotation.x = -0.6;
      h.elbowL.rotation.x = h.elbowR.rotation.x = -0.8;
    };
    const suger = createHumanoid({ outfit: 'peasant', tunic: 0x1c1a1a, trousers: 0x1c1a1a, hood: true, hair: 0x6a5a4a });
    sit(suger);
    suger.root.position.set(-0.45, 0.55, 0.9);
    cart.add(suger.root);
    const driver = createHumanoid({ outfit: 'peasant', tunic: 0x5a4a3a, trousers: 0x3a3028, hood: true, hair: 0x4a3020 });
    sit(driver);
    driver.root.position.set(0.45, 0.55, 0.9);
    cart.add(driver.root);
    this.convoy = { mule, cart, suger, driver, circle: { x: 0, z: 0, r: 1.4, top: 99 }, leg: 1, route: ROUTE_A, waiting: false, toastIn: 0 };
    world.circles.push(this.convoy.circle);
    this.hideConvoy();

    // Les hommes de Garlande
    const mk = (look, weapon, name, hp, speed, damageMul) => {
      const h = createHumanoid(look);
      const w = weapon();
      w.rotation.x = 0.45;
      h.handR.add(w);
      h.root.visible = false;
      scene.add(h.root);
      return { h, sword: w, name, hp, speed, damageMul };
    };
    this.foes = [
      mk({ outfit: 'mail', trousers: 0x2a2a20, hair: 0x2a1a10, beard: 0x2a1a10, cloak: 0x2a5a2a, shield: true, arms: { field: 'or', charge: 'gueules', pattern: 'fasce' } }, () => createSword(false), RENAUD, 120, 1.2, 1.0),
      mk({ outfit: 'gambeson', trousers: 0x3a3028, hair: 0x3a2a1a, beard: 0x3a2a1a, hood: true }, createAxe, 'Un homme de Garlande', 60, 1.3, 0.8),
      mk({ outfit: 'gambeson', trousers: 0x2a2a30, hair: 0x6a4a2a }, createClub, 'Un homme de Garlande', 60, 1.25, 0.75),
      mk({ outfit: 'peasant', tunic: 0x3a3a30, trousers: 0x3a3028, hair: 0x1a1410, hood: true }, () => createSword(false), 'Un homme de Garlande', 60, 1.3, 0.8),
    ];
    // Colin la Fouine (si on l'a laissé filer au chapitre VI)
    this.colin = createHumanoid({ outfit: 'peasant', tunic: 0x5a4a3a, trousers: 0x3a3028, hair: 0x8a5a2a, hood: true });
    this.colin.root.visible = false;
    scene.add(this.colin.root);
  }

  hideConvoy() {
    const C = this.convoy;
    C.mule.setMounted(false);
    C.mule.object.visible = C.cart.visible = false;
    C.mule.circle.top = C.mule.circle2.top = -99;
    C.circle.top = -99;
    C.active = false;
  }

  /** Met le convoi en place sur la route (au point i de l'itinéraire). */
  placeConvoy(route, leg) {
    const C = this.convoy;
    const [x, z] = route[leg - 1];
    const [nx, nz] = route[Math.min(leg, route.length - 1)];
    C.route = route;
    C.leg = leg;
    C.mule.position.set(PARIS.x + x, 0, PARIS.z + z);
    C.mule.object.rotation.y = Math.atan2(nx - x, nz - z);
    C.mule.speed = 0;
    C.mule.setMounted(true);
    C.mule.object.visible = C.cart.visible = true;
    C.circle.top = 99;
    C.active = true;
    C.stopped = false;
    this.syncCart(0);
  }

  syncCart(dt) {
    const C = this.convoy, m = C.mule, h = m.heading;
    C.cart.position.set(m.position.x - Math.sin(h) * 2.7, 0, m.position.z - Math.cos(h) * 2.7);
    C.cart.rotation.y = h;
    C.circle.x = C.cart.position.x;
    C.circle.z = C.cart.position.z;
    for (const c of C.cart.children) if (c.userData.wheel) c.rotation.x -= (m.speed * dt) / 0.6;
  }

  /** Place décors et personnages selon l'étape. */
  placeForStep() {
    const P = this.getParis();
    if (!P) return;
    this.attach();
    const N = this.getNorth();
    const s = this.step;
    P.setNorthGate(s >= 38);
    N.setTrunk(s >= 38 && s <= 39);
    for (const f of this.foes) f.h.root.visible = false;
    if (s === 38) this.placeConvoy(ROUTE_A, 1);
    else if (s === 40) this.placeConvoy(ROUTE_B, 1);
    else if (s === 41) { this.placeConvoy(ROUTE_B, ROUTE_B.length); this.convoy.stopped = true; }
    else if (s !== 39) this.hideConvoy();
    for (const m of N.monks) m.object.visible = true;
  }

  // ================= Extension du gestionnaire de quêtes =================
  refresh(step) {
    const ui = this.ui, C = 'Chapitre VII · La route de Saint-Denis';
    switch (step) {
      case 37: ui.setQuest('Chevalier du roi', 'Quand tu seras prêt, rejoins l\'abbé Suger dans la grande salle du palais pour partir vers Saint-Denis (chapitre VII).'); return true;
      case 38: ui.setQuest(C, 'Escorte le chariot de l\'abbé Suger jusqu\'à Saint-Denis. Reste près de lui.'); return true;
      case 39: ui.setQuest(C, 'Embuscade ! Protège l\'abbé Suger et les chartes du roi !'); return true;
      case 40: ui.setQuest(C, 'La route est libre. Escorte le chariot jusqu\'à l\'abbaye de Saint-Denis.'); return true;
      case 41: ui.setQuest(C, 'Vous voici à Saint-Denis. Parle à l\'abbé Suger devant la porte de l\'abbaye.'); return true;
      case 42: ui.setQuest('Chevalier du roi', 'Les chartes sont à l\'abri. Le chapitre VIII arrive bientôt… En attendant, Paris et Montclair sont à toi.'); return true;
      default: return false;
    }
  }

  target(step) {
    if (!this.convoy || !this.getParis()) return null;
    const C = this.convoy, room = this.interiors.current;
    switch (step) {
      case 37: {
        if (!inParis(this.player.position) && !room) return null;
        const P = this.getParis();
        return room === 'palais' ? P.royal.suger : room ? null : { position: this.W(P.SPOTS.hallDoor.x, P.SPOTS.hallDoor.z + 0.6), markerHeight: 3.4 };
      }
      case 38: case 40: return { position: C.cart.position, markerHeight: 3 };
      case 41: return { position: C.cart.position, markerHeight: 3 };
      default: return null;
    }
  }

  talk(npc) {
    const s = this.step, P = this.getParis();
    if (!P) return false;
    if (npc === P.royal.suger && s === 37) {
      this.ui.showChoice(npc.name, 'Les chartes sont prêtes, et mon chariot aussi. Partons-nous pour Saint-Denis, chevalier ?', [
        { label: 'En route ! (chapitre VII)', value: 'go' },
        { label: 'Pas encore', value: 'no' },
      ], (v) => { if (v === 'go') this.depart(); });
      return true;
    }
    if (npc === P.royal.suger && s >= 38) { this.ui.showDialog([[npc.name, s >= 42 ? 'Je retourne bientôt à Saint-Denis. Mes moines m\'y attendent, et mes plans d\'une église nouvelle.' : 'Que Dieu nous garde sur la route.']]); return true; }
    return false;
  }

  // ================= Le départ =================
  depart() {
    this.timeJump(7, null, 'Deux jours plus tard, à l\'aube…', () => {
      this.leaveRoom();
      const p = this.player;
      p.position.set(PARIS.x + NORTH.start.x + 1.5, 0, PARIS.z + NORTH.start.z);
      p.object.rotation.y = Math.PI;
      this.setCam(0);
      this.quests.goTo(38);
      this.placeForStep();
      this.flags.warned = false;
      this.save(false);
      setTimeout(() => this.showChapter('Chapitre VII', 'La route de Saint-Denis'), 600);
      setTimeout(() => this.ui.showDialog([
        ['L\'abbé Suger', 'Les chartes du trésor sont dans ce coffre. Elles prouvent ce que Garlande a volé au roi. Elles doivent arriver à Saint-Denis.'],
        ['L\'abbé Suger', 'Frère Ernaud mènera la mule. Toi, chevalier, ouvre l\'œil… et reste près de nous.'],
      ]), 4300);
    });
  }

  // ================= L'escorte =================
  updateConvoy(dt) {
    const C = this.convoy;
    if (!C.active) return;
    const m = C.mule, pl = this.player.position;
    const dist = Math.hypot(pl.x - C.cart.position.x, pl.z - C.cart.position.z);
    const wp = C.route[C.leg];
    let throttle = 0, turn = 0;
    const paused = this.ui.dialogOpen || C.stopped;
    if (!wp || paused) throttle = 0;
    else {
      const tx = PARIS.x + wp[0], tz = PARIS.z + wp[1];
      const want = Math.atan2(tx - m.position.x, tz - m.position.z);
      const diff = Math.atan2(Math.sin(want - m.heading), Math.cos(want - m.heading));
      turn = THREE.MathUtils.clamp(-diff * 2, -1, 1);
      C.waiting = dist > 16;
      throttle = C.waiting ? 0 : 0.3;
      if (Math.hypot(tx - m.position.x, tz - m.position.z) < 1.5) C.leg++;
      C.toastIn -= dt;
      if (C.waiting && C.toastIn <= 0) { C.toastIn = 8; this.ui.toast('L\'abbé Suger t\'attend. Reste près du chariot !', 2400); }
    }
    m.update(dt, { throttle, turn });
    this.syncCart(dt);
    if (!wp && C.route === ROUTE_A && this.step === 38) this.springAmbush();
    if (!wp && C.route === ROUTE_B && this.step === 40) this.arrive();
  }

  /** Colin vient prévenir (si on l'a laissé filer au chapitre VI). */
  colinWarning() {
    this.flags.warned = true;
    const c = this.colin, pl = this.player.position;
    c.root.position.set(pl.x - 3, 0, pl.z + 14);
    c.root.visible = true;
    this.colinRun = { t: 0 };
    this.convoy.stopped = true;
  }

  updateColin(dt) {
    const R = this.colinRun, c = this.colin.root, pl = this.player.position;
    const dx = pl.x - c.position.x, dz = pl.z - c.position.z, d = Math.hypot(dx, dz);
    R.t += dt;
    if (d > 1.8 && R.t < 8) {
      c.position.x += (dx / d) * 6 * dt;
      c.position.z += (dz / d) * 6 * dt;
      c.rotation.y = Math.atan2(dx, dz);
      animateWalk(this.colin, R.t * 9, 1.3);
      return;
    }
    animateWalk(this.colin, 0, 0);
    this.colinRun = null;
    this.ui.showDialog([
      ['Colin la Fouine', 'Messire ! Messire ! Ouf… j\'ai couru depuis le Grand Pont !'],
      ['Colin la Fouine', 'Vous m\'avez laissé filer, alors je vous dois bien ça : des hommes armés vous attendent au pied de Montmartre. Cachés dans les fourrés, à gauche de la route.'],
      ['Colin la Fouine', 'J\'en ai vu un partir chercher du renfort, mais il ne reviendra pas à temps. Ils ne seront que trois… et le chef au manteau vert.'],
      ['L\'abbé Suger', 'Que Dieu bénisse ce garçon ! Chevalier, nous savons où ils sont. C\'est nous qui les surprendrons.'],
    ], () => {
      this.convoy.stopped = false;
      this.colin.root.visible = false;
    });
  }

  springAmbush() {
    const C = this.convoy, ui = this.ui;
    C.stopped = true;
    this.quests.goTo(39);
    const warned = this.flags.warned;
    const foes = warned ? this.foes.slice(0, 3) : this.foes;
    const spots = [[-6, -192], [-8, -185], [-7, -198], [3.5, -200]];
    foes.forEach((f, i) => { f.spawn = { x: PARIS.x + spots[i][0], z: PARIS.z + spots[i][1] }; });
    const lines = warned ? [
      [NARR, 'Un arbre abattu barre la route. Comme Colin l\'avait dit, les fourrés bougent à gauche du chemin…'],
      [this.hero().name, 'Sortez de là, hommes de Garlande ! On vous attendait !'],
      [RENAUD, 'L\'abbé est bien gardé, à ce que je vois… Peu importe. Tue le chevalier, et brûlez le coffre !'],
    ] : [
      [NARR, 'Un arbre abattu barre la route. Le frère Ernaud arrête la mule…'],
      [RENAUD, 'Bonjour, l\'abbé ! Encore toi, le chevalier ? La Seine ne m\'a pas eu, tu vois.'],
      [RENAUD, 'Je suis Renaud, écuyer de monseigneur Étienne de Garlande. Et ces chartes ne verront jamais Saint-Denis. À l\'attaque !'],
    ];
    ui.showDialog(lines, () => {
      this.battle.onWin = () => setTimeout(() => this.afterAmbush(), 1200);
      this.battle.onLose = (retry) => ui.showDialog([['L\'abbé Suger', 'Relève-toi, mon fils ! Dieu combat avec toi !']], retry);
      this.battle.start(foes, { title: 'L\'embuscade de Montmartre', label: 'Protège l\'abbé Suger !' });
    });
  }

  afterAmbush() {
    const ui = this.ui, name = this.hero().name;
    ui.showDialog([
      [RENAUD, 'Assez… Je me rends. Tu m\'as vaincu deux fois, chevalier. On ne me reprendra pas à jouer les assassins.'],
      ['L\'abbé Suger', 'Qui t\'envoie, Renaud ? Parle, et le roi sera peut-être clément.'],
      [RENAUD, 'Monseigneur Étienne s\'est retranché dans son château de Livry, à l\'est de Paris. Il lève des hommes et fortifie ses murs.'],
      [RENAUD, 'Il dit que le roi n\'osera jamais l\'assiéger. Il se trompe peut-être… si le roi a beaucoup de chevaliers comme celui-là.'],
      ['L\'abbé Suger', `Des sergents du roi te ramèneront à Paris. Sire ${name}, aide frère Ernaud à dégager ce tronc. Saint-Denis nous attend.`],
    ], () => {
      for (const f of this.foes) f.h.root.visible = false;
      this.getNorth().setTrunk(false);
      playSuccess();
      this.economy.earn(30, ui, 'la bourse de Renaud');
      this.quests.goTo(40);
      const C = this.convoy;
      C.route = ROUTE_B;
      C.leg = 0;
      C.stopped = false;
      this.save(false);
    });
  }

  arrive() {
    this.convoy.stopped = true;
    this.quests.goTo(41);
    this.ui.toast('Saint-Denis !', 2200);
    this.save(false);
  }

  nearCart(pos) {
    if (this.step !== 41 || !this.convoy) return false;
    const c = this.convoy.cart.position;
    return Math.hypot(pos.x - c.x, pos.z - c.z) < 3.2;
  }

  prompt(pos, key) { return this.nearCart(pos) ? `${key} Parler à l'abbé Suger` : null; }
  interact(pos) { if (this.nearCart(pos)) { this.finale(); return true; } return false; }

  finale() {
    const ui = this.ui, name = this.hero().name, S = 'L\'abbé Suger';
    ui.showDialog([
      [S, 'Nous y voilà. Saint-Denis, où reposent les rois de France depuis Dagobert.'],
      [S, 'Regarde cette vieille église, chevalier. Sombre, étroite, trop petite pour les pèlerins qui s\'y écrasent les jours de fête.'],
      [S, 'Un jour, je la rebâtirai. Haute, avec de grands vitraux, pour que la lumière de Dieu inonde tout. Une lumière nouvelle…'],
      [S, 'Les chartes sont à l\'abri. Garlande ne peut plus nier ses vols. Mais il s\'est enfermé à Livry, et le roi devra aller l\'y chercher.'],
      [S, `Tiens, Sire ${name}. Une lettre scellée du roi. Quand il marchera sur Livry, il veut que tu chevauches à ses côtés.`],
    ], () => {
      playVictory();
      this.economy.earn(60, ui, 'les remerciements de l\'abbé');
      this.quests.goTo(42);
      this.convoy.stopped = true;
      this.save(false);
      setTimeout(() => this.showChapter('Fin du chapitre VII', 'Le chapitre VIII, « Le siège de Livry », arrive bientôt…'), 1200);
    });
  }

  // ================= Boucle =================
  update(dt) {
    if (!this.convoy) return;
    const s = this.step;
    if (this.convoy.active) {
      if (s === 38 && !this.flags.warned && this.ch6.flags.colin === 'free' && this.convoy.mule.position.z < PARIS.z - 140 && !this.ui.dialogOpen) this.colinWarning();
      if (this.colinRun) this.updateColin(dt);
      else if (s === 38 || s === 40 || s === 41) this.updateConvoy(dt);
    }
  }

  serialize() { return { flags: this.flags }; }
  restore(d) { if (d && d.flags) Object.assign(this.flags, d.flags); }
}
