// Combat contre plusieurs adversaires (chapitre III : l'embuscade).
// Reprend les règles et l'interface du duel, avec une cible verrouillée
// que l'on peut changer (Tab / 🎯).
import * as THREE from 'three';
import { Duel, setThreat } from './duel.js?v=202611261111';
import { Fighter } from './combat.js?v=202611261111';
import { animateWalk } from './humanoid.js?v=202611261111';
import { playBlock, playParry, playHurt, playVictory, playSwing } from './audio.js?v=202611261111';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const REACH = 2.7;

export class Battle extends Duel {
  constructor(opts) {
    super({ ...opts, npc: null });
    this.enemies = [];
    this.locked = null;
  }

  /**
   * enemies : [{ name, h, sword, spawn: {x, z} }]
   * arena : { x, z } centre du combat (pour la caméra et les retours)
   */
  start(enemies, { title = 'Embuscade !' } = {}) {
    this.running = true;
    this.title = title;
    document.body.classList.add('in-duel', 'multi');
    $('combat').classList.remove('hidden');
    $('tuto-title').textContent = title;
    $('tuto-count').textContent = '';
    this.me = this.player.fighter;
    this.me.active = true;
    this.me.reset();
    this.over = null;
    this.pause = 1.0;
    this.hintShown = false;
    // Indicateurs de garde : un par ennemi
    this.enemies = enemies.map((e, i) => {
      const fighter = new Fighter(e.h, e.sword, { maxHp: e.hp ?? 60, speed: e.speed ?? 1.25, damageMul: e.damageMul ?? 0.8 });
      fighter.active = true;
      const ind = $('gi-enemy').cloneNode(true);
      ind.id = 'gi-enemy-' + i;
      $('combat').appendChild(ind);
      return {
        ...e, fighter, ind, obj: e.h.root,
        ai: { attackIn: rand(1.5, 3.5), guardIn: rand(1, 3), blockUntil: 0, reaction: null, strafe: i % 2 ? 1 : -1, strafeIn: rand(1, 3) },
        walkPhase: Math.random() * 6, fall: 0,
      };
    });
    $('gi-enemy').style.display = 'none';
    this.resetPositions();
    this.lockNearest();
    this.updateTuto();
  }

  resetPositions() {
    for (const e of this.enemies) {
      e.obj.position.set(e.spawn.x, 0, e.spawn.z);
      e.obj.rotation.set(0, 0, 0);
      e.fall = 0;
      e.fighter.reset();
    }
  }

  restart() {
    this.me.reset();
    this.resetPositions();
    this.over = null;
    this.pause = 1.2;
    this.lockNearest();
    this.updateTuto();
  }

  end() {
    this.running = false;
    document.body.classList.remove('in-duel', 'multi');
    $('combat').classList.add('hidden');
    $('hurt').style.opacity = 0;
    for (const e of this.enemies) e.ind.remove();
    $('gi-enemy').style.display = '';
    const ph = this.player.h;
    ph.spine.rotation.set(0, 0, 0);
    ph.armR.rotation.z = 0;
    ph.armL.rotation.z = 0;
    if (this.me.sword) this.me.sword.rotation.x = this.me.swordBase;
    this.me.active = false;
    this.me.reset();
    this.timeScale = 1;
  }

  get alive() { return this.enemies.filter((e) => e.fighter.alive); }

  lockNearest() {
    const p = this.player.position;
    let best = null, bd = Infinity;
    for (const e of this.alive) {
      const d = e.obj.position.distanceTo(p);
      if (d < bd) { bd = d; best = e; }
    }
    this.locked = best;
  }

  cycleTarget() {
    const list = this.alive;
    if (list.length < 2) return;
    const i = list.indexOf(this.locked);
    this.locked = list[(i + 1) % list.length];
  }

  get lockTarget() { return this.running && this.locked ? this.locked.obj.position : null; }

  dirToEnemy() {
    const p = this.player.position, e = this.locked ? this.locked.obj.position : p;
    return new THREE.Vector3(e.x - p.x, 0, e.z - p.z).normalize();
  }

  handleActions(actions, move) {
    if (!this.running || this.over) return;
    if (actions.target) this.cycleTarget();
    super.handleActions(actions, move);
  }

  updateTuto() {
    const n = this.alive.length;
    const hint = this.isTouch ? '🛡 parer · ↶ esquiver · 🎯 changer de cible.' : 'Maj : parer · Espace : esquiver · Tab : changer de cible.';
    $('tuto-text').textContent = `Brigands restants : ${n}. Garde un œil sur les autres ! ${hint}`;
  }

