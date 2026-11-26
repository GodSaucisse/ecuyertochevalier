// Deniers, équipement et boutique de Gautier le forgeron.
const $ = (id) => document.getElementById(id);

/** Objets en vente. Les effets sont appliqués au combattant du joueur. */
export const ITEMS = {
  casque: {
    name: 'Casque à nasal', icon: '⛑️', price: 40, slot: 'head',
    desc: 'Acier martelé, nasal riveté. Les coups reçus font 10 % de dégâts en moins.',
  },
  ecu: {
    name: 'Écu de Montclair', icon: '🛡️', price: 60, slot: 'shield',
    desc: 'Bois cerclé de fer, aux armes du seigneur. Parer fatigue 40 % de moins.',
  },
  haubert: {
    name: 'Cotte de mailles', icon: '🧥', price: 120, slot: 'body',
    desc: 'Des milliers d\'anneaux d\'acier. Les coups reçus font 25 % de dégâts en moins.',
  },
  epee: {
    name: 'Épée d\'acier', icon: '🗡️', price: 80, slot: 'weapon',
    desc: 'Une vraie lame, équilibrée par Gautier. Tes coups font 40 % de dégâts en plus.',
  },
};

export class Economy {
  constructor() {
    this.money = 0;
    this.owned = {};      // id → true
    this.onChange = null; // appelé quand l'équipement change
    this.shopOpen = false;
  }

  serialize() { return { money: this.money, owned: this.owned }; }
  restore(d) {
    if (!d) return;
    this.money = d.money ?? 0;
    this.owned = { ...(d.owned || {}) };
  }

  has(id) { return !!this.owned[id]; }

  /** Gagne des deniers (avec un petit message). */
  earn(n, ui, reason = '') {
    this.money += n;
    this.updateHUD();
    if (ui) ui.toast(`🪙 +${n} deniers${reason ? ' · ' + reason : ''}`, 2200);
  }

  give(id) {
    this.owned[id] = true;
    if (this.onChange) this.onChange();
  }

  /** Modificateurs de combat selon l'équipement. */
  stats() {
    let defense = 1, blockCost = 1, damage = 1;
    if (this.has('casque')) defense *= 0.9;
    if (this.has('haubert')) defense *= 0.75;
    if (this.has('ecu')) blockCost *= 0.6;
    if (this.has('epee')) damage *= 1.4;
    return { defense, blockCost, damage };
  }

  updateHUD() {
    const el = $('purse');
    if (el) el.textContent = `🪙 ${this.money}`;
  }

  // ---------- Boutique ----------
  openShop(ui, onClose) {
    this.shopOpen = true;
    ui.modalOpen = true;
    if (document.pointerLockElement) document.exitPointerLock();
    this.renderShop(ui);
    $('shop').classList.remove('hidden');
    this.closeShop = () => {
      this.shopOpen = false;
      ui.modalOpen = false;
      $('shop').classList.add('hidden');
      if (onClose) onClose();
    };
    $('shop-close').onclick = () => this.closeShop();
  }

  renderShop(ui) {
    $('shop-money').textContent = `Ta bourse : 🪙 ${this.money} deniers`;
    const list = $('shop-list');
    list.textContent = '';
    for (const [id, it] of Object.entries(ITEMS)) {
      const row = document.createElement('div');
      row.className = 'shop-item' + (this.has(id) ? ' owned' : '');
      row.innerHTML = `<div class="shop-icon">${it.icon}</div>
        <div class="shop-info"><b>${it.name}</b><span>${it.desc}</span></div>`;
      const btn = document.createElement('button');
      if (this.has(id)) {
        btn.textContent = 'Équipé ✓';
        btn.disabled = true;
      } else {
        btn.textContent = `Acheter · ${it.price} 🪙`;
        btn.disabled = this.money < it.price;
        btn.onclick = () => {
          if (this.money < it.price) return;
          this.money -= it.price;
          this.updateHUD();
          this.give(id);
          this.renderShop(ui);
          if (this.onBuy) this.onBuy(id);
        };
      }
      row.appendChild(btn);
      list.appendChild(row);
    }
  }
}
