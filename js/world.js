// ============================================================
// Fase 2: mundo voxel — chunks 16x16x48, geração procedural,
// culling por face, streaming ao redor do jogador, spawn
// ============================================================
import * as THREE from "three";
import { makeNoise2D } from "./noise.js";
import {
  AIR,
  GRASS,
  DIRT,
  STONE,
  SAND,
  SNOW,
  LOG,
  LEAVES,
  WATER,
  BLOCKS,
  solidMaterial,
  waterMaterial,
  tileUV,
} from "./blocks.js";

export const CHUNK = 16;
export const HEIGHT = 48;
export const SEA = 20; // nível do mar
export const RENDER_DIST = 6; // chunks (~96 blocos)

const TOP_SHADE = 1.0;
const SIDE_SHADE = 0.82;
const BOT_SHADE = 0.55;
const WATER_LEVEL = 0.88; // topo da água ~0.12 abaixo do bloco
const BUILD_BUDGET_MS = 6; // orçamento de build por frame

const keyOf = (cx, cz) => cx + "," + cz;
const DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

// 6 faces: direção, cantos (ordem CCW vista de fora), UV local do tile
// e sombreamento por face (topo/lado/base)
const FACES = [
  {
    dir: [1, 0, 0],
    shade: SIDE_SHADE,
    c: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
    uv: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
    ],
  },
  {
    dir: [-1, 0, 0],
    shade: SIDE_SHADE,
    c: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
    uv: [
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  },
  {
    dir: [0, 1, 0],
    shade: TOP_SHADE,
    c: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    uv: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    dir: [0, -1, 0],
    shade: BOT_SHADE,
    c: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    uv: [
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ],
  },
  {
    dir: [0, 0, 1],
    shade: SIDE_SHADE,
    c: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    uv: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  },
  {
    dir: [0, 0, -1],
    shade: SIDE_SHADE,
    c: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    uv: [
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
  },
];

// Bloco "opaco" oculta faces vizinhas (folhas/água não ocultam)
const isOpaque = (id) => id !== AIR && id !== WATER && id !== LEAVES;

export class World {
  constructor(scene, seed = 20261121) {
    this.scene = scene;
    this.seed = seed;
    this.noise = makeNoise2D(seed);
    this.heat = makeNoise2D((seed ^ 0x9e3779b9) >>> 0);
    this.chunks = new Map(); // "cx,cz" → chunk
    this.dirtyRemesh = new Set(); // chunks com vizinho novo a re-meshar
    this.group = new THREE.Group();
    scene.add(this.group);

    this.spawn = this.findSpawn();

    // Garante terreno já construído ao redor do spawn (colisão imediata)
    const scx = Math.floor(this.spawn.x / CHUNK);
    const scz = Math.floor(this.spawn.z / CHUNK);
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) this.buildChunk(scx + dx, scz + dz);
  }

  // ------------------------------------------------------------
  // Terreno (ruído determinístico)
  // ------------------------------------------------------------
  heightAt(x, z) {
    const cont = this.noise.fbm(x * 0.0035, z * 0.0035, 4); // continental
    const det = this.noise.fbm(x * 0.02 + 100, z * 0.02 + 100, 4); // detalhe
    const h = Math.floor(8 + cont * 10 + det * 14);
    return Math.max(2, Math.min(HEIGHT - 6, h));
  }

  tempAt(x, z) {
    return this.heat.fbm(x * 0.004 + 500, z * 0.004 + 500, 3);
  }

  biomeAt(x, z) {
    const t = this.tempAt(x, z);
    if (t < 0.4) return "desert";
    if (t > 0.62) return "snow";
    return "plains";
  }

  // ------------------------------------------------------------
  // Spawn: coluna mais próxima do centro com superfície acima do mar
  // ------------------------------------------------------------
  findSpawn() {
    for (let r = 0; r < 96; r++) {
      const ring = [];
      if (r === 0) ring.push([0, 0]);
      else {
        for (let dx = -r; dx <= r; dx++) ring.push([dx, -r], [dx, r]);
        for (let dz = -r + 1; dz <= r - 1; dz++) ring.push([-r, dz], [r, dz]);
      }
      for (const [dx, dz] of ring) {
        const h = this.heightAt(dx, dz);
        if (h >= SEA + 1) return { x: dx + 0.5, y: h + 1, z: dz + 0.5 };
      }
    }
    return { x: 0.5, y: HEIGHT - 4, z: 0.5 };
  }

  // ------------------------------------------------------------
  // Geração dos dados de um chunk
  // ------------------------------------------------------------
  generateChunk(cx, cz) {
    const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
    const set = (lx, y, lz, b) => {
      if (
        y < 0 ||
        y >= HEIGHT ||
        lx < 0 ||
        lx >= CHUNK ||
        lz < 0 ||
        lz >= CHUNK
      )
        return;
      data[(lx * CHUNK + lz) * HEIGHT + y] = b;
    };
    const topBlock = { plains: GRASS, desert: SAND, snow: SNOW };
    const subBlock = { plains: DIRT, desert: SAND, snow: DIRT };

    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const wx = cx * CHUNK + lx;
        const wz = cz * CHUNK + lz;
        const h = this.heightAt(wx, wz);
        const biome = this.biomeAt(wx, wz);

        for (let y = 0; y <= h; y++) {
          let b;
          if (y === h) b = topBlock[biome];
          else if (y >= h - 3) b = subBlock[biome];
          else b = STONE;
          set(lx, y, lz, b);
        }

        // água preenche de h+1 até o nível do mar
        if (h < SEA) {
          for (let y = h + 1; y <= SEA; y++) set(lx, y, lz, WATER);
        }

        // árvores: só em plains, sem tocar a borda do chunk (coroa 5x5
        // precisa caber inteira) → determinístico e seguro no meshing
        if (
          biome === "plains" &&
          h >= SEA + 1 &&
          lx >= 2 &&
          lx <= 13 &&
          lz >= 2 &&
          lz <= 13 &&
          this.noise.hash2(wx, wz) > 0.96
        ) {
          this.placeTree(set, lx, lz, h, wx, wz);
        }
      }
    }
    return data;
  }

  placeTree(set, lx, lz, h, wx, wz) {
    const th = 4 + (this.noise.hash2(lx * 3 + 7, lz * 5 + 11) > 0.5 ? 1 : 0);
    for (let i = 1; i <= th; i++) set(lx, h + i, lz, LOG);

    const topY = h + th;
    for (let dy = -1; dy <= 1; dy++) {
      const r = dy === 1 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0) continue;
          // arredonda os cantos da coroa (determinístico)
          if (
            Math.abs(dx) === 2 &&
            Math.abs(dz) === 2 &&
            this.noise.hash2(wx * 13 + dx, wz * 17 + dz) < 0.35
          )
            continue;
          set(lx + dx, topY + dy, lz + dz, LEAVES);
        }
      }
    }
    set(lx, topY + 1, lz, LEAVES);
  }

  // ------------------------------------------------------------
  // Meshing (culling por face)
  // ------------------------------------------------------------
  buildChunk(cx, cz, isNew = true) {
    const key = keyOf(cx, cz);
    const old = this.chunks.get(key);
    if (old) this.disposeChunk(old);
    this.dirtyRemesh.delete(key);

    const data = this.generateChunk(cx, cz);
    const chunk = { cx, cz, data, mesh: null, waterMesh: null };

    this.fillMesh(chunk);
    this.chunks.set(key, chunk);

    if (isNew) {
      // Vizinhos já construídos têm faces desenhadas "contra ar" na borda
      // compartilhada — marcam para re-mesh com o culling correto.
      for (const [dx, dz] of DIRS4) {
        const nk = keyOf(cx + dx, cz + dz);
        if (this.chunks.has(nk)) this.dirtyRemesh.add(nk);
      }
    }
    return chunk;
  }

  // Re-mesh um chunk existente usando a data já gerada (vizinhos mudaram)
  fillMesh(chunk) {
    const { cx, cz, data } = chunk;
    if (chunk.mesh) {
      this.group.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }
    if (chunk.waterMesh) {
      this.group.remove(chunk.waterMesh);
      chunk.waterMesh.geometry.dispose();
      chunk.waterMesh = null;
    }

    const solid = this.meshFaces(
      data,
      cx,
      cz,
      (id) => id !== AIR && id !== WATER,
      false,
    );
    if (solid.pos.length) {
      chunk.mesh = this.makeMesh(solid, solidMaterial);
      chunk.mesh.position.set(cx * CHUNK, 0, cz * CHUNK);
      this.group.add(chunk.mesh);
    }

    const water = this.meshFaces(data, cx, cz, (id) => id === WATER, true);
    if (water.pos.length) {
      chunk.waterMesh = this.makeMesh(water, waterMaterial);
      chunk.waterMesh.position.set(cx * CHUNK, 0, cz * CHUNK);
      this.group.add(chunk.waterMesh);
    }
  }

  remeshChunk(key) {
    const chunk = this.chunks.get(key);
    if (!chunk) {
      this.dirtyRemesh.delete(key);
      return;
    }
    this.dirtyRemesh.delete(key);
    this.fillMesh(chunk);
  }

  // Vizinhança: rápido dentro do chunk; atravessa a borda usando o chunk
  // vizinho se já construído (evita faces duplicadas); senão AIR (desenha
  // a face de fronteira — vizinhos vazios não desenhariam a deles).
  makeNeighbor(data, cx, cz) {
    return (x, y, z) => {
      if (y < 0 || y >= HEIGHT) return AIR;
      let ncx = cx,
        nz = cz,
        lx = x,
        lz = z;
      if (x < 0) {
        ncx = cx - 1;
        lx = CHUNK - 1;
      } else if (x >= CHUNK) {
        ncx = cx + 1;
        lx = 0;
      }
      if (z < 0) {
        nz = cz - 1;
        lz = CHUNK - 1;
      } else if (z >= CHUNK) {
        nz = cz + 1;
        lz = 0;
      }
      if (ncx === cx && nz === cz) return data[(lx * CHUNK + lz) * HEIGHT + y];
      const n = this.chunks.get(keyOf(ncx, nz));
      return n ? n.data[(lx * CHUNK + lz) * HEIGHT + y] : AIR;
    };
  }

  meshFaces(data, cx, cz, pick, water) {
    const pos = [],
      norm = [],
      col = [],
      uv = [],
      idx = [];
    const neighbor = this.makeNeighbor(data, cx, cz);
    water = !!water;

    for (let y = 0; y < HEIGHT; y++) {
      for (let z = 0; z < CHUNK; z++) {
        for (let x = 0; x < CHUNK; x++) {
          const id = data[(x * CHUNK + z) * HEIGHT + y];
          if (!pick(id)) continue;
          const def = BLOCKS[id];
          for (const f of FACES) {
            const n = neighbor(x + f.dir[0], y + f.dir[1], z + f.dir[2]);
            // face oculta: vizinho opaco (mesmo bloco incluso)
            if (n === id || isOpaque(n)) continue;
            // água só desenha face contra ar
            if (water && n !== AIR) continue;

            const tile =
              f.dir[1] === 1
                ? def.top
                : f.dir[1] === -1
                  ? def.bottom
                  : def.side;
            const base = pos.length / 3;
            const { u0, v0, du, dv } = tileUV(tile);
            const s = f.shade;
            for (let i = 0; i < 4; i++) {
              const c = f.c[i];
              // topo da água fica ~0.12 mais baixo
              const cy =
                water && f.dir[1] === 1 && c[1] === 1 ? WATER_LEVEL : c[1];
              pos.push(x + c[0], y + cy, z + c[2]);
              norm.push(f.dir[0], f.dir[1], f.dir[2]);
              col.push(s, s, s);
              uv.push(u0 + f.uv[i][0] * du, v0 + f.uv[i][1] * dv);
            }
            idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
        }
      }
    }
    return { pos, norm, col, uv, idx };
  }

  makeMesh(f, material) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(f.pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(f.norm, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(f.col, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(f.uv, 2));
    geo.setIndex(f.idx);
    geo.computeBoundingSphere();
    return new THREE.Mesh(geo, material);
  }

  disposeChunk(chunk) {
    if (chunk.mesh) {
      this.group.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
    }
    if (chunk.waterMesh) {
      this.group.remove(chunk.waterMesh);
      chunk.waterMesh.geometry.dispose();
    }
  }

  // ------------------------------------------------------------
  // Consultas para colisão
  // ------------------------------------------------------------
  isSolid(wx, wy, wz) {
    if (wy < 0) return true; // piso do mundo (rede de segurança)
    if (wy >= HEIGHT) return false;
    const cx = Math.floor(wx / CHUNK);
    const cz = Math.floor(wz / CHUNK);
    const c = this.chunks.get(keyOf(cx, cz));
    if (!c) return true; // chunk não gerado = parede (impede cair no não-gerado)
    const id =
      c.data[((wx - cx * CHUNK) * CHUNK + (wz - cz * CHUNK)) * HEIGHT + wy];
    return BLOCKS[id].solid;
  }

  isWater(wx, wy, wz) {
    if (wy < 0 || wy >= HEIGHT) return false;
    const cx = Math.floor(wx / CHUNK);
    const cz = Math.floor(wz / CHUNK);
    const c = this.chunks.get(keyOf(cx, cz));
    if (!c) return false;
    const id =
      c.data[((wx - cx * CHUNK) * CHUNK + (wz - cz * CHUNK)) * HEIGHT + wy];
    return id === WATER;
  }

  // ------------------------------------------------------------
  // Consulta e edição de blocos (Fase 4 — interação)
  // ------------------------------------------------------------
  // ID do bloco em (wx, wy, wz); AIR se fora do mundo ou chunk não construído.
  // Coordenadas fracionárias são arredondadas p/ baixo (o array é indexado
  // diretamente — índice fracionário retornaria undefined).
  getBlock(wx, wy, wz) {
    wx = Math.floor(wx);
    wy = Math.floor(wy);
    wz = Math.floor(wz);
    if (wy < 0 || wy >= HEIGHT) return AIR;
    const cx = Math.floor(wx / CHUNK);
    const cz = Math.floor(wz / CHUNK);
    const c = this.chunks.get(keyOf(cx, cz));
    if (!c) return AIR;
    const id =
      c.data[((wx - cx * CHUNK) * CHUNK + (wz - cz * CHUNK)) * HEIGHT + wy];
    return id;
  }

  // Escreve um bloco e re-mesha o chunk (marcando vizinhos na borda).
  // Retorna true se a edição foi aplicada.
  setBlock(wx, wy, wz, id) {
    if (wy < 0 || wy >= HEIGHT) return false;
    const cx = Math.floor(wx / CHUNK);
    const cz = Math.floor(wz / CHUNK);
    const key = keyOf(cx, cz);
    const c = this.chunks.get(key);
    if (!c) return false; // chunk ainda não construído: nada para editar
    const lx = wx - cx * CHUNK;
    const lz = wz - cz * CHUNK;
    c.data[(lx * CHUNK + lz) * HEIGHT + wy] = id;
    this.remeshChunk(key);
    // Célula na borda: a face de fronteira do vizinho construído precisa
    // re-meschar (mark now, resolve no orçamento do update). Vizinho ainda
    // não construído resolve naturalmente quando for gerado.
    if (lx === 0) this.markDirtyIfBuilt(cx - 1, cz);
    if (lx === CHUNK - 1) this.markDirtyIfBuilt(cx + 1, cz);
    if (lz === 0) this.markDirtyIfBuilt(cx, cz - 1);
    if (lz === CHUNK - 1) this.markDirtyIfBuilt(cx, cz + 1);
    return true;
  }

  markDirtyIfBuilt(cx, cz) {
    const key = keyOf(cx, cz);
    if (this.chunks.has(key)) this.dirtyRemesh.add(key);
  }

  // ------------------------------------------------------------
  // Streaming: constrói em ordem de distância (orçamento/frame) e
  // descarta chunks fora do raio
  // ------------------------------------------------------------
  update(playerPos) {
    const pcx = Math.floor(playerPos.x / CHUNK);
    const pcz = Math.floor(playerPos.z / CHUNK);
    const R = RENDER_DIST;
    const r2 = (R + 0.4) * (R + 0.4);

    const want = new Set();
    const queue = [];
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        const d = dx * dx + dz * dz;
        if (d > r2) continue;
        const key = keyOf(pcx + dx, pcz + dz);
        want.add(key);
        if (!this.chunks.has(key))
          queue.push({ cx: pcx + dx, cz: pcz + dz, d });
      }
    }

    queue.sort((a, b) => a.d - b.d);
    const t0 = performance.now();

    // Re-mesh primeiro (corrigi faces de borda contra vizinho novo)
    for (const key of Array.from(this.dirtyRemesh)) {
      if (performance.now() - t0 > BUILD_BUDGET_MS) break;
      this.remeshChunk(key);
    }

    for (const q of queue) {
      if (performance.now() - t0 > BUILD_BUDGET_MS) break;
      this.buildChunk(q.cx, q.cz, true);
    }

    for (const [key, chunk] of this.chunks) {
      if (!want.has(key)) {
        this.disposeChunk(chunk);
        this.chunks.delete(key);
        this.dirtyRemesh.delete(key);
      }
    }
  }

  stats() {
    return { chunks: this.chunks.size };
  }
}
