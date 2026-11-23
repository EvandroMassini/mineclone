// ============================================================
// Fase 4: sons sintetizados via WebAudio (sem arquivos externos)
// — quebra, colocação, passos e seleção de slot
// ============================================================

let ctx = null;

// AudioContext só existe após gesto do usuário; cria/resume sob demanda
function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// Ruptura de ruído com decaimento — base de todos os sons de bloco
function noiseBurst(
  a,
  { dur = 0.12, freq = 900, q = 0.8, gain = 0.4, type = "lowpass" },
) {
  const n = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const k = i / n;
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, 2); // decaimento quadrático
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const filt = a.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = freq;
  filt.Q.value = q;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(filt);
  filt.connect(g);
  g.connect(a.destination);
  src.start();
}

// Tom curto com envelope exponencial
function tone(a, freq, dur, gain = 0.2, type = "sine") {
  const o = a.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = a.createGain();
  const t0 = a.currentTime;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g);
  g.connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur);
}

// Sons de mundo ------------------------------------------------------

/** Quebra de bloco — o "crack" é proporcional à dureza do bloco. */
export function playBreak(hardness = 0.45) {
  try {
    const a = ac();
    if (!a) return;
    const dur = Math.min(0.35, 0.08 + hardness * 0.12);
    noiseBurst(a, { dur, freq: 700 + Math.random() * 300, gain: 0.5 });
    tone(a, 85 + Math.random() * 45, dur * 0.8, 0.22); // "thock" grave
  } catch {
    /* áudio indisponível — segue o jogo */
  }
}

/** Colocação de bloco — clique seco. */
export function playPlace() {
  try {
    const a = ac();
    if (!a) return;
    noiseBurst(a, { dur: 0.08, freq: 1400, gain: 0.35 });
  } catch {
    /* noop */
  }
}

/** Passo no chão — suave, varia levemente por chamada. */
export function playStep() {
  try {
    const a = ac();
    if (!a) return;
    noiseBurst(a, {
      dur: 0.06,
      freq: 480 + Math.random() * 220,
      gain: 0.1,
      type: "bandpass",
      q: 1.4,
    });
  } catch {
    /* noop */
  }
}

/** Seleção de slot na hotbar — "pop" discreto. */
export function playSelect() {
  try {
    const a = ac();
    if (!a) return;
    tone(a, 520 + Math.random() * 60, 0.05, 0.06, "square");
  } catch {
    /* noop */
  }
}

// Sons da Fase 8 (ferramentas e crafting) -----------------------------

/** Crafting concluído — duas notas ascendentes (clic-clic). */
export function playCraft() {
  try {
    const a = ac();
    if (!a) return;
    tone(a, 660, 0.07, 0.14, "triangle");
    setTimeout(() => tone(a, 990, 0.1, 0.14, "triangle"), 70);
  } catch {
    /* noop */
  }
}

/** Ferramenta quebrou — estalo grave + "crack" de madeira. */
export function playToolBreak() {
  try {
    const a = ac();
    if (!a) return;
    noiseBurst(a, { dur: 0.22, freq: 520, gain: 0.5 });
    tone(a, 140, 0.2, 0.25, "sawtooth");
  } catch {
    /* noop */
  }
}

// Sons da Fase 9 (sobrevivência) ---------------------------------------

/** Dano sofrido — tom grave quadrado ("uuf" de dor). */
export function playHurt() {
  try {
    const a = ac();
    if (!a) return;
    tone(a, 160 + Math.random() * 30, 0.12, 0.2, "square");
    setTimeout(() => tone(a, 110, 0.1, 0.14, "square"), 50);
  } catch {
    /* noop */
  }
}

/** Comer — três mastigadas curtas (croc-croc-croc). */
export function playEat() {
  try {
    const a = ac();
    if (!a) return;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        noiseBurst(a, { dur: 0.05, freq: 1800, gain: 0.25, q: 0.6 });
      }, i * 90);
    }
  } catch {
    /* noop */
  }
}

/** Morte — quatro notas descendentes, tipo "largo" de despedida. */
export function playDeath() {
  try {
    const a = ac();
    if (!a) return;
    [440, 349, 262, 175].forEach((f, i) => {
      setTimeout(() => tone(a, f, 0.28, 0.18, "sawtooth"), i * 240);
    });
  } catch {
    /* noop */
  }
}
