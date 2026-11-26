// Petits conseils pour débuter (uniquement lors d'une nouvelle partie).
const $ = (id) => document.getElementById(id);
const KEY = 'ecuyer-a-chevalier:tutoriel:v1';

export class Tutorial {
  constructor(isTouch) {
    this.isTouch = isTouch;
    this.active = false;
    this.step = null;
    this.t = 0;
    this.moved = 0;
    this.looked = 0;
    try { this.finished = localStorage.getItem(KEY) === 'fini'; } catch (_) { this.finished = false; }
  }

  start() {
    if (this.finished) return;
    this.active = true;
    this.show('move');
  }

  show(step) {
    this.step = step;
    this.t = 0;
    const T = this.isTouch;
    const text = {
      move: T ? 'Pose le pouce à gauche de l\'écran pour te déplacer (pousse à fond pour courir).'
        : 'Déplace-toi avec Z Q S D (ou les flèches). Maintiens Maj pour courir.',
      look: T ? 'Fais glisser ton doigt sur la droite de l\'écran pour tourner la caméra.'
        : 'Clique dans le jeu, puis bouge la souris pour regarder autour de toi. Molette : zoom.',
      talk: T ? 'Touche 💬 pour parler à ce personnage.' : 'Appuie sur E pour parler à ce personnage.',
      goal: 'Le losange doré et la flèche en haut de l\'écran montrent ton objectif. '
        + (T ? '🗺️ : carte · ⏸ : pause et réglages.' : 'M : carte · Échap : pause et réglages.'),
    }[step];
    $('tip-text').textContent = text;
    $('tip').classList.remove('hidden');
  }

  hide() { $('tip').classList.add('hidden'); }

  finish() {
    this.active = false;
    this.hide();
    try { localStorage.setItem(KEY, 'fini'); } catch (_) { /* rien */ }
  }

  /** ctx : { moved (m), looked (px), nearNPC, talked, dialogOpen } */
  update(dt, ctx) {
    if (!this.active) return;
    this.t += dt;
    this.moved += ctx.moved;
    this.looked += ctx.looked;
    switch (this.step) {
      case 'move': if (this.moved > 3) this.show('look'); break;
      case 'look': if (this.looked > 250 || this.t > 12) { this.hide(); this.step = 'wait-npc'; } break;
      case 'wait-npc': if (ctx.nearNPC && !ctx.dialogOpen) this.show('talk'); break;
      case 'talk': if (ctx.dialogOpen) { this.hide(); this.step = 'wait-dialog'; } break;
      case 'wait-dialog': if (!ctx.dialogOpen) this.show('goal'); break;
      case 'goal': if (this.t > 10) this.finish(); break;
      default:
    }
  }
}
