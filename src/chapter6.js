// Chapitre VI « La Cité du roi » (étapes 29 à 37) : Paris, 1127.
// Le voyage, le vol de la lettre du comte, la poursuite du coupe-bourse, l'audience du roi Louis VI,
// la taverne du Grand Pont, l'embuscade de nuit et le rapport à l'abbé Suger.
import * as THREE from 'three';
import { makeNPC } from './npcs.js?v=202611261852';
import { createHumanoid, createSword, createAxe, createClub, animateWalk } from './humanoid.js?v=202611261852';
import { PARIS, SPOTS, inParis } from './paris.js?v=202611261852';
import { ROOMS } from './interiors.js?v=202611261852';
import { playSuccess, playVictory } from './audio.js?v=202611261852';

const NARR = '';
// Chemin de fuite du voleur (coordonnées locales de Paris)
const FLIGHT = [[11, 4.6], [3, 1], [-20.5, 0], [-20.5, -9], [-20.5, -17]];

export class Chapter6 {
  /**
   * ctx : { scene, world, ui, quests, npcs, player, horse, interiors, battle, economy, timeJump, fadeTo,
   *         showChapter, setCam, leaveRoom, save, hero, ensureParis, onTravel }
   */
  constructor(ctx) {
    Object.assign(this, ctx);
    this.paris = null;
    this.flags = { colin: null };
  }

  get step() { return this.quests.step; }
  W(x, z) { return new THREE.Vector3(PARIS.x + x, 0, PARIS.z + z); }

  /** Appelé une fois que Paris est construit. */
  attach(paris) {
    this.paris = paris;
    const { scene, world } = this;
    // Colin la Fouine, le coupe-bourse du marché
    this.thief = makeNPC(scene, world, {
      id: 'voleur', name: 'Colin la Fouine', x: PARIS.x + 14, z: PARIS.z + 17.5, rotY: -2.2,
      look: { outfit: 'peasant', tunic: 0x5a4a3a, trousers: 0x3a3028, hair: 0x8a5a2a, hood: true },
    });
    this.thief.lines = [['Hé, messire ! Je n\'ai rien fait, moi. Je regarde les étals, c\'est tout.']];
    this.thief.markerHeight = 2.2;
    this.chase = null;
    // Le palefrenier de la porte sud (retour à Montclair)
    this.groom = makeNPC(scene, world, {
      id: 'palefrenier', name: 'Le palefrenier du relais', x: PARIS.x + 13.6, z: PARIS.z + 57, rotY: -Math.PI / 2,
      look: { outfit: 'peasant', tunic: 0x6a5a3a, trousers: 0x3a3028, hair: 0x3a2618 },
    });
    // Combattants de l'embuscade du Grand Pont
    const mk = (look, weapon) => {
      const h = createHumanoid(look);
      const w = weapon();
      w.rotation.x = 0.45;
      h.handR.add(w);
      h.root.visible = false;
      scene.add(h.root);
      return { h, sword: w };
    };
    this.foes = [
      { ...mk({ outfit: 'lord', tunic: 0x2a4a2a, trousers: 0x2a2a20, hair: 0x2a1a10, beard: 0x2a1a10, cloak: 0x2a5a2a }, () => createSword(false)), name: 'L\'homme au manteau vert', hp: 90, speed: 1.2, damageMul: 0.9 },
      { ...mk({ outfit: 'gambeson', trousers: 0x3a3028, hair: 0x3a2a1a, beard: 0x3a2a1a }, createClub), name: 'Un homme de main', hp: 60, speed: 1.25, damageMul: 0.75 },
      { ...mk({ outfit: 'gambeson', trousers: 0x2a2a30, hair: 0x6a4a2a, hood: true }, createAxe), name: 'Un homme de main', hp: 60, speed: 1.3, damageMul: 0.75 },
    ];
    this.placeForStep();
    return [this.thief, this.groom];
  }

