// ============================================================
// Fase 2: catálogo de blocos + atlas de texturas (tiles 16px em canvas)
// ============================================================
import * as THREE from "three";
import { mulberry32 } from "./noise.js";

export const TILE = 16; // tamanho de cada tile (px)
export const ATLAS = 8; // grade 8x8 de tiles → canvas 128x128

// IDs de bloco (índice no array BLOCKS)
export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const SAND = 4;
export const SNOW = 5;
export const LOG = 6;
export const LEAVES = 7;
export const WATER = 8;
export const PLANKS = 9;

// Tiles do atlas (índice → posição na grade)
const T = {
  grassTop: 0,
  grassSide: 1,
  dirt: 2,
  stone: 3,
  sand: 4,
  snow: 5,
  logSide: 6,
  logTop: 7,
  leaves: 8,
  water: 9,
  planks: 10,
};

// Catálogo: qual tile em topo/lado/base, se colide e tempo de mineração (s)
// `hard`: segundos para quebrar a mão livre (Infinity → não quebrável)
// `drop`: id do item que o bloco solta ao quebrar (omitido → ele mesmo)
export const BLOCKS = [
  { name: "air", solid: false, hard: Infinity },
  {
    name: "grass",
    top: T.grassTop,
    side: T.grassSide,
    bottom: T.dirt,
    solid: true,
    hard: 0.45,
    drop: 2, // grama solta terra (como no vanilla)
  },
  {
    name: "dirt",
    top: T.dirt,
    side: T.dirt,
    bottom: T.dirt,
    solid: true,
    hard: 0.45,
  },
  {
    name: "stone",
    top: T.stone,
    side: T.stone,
    bottom: T.stone,
    solid: true,
    hard: 1.8,
  },
  {
    name: "sand",
    top: T.sand,
    side: T.sand,
    bottom: T.sand,
    solid: true,
    hard: 0.45,
  },
  {
    name: "snow",
    top: T.snow,
    side: T.snow,
    bottom: T.snow,
    solid: true,
    hard: 0.3,
  },
  {
    name: "log",
    top: T.logTop,
    side: T.logSide,
    bottom: T.logTop,
    solid: true,
    hard: 1.1,
  },
  {
    name: "leaves",
    top: T.leaves,
    side: T.leaves,
    bottom: T.leaves,
    solid: true,
    hard: 0.35,
    drop: null, // folhas não soltam nada
  },
  {
    name: "water",
    top: T.water,
    side: T.water,
    bottom: T.water,
    solid: false,
    hard: Infinity,
    drop: null,
  },
  {
    name: "planks",
    top: T.planks,
    side: T.planks,
    bottom: T.planks,
    solid: true,
    hard: 1.4,
  },
];

// ------------------------------------------------------------
// Pinte cada tile em pixel art (16x16). null → pixel vazio (folhas)
// ------------------------------------------------------------
const PAINTERS = {
  [T.grassTop]: (px, py, r) => {
    const n = (r() - 0.5) * 26;
    let g = [76 + n, 158 + n * 1.1, 50 + n * 0.6];
    if (r() < 0.07) g = g.map((v) => v - 22);
    return g;
  },
  [T.grassSide]: (px, py, r) => {
    if (py < 3 || (py === 3 && r() < 0.55)) {
      const n = (r() - 0.5) * 24;
      return [72 + n, 150 + n * 1.1, 48 + n * 0.6];
    }
    const n = (r() - 0.5) * 28;
    let g = [124 + n, 88 + n * 0.9, 48 + n * 0.5];
    if (r() < 0.08) g = g.map((v) => v - 24);
    return g;
  },
  [T.dirt]: (px, py, r) => {
    const n = (r() - 0.5) * 30;
    let g = [124 + n, 88 + n * 0.9, 48 + n * 0.5];
    if (r() < 0.09) g = g.map((v) => v - 26);
    return g;
  },
  [T.stone]: (px, py, r) => {
    const n = (r() - 0.5) * 22;
    let g = [126 + n, 128 + n, 132 + n];
    if (r() < 0.1) g = g.map((v) => v - 22);
    return g;
  },
  [T.sand]: (px, py, r) => {
    const n = (r() - 0.5) * 18;
    let g = [222 + n, 204 + n, 148 + n * 0.7];
    if (r() < 0.06) g = g.map((v) => v - 16);
    return g;
  },
  [T.snow]: (px, py, r) => {
    const n = (r() - 0.5) * 12;
    return [238 + n, 244 + n, 250 + n * 0.6];
  },
  [T.logSide]: (px, py, r) => {
    const band = Math.floor(px / 3) % 2;
    const n = (r() - 0.5) * 14;
    return band
      ? [106 + n, 76 + n * 0.8, 42 + n * 0.5]
      : [88 + n, 60 + n * 0.8, 34 + n * 0.5];
  },
  [T.logTop]: (px, py, r) => {
    const d = Math.max(Math.abs(px - 7.5), Math.abs(py - 7.5));
    const n = (r() - 0.5) * 10;
    if (d >= 6.5) return [92 + n, 62 + n * 0.8, 34 + n * 0.5];
    return d % 2 < 1
      ? [178 + n, 142 + n, 92 + n * 0.7]
      : [144 + n, 110 + n, 66 + n * 0.7];
  },
  [T.leaves]: (px, py, r) => {
    if (r() < 0.13) return null; // furos → cutout via alphaTest
    const n = (r() - 0.5) * 36;
    let g = [56 + n, 128 + n * 1.1, 40 + n * 0.6];
    if (r() < 0.06) g = g.map((v) => v + 16);
    return g;
  },
  [T.water]: (px, py, r) => {
    const wave = Math.sin((px + py * 0.7) * 0.9) * 10;
    const n = (r() - 0.5) * 10;
    return [62 + wave + n, 118 + wave + n, 205 + wave * 0.6 + n];
  },
  [T.planks]: (px, py, r) => {
    const row = Math.floor(py / 4); // 4 tábuas de 4px
    const seam = py % 4 === 3; // linha de emenda escura
    const nail = seam && (px === 1 + row * 5 || px === 14 - (row % 2) * 3);
    const grain = (px + row * 7) % 5 === 0; // veios sutis
    const n = (r() - 0.5) * 18;
    if (nail) return [62 + n, 44 + n * 0.7, 22 + n * 0.5];
    let g;
    if (seam) g = [128 + n, 94 + n * 0.8, 52 + n * 0.5];
    else if (grain) g = [172 + n, 130 + n * 0.9, 78 + n * 0.6];
    else g = [190 + n, 146 + n * 0.9, 88 + n * 0.6];
    if (r() < 0.05) g = g.map((v) => v - 20);
    return g;
  },
};

