// Duel d'entraînement contre Bertrand : leçons (bloquer, toucher, parer) puis duel libre.
import * as THREE from 'three';
import { Fighter } from './combat.js?v=202611261343';
import { createSword, animateWalk } from './humanoid.js?v=202611261343';
import { playBlock, playParry, playHurt, playVictory, playSuccess, playSwing } from './audio.js?v=202611261343';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const START = { me: new THREE.Vector3(22.5, 0, 1.5), enemy: new THREE.Vector3(25, 0, -2) };
const REACH = 2.7;
const KEEP_DIST = 2.0;

function phases(isTouch) {
  const block = isTouch ? 'maintiens 🛡' : 'maintiens E';
  const attacks = isTouch ? '⚔️ coup léger, 💥 coup lourd' : 'clic gauche = coup léger, clic droit = coup lourd';
  return [
    {
      id: 'block', title: 'Leçon 1 · Parer', goal: 3, enemySpeed: 1.9,
      text: `Quand un « ! » rouge apparaît au-dessus de Bertrand, il attaque : ${block} pour lever ta garde et bloquer le coup.`,
    },
    {
      id: 'hit', title: 'Leçon 2 · Toucher', goal: 3, enemySpeed: 1,
      text: `Quand Bertrand se protège (🛡), tes coups sont bloqués. Frappe quand il baisse sa garde : ${attacks}.`,
    },
    {
      id: 'parry', title: 'Leçon 3 · Parade parfaite', goal: 1, enemySpeed: 1.75, maxTries: 6,
      text: `Lève ta garde au dernier moment, juste quand son coup va tomber : Bertrand sera déséquilibré et tu pourras frapper.`,
    },
    {
      id: 'free', title: 'Duel', goal: null, enemySpeed: 1.2,
      text: `Bats Bertrand ! Pare (${isTouch ? '🛡' : 'E'}), esquive (${isTouch ? '↶' : 'Espace'}) et surveille ton endurance (barre bleue) : parer la fatigue aussi.`,
    },
  ];
}

/** Met à jour le signal affiché au-dessus d'un combattant. */
export function setThreat(el, f, mine = false) {
  const t = el.querySelector('.threat');
  const atk = !mine && f.state === 'windup' && f.attack;
  const guard = f.isBlocking;
  const cls = atk ? (f.attack.kind === 'heavy' ? 'threat atk heavy' : 'threat atk') : guard ? 'threat guard' : 'threat';
  if (t.className !== cls) t.className = cls;
  const txt = atk ? '!' : guard ? '🛡' : '';
  if (t.textContent !== txt) t.textContent = txt;
}

export class Duel {
  constructor({ scene, camera, player, npc, world, ui, isTouch, onWin, onLose }) {
    Object.assign(this, { scene, camera, player, npc, world, ui, isTouch, onWin, onLose });
    this.running = false;
    this.PHASES = phases(isTouch);
    this.timeScale = 1;
    this.slowUntil = 0;
    this.shake = 0;
    this.clock = 0;
    this.sparks = this.createSparks();
    this.tmp = new THREE.Vector3();
  }

  // ---------- Démarrage / arrêt ----------
  start(phaseIndex = 0) {
    this.running = true;
    document.body.classList.add('in-duel');
    $('combat').classList.remove('hidden');
    $('enemy-name').textContent = 'Bertrand, maître d\'armes';

    const npc = this.npc;
    npc.inCombat = true;
    this.npcCircle = npc.circle;
    this.home = { pos: npc.object.position.clone(), rot: npc.object.rotation.y };
    if (this.npcCircle) this.npcCircle.top = -1; // désactive l'obstacle fixe pendant le duel

    if (!this.enemySword) {
      this.enemySword = createSword(true);
      this.enemySword.rotation.x = 0.45;
    }
    npc.h.handR.add(this.enemySword);
    this.enemy = new Fighter(npc.h, this.enemySword, { maxHp: 100, shield: true });
    this.me = this.player.fighter;
    this.me.active = true;
    this.enemy.active = true;
    this.setPhase(phaseIndex);
  }