  // ---------- Boucle ----------
  update(dt) {
    if (!this.running) return;
    this.clock += dt;
    if (this.timeScale < 1 && this.clock > this.slowUntil) this.timeScale = 1;
    if (this.pause > 0) this.pause -= dt;
    if (!this.locked || !this.locked.fighter.alive) this.lockNearest();

    // Qui a le droit d'attaquer ? Les deux plus proches.
    const p = this.player.position;
    const byDist = this.alive.slice().sort((a, b) => a.obj.position.distanceTo(p) - b.obj.position.distanceTo(p));
    const engaged = new Set(byDist.slice(0, 2));
    for (const e of this.enemies) this.updateEnemy(e, dt, engaged.has(e));

    for (const ev of this.me.events) {
      if (ev.type === 'impact' && this.locked) this.resolveHit(this.me, this.locked, ev, true);
    }
    for (const e of this.enemies) {
      for (const ev of e.fighter.events) if (ev.type === 'impact') this.resolveHit(e.fighter, e, ev, false);
    }

    this.checkEnd();
    this.updateSparks(dt);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.updateHUD();
  }

  updateEnemy(e, dt, engaged) {
    const f = e.fighter, ai = e.ai, obj = e.obj, pos = obj.position;
    if (!f.alive) {
      // Tombe à terre
      e.fall = Math.min(1, e.fall + dt * 1.6);
      obj.rotation.x = -1.45 * e.fall * e.fall;
      pos.y = 0.15 * e.fall;
      f.update(dt);
      f.applyPose(dt);
      return;
    }
    const p = this.player.position;
    const dx = p.x - pos.x, dz = p.z - pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const fx = dx / dist, fz = dz / dist;
    const target = Math.atan2(fx, fz);
    obj.rotation.y += Math.atan2(Math.sin(target - obj.rotation.y), Math.cos(target - obj.rotation.y)) * Math.min(1, dt * 7);

    let mvx = 0, mvz = 0;
    const keep = engaged ? 2.0 : 4.2;
    if (!f.attacking && f.state !== 'staggered' && f.state !== 'hitstun' && !this.over) {
      const approach = THREE.MathUtils.clamp((dist - keep) * 1.2, -1, 1);
      ai.strafeIn -= dt;
      if (ai.strafeIn < 0) { ai.strafe = pick([-1, 0, 1]); ai.strafeIn = rand(1.2, 2.8); }
      const strafe = ai.strafe * (engaged ? 0.4 : 0.7);
      mvx = fx * approach - fz * strafe;
      mvz = fz * approach + fx * strafe;
    }
    // Les brigands s'écartent les uns des autres
    for (const o of this.alive) {
      if (o === e) continue;
      const ox = pos.x - o.obj.position.x, oz = pos.z - o.obj.position.z, od = Math.hypot(ox, oz);
      if (od < 1.6 && od > 0.01) { mvx += (ox / od) * (1.6 - od); mvz += (oz / od) * (1.6 - od); }
    }
    const speed = dist > 6 ? 3.6 : 2.2; // ils courent pour rejoindre le combat
    pos.x += mvx * speed * dt;
    pos.z += mvz * speed * dt;
    if (dist < 1.1) {
      const push = (1.1 - dist) * 0.5;
      pos.x -= fx * push; pos.z -= fz * push;
    }
    this.world.resolve(pos, 0.42);
    const moving = Math.min(1, Math.hypot(mvx, mvz));
    e.walkPhase += dt * (dist > 6 ? 10 : 7) * moving;
    animateWalk(e.h, e.walkPhase, moving * (dist > 6 ? 1 : 0.7), true);

    if (this.pause <= 0 && this.me.alive && !this.over) {
      // Réagir aux coups du joueur s'il nous vise : parfois, on lève la garde
      const me = this.me;
      if (this.locked === e && me.state === 'windup' && me.attack && !ai.reaction && !f.attacking) {
        ai.reaction = { at: this.clock + rand(0.25, 0.45), success: Math.random() < 0.4 };
      }
      if (ai.reaction && this.clock >= ai.reaction.at) {
        if (ai.reaction.success) ai.blockUntil = this.clock + 0.9;
        ai.reaction = null;
      }
      if (me.state !== 'windup') ai.reaction = null;
      // Les brigands à l'écart restent souvent sur leurs gardes
      ai.guardIn -= dt;
      if (!engaged && ai.guardIn < 0) { ai.blockUntil = this.clock + rand(0.8, 1.6); ai.guardIn = rand(2, 4); }
      f.setBlocking(this.clock < ai.blockUntil);
      // Attaquer (les ennemis à l'écart attaquent moins souvent)
      ai.attackIn -= dt;
      const othersAttacking = this.alive.some((o) => o !== e && o.fighter.attacking);
      if (engaged && ai.attackIn < 0 && dist < REACH - 0.2 && !f.busy && !othersAttacking) {
        ai.blockUntil = 0;
        f.setBlocking(false);
        f.tryAttack(Math.random() < 0.7 ? 'light' : 'heavy');
        ai.attackIn = this.locked === e ? rand(1.8, 3.2) : rand(3.5, 5.5);
      }
    }
    f.update(dt);
    f.applyPose(dt);
  }

