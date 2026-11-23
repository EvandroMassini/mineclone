// ============================================================
// Fase 9: lógica de sobrevivência (pura — sem DOM/Three.js)
// HP 0–20 (10 corações), fome 0–20 (10 comidos), ar 15 s.
// ============================================================

export const MAX_HP = 20;
export const MAX_FOOD = 20;
export const MAX_AIR = 15;

const REGEN_EVERY = 3.5; // s entre regenerações (cada uma consome 1 de fome)
const STARVE_EVERY = 6; // s entre dano de inanição (fome = 0)
const DROWN_EVERY = 2; // s sem ar até 2 de dano
const HUNGER_WALK = 1 / 25; // fome/s andando
const HUNGER_SPRINT = 1 / 8; // fome/s correndo

export class Survival {
  constructor() {
    this.hp = MAX_HP;
    this.food = MAX_FOOD;
    this.air = MAX_AIR;
    this.dead = false;
    this.onHurt = null; // (hp, dmg) => void
    this.onDeath = null; // () => void
    this._regenT = 0;
    this._starveT = 0;
    this._drownT = 0;
  }

  /** Recebe dano; ao chegar a 0, morre (chama onHurt/onDeath). */
  takeDamage(n) {
    if (this.dead || n <= 0) return;
    this.hp = Math.max(0, this.hp - n);
    if (this.onHurt) this.onHurt(this.hp, n);
    if (this.hp <= 0) this._die();
  }

  _die() {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    if (this.onDeath) this.onDeath();
  }

  heal(n) {
    if (this.dead) return;
    this.hp = Math.min(MAX_HP, this.hp + n);
  }

  /** Come: adiciona comida (teto 20). @returns {boolean} */
  feed(n) {
    if (this.dead) return false;
    this.food = Math.min(MAX_FOOD, this.food + n);
    return true;
  }

  /** Respawn: restaura HP/fome/ar e zera os timers (inventário fica). */
  respawn() {
    this.hp = MAX_HP;
    this.food = MAX_FOOD;
    this.air = MAX_AIR;
    this.dead = false;
    this._regenT = 0;
    this._starveT = 0;
    this._drownT = 0;
  }

  /**
   * Atualiza o estado (dt em segundos).
   * ctx: { inWater, moving, sprinting }
   */
  update(dt, ctx) {
    if (this.dead || dt <= 0) return;
    const inWater = !!ctx.inWater;
    const moving = !!ctx.moving;
    const sprinting = !!ctx.sprinting;

    // --- ar / afogamento: em água o ar esgota; a 0, 2 de dano a cada 2 s ---
    if (inWater) {
      this.air = Math.max(0, this.air - dt);
      if (this.air <= 0) {
        this._drownT += dt;
        if (this._drownT >= DROWN_EVERY) {
          this._drownT -= DROWN_EVERY;
          this.takeDamage(2);
        }
      }
    } else {
      this.air = MAX_AIR;
      this._drownT = 0;
    }

    // --- fome: só drena em movimento (correr gasta mais rápido) ---
    if (moving && this.food > 0) {
      this.food = Math.max(
        0,
        this.food - dt * (sprinting ? HUNGER_SPRINT : HUNGER_WALK),
      );
    }

    // --- regeneração: a cada 3.5 s, com comida, +1 HP (−1 de fome) ---
    if (this.food > 0 && this.hp < MAX_HP) {
      this._regenT += dt;
      if (this._regenT >= REGEN_EVERY) {
        this._regenT -= REGEN_EVERY;
        this.food = Math.max(0, this.food - 1);
        this.hp = Math.min(MAX_HP, this.hp + 1);
      }
    } else {
      this._regenT = 0;
    }

    // --- inanição: sem comida, 1 de dano a cada 6 s ---
    if (this.food <= 0) {
      this._starveT += dt;
      if (this._starveT >= STARVE_EVERY) {
        this._starveT -= STARVE_EVERY;
        this.takeDamage(1);
      }
    } else {
      this._starveT = 0;
    }
  }
}
