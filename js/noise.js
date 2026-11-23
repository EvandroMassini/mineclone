// ============================================================
// Fase 2: ruído de valor 2D determinístico (hash) + fBm
// ============================================================

// PRNG determinístico (mesma seed → mesma textura/terreno)
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeNoise2D(seed = 1337) {
  const s = seed >>> 0;

  // Hash inteiro (x, y) → [0, 1), estável para qualquer inteiro
  function hash2(x, y) {
    let h = (s ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function smooth(t) {
    return t * t * (3 - 2 * t);
  }

  // Value noise suave em [0, 1]
  function value(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const a = hash2(xi, yi);
    const b = hash2(xi + 1, yi);
    const c = hash2(xi, yi + 1);
    const d = hash2(xi + 1, yi + 1);
    const u = smooth(x - xi);
    const v = smooth(y - yi);
    return (
      a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v
    );
  }

  // fBm: soma de oitavas; retorna ~[0, 1]
  function fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amp = 1,
      freq = 1,
      sum = 0,
      norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * value(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  return { value, fbm, hash2 };
}
