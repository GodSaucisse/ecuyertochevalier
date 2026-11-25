// Interface : quête en cours, boîte de dialogue, messages, boussole.
const $ = (id) => document.getElementById(id);

export class UI {
  constructor(isTouch) {
    this.isTouch = isTouch;
    this.dialogLines = null;
    this.dialogIndex = 0;
    this.dialogDone = null;
    this.toastTimer = null;
    $('dialog').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.advanceDialog();
    });
  }

  showHUD() { $('hud').classList.remove('hidden'); }

  setQuest(title, text) {
    $('quest-title').textContent = title;
    $('quest-text').textContent = text;
  }

  setPrompt(text) {
    const el = $('prompt');
    if (!text) { el.classList.add('hidden'); return; }
    el.textContent = text;
    el.classList.remove('hidden');
  }

  toast(text, ms = 3500) {
    const el = $('toast');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  /** Boussole vers l'objectif. angle en radians (0 = droit devant). */
  setCompass(angle, distance) {
    const el = $('compass');
    if (angle === null) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    $('compass-arrow').style.transform = `rotate(${angle - Math.PI / 2}rad)`;
    $('compass-dist').textContent = `${Math.round(distance)} m`;
  }

  get dialogOpen() { return this.dialogLines !== null; }

  /** lines : liste de [nom, texte]. onDone est appelé à la fin du dialogue. */
  showDialog(lines, onDone) {
    this.dialogLines = lines;
    this.dialogIndex = 0;
    this.dialogDone = onDone || null;
    $('dialog').classList.remove('hidden');
    this.setPrompt(null);
    this.renderDialog();
  }

  renderDialog() {
    const [name, text] = this.dialogLines[this.dialogIndex];
    $('dialog-name').textContent = name;
    $('dialog-name').style.display = name ? '' : 'none';
    $('dialog-text').textContent = text;
    const last = this.dialogIndex === this.dialogLines.length - 1;
    const how = this.isTouch ? 'Touchez' : 'E / clic';
    $('dialog-next').textContent = `${how} pour ${last ? 'terminer' : 'continuer'} ▸`;
  }

  advanceDialog() {
    if (!this.dialogLines) return;
    this.dialogIndex++;
    if (this.dialogIndex >= this.dialogLines.length) {
      this.dialogLines = null;
      $('dialog').classList.add('hidden');
      const done = this.dialogDone;
      this.dialogDone = null;
      if (done) done();
    } else {
      this.renderDialog();
    }
  }
}