  end() {
    this.running = false;
    document.body.classList.remove('in-duel');
    $('combat').classList.add('hidden');
    $('hurt').style.opacity = 0;
    const npc = this.npc, h = npc.h;
    npc.inCombat = false;
    if (this.enemySword) h.handR.remove(this.enemySword);
    npc.object.position.copy(this.home.pos);
    npc.object.rotation.y = this.home.rot;
    if (this.npcCircle) Object.assign(this.npcCircle, { x: this.home.pos.x, z: this.home.pos.z, top: 99 });
    const ph = this.player.h;
    ph.spine.rotation.set(0, 0, 0);
    ph.armR.rotation.z = 0;
    ph.armL.rotation.z = 0;
    if (this.me.sword) this.me.sword.rotation.x = this.me.swordBase;
    for (const part of [h.armR, h.armL, h.spine]) part.rotation.set(0, 0, 0);
    h.elbowR.rotation.x = -0.25;
    h.elbowL.rotation.x = -0.5;
    for (const leg of [h.legL, h.legR, h.kneeL, h.kneeR]) leg.rotation.x = 0;
    this.me.active = false;
    this.me.reset();
    this.timeScale = 1;
  }

  setPhase(i) {
    this.phaseIndex = i;
    this.phase = this.PHASES[i];
    this.count = 0;
    this.tries = 0;
    this.pause = 1.4;
    this.over = null;
    this.me.reset();
    this.enemy.reset();
    this.enemy.speed = this.phase.enemySpeed;
    this.ai = { attackIn: rand(1.2, 2.0), guardIn: rand(1.0, 2.0), guarding: false, blockUntil: 0, reaction: null, strafe: Math.random() < 0.5 ? 1 : -1, strafeIn: 2 };
    this.player.position.copy(START.me);
    this.npc.object.position.copy(START.enemy);
    $('tuto-title').textContent = this.phase.title;
    $('tuto-text').textContent = this.phase.text;
    this.updateCount();
  }

  updateCount() {
    const g = this.phase.goal;
    $('tuto-count').textContent = g ? '◆'.repeat(this.count) + '◇'.repeat(Math.max(0, g - this.count)) : '';
  }