function paintTile(ctx, tileIndex, fn) {
  const ox = (tileIndex % ATLAS) * TILE;
  const oy = Math.floor(tileIndex / ATLAS) * TILE;
  const rng = mulberry32(0x9e37 + tileIndex * 7919);
  for (let py = 0; py < TILE; py++) {
    for (let px = 0; px < TILE; px++) {
      const c = fn(px, py, rng);
      if (!c) {
        ctx.clearRect(ox + px, oy + py, 1, 1);
        continue;
      }
      const rr = Math.max(0, Math.min(255, c[0])) | 0;
      const gg = Math.max(0, Math.min(255, c[1])) | 0;
      const bb = Math.max(0, Math.min(255, c[2])) | 0;
      ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
      ctx.fillRect(ox + px, oy + py, 1, 1);
    }
  }
}

function buildAtlasCanvas() {
  const size = TILE * ATLAS;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  for (const t of Object.values(T)) paintTile(ctx, t, PAINTERS[t]);
  return c;
}

// Canvas original do atlas (fonte dos materiais e das texturas do hotbar)
export const atlasCanvas = buildAtlasCanvas();

// DataURL de um tile isolado do atlas (16x16 → escalado para uso no CSS)
export function tileDataURL(tile) {
  const ox = (tile % ATLAS) * TILE;
  const oy = Math.floor(tile / ATLAS) * TILE;
  const out = document.createElement("canvas");
  out.width = TILE;
  out.height = TILE;
  const ctx = out.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, TILE, TILE);
  ctx.drawImage(atlasCanvas, ox, oy, TILE, TILE, 0, 0, TILE, TILE);
  return out.toDataURL("image/png");
}

// ------------------------------------------------------------
// Materiais compartilhados por todos os chunks
// ------------------------------------------------------------
const atlas = new THREE.CanvasTexture(atlasCanvas);
atlas.magFilter = THREE.NearestFilter;
atlas.minFilter = THREE.NearestFilter;
atlas.generateMipmaps = false; // sem mipmap → sem bleed entre tiles
atlas.colorSpace = THREE.SRGBColorSpace;

export const solidMaterial = new THREE.MeshLambertMaterial({
  map: atlas,
  vertexColors: true,
  alphaTest: 0.5, // cutout das folhas
});

export const waterMaterial = new THREE.MeshLambertMaterial({
  map: atlas,
  vertexColors: true,
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
});

// UVs de um tile na grade do atlas (flipY do CanvasTexture)
export function tileUV(tile) {
  const col = tile % ATLAS;
  const row = Math.floor(tile / ATLAS);
  return {
    u0: col / ATLAS,
    v0: 1 - (row + 1) / ATLAS,
    du: 1 / ATLAS,
    dv: 1 / ATLAS,
  };
}