  /** Place les personnages selon l'étape (après un chargement ou un saut d'étape). */
  placeForStep() {
    if (!this.paris) return;
    const s = this.step;
    const T = this.thief;
    const conspirators = [this.paris.tav.green, this.paris.tav.thug1, this.paris.tav.thug2];
    const show = (n, on) => { n.object.visible = on; n.circle.top = on ? 99 : -99; };
    show(T, s <= 31 && !(s === 31 && this.flags.colin === 'guet'));
    if (s <= 29) { T.inCombat = false; T.moveTo(PARIS.x + 14, PARIS.z + 17.5, -2.2); }
    if (s === 31 && this.cornered) T.moveTo(this.cornered.x, this.cornered.z, this.cornered.rot);
    for (const n of conspirators) show(n, s <= 34);
    ROOMS.palais.locked = !(s === 32 || s >= 36);
  }

  // ================= Extension du gestionnaire de quêtes =================
  refresh(step) {
    const ui = this.ui, C = 'Chapitre VI · La Cité du roi';
    switch (step) {
      case 29: ui.setQuest(C, 'Traverse le Petit Pont et rends-toi au palais du roi, à la pointe ouest de l\'île de la Cité.'); return true;
      case 30: ui.setQuest(C, 'Au voleur ! Rattrape le coupe-bourse qui t\'a pris la lettre du comte !'); return true;
      case 31: ui.setQuest(C, 'Le voleur est pris. Reprends-lui la lettre du comte.'); return true;
      case 32: ui.setQuest(C, 'Porte la lettre du comte Thibaut au roi, dans la grande salle du palais.'); return true;
      case 33: case 34: ui.setQuest(C, 'À la nuit tombée, entre dans la taverne « Au Cheval Blanc », sur le Grand Pont, et écoute l\'homme au manteau vert sans te faire remarquer.'); return true;
      case 35: ui.setQuest(C, 'Ils t\'ont repéré ! Sors de la taverne… et défends-toi.'); return true;
      case 36: ui.setQuest(C, 'Retourne au palais faire ton rapport au roi et à l\'abbé Suger.'); return true;
      case 37: ui.setQuest('Chevalier du roi', 'Paris est à toi ! Le chapitre VII arrive bientôt… Pour voyager : le palefrenier de la porte sud de Paris, ou Sire Godefroy à Montclair.'); return true;
      default: return false;
    }
  }

  target(step) {
    if (!this.paris) return null;
    const room = this.interiors.current;
    const { royal, tav } = this.paris;
    const marker = (v, h = 2.2) => ({ position: v, markerHeight: h });
    switch (step) {
      case 29: return room ? null : marker(this.W(SPOTS.palaceGate.x + 1, SPOTS.palaceGate.z), 3);
      case 30: case 31: return this.thief;
      case 32: return room === 'palais' ? royal.king : room ? null : marker(this.W(SPOTS.hallDoor.x, SPOTS.hallDoor.z + 0.6), 3.4);
      case 33: return room === 'pontTavern' ? marker(new THREE.Vector3(tav.eavesdrop.x, 0, tav.eavesdrop.z), 1.4) : room ? null : marker(this.W(SPOTS.tavernDoor.x, SPOTS.tavernDoor.z), 3);
      case 35: return room === 'pontTavern' ? marker(new THREE.Vector3(ROOMS.pontTavern.exit.x, 0, ROOMS.pontTavern.exit.z), 2.4) : null;
      case 36: return room === 'palais' ? royal.suger : room ? null : marker(this.W(SPOTS.hallDoor.x, SPOTS.hallDoor.z + 0.6), 3.4);
      default: return null;
    }
  }

