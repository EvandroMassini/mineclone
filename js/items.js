// ============================================================
// Fase 8: itens que NÃO são blocos — graveto + ferramentas
// de madeira (picareta, machado, pá, espada), com duração,
// velocidade de mineração e receitas de crafting.
//
// IDs >= 100 = itens (0..9 = blocos, em blocks.js).
// ============================================================
import { BLOCKS, tileDataURL } from "./blocks.js";

export const STICK = 101;
export const PICKAXE = 102;
export const AXE = 103;
export const SHOVEL = 104;
export const SWORD = 105;
export const APPLE = 106; // Fase 9: comestível (food: 4)

// goodFor: blocos em que a ferramenta acelera a mineração (xTOOL_SPEED)
// dur: duração inicial (cada bloco quebrado consome 1)
export const ITEMS = {
  [STICK]: { name: "graveto", maxStack: 16 },
  [PICKAXE]: {
    name: "picareta de madeira",
    maxStack: 1,
    dur: 64,
    goodFor: [3],
  },
  [AXE]: { name: "machado de madeira", maxStack: 1, dur: 64, goodFor: [6, 9] },
  [SHOVEL]: {
    name: "pá de madeira",
    maxStack: 1,
    dur: 64,
    goodFor: [1, 2, 4, 5],
  },
  [SWORD]: { name: "espada de madeira", maxStack: 1, dur: 64, goodFor: [7] },
  // food: quanta fome restaura ao comer (1 ícone = 2 de fome)
  [APPLE]: { name: "maçã", maxStack: 64, food: 4 },
};

// velocidade relativa da ferramenta certa no bloco certo
export const TOOL_SPEED = 4;

export function isItem(id) {
  return id >= 100;
}

export function itemName(id) {
  return isItem(id) ? ITEMS[id].name : BLOCKS[id].name;
}

/** Tamanho de pilha do item (ferramentas não empilham, como no vanilla). */
export function stackOf(id) {
  return isItem(id) ? ITEMS[id].maxStack : 64;
}

/** Multiplicador de velocidade do item ativo sobre o bloco mirado. */
export function toolSpeed(slot, blockId) {
  if (!slot) return 1;
  const info = ITEMS[slot.id];
  if (info && info.goodFor && info.goodFor.includes(blockId)) return TOOL_SPEED;
  return 1;
}

// ------------------------------------------------------------
// Receitas: in = { id: qtd } consumido · out = { id, n } produzido
// (madeira→tábuas→gravetos→ferramenta, fiel ao survival inicial)
// ------------------------------------------------------------
export const RECIPES = [
  { in: { 6: 1 }, out: { id: 9, n: 4 } },
  { in: { 9: 2 }, out: { id: STICK, n: 4 } },
  { in: { 6: 1, 101: 2 }, out: { id: PICKAXE, n: 1 } },
  { in: { 6: 1, 101: 2 }, out: { id: AXE, n: 1 } },
  { in: { 6: 1, 101: 2 }, out: { id: SHOVEL, n: 1 } },
  { in: { 6: 1, 101: 2 }, out: { id: SWORD, n: 1 } },
];

/** Tem o inventário material suficiente para a receita i? */
export function canCraft(inv, i) {
  const r = RECIPES[i];
  if (!r) return false;
  return Object.entries(r.in).every(([id, n]) => inv.countOf(Number(id)) >= n);
}

/** Consome o material e entrega o resultado. @returns {boolean} */
export function craft(inv, i) {
  const r = RECIPES[i];
  if (!r || !canCraft(inv, i)) return false;
  for (const [id, n] of Object.entries(r.in)) inv.takeFromAny(Number(id), n);
  inv.addItem(r.out.id, r.out.n);
  return true;
}

// ------------------------------------------------------------
// Ícones pixel art (16x16) dos itens — canvas por id, com cache
// ------------------------------------------------------------
function _line(ctx, x0, y0, x1, y1, w, c) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const hw = w >> 1;
  ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps) - hw;
    const y = Math.round(y0 + ((y1 - y0) * i) / steps) - hw;
    ctx.fillRect(x, y, w, w);
  }
}

function _rect(ctx, x, y, w, h, c) {
  ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
  ctx.fillRect(x, y, w, h);
}

const WOOD = [122, 88, 48];
const WOOD_D = [88, 62, 32];
const HEAD = [168, 172, 178];
const BLADE = [190, 198, 208];

