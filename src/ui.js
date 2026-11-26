// Interface : quête en cours, boîte de dialogue, messages, boussole.
const $ = (id) => document.getElementById(id);

export class UI {
  constructor(isTouch) {
    this.isTouch = isTouch;
    this.dialogLines = null;
    this.dialogIndex = 0;
    this.dialogDone = null;
    this.toastTimer = null;
    this.choice = null;
    this.modalOpen = false; // un menu demande la souris (choix, boutique)
    $('dialog').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (!this.choice) this.advanceDialog();
    });
    // Choix au clavier : 1, 2, 3… ou Échap pour la dernière option
    window.addEventListener('keydown', (e) => {
      if (!this.choice) return;
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
      if (n !== undefined && n < this.choice.options.length) { e.preventDefault(); this.pick(n); }
      else if (e.code === 'Escape') { e.preventDefault(); this.pick(this.choice.options.length - 1); }
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

  get dialogOpen() { return this.dialogLines !== null || this.choice !== null; }

  /** Question avec plusieurs réponses. options : [{ label, value }]. */
  showChoice(name, text, options, onPick) {
    this.choice = { options, onPick };
    this.modalOpen = true;
    if (document.pointerLockElement) document.exitPointerLock();
    $('dialog').classList.remove('hidden');
    $('dialog-name').textContent = name;
    $('dialog-name').style.display = name ? '' : 'none';
    $('dialog-text').textContent = text;
    const box = $('dialog-next');
    box.textContent = '';
    options.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'choice';
      b.textContent = (this.isTouch ? '' : `${i + 1}. `) + o.label;
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.pick(i); });
      box.appendChild(b);
    });
    this.setPrompt(null);
  }

  pick(i) {
    const c = this.choice;
    if (!c) return;
    this.choice = null;
    this.modalOpen = false;
    $('dialog').classList.add('hidden');
    $('dialog-next').textContent = '';
    if (this.onModalClosed) this.onModalClosed();
    c.onPick(c.options[i].value);
  }

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
