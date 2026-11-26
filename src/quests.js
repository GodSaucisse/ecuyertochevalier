// Histoire et quêtes. Chaque étape a un objectif et une cible (pour la boussole).
import * as THREE from 'three';
import { playSuccess } from './audio.js?v=202611261111';

const HITS_NEEDED = 5;
const NARRATOR = '';

export class QuestManager {
  constructor({ ui, npcs, world }) {
    this.ui = ui;
    this.npcs = npcs;
    this.world = world;
    this.step = 0;
    this.hits = 0;
    this.mathildeIndex = 0;
    this.gateIndex = 0;
    this.joustHits = 0;
    this.refresh();
  }

  /** Objet visé par l'objectif actuel (ou null). */
  get target() {
    switch (this.step) {
      case 0: return this.npcs.godefroy;
      case 1: return this.npcs.bertrand;
      case 2: return this.world.quintain;
      case 3: return this.npcs.bertrand;
      case 4: return this.duelRunning && this.duelRunning() ? null : this.npcs.bertrand;
      case 5: return this.npcs.godefroy;
      case 6: return this.npcs.bertrand;
      case 7: return this.horse && !this.horse.mounted ? this.horse : null;
      case 8: {
        const g = this.course && this.course.gates[this.gateIndex];
        return g ? { position: new THREE.Vector3(g.x, 0, g.z), markerHeight: 4.5 } : null;
      }
      case 9: return this.course ? this.course.joust : null;
      case 10: return this.npcs.bertrand;
      case 11: return this.npcs.godefroy;
      case 12: return this.npcs.godefroy;
      case 13: return this.npcs.godefroy.inCombat ? { position: this.npcs.godefroy.object.position, markerHeight: 3.3 } : this.npcs.godefroy;
      case 16: return { position: this.npcs.godefroy.object.position, markerHeight: 3.3 };
      case 17: return this.npcs.godefroy;
      default: return null;
    }
  }

  refresh() {
    const ui = this.ui;
    switch (this.step) {
      case 0: ui.setQuest('Chapitre I · L\'arrivée', 'Présente-toi à Sire Godefroy, dans la cour du château (au nord).'); break;
      case 1: ui.setQuest('Chapitre I · L\'arrivée', 'Rejoins Bertrand, le maître d\'armes, sur le terrain d\'entraînement (à l\'est).'); break;
      case 2: ui.setQuest('Chapitre I · Premières armes', `Frappe la quintaine avec ton épée de bois (${this.hits}/${HITS_NEEDED}).`); break;
      case 3: ui.setQuest('Chapitre I · Premières armes', 'Retourne voir Bertrand.'); break;
      case 4: ui.setQuest('Chapitre I · En garde !', 'Affronte Bertrand en duel d\'entraînement (parle-lui pour commencer).'); break;
      case 5: ui.setQuest('Chapitre I · En garde !', 'Va raconter ton duel à Sire Godefroy, au château.'); break;
      case 6: ui.setQuest('Chapitre II · En selle', 'Rejoins Bertrand aux écuries, dans la cour du château.'); break;
      case 7: ui.setQuest('Chapitre II · En selle', 'Monte sur Tonnerre : approche-toi du cheval et appuie sur ' + (ui.isTouch ? '💬.' : 'E.')); break;
      case 8: ui.setQuest('Chapitre II · En selle', `Franchis les portes à bannières, dans l'ordre (${this.gateIndex}/8). Suis l'anneau doré.`); break;
      case 9: ui.setQuest('Chapitre II · La lice', `Charge la quintaine au galop et frappe l'écu avec ta lance (${this.joustHits}/3).`); break;
      case 10: ui.setQuest('Chapitre II · La lice', 'Va voir Bertrand à l\'entrée de la lice.'); break;
      case 11: ui.setQuest('Chapitre II · La lice', 'Rentre au château et fais ton rapport à Sire Godefroy.'); break;
      case 12: ui.setQuest('Chapitre III · L\'embuscade', 'Rejoins Sire Godefroy dans la cour du château : il a une mission pour toi.'); break;
      case 13: ui.setQuest('Chapitre III · L\'embuscade', 'Monte sur Tonnerre et escorte Sire Godefroy sur la route de l\'abbaye. Reste près de lui !'); break;
      case 14: ui.setQuest('Chapitre III · L\'embuscade', 'Des brigands ! Défends Sire Godefroy !'); break;
      case 15: ui.setQuest('Chapitre III · L\'embuscade', 'Parle à Sire Godefroy.'); break;
      case 16: ui.setQuest('Chapitre III · L\'embuscade', 'Rentre au château avec Sire Godefroy.'); break;
      case 17: ui.setQuest('Chapitre III · L\'embuscade', 'Parle à Sire Godefroy dans la cour.'); break;
      default: ui.setQuest('Fin du chapitre III', 'Explore librement Montclair. La suite arrive bientôt !');
    }
  }