function _paintIcon(id, ctx) {
  switch (id) {
    case STICK:
      _line(ctx, 3, 13, 13, 3, 2, WOOD);
      _line(ctx, 3, 13, 13, 3, 1, WOOD_D);
      break;
    case SHOVEL:
      _line(ctx, 4, 12, 12, 4, 2, WOOD);
      _rect(ctx, 1, 10, 5, 5, [150, 112, 66]); // pá (cabo na diagonal)
      _rect(ctx, 1, 14, 5, 1, WOOD_D);
      break;
    case SWORD:
      _line(ctx, 3, 13, 9, 7, 2, WOOD); // cabo
      _line(ctx, 9, 7, 13, 3, 3, BLADE); // lâmina
      _rect(ctx, 7, 6, 3, 2, WOOD_D); // guarda
      break;
    case PICKAXE:
      _line(ctx, 7, 4, 7, 13, 2, WOOD); // cabo vertical
      _line(ctx, 3, 6, 12, 4, 3, HEAD); // cabeça em arco
      _rect(ctx, 2, 5, 2, 3, HEAD);
      _rect(ctx, 12, 3, 2, 3, HEAD);
      break;
    case AXE:
      _line(ctx, 7, 3, 7, 13, 2, WOOD); // cabo vertical
      _rect(ctx, 8, 3, 5, 5, HEAD); // lâmina lateral
      _rect(ctx, 12, 5, 2, 2, WOOD_D);
      break;
    case APPLE:
      _rect(ctx, 5, 4, 6, 2, [178, 42, 42]); // topo
      _rect(ctx, 3, 6, 10, 8, [178, 42, 42]); // corpo
      _rect(ctx, 5, 14, 6, 1, [140, 30, 30]); // base escura
      _line(ctx, 8, 2, 8, 5, 1, [92, 64, 32]); // talo
      _rect(ctx, 10, 3, 2, 2, [92, 148, 56]); // folha
      _rect(ctx, 4, 7, 2, 2, [224, 116, 100]); // brilho
      break;
  }
}

const _iconCache = new Map();

/** Canvas 16x16 do ícone do item (cache por id). */
export function itemIconCanvas(id) {
  let c = _iconCache.get(id);
  if (!c) {
    c = document.createElement("canvas");
    c.width = 16;
    c.height = 16;
    _paintIcon(id, c.getContext("2d"));
    _iconCache.set(id, c);
  }
  return c;
}

/** DataURL do ícone do item (hotbar/inventário/crafting). */
export function itemDataURL(id) {
  return itemIconCanvas(id).toDataURL("image/png");
}

/**
 * URL de textura de QUALQUER item (bloco ou item) —
 * blocos usam o tile do topo do atlas, itens o ícone próprio.
 */
export function itemTexURL(id) {
  return isItem(id) ? itemDataURL(id) : tileDataURL(BLOCKS[id].top);
}

// ------------------------------------------------------------
// Fase 9: ícones de sobrevivência (corações + bife de fome)
// ------------------------------------------------------------
const _hudCache = new Map();

// Matriz 16x16 do coração, simétrica em torno de x = 7.5
const HEART_ROWS = [
  "................",
  "....XX....XX....",
  "...XXXX..XXXX...",
  "..XXXXXXXXXXXX..",
  ".XXXXXXXXXXXXXX.",
  ".XXXXXXXXXXXXXX.",
  ".XXXXXXXXXXXXXX.",
  "..XXXXXXXXXXXX..",
  "...XXXXXXXXXX...",
  "....XXXXXXXX....",
  ".....XXXXXX.....",
  "......XXXX......",
  ".......XX.......",
  "................",
  "................",
  "................",
];

function _drawHeart(ctx, state) {
  if (state === "empty") return; // vazio = transparente
  const half = state === "half";
  ctx.fillStyle = "rgb(178,34,34)";
  for (let y = 0; y < 16; y++) {
    const row = HEART_ROWS[y];
    const limit = half ? 8 : 16;
    for (let x = 0; x < limit; x++) {
      if (row[x] === "X") ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** DataURL do coração do HUD: "full" | "half" | "empty". */
export function heartDataURL(state) {
  const key = "heart_" + state;
  let c = _hudCache.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = 16;
    c.height = 16;
    _drawHeart(c.getContext("2d"), state);
    _hudCache.set(key, c);
  }
  return c.toDataURL("image/png");
}

function _drawFood(ctx) {
  // bife: carne avermelhada + osso branco na diagonal
  const MEAT = [188, 106, 66];
  const MEAT_D = [142, 78, 44];
  const BONE = [232, 228, 220];
  _line(ctx, 9, 6, 13, 2, 2, BONE); // osso
  _rect(ctx, 12, 1, 3, 2, BONE);
  _rect(ctx, 12, 3, 2, 2, BONE);
  _rect(ctx, 3, 4, 8, 8, MEAT); // carne
  _rect(ctx, 2, 5, 10, 6, MEAT);
  _rect(ctx, 4, 12, 6, 2, MEAT_D);
  _rect(ctx, 4, 5, 2, 2, [222, 150, 100]); // brilho
}

/** DataURL do bife de fome (1 ícone = 2 de fome). */
export function foodDataURL() {
  let c = _hudCache.get("food");
  if (!c) {
    c = document.createElement("canvas");
    c.width = 16;
    c.height = 16;
    _drawFood(c.getContext("2d"));
    _hudCache.set("food", c);
  }
  return c.toDataURL("image/png");
}