  talk(npc) {
    const s = this.step, ui = this.ui, name = this.hero().name;
    // Sire Godefroy propose le voyage
    if (npc.id === 'godefroy' && s >= 28 && !inParis(this.player.position)) {
      const G = npc.name;
      if (s === 28) {
        ui.showChoice(G, `Sire ${name}, un messager du comte Thibaut est arrivé cette nuit. Le comte te confie une mission : porter une lettre au roi Louis, à Paris.`, [
          { label: 'Partir pour Paris (chapitre VI)', value: 'go' },
          { label: 'Pas encore', value: 'later' },
          { label: 'Autre chose', value: 'talk' },
        ], (v) => {
          if (v === 'talk') this.quests.talkTo(npc, true);
          else if (v === 'go') ui.showDialog([
            [G, 'La lettre est scellée du sceau du comte. Ne la confie à personne d\'autre qu\'au roi lui-même.'],
            [G, 'Paris est une grande ville : on y trouve plus de coupe-bourses que de chanoines. Garde la main sur ta ceinture.'],
            [G, 'Va, et que Dieu te garde. Tonnerre restera ici : à Paris, on se déplace à pied dans les ruelles de la Cité.'],
          ], () => this.travelToParis());
        });
        return true;
      }
      if (this.travelAllowed) {
        ui.showChoice(G, 'Tu repars pour Paris ?', [
          { label: 'Retourner à Paris', value: 'go' },
          { label: 'Autre chose', value: 'talk' },
          { label: 'Plus tard', value: 'no' },
        ], (v) => { if (v === 'go') this.travelToParis(); else if (v === 'talk') this.quests.talkTo(npc, true); });
        return true;
      }
      return false;
    }
    if (!this.paris) return false;
    if (npc === this.groom) {
      if (!this.travelAllowed) { ui.showDialog([[npc.name, 'Ce n\'est pas le moment de partir, messire !']]); return true; }
      ui.showChoice(npc.name, 'Les chevaux du relais sont frais. Je peux vous faire reconduire à Montclair, messire. Huit jours de route…', [
        { label: 'Retourner à Montclair', value: 'go' },
        { label: 'Rester à Paris', value: 'no' },
      ], (v) => { if (v === 'go') this.travelToMontclair(); });
      return true;
    }
    if (npc === this.thief && s === 31) { this.talkThief(); return true; }
    const { royal, tav } = this.paris;
    if ((npc === royal.king || npc === royal.suger || npc === royal.queen) && s === 32) { this.audience(); return true; }
    if ((npc === royal.king || npc === royal.suger || npc === royal.queen) && s === 36) { this.report(); return true; }
    if (npc === royal.king) { ui.showDialog([[npc.name, s >= 37 ? `Sire ${name}, chevalier de ma maison ! Paris te doit beaucoup.` : 'Approche, chevalier.']]); return true; }
    if (npc === royal.suger) { ui.showDialog([[npc.name, s >= 37 ? 'Après-demain, nous partons pour Saint-Denis. Repose-toi, mon fils : la route sera longue.' : 'Que Dieu garde le roi.']]); return true; }
    if (npc === royal.queen) { ui.showDialog([[npc.name, 'Le roi a besoin d\'hommes loyaux. Ils se font rares, ces temps-ci.']]); return true; }
    if (npc === tav.green || npc === tav.thug1 || npc === tav.thug2) {
      ui.showDialog([[npc.name, s <= 34 ? 'Passe ton chemin, l\'ami. On parle affaires.' : '…']]);
      return true;
    }
    return false;
  }

  get travelAllowed() {
    const s = this.step;
    return s >= 29 && ![30, 31, 34, 35, 38, 39, 40, 41].includes(s);
  }

  // ================= Voyages =================
  travelToParis() {
    const first = this.step === 28;
    this.fadeTo(() => {
      const { horse, player } = this;
      if (horse.mounted) { horse.setMounted(false); player.dismount(horse); }
      this.ensureParis();
      if (this.interiors.current) this.leaveRoom(true);
      const a = SPOTS.arrival;
      player.position.set(PARIS.x + a.x, 0, PARIS.z + a.z);
      player.object.rotation.y = a.rot;
      this.setCam(a.rot + Math.PI);
      if (first) {
        this.tod.setTime(10);
        this.quests.goTo(29);
      }
      this.placeForStep();
      if (this.onTravel) this.onTravel('paris');
      this.save(false);
    });
    setTimeout(() => {
      if (first) this.showChapter('Chapitre VI', 'La Cité du roi');
      else this.ui.toast('Paris', 2000);
    }, 700);
  }

  travelToMontclair() {
    this.fadeTo(() => {
      if (this.interiors.current) this.leaveRoom(true);
      const { player } = this;
      player.position.set(0, 0, -12);
      player.object.rotation.y = 0;
      this.setCam(Math.PI);
      if (this.onTravel) this.onTravel('montclair');
      this.save(false);
    }, 'De retour à Montclair, après huit jours de route…');
  }

