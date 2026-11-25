// Histoire et quêtes. Chaque étape a un objectif et une cible (pour la boussole).
import { playSuccess } from './audio.js?v=202611252021';

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
      default: ui.setQuest('Fin du chapitre I', 'Explore librement Montclair. La suite de ta formation arrive bientôt !');
    }
  }

  goTo(step) {
    this.step = step;
    this.refresh();
    if (this.onChange) this.onChange();
  }

  serialize() {
    return { step: this.step, hits: this.hits, mathildeIndex: this.mathildeIndex };
  }

  restore(data) {
    this.step = data.step ?? 0;
    this.hits = data.hits ?? 0;
    this.mathildeIndex = data.mathildeIndex ?? 0;
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
          this.ui.toast('Fin du chapitre I. La suite arrive bientôt !', 5000);
        });
      } else if (this.step >= 6) {
        ui.showDialog([[N, 'Bertrand m\'a dit du bien de toi. Continue ainsi, écuyer.']]);
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
      } else {
        ui.showDialog([[N, 'Va voir Sire Godefroy. Et demain, à cheval !']]);
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
