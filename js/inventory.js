// ============================================================
// Fase 7: inventário real (modo sobrevivência) — 36 slots
// (9 hotbar + 27 grade principal), pilhas de até 64, com
// lógica de adicionar (drops de blocos), consumir (colocar
// bloco) e mover (tela de inventário aberta).
//
// Slots 0..8 = hotbar (teclas 1–9) · 9..35 = grade principal.
// Fase 8: pilha máx. varia por item (stackOf) — ferramentas não empilham.
// ============================================================
import { stackOf } from "./items.js";

export const MAX_STACK = 64;
export const INV_SIZE = 36;
export const HOTBAR = 9;

/** Tamanho de pilha do id (blocos 64, graveto 16, ferramentas 1). */
function _max(id) {
  return stackOf(id);
}

export class Inventory {
  /**
   * @param {() => void} onChange - chamado após qualquer mutação
   */
  constructor(onChange) {
    this.slots = new Array(INV_SIZE).fill(null); // { id, count } | null
    this.onChange = onChange || (() => {});
  }

  _commit() {
    this.onChange();
  }

  /**
   * Adiciona n itens: primeiro completa pilhas existentes do
   * mesmo id, depois slots vazios (na ordem).
   * @returns {number} quantos NÃO couberam (só >0 se lotado)
   */
  addItem(id, n = 1) {
    if (!Number.isFinite(id) || n <= 0) return 0;
    let left = n;
    const max = _max(id);
    for (let i = 0; i < INV_SIZE && left > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < max) {
        const t = Math.min(left, max - s.count);
        s.count += t;
        left -= t;
      }
    }
    for (let i = 0; i < INV_SIZE && left > 0; i++) {
      if (this.slots[i] === null) {
        const t = Math.min(left, max);
        this.slots[i] = { id, count: t };
        left -= t;
      }
    }
    this._commit();
    return left;
  }

  /** Remove até n itens do slot i. @returns {number} removidos */
  takeFrom(i, n = 1) {
    const s = this.slots[i];
    if (!s || n <= 0) return 0;
    const t = Math.min(n, s.count);
    s.count -= t;
    if (s.count <= 0) this.slots[i] = null;
    this._commit();
    return t;
  }

  /**
   * Remove a metade da pilha (ou tudo se 1) e devolve o que saiu.
   * (botão direito no inventário, como no vanilla)
   */
  takePartial(i) {
    const s = this.slots[i];
    if (!s) return null;
    let t = s.count === 1 ? 1 : Math.ceil(s.count / 2);
    const max = _max(s.id);
    if (t > max) t = max;
    const out = { id: s.id, count: t };
    s.count -= t;
    if (s.count <= 0) this.slots[i] = null;
    this._commit();
    return out;
  }

  /**
   * Coloca uma pilha no slot i: mescla se for o mesmo item,
   * senão troca (o que já estava volta como resto).
   * @returns {{id:number,count:number}|null} resto não cabido/trocado
   */
  placeAt(i, item) {
    if (!item) return null;
    const s = this.slots[i];
    const max = _max(item.id);
    if (!s) {
      const t = Math.min(item.count, max);
      this.slots[i] = { id: item.id, count: t };
      this._commit();
      return item.count > t ? { id: item.id, count: item.count - t } : null;
    }
    if (s.id === item.id) {
      const t = Math.min(max - s.count, item.count);
      s.count += t;
      this._commit();
      return item.count - t > 0 ? { id: item.id, count: item.count - t } : null;
    }
    // troca
    const rest = { id: s.id, count: s.count };
    this.slots[i] = { id: item.id, count: Math.min(item.count, max) };
    this._commit();
    return rest;
  }

  /**
   * Remove itens do id espalhados pelos slots (na ordem 0..35),
   * quanto houver. @returns {number} quantos removeram de fato
   */
  takeFromAny(id, n = 1) {
    if (n <= 0) return 0;
    let left = n;
    for (let i = 0; i < INV_SIZE && left > 0; i++) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const t = Math.min(left, s.count);
      s.count -= t;
      left -= t;
      if (s.count <= 0) this.slots[i] = null;
    }
    this._commit();
    return n - left;
  }

  /** Total de um id em todo o inventário. */
  countOf(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  has(id) {
    return this.countOf(id) > 0;
  }

  /** Esvazia tudo (morte/respawn — Fase 9). */
  clear() {
    this.slots.fill(null);
    this._commit();
  }

  snapshot() {
    return this.slots.map((s) => (s ? { ...s } : null));
  }
}