  // ================= Le vol et la poursuite =================
  startTheft() {
    const p = this.player.position, T = this.thief;
    const dir = new THREE.Vector3(Math.sin(this.player.object.rotation.y), 0, Math.cos(this.player.object.rotation.y));
    T.inCombat = true;
    T.moveTo(p.x + dir.x * 1.3, p.z + dir.z * 1.3, Math.atan2(-dir.x, -dir.z));
    this.theftFrom = p.clone();
    this.ui.showDialog([
      [NARR, 'Dans la cohue du marché, un gamin te bouscule…'],
      ['Colin la Fouine', 'Pardon, messire ! Pardon !'],
      [NARR, 'Ta ceinture est plus légère. La lettre du comte ! Le voleur file à toute allure entre les étals !'],
    ], () => {
      // Il a pris de l'avance pendant que tu cherchais ta lettre
      const q = T.object.position, w = FLIGHT[0];
      const dx = PARIS.x + w[0] - q.x, dz = PARIS.z + w[1] - q.z, dd = Math.hypot(dx, dz) || 1;
      T.moveTo(q.x + (dx / dd) * Math.min(5, dd), q.z + (dz / dd) * Math.min(5, dd), Math.atan2(dx, dz));
      this.quests.goTo(30);
      this.chase = { leg: 0, phase: 0, waited: false, t: 0 };
    });
  }

  updateChase(dt) {
    const C = this.chase, T = this.thief, p = T.object.position, pl = this.player.position;
    const d = Math.hypot(pl.x - p.x, pl.z - p.z);
    C.t = (C.t || 0) + dt;
    if (d < 1.6 && C.t > 1.2) { this.cornerThief('caught'); return; }
    const wp = FLIGHT[C.leg];
    if (!wp) { this.cornerThief('cornered'); return; }
    const tx = PARIS.x + wp[0], tz = PARIS.z + wp[1];
    const dx = tx - p.x, dz = tz - p.z, dd = Math.hypot(dx, dz);
    if (dd < 0.5) { C.leg++; return; }
    // Il attend (en narguant) si on le perd de vue
    if (d > 24) {
      if (!C.waited) { C.waited = true; this.ui.toast('« Trop lent, le chevalier ! »', 1800); }
      animateWalk(T.h, C.phase, 0);
      T.moveTo(p.x, p.z, Math.atan2(pl.x - p.x, pl.z - p.z));
      return;
    }
    const sp = 6.2;
    C.phase += dt * 9;
    T.moveTo(p.x + (dx / dd) * sp * dt, p.z + (dz / dd) * sp * dt, Math.atan2(dx, dz));
    animateWalk(T.h, C.phase, 1.3);
  }

  cornerThief(how) {
    const T = this.thief, p = T.object.position, pl = this.player.position;
    this.chase = null;
    animateWalk(T.h, 0, 0);
    const rot = Math.atan2(pl.x - p.x, pl.z - p.z);
    T.moveTo(p.x, p.z, rot);
    this.cornered = { x: p.x, z: p.z, rot };
    this.quests.goTo(31);
    this.ui.toast(how === 'caught' ? 'Tu l\'attrapes par le col !' : 'Le voleur est coincé au fond de la ruelle !', 2200);
  }

  talkThief() {
    const C = 'Colin la Fouine', ui = this.ui;
    ui.showDialog([
      [C, 'Pitié, messire, pitié ! La voilà, votre lettre ! Je ne l\'ai même pas ouverte, je ne sais pas lire !'],
      [C, 'On m\'a payé, je le jure ! Un homme au manteau vert. Deux sous d\'argent pour voler toute lettre scellée qu\'un chevalier porterait au palais.'],
      [C, 'Il a dit qu\'il serait ce soir à la taverne du Cheval Blanc, sur le Grand Pont, pour récupérer ce que j\'aurais pris.'],
    ], () => {
      ui.showChoice(C, 'Qu\'allez-vous faire de moi, messire ?', [
        { label: 'File, et ne vole plus !', value: 'free' },
        { label: 'Je te livre au guet.', value: 'guet' },
      ], (v) => {
        this.flags.colin = v;
        const lines = v === 'free'
          ? [[C, 'Merci, messire ! Colin n\'oublie jamais un bienfait. Si vous avez besoin d\'yeux dans Paris… demandez la Fouine !']]
          : [[NARR, 'Un sergent du guet emmène Colin au Grand Châtelet. Il te jette un regard noir par-dessus l\'épaule.']];
        ui.showDialog([...lines, [NARR, 'Tu as récupéré la lettre du comte. Direction le palais du roi !']], () => {
          playSuccess();
          this.thief.object.visible = false;
          this.thief.circle.top = -99;
          this.quests.goTo(32);
          this.placeForStep();
        });
      });
    });
  }