  goTo(step) {
    this.step = step;
    this.placeNPCs();
    this.refresh();
    if (this.course) this.course.setActiveGate(step === 8 ? this.gateIndex : -1);
    if (this.onChange) this.onChange();
  }

  /** Bertrand change de place selon l'avancée de l'histoire. */
  placeNPCs() {
    const b = this.npcs.bertrand;
    if (this.duelRunning && this.duelRunning()) return;
    if (this.onPlace) this.onPlace(this.step);
    if (this.step >= 6 && this.step <= 7) b.moveTo(-11.5, -29.5, Math.PI);
    else if (this.step >= 8 && this.step <= 10) b.moveTo(52, 45, Math.PI);
    else b.moveTo(23, -3, -Math.PI / 2);
  }

  /** Après la victoire contre les brigands. */
  afterAmbushDialog() {
    const N = this.npcs.godefroy.name;
    this.ui.showDialog([
      [N, 'Tu n\'es pas blessé ? … Par tous les saints, tu t\'es battu comme un lion.'],
      [N, 'Ces brigands n\'étaient pas là par hasard. Quelqu\'un savait que nous passerions par ici avec la dîme.'],
      [N, 'Nous n\'irons pas plus loin aujourd\'hui. Rentrons au château, et garde la main sur ton épée.'],
    ], () => {
      this.goTo(16);
      if (this.onReturn) this.onReturn();
    });
  }

  onMounted() {
    if (this.step === 7) {
      this.ui.toast(this.ui.isTouch
        ? 'Joystick : avancer et tourner · poussé à fond : galop · 💬 : descendre'
        : 'Z/↑ : avancer · Maj : galop · Q/D : tourner · S : freiner · E : descendre', 7000);
      this.gateIndex = 0;
      this.goTo(8);
    }
  }

  onGatePassed() {
    this.gateIndex++;
    playSuccess();
    if (this.gateIndex >= this.course.gates.length) {
      const N = this.npcs.bertrand.name;
      this.goTo(9);
      this.ui.showDialog([
        [N, 'Bien mené ! Tu tiens en selle mieux que je ne l\'aurais cru.'],
        [N, 'Voici la lice. Prends cette lance, couche-la sous ton bras et charge la quintaine au GALOP.'],
        [N, 'Vise l\'écu. Trois touches propres, et je te laisse tranquille… pour aujourd\'hui.'],
      ]);
    } else {
      this.ui.toast(`Porte ${this.gateIndex}/8`, 1200);
      this.course.setActiveGate(this.gateIndex);
      this.refresh();
      if (this.onChange) this.onChange();
    }
  }

  onJoustHit(fastEnough) {
    if (this.step !== 9) return;
    if (!fastEnough) { this.ui.toast('Trop lent ! Il faut charger au galop.', 2000); return; }
    this.joustHits++;
    this.course.cheer();
    if (this.joustHits >= 3) {
      playSuccess();
      this.ui.toast('Magnifique ! La foule t\'acclame.', 3000);
      this.goTo(10);
    } else {
      this.ui.toast(`Touché ! (${this.joustHits}/3)`, 1500);
      this.refresh();
    }
  }

  serialize() {
    return { step: this.step, hits: this.hits, mathildeIndex: this.mathildeIndex, gateIndex: this.gateIndex, joustHits: this.joustHits };
  }

  restore(data) {
    this.step = data.step ?? 0;
    this.hits = data.hits ?? 0;
    this.mathildeIndex = data.mathildeIndex ?? 0;
    this.gateIndex = data.gateIndex ?? 0;
    this.joustHits = data.joustHits ?? 0;
    this.placeNPCs();
    if (this.course) this.course.setActiveGate(this.step === 8 ? this.gateIndex : -1);
    this.refresh();
  }

  startDuel() {
    if (this.onStartDuel) this.onStartDuel();
  }

  /** Appelé quand le joueur bat Bertrand. */
  onDuelWon() {
    const N = this.npcs.bertrand.name;
    this.ui.showDialog([
      [N, 'Assez ! Assez ! … Par saint Georges, tu apprends vite.'],
      [N, 'Tu as bloqué, tu as frappé, tu as tenu ta garde. C\'est ainsi que l\'on reste en vie sur un champ de bataille.'],
      [N, 'Va donc raconter ça à Sire Godefroy. Il voudra l\'entendre de ta bouche.'],
    ], () => { playSuccess(); this.goTo(5); });
  }

  /** Appelé quand le joueur perd le duel libre. */
  onDuelLost(retry) {
    const N = this.npcs.bertrand.name;
    this.ui.showDialog([
      [N, 'Relève-toi ! Un chevalier peut tomber, mais il se relève toujours.'],
      [N, 'Surveille ton endurance, et ne frappe pas là où je me protège. Encore une fois !'],
    ], retry);
  }