  message(text, ms = 900) {
    const el = $('combat-msg');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  slowMo(duration = 0.45, scale = 0.3) {
    this.slowUntil = this.clock + duration;
    this.timeScale = scale;
  }

  // ---------- Commandes du joueur ----------
  /** (Ancienne garde directionnelle : plus utilisée.) */
  guardFromLook() {}

  handleActions(actions, move, blockHeld = false) {
    if (!this.running || this.over) { if (this.me) this.me.setBlocking(false); return; }
    const me = this.me;
    me.setBlocking(!!blockHeld);
    if (actions.attack && me.tryAttack('light')) playSwing();
    if (actions.heavy && me.tryAttack('heavy')) playSwing();
    if (actions.jump) {
      // Esquive dans la direction du déplacement (en arrière par défaut)
      const f = this.dirToEnemy();
      const right = new THREE.Vector3(-f.z, 0, f.x);
      const v = new THREE.Vector3();
      if (Math.hypot(move.x, move.y) > 0.2) v.addScaledVector(f, move.y).addScaledVector(right, move.x).normalize();
      else v.copy(f).multiplyScalar(-1);
      me.tryDodge(v);
    }
  }

  dirToEnemy() {
    const p = this.player.position, e = this.npc.object.position;
    return this.tmp.set(e.x - p.x, 0, e.z - p.z).normalize().clone();
  }

  get lockTarget() { return this.running ? this.npc.object.position : null; }

  // ---------- Boucle ----------
  update(dt) {
    if (!this.running) return;
    this.clock += dt;
    if (this.timeScale < 1 && this.clock > this.slowUntil) this.timeScale = 1;
    if (this.pause > 0) this.pause -= dt;

    this.updateEnemy(dt);

    // Résolution des coups (le joueur a été mis à jour juste avant)
    for (const ev of this.me.events) if (ev.type === 'impact') this.resolve(this.me, this.enemy, ev);
    for (const ev of this.enemy.events) if (ev.type === 'impact') this.resolve(this.enemy, this.me, ev);

    this.checkProgress(dt);
    this.updateSparks(dt);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.updateHUD();
  }

  updateEnemy(dt) {
    const e = this.enemy, me = this.me, ai = this.ai, ph = this.phase.id;
    const obj = this.npc.object, pos = obj.position, p = this.player.position;
    const dx = p.x - pos.x, dz = p.z - pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const fx = dx / dist, fz = dz / dist;

    // Toujours face au joueur
    const target = Math.atan2(fx, fz);
    let diff = Math.atan2(Math.sin(target - obj.rotation.y), Math.cos(target - obj.rotation.y));
    obj.rotation.y += diff * Math.min(1, dt * 8);

    // Déplacements : garder la bonne distance, tourner autour du joueur
    let mvx = 0, mvz = 0;
    if (e.alive && !e.attacking && e.state !== 'staggered' && !this.over) {
      const gap = dist - KEEP_DIST;
      const approach = THREE.MathUtils.clamp(gap * 1.5, -1, 1);
      ai.strafeIn -= dt;
      if (ai.strafeIn < 0) { ai.strafe = Math.random() < 0.5 ? -1 : (Math.random() < 0.5 ? 0 : 1); ai.strafeIn = rand(1.5, 3); }
      const strafe = ph === 'free' ? ai.strafe * 0.45 : 0;
      mvx = fx * approach + -fz * strafe;
      mvz = fz * approach + fx * strafe;
    }
    const speed = 2.2;
    pos.x += mvx * speed * dt;
    pos.z += mvz * speed * dt;
    // Séparation entre les deux combattants
    if (dist < 1.1) {
      const push = (1.1 - dist) * 0.5;
      pos.x -= fx * push; pos.z -= fz * push;
      p.x += fx * push; p.z += fz * push;
    }
    this.world.resolve(pos, 0.42);
    const moving = Math.hypot(mvx, mvz);
    this.walkPhase = (this.walkPhase || 0) + dt * 7 * moving;
    animateWalk(this.npc.h, this.walkPhase, Math.min(1, moving) * 0.7, true);

    // Décisions
    if (this.pause <= 0 && e.alive && me.alive && !this.over) {
      // Garde de Bertrand
      const now = this.clock;
      if (ph === 'hit') {
        // Il lève et baisse sa garde à intervalles réguliers
        ai.guardIn -= dt;
        if (ai.guardIn < 0) { ai.guarding = !ai.guarding; ai.guardIn = ai.guarding ? rand(1.4, 2.4) : rand(1.6, 2.6); }
        e.setBlocking(ai.guarding);
      } else if (ph === 'free') {
        // Il réagit parfois quand on l'attaque
        if (me.state === 'windup' && me.attack && !ai.reaction && !e.attacking) {
          ai.reaction = { at: now + rand(0.2, 0.4), success: Math.random() < (me.attack.kind === 'heavy' ? 0.55 : 0.45) };
        }
        if (ai.reaction && now >= ai.reaction.at) {
          if (ai.reaction.success) ai.blockUntil = now + 0.9;
          ai.reaction = null;
        }
        if (me.state !== 'windup') ai.reaction = null;
        e.setBlocking(now < ai.blockUntil);
      } else {
        e.setBlocking(false);
      }

      // Attaquer
      if (ph !== 'hit') {
        ai.attackIn -= dt;
        if (ai.attackIn < 0 && dist < REACH - 0.2 && !e.busy && !me.busy) {
          const kind = ph === 'parry' ? 'heavy' : ph === 'block' ? 'light' : (Math.random() < 0.65 ? 'light' : 'heavy');
          ai.blockUntil = 0;
          e.setBlocking(false);
          e.tryAttack(kind);
          ai.attackIn = ph === 'free' ? rand(1.3, 2.6) : ph === 'parry' ? rand(2.6, 3.4) : rand(2.0, 2.8);
        }
      }
    }

    e.update(dt);
    e.applyPose(dt);
    // Bouclier : petit recul quand il bloque
    if (this.npcCircle) { this.npcCircle.x = pos.x; this.npcCircle.z = pos.z; }
  }

  // ---------- Règles du combat ----------
  resolve(att, def, ev) {
    const attObj = att === this.me ? this.player.object : this.npc.object;
    const defObj = def === this.me ? this.player.object : this.npc.object;
    const d = attObj.position.distanceTo(defObj.position);
    const meDef = def === this.me;
    const ph = this.phase.id;
    if (d > REACH || !def.alive) {
      if (!meDef) this.message('Trop loin !', 600);
      return;
    }
    const contact = defObj.position.clone().add(attObj.position).multiplyScalar(0.5);
    contact.y = 1.3;

    if (def.time < def.invulnUntil) {
      if (meDef) this.message('Esquivé', 600);
      return;
    }
    const window = ph === 'parry' ? 0.5 : undefined;
    if (def.parries(null, window)) {
      def.cancelForParry();
      att.getParried();
      playParry();
      this.burst(contact, 40, 0xffd27a);
      this.slowMo();
      this.shake = 0.5;
      if (meDef) {
        this.message('PARADE !', 1100);
        if (ph === 'parry') { this.count++; this.updateCount(); }
      } else this.message('Paré…', 800);
      return;
    }
    if (def.blocks()) {
      const broken = def.blockedHit(ev.kind);
      att.wasBlocked();
      playBlock();
      this.burst(contact, 14, 0xffb050);
      this.shake = broken ? 0.4 : 0.15;
      if (broken) this.message(meDef ? 'Garde brisée !' : 'Garde brisée ! Frappe !', 1000);
      else if (meDef) {
        this.message('Paré', 500);
        if (ph === 'block') { this.count++; this.updateCount(); }
      } else this.message('Bloqué', 500);
      if (ph === 'parry' && meDef) this.countTry();
      return;
    }
    // Touché
    let dmg = ev.damage;
    if (meDef && ph !== 'free') dmg = Math.min(dmg, Math.max(0, def.hp - 25)); // pas de défaite pendant les leçons
    if (!meDef && ph !== 'free') dmg = Math.min(dmg, Math.max(0, def.hp - 25));
    def.takeHit(dmg);
    playHurt();
    this.burst(contact, 10, 0xd8c8a8);
    this.shake = ev.kind === 'heavy' ? 0.6 : 0.35;
    if (meDef) {
      $('hurt').style.opacity = 1;
      setTimeout(() => { $('hurt').style.opacity = 0; }, 180);
      if (ph === 'parry') this.countTry();
    } else {
      this.message(ev.kind === 'heavy' ? 'Coup lourd !' : 'Touché !', 600);
      if (ph === 'hit') { this.count++; this.updateCount(); }
    }
  }

  countTry() {
    this.tries++;
    if (this.phase.maxTries && this.tries >= this.phase.maxTries && this.count < this.phase.goal) {
      this.ui.toast('La parade viendra avec la pratique. Passons au duel !', 3000);
      this.nextPhase();
    }
  }

  nextPhase() {
    playSuccess();
    this.over = 'next';
    this.overAt = this.clock + 1.3;
  }

  checkProgress() {
    const ph = this.phase;
    if (this.over === null) {
      if (ph.goal && this.count >= ph.goal) {
        this.message('Bien !', 1200);
        this.nextPhase();
      } else if (ph.id === 'free' && !this.enemy.alive) {
        this.message('VICTOIRE', 2500);
        playVictory();
        this.over = 'win';
        this.overAt = this.clock + 2.2;
      } else if (ph.id === 'free' && !this.me.alive) {
        this.message('Vaincu…', 2000);
        this.over = 'lose';
        this.overAt = this.clock + 2.0;
      }
    } else if (this.over !== 'waiting' && this.clock >= this.overAt) {
      const o = this.over;
      this.over = null;
      if (o === 'next') this.setPhase(Math.min(this.phaseIndex + 1, this.PHASES.length - 1));
      else if (o === 'win') { this.end(); this.onWin && this.onWin(); }
      else if (o === 'lose') { this.over = 'waiting'; this.onLose && this.onLose(() => { this.over = null; this.setPhase(3); }); }
    }
  }

  // ---------- Interface ----------
  updateHUD() {
    const me = this.me, e = this.enemy;
    $('enemy-hp').style.width = (100 * e.hp / e.maxHp) + '%';
    $('player-hp').style.width = (100 * me.hp / me.maxHp) + '%';
    $('player-st').style.width = me.stamina + '%';
    $('player-st').classList.toggle('exhausted', me.exhausted);

    // Signal au-dessus de l'adversaire : « ! » rouge = il attaque (orange = coup lourd), 🛡 = il se protège
    const gi = $('gi-enemy');
    const sp = this.project(this.npc.object.position, 2.25);
    gi.style.display = sp && e.alive ? '' : 'none';
    if (sp) { gi.style.left = sp.x + 'px'; gi.style.top = sp.y + 'px'; }
    setThreat(gi, e);
    // Notre garde
    const gp = $('gi-player');
    const pp = this.project(this.player.position, 2.1);
    gp.style.display = pp ? '' : 'none';
    if (pp) { gp.style.left = pp.x + 'px'; gp.style.top = pp.y + 'px'; }
    setThreat(gp, me, true);
  }

  project(pos, height) {
    const v = this.tmp.set(pos.x, pos.y + height, pos.z).project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }

  // ---------- Étincelles ----------
  createSparks() {
    const N = 120;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3).fill(-999);
    const col = new Float32Array(N * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.06, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    pts.frustumCulled = false;
    this.scene.add(pts);
    return { geo, pos, col, vel: new Float32Array(N * 3), life: new Float32Array(N), next: 0, N };
  }

  burst(at, n, color) {
    const s = this.sparks, c = new THREE.Color(color).multiplyScalar(2.5);
    for (let k = 0; k < n; k++) {
      const i = s.next; s.next = (s.next + 1) % s.N;
      s.pos[i * 3] = at.x; s.pos[i * 3 + 1] = at.y; s.pos[i * 3 + 2] = at.z;
      s.vel[i * 3] = rand(-3, 3); s.vel[i * 3 + 1] = rand(0.5, 4); s.vel[i * 3 + 2] = rand(-3, 3);
      s.col[i * 3] = c.r; s.col[i * 3 + 1] = c.g; s.col[i * 3 + 2] = c.b;
      s.life[i] = rand(0.25, 0.55);
    }
  }

  updateSparks(dt) {
    const s = this.sparks;
    for (let i = 0; i < s.N; i++) {
      if (s.life[i] <= 0) continue;
      s.life[i] -= dt;
      s.vel[i * 3 + 1] -= 9 * dt;
      s.pos[i * 3] += s.vel[i * 3] * dt;
      s.pos[i * 3 + 1] += s.vel[i * 3 + 1] * dt;
      s.pos[i * 3 + 2] += s.vel[i * 3 + 2] * dt;
      if (s.life[i] <= 0) s.pos[i * 3 + 1] = -999;
    }
    s.geo.attributes.position.needsUpdate = true;
    s.geo.attributes.color.needsUpdate = true;
  }
}