  // ================= Au palais =================
  audience() {
    const ui = this.ui, { royal } = this.paris, name = this.hero().name;
    const K = royal.king.name, S = royal.suger.name, Q = royal.queen.name;
    ui.showDialog([
      [NARR, 'Tu poses un genou à terre devant le roi Louis, sixième du nom.'],
      [K, `Relève-toi, chevalier. On m'annonce Sire ${name}, de Montclair, avec une lettre du comte Thibaut.`],
      [S, 'Permettez, sire. (Il brise le sceau et lit.) Le comte vous assure de sa fidélité, et promet cent chevaliers si les Garlande prennent les armes.'],
      [K, 'Les Garlande… Étienne de Garlande était mon sénéchal et mon chancelier. Il se croyait plus roi que moi.'],
      [Q, 'Je l\'ai démasqué, et le roi l\'a chassé du palais. Mais il a des amis, jusque dans cette ville.'],
      [NARR, 'Tu racontes le vol de la lettre au marché, et l\'homme au manteau vert.'],
      [S, 'Un homme de Garlande, à coup sûr. S\'il cherchait cette lettre, c\'est qu\'il veut savoir quels barons restent fidèles au roi.'],
      [K, `Sire ${name}, ce soir, va dans cette taverne. Écoute, et ne te fais pas voir. Puis reviens me dire ce que tu as appris.`],
    ], () => {
      this.timeJump(21, null, 'À la nuit tombée…', () => {
        this.leaveRoom(true);
        this.quests.goTo(33);
        this.placeForStep();
        this.save(false);
      });
    });
  }

  // ================= La taverne du Grand Pont =================
  nearEavesdrop(pos) {
    if (this.step !== 33 || this.interiors.current !== 'pontTavern' || !this.paris) return false;
    const e = this.paris.tav.eavesdrop;
    return Math.hypot(pos.x - e.x, pos.z - e.z) < 1.5;
  }

  eavesdrop() {
    const { tav } = this.paris, ui = this.ui;
    const V = tav.green.name, H = 'Un homme de main';
    this.quests.goTo(34);
    const p = this.player;
    p.position.set(tav.eavesdrop.x, 0, tav.eavesdrop.z);
    p.object.rotation.y = 0;
    ui.showDialog([
      [NARR, 'Tu t\'assois à la table voisine, le capuchon sur les yeux, dos aux trois hommes…'],
      [V, 'Le gamin a raté son coup. Un chevalier l\'a rattrapé au marché.'],
      [H, 'Et alors ? On n\'a plus besoin de leur lettre.'],
      [V, 'Monseigneur Étienne voulait savoir quels barons restent fidèles au roi. Tant pis. On frappera à la tête.'],
      [V, 'Après-demain, l\'abbé Suger part pour Saint-Denis avec les chartes du trésor. Les preuves contre monseigneur.'],
      [V, 'Il passera par la plaine, au pied de Montmartre. Pas de témoins. Ni l\'abbé, ni ses chartes.'],
      [NARR, 'L\'homme au manteau vert se lève pour payer… et son regard croise le tien.'],
      [V, 'Toi ! Le chevalier du marché ! Il nous a entendus… Dehors ! Attendez-le sur le pont !'],
      [NARR, 'Les trois hommes sortent en renversant un banc.'],
    ], () => {
      for (const n of [tav.green, tav.thug1, tav.thug2]) { n.object.visible = false; n.circle.top = -99; }
      this.quests.goTo(35);
    });
  }