  talkTo(npc) {
    const ui = this.ui;
    const N = npc.name;
    // Personnages secondaires : répliques qui tournent
    if (npc.lines) {
      npc.lineIndex = (npc.lineIndex ?? -1) + 1;
      const line = npc.lines[npc.lineIndex % npc.lines.length];
      ui.showDialog(line.map((t) => [N, t]));
      return;
    }
    if (npc.id === 'godefroy') {
      if (this.step === 0) {
        ui.showDialog([
          [N, 'Ah, te voilà enfin, mon garçon. Ton père m\'avait écrit que tu arriverais avant la Saint-Martin.'],
          [N, 'Ici, à Montclair, un écuyer sert son seigneur avant de se servir lui-même. Tu panseras les chevaux, tu porteras mon écu et tu apprendras le maniement des armes.'],
          [N, 'Si tu te montres digne, tu recevras peut-être un jour l\'adoubement. Mais ce jour est encore loin.'],
          [N, 'Va trouver Bertrand, mon maître d\'armes. Il t\'attend sur le terrain d\'entraînement, à l\'est du chemin.'],
        ], () => { playSuccess(); this.goTo(1); });
      } else if (this.step === 5) {
        ui.showDialog([
          [N, 'Alors, il paraît que tu as tenu tête à Bertrand ? Il ne dit pas ça de tout le monde.'],
          [N, 'Bien. Très bien. Mais l\'épée ne fait pas tout. Un chevalier doit aussi savoir monter, chasser, servir… et obéir.'],
          [N, 'Repose-toi ce soir, écuyer. Demain, tu apprendras à monter à cheval.'],
        ], () => {
          playSuccess();
          this.goTo(6);
          if (this.onChapter) this.onChapter('Chapitre II', 'En selle');
        });
      } else if (this.step >= 6 && this.step <= 10) {
        ui.showDialog([[N, 'Bertrand t\'attend. Et Tonnerre aussi : c\'est un bon cheval, prends-en soin.']]);
      } else if (this.step === 11) {
        ui.showDialog([
          [N, 'On m\'a raconté ta joute. Trois touches au galop, à ton âge ! Les villageois ne parlent que de ça.'],
          [N, 'L\'épée, le cheval, la lance… tu deviens un véritable homme d\'armes.'],
          [N, 'Mais la chevalerie ne s\'apprend pas seulement à l\'entraînement. Bientôt, tu m\'accompagneras hors de nos terres. Tiens-toi prêt.'],
        ], () => {
          playSuccess();
          this.goTo(12);
          if (this.onChapter) this.onChapter('Chapitre III', 'L\'embuscade');
        });
      } else if (this.step === 12) {
        ui.showDialog([
          [N, 'Écuyer ! Nous partons sur-le-champ pour l\'abbaye de Saint-Aubin. Je dois y porter la dîme et une lettre pour l\'abbé.'],
          [N, 'La route traverse la forêt. On dit que des brigands y rôdent depuis la Saint-Michel.'],
          [N, 'Tiens. Une épée d\'acier, forgée par Gautier. Elle était à mon frère. Fais-lui honneur.'],
          [N, 'En selle ! Reste près de moi sur la route.'],
        ], () => {
          playSuccess();
          if (this.onSwordGiven) this.onSwordGiven();
          this.goTo(13);
          if (this.onEscort) this.onEscort();
        });
      } else if (this.step === 13 || this.step === 14 || this.step === 16) {
        ui.showDialog([[N, 'Pas le temps de bavarder, écuyer. Ouvre l\'œil.']]);
      } else if (this.step === 15) {
        this.afterAmbushDialog();
      } else if (this.step === 17) {
        ui.showDialog([
          [N, 'Nous voilà rentrés. L\'abbé attendra sa dîme : je ne risquerai pas la vie de mes gens pour quelques pièces.'],
          [N, 'Aujourd\'hui, tu as protégé ton seigneur au péril de ta vie. C\'est le premier devoir d\'un chevalier.'],
          [N, 'À la Pentecôte, quand le comte tiendra sa cour, je demanderai qu\'on t\'adoube. D\'ici là… continue de t\'entraîner.'],
        ], () => {
          playSuccess();
          this.goTo(18);
          this.ui.toast('Fin du chapitre III. La suite arrive bientôt !', 5000);
        });
      } else if (this.step >= 18) {
        ui.showDialog([[N, 'La Pentecôte approche, écuyer. Tiens-toi prêt.']]);
      } else {
        ui.showDialog([[N, 'Bertrand t\'attend. Ne fais pas attendre un homme qui manie l\'épée mieux que toi.']]);
      }
    } else if (npc.id === 'bertrand') {
      if (this.step === 0) {
        ui.showDialog([[N, 'Hm ? Présente-toi d\'abord à Sire Godefroy, au château. Ensuite, on parlera.']]);
      } else if (this.step === 1) {
        ui.showDialog([
          [N, 'Alors c\'est toi, le nouveau ? Tes bras sont maigres comme des branches de saule.'],
          [N, 'Garde cette épée de bois. Avant de toucher une vraie lame, tu frapperas la quintaine jusqu\'à en avoir des ampoules.'],
          [N, 'Frappe-la cinq fois. Et méfie-toi : le bras tourne, et le sac de sable ne pardonne pas aux maladroits !'],
          [NARRATOR, this.ui.isTouch
            ? '(Approche-toi de la quintaine, tourne-toi vers elle et touche ⚔️ pour frapper.)'
            : '(Approche-toi de la quintaine, tourne-toi vers elle et frappe : clic gauche ou touche F.)'],
        ], () => this.goTo(2));
      } else if (this.step === 2) {
        ui.showDialog([[N, `Cinq coups, j'ai dit. J'en compte ${this.hits}. Au travail !`]]);
      } else if (this.step === 3) {
        ui.showDialog([
          [N, 'Pas mal, pour un premier jour. Tu as la main lourde, c\'est bon signe.'],
          [N, 'Mais frapper un poteau, c\'est facile : il ne rend pas les coups. Moi, si.'],
          [N, 'Prends ta garde, écuyer. Je vais t\'apprendre à bloquer, à toucher et à parer. En garde !'],
        ], () => {
          playSuccess();
          this.goTo(4);
          this.startDuel();
        });
      } else if (this.step === 4) {
        ui.showDialog([[N, 'Reprenons là où nous en étions. En garde !']], () => this.startDuel());
      } else if (this.step === 5) {
        ui.showDialog([[N, 'Va voir Sire Godefroy. Et demain, à cheval !']]);
      } else if (this.step === 6) {
        ui.showDialog([
          [N, 'Ah, te voilà. Je te présente Tonnerre. Il est vif, mais il a bon cœur.'],
          [N, 'Un chevalier sans cheval n\'est qu\'un homme avec une épée. Monte en selle.'],
          [N, 'Je t\'ai préparé un parcours dans la campagne : des portes à bannières. Passe-les toutes, dans l\'ordre, puis rejoins-moi à la lice.'],
        ], () => this.goTo(7));
      } else if (this.step === 7) {
        ui.showDialog([[N, 'Qu\'attends-tu ? Tonnerre ne va pas se seller tout seul… enfin, si, c\'est déjà fait. En selle !']]);
      } else if (this.step === 8) {
        ui.showDialog([[N, 'Les portes d\'abord ! Suis l\'anneau doré.']]);
      } else if (this.step === 9) {
        ui.showDialog([[N, `Au galop, j'ai dit ! Vise l'écu. ${this.joustHits}/3.`]]);
      } else if (this.step === 10) {
        ui.showDialog([
          [N, 'Hé ! Tu m\'as presque fait sourire, et ce n\'est pas facile.'],
          [N, 'Va trouver Sire Godefroy et raconte-lui. Il sera fier de toi… même s\'il ne le dira pas.'],
        ], () => { playSuccess(); this.goTo(11); });
      } else {
        ui.showDialog([[N, 'Repose-toi. Tes bras en auront besoin.']]);
      }
    } else if (npc.id === 'garde') {
      const lines = this.step === 0
        ? [[N, 'Halte ! … Ah, tu dois être le nouvel écuyer. Passe, Sire Godefroy t\'attend dans la cour.']]
        : [[N, 'Rien à signaler. Les routes sont calmes depuis la Saint-Michel.']];
      ui.showDialog(lines);
    } else if (npc.id === 'mathilde') {
      const lines = [
        [[N, 'Bonjour, jeune maître ! C\'est toi, le nouvel écuyer du seigneur ?'],
         [N, 'Le château est au bout du chemin, au nord. Tu ne peux pas le manquer.']],
        [[N, 'On raconte que Sire Godefroy a suivi le comte jusqu\'à Jérusalem, il y a bientôt trente ans. Il en est revenu avec une cicatrice et peu de mots.']],
        [[N, 'Mon mari dit que des chevaliers-moines se sont installés à Jérusalem pour protéger les pèlerins. Les chevaliers du Temple, qu\'on les appelle.']],
        [[N, 'Si tu passes par l\'église, dis une prière pour la récolte. L\'hiver a été rude.']],
      ];
      ui.showDialog(lines[this.mathildeIndex % lines.length]);
      this.mathildeIndex++;
    }
  }

  onQuintainHit() {
    if (this.step !== 2) return;
    this.hits++;
    if (this.hits >= HITS_NEEDED) {
      playSuccess();
      this.ui.toast('Objectif accompli !');
      this.goTo(3);
    } else {
      this.refresh();
    }
  }
}
