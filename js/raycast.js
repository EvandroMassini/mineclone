// ============================================================
// Fase 4: raycast voxel por DDA (Amatos/Humphreys)
// Caminha célula a célula da origem até o primeiro bloco
// sólido (água é transparente para o raio, como no vanilla).
// ============================================================
import { AIR, WATER } from "./blocks.js";

/**
 * Raycast DDA em grade voxel.
 * @param {{x:number,y:number,z:number}} origin — olho da câmera
 * @param {{x:number,y:number,z:number}} dir — direção unitária
 * @param {number} maxDist — alcance máximo em blocos
 * @param {(x:number,y:number,z:number)=>number} getBlock — leitura do mundo
 * @returns {null | {id:number, cell:[number,number,number], prev:[number,number,number]}}
 *   cell = bloco atingido; prev = célula anterior ao hit (onde colocar)
 */
export function raycastVoxel(origin, dir, maxDist, getBlock) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = dir.x >= 0 ? 1 : -1;
  const stepY = dir.y >= 0 ? 1 : -1;
  const stepZ = dir.z >= 0 ? 1 : -1;

  // t para atravessar 1 bloco em cada eixo (Infinity se dir == 0)
  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

  // t da próxima fronteira de célula a partir da origem (atualizadas no loop)
  let tMaxX =
    dir.x !== 0
      ? (stepX > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX
      : Infinity;
  let tMaxY =
    dir.y !== 0
      ? (stepY > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY
      : Infinity;
  let tMaxZ =
    dir.z !== 0
      ? (stepZ > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ
      : Infinity;

  let prev = [x, y, z]; // célula anterior à atual (para colocação)

  for (;;) {
    const id = getBlock(x, y, z);
    if (id !== AIR && id !== WATER) {
      return {
        id,
        cell: [x, y, z],
        prev: prev[0] === x && prev[1] === y && prev[2] === z ? null : prev,
      };
    }

    // Avança para a fronteira mais próxima; zera prev quando o hit é a própria origem
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      if (tMaxX > maxDist) return null;
      prev = [x, y, z];
      x += stepX;
      tMaxX += tDeltaX;
    } else if (tMaxY < tMaxZ) {
      if (tMaxY > maxDist) return null;
      prev = [x, y, z];
      y += stepY;
      tMaxY += tDeltaY;
    } else {
      if (tMaxZ > maxDist) return null;
      prev = [x, y, z];
      z += stepZ;
      tMaxZ += tDeltaZ;
    }
  }
}
