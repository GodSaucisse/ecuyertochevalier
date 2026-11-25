// Histoire et quêtes. Chaque étape a un objectif et une cible (pour la boussole).
import { playSuccess } from './audio.js';

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
      default: ui.setQuest('Fin du prototype', 'Explore librement Montclair. La suite de ta formation arrive bientôt !');
    }
  }

  goTo(step) {
    this.step = step;
    this.refresh();
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
      } else if (this.step >= 4) {
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
          [N, 'Demain, nous verrons si tu tiens aussi bien en selle. Va te reposer, écuyer.'],
        ], () => {
          playSuccess();
          this.goTo(4);
          this.ui.toast('Fin du prototype : la suite arrive bientôt !', 5000);
        });
      } else {
        ui.showDialog([[N, 'Repose-toi. Demain, à cheval !']]);
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