  /** Appelé quand le joueur sort d'une pièce. */
  onRoomExit(id) {
    if (id === 'pontTavern' && this.step === 35) setTimeout(() => this.bridgeFight(), 500);
  }

  bridgeFight() {
    const b = this.battle, ui = this.ui, p = this.player.position;
    const spawns = [[-1.5, -24], [1.5, -36], [-2, -35]];
    this.foes.forEach((f, i) => { f.spawn = { x: PARIS.x + spawns[i][0], z: PARIS.z + spawns[i][1] }; });
    b.onWin = () => {
      setTimeout(() => ui.showDialog([
        [NARR, 'Blessé, l\'homme au manteau vert recule jusqu\'au parapet… et se jette dans la Seine. Le courant noir l\'emporte.'],
        [NARR, 'Sur le pavé, il a laissé tomber un anneau. Gravé dessus : d\'or à deux fasces de gueules. Les armes des Garlande.'],
      ], () => {
        this.foes[0].h.root.visible = false;
        playSuccess();
        this.quests.goTo(36);
        this.placeForStep();
        this.save(false);
      }), 1200);
    };
    b.onLose = (retry) => ui.showDialog([[NARR, 'Relève-toi ! L\'abbé Suger compte sur toi, même s\'il ne le sait pas encore.']], retry);
    b.start(this.foes, { title: 'Le guet-apens du Grand Pont', label: 'Défends-toi !' });
    if (p) this.ui.toast('Ils t\'attendaient sur le pont !', 2000);
  }

  report() {
    const ui = this.ui, { royal } = this.paris, name = this.hero().name;
    const K = royal.king.name, S = royal.suger.name, Q = royal.queen.name;
    ui.showDialog([
      [NARR, 'Malgré l\'heure tardive, le roi te reçoit. Tu racontes tout : la taverne, Montmartre, le combat sur le pont, l\'anneau des Garlande.'],
      [S, 'Montmartre… Ils veulent ma mort, et brûler les chartes qui prouvent que Garlande a pillé le trésor du roi.'],
      [K, 'Par saint Denis ! Garlande ose s\'en prendre à mon abbé ! Cette fois, il me rendra des comptes.'],
      [Q, 'Ce chevalier de Montclair vaut mieux que la moitié de ta cour, mon époux.'],
      [K, `Sire ${name}, tu as bien servi la couronne. Désormais, tu es chevalier de ma maison. Voici de quoi tenir ton rang.`],
      [S, 'Je partirai pour Saint-Denis malgré tout : les chartes n\'y seront à l\'abri nulle part ailleurs. Me feras-tu l\'honneur de m\'escorter ?'],
      [NARR, 'Tu acceptes. Le chemin de Saint-Denis passe au pied de Montmartre…'],
    ], () => {
      playVictory();
      this.economy.earn(80, ui, 'la bourse du roi');
      this.quests.goTo(37);
      this.placeForStep();
      this.save(false);
      setTimeout(() => this.showChapter('Fin du chapitre VI', 'Le chapitre VII, « La route de Saint-Denis », arrive bientôt…'), 1500);
    });
  }

  // ================= Boucle =================
  /** Texte d'aide à afficher, ou null. */
  prompt(pos, key) {
    if (this.nearEavesdrop(pos)) return `${key} T'asseoir et écouter discrètement`;
    return null;
  }

  interact(pos) {
    if (this.nearEavesdrop(pos)) { this.eavesdrop(); return true; }
    return false;
  }

  update(dt) {
    if (!this.paris) return;
    const s = this.step, pl = this.player.position;
    if (s === 29 && !this.interiors.current) {
      const m = SPOTS.market;
      if (Math.hypot(pl.x - (PARIS.x + m.x), pl.z - (PARIS.z + m.z)) < 6.5 && !this.ui.dialogOpen) this.startTheft();
    }
    if (s === 30) {
      if (!this.chase) this.chase = { leg: 0, phase: 0, waited: false, t: 0 };
      if (!this.ui.dialogOpen) this.updateChase(dt);
    }
    this.thief.inCombat = s === 30;
  }

  serialize() { return { flags: this.flags }; }
  restore(d) { if (d && d.flags) Object.assign(this.flags, d.flags); }
}