  resolveHit(att, enemyEntry, ev, playerAttacks) {
    const def = playerAttacks ? enemyEntry.fighter : this.me;
    const attObj = playerAttacks ? this.player.object : enemyEntry.obj;
    const defObj = playerAttacks ? enemyEntry.obj : this.player.object;
    const d = attObj.position.distanceTo(defObj.position);
    if (d > REACH || !def.alive) {
      if (playerAttacks) this.message('Trop loin !', 600);
      return;
    }
    const contact = defObj.position.clone().add(attObj.position).multiplyScalar(0.5);
    contact.y = 1.3;
    if (def.time < def.invulnUntil) { if (!playerAttacks) this.message('Esquivé', 600); return; }
    if (def.parries()) {
      def.cancelForParry();
      att.getParried();
      playParry();
      this.burst(contact, 40, 0xffd27a);
      this.slowMo();
      this.shake = 0.5;
      this.message(playerAttacks ? 'Paré…' : 'PARADE !', 1000);
      return;
    }
    if (def.blocks()) {
      const broken = def.blockedHit(ev.kind);
      att.wasBlocked();
      playBlock();
      this.burst(contact, 14, 0xffb050);
      this.shake = broken ? 0.4 : 0.15;
      if (broken) this.message(playerAttacks ? 'Garde brisée ! Frappe !' : 'Garde brisée !', 1000);
      else this.message(playerAttacks ? 'Bloqué' : 'Paré', 500);
      return;
    }
    const dmg = ev.damage * (playerAttacks ? 1.4 : 1); // vraie épée contre gambisons
    def.takeHit(dmg);
    playHurt();
    this.burst(contact, 12, 0xd8c8a8);
    this.shake = ev.kind === 'heavy' ? 0.6 : 0.35;
    if (!playerAttacks) {
      $('hurt').style.opacity = 1;
      setTimeout(() => { $('hurt').style.opacity = 0; }, 180);
    } else {
      this.message(!def.alive ? 'Brigand vaincu !' : ev.kind === 'heavy' ? 'Coup lourd !' : 'Touché !', 700);
      if (!def.alive) { this.updateTuto(); this.lockNearest(); }
    }
  }

  checkEnd() {
    if (this.over === null) {
      if (this.alive.length === 0) {
        this.message('VICTOIRE', 2500);
        playVictory();
        this.over = 'win';
        this.overAt = this.clock + 2.2;
      } else if (!this.me.alive) {
        this.message('Vaincu…', 2000);
        this.over = 'lose';
        this.overAt = this.clock + 2.0;
      }
    } else if (this.over !== 'waiting' && this.clock >= this.overAt) {
      const o = this.over;
      if (o === 'win') { this.over = null; this.end(); this.onWin && this.onWin(); }
      else if (o === 'lose') { this.over = 'waiting'; this.onLose && this.onLose(() => this.restart()); }
    }
  }

  updateHUD() {
    const me = this.me, L = this.locked;
    if (L) {
      $('enemy-name').textContent = L.name;
      $('enemy-hp').style.width = (100 * L.fighter.hp / L.fighter.maxHp) + '%';
    }
    $('player-hp').style.width = (100 * me.hp / me.maxHp) + '%';
    $('player-st').style.width = me.stamina + '%';
    $('player-st').classList.toggle('exhausted', me.exhausted);
    for (const e of this.enemies) {
      const f = e.fighter, gi = e.ind;
      const sp = f.alive ? this.project(e.obj.position, 2.25) : null;
      gi.style.display = sp ? '' : 'none';
      if (!sp) continue;
      gi.style.left = sp.x + 'px';
      gi.style.top = sp.y + 'px';
      gi.style.opacity = e === L ? 1 : 0.55;
      gi.style.transform = e === L ? '' : 'scale(0.7)';
      setThreat(gi, f);
    }
    const gp = $('gi-player');
    const pp = this.project(this.player.position, 2.1);
    gp.style.display = pp ? '' : 'none';
    if (pp) { gp.style.left = pp.x + 'px'; gp.style.top = pp.y + 'px'; }
    setThreat(gp, me, true);
  }
}
