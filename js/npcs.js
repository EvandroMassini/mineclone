// ============================================================
// Fase 5: NPCs — modelos voxelados (villager, porco, vaca,
// ovelha, morcego), wander aleatório, animações simples
// (caminhar, comer grama, voar), spawn em posição válida e
// culling/relocação por distância.
// Fase 10: zumbi (hostil: persegue, ataque corpo-a-corpo,
// queima de dia), passivos comvida (dano/fuga/morte "poof"),
// villager olha o jogador, morcego acompanha o jogador,
// ovelhas pastam com mais frequência.
//
// Convenção: modelo "olha" para −z local quando yaw = 0
// (mesma convenção do jogador). Forward de yaw θ =
// (−sin θ, 0, −cos θ).
// ============================================================
import * as THREE from "three";
import { AIR, GRASS, DIRT, SAND, SNOW, STONE, PLANKS } from "./blocks.js";
import { HEIGHT } from "./world.js";
import { playHurt, playBreak } from "./sounds.js";

const RELOC_DIST = 48; // mais longe que isso → realocar perto do jogador
const VIEW_DIST = 42; // além disso → não renderizar (culling)

// Fase 10: constantes do zumbi
const CHASE_DIST = 16; // além disso → só vaga (como no vanilla)
const ATTACK_RANGE = 1.6; // dentro disso → ataque corpo-a-corpo
const Z_SPEED = 1.5; // velocidade de perseguição (mais rápido que passivos)

// Fase 10: vida por espécie (vanilla aproximado: 20 = 10 corações)
const MOB_HP = { pig: 10, cow: 10, sheep: 8, villager: 20, bat: 6, zombie: 20 };

// Fase 10: hitbox [lx, ly, lz] em metros (centro = pés + ly/2,
// exceto morcego, cujo centro já é n.pos). Usada no ataque melee.
export const MOB_HITBOX = {
  pig: [0.6, 0.6, 1.0],
  cow: [0.65, 0.7, 1.1],
  sheep: [0.7, 0.9, 0.95],
  villager: [0.55, 1.75, 0.45],
  bat: [0.4, 0.4, 0.5],
  zombie: [0.55, 1.85, 0.5],
};

// Superfícies em que animais/villager podem pousar
const WALKABLE_TOP = new Set([GRASS, DIRT, SAND, SNOW, STONE, PLANKS]);

// materiais compartilhados por cor (menos objetos no renderer)
const matCache = new Map();
function mat(color) {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    matCache.set(color, m);
  }
  return m;
}

// ---- geometrias com pivot ----------------------------------
// perna/braco: origem no topo (quadril/ombro), p/ girar
function pivotGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, -h / 2, 0);
  return g;
}
// cabeca: pivot na nuca (atrás), modelo olha p/ −z local
function headGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, 0, -d / 2);
  return g;
}

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
}

// ---- modelos -------------------------------------------------
// Cada builder devolve { group, parts } — parts guarda as peças
// animadas. Origem do group = chão (andadores) / centro (morcego).

function buildPig() {
  const g = new THREE.Group();
  const P = 0xef9ba7; // rosa
  g.add(box(0.55, 0.5, 0.9, P, 0, 0.55, 0));
  const head = new THREE.Mesh(headGeo(0.42, 0.4, 0.42), mat(P));
  head.position.set(0, 0.62, -0.36);
  g.add(head);
  head.add(box(0.2, 0.16, 0.1, 0xd77d92, 0, -0.06, -0.46)); // focinho
  head.add(box(0.1, 0.12, 0.08, P, -0.13, 0.2, 0.02)); // orelhas
  head.add(box(0.1, 0.12, 0.08, P, 0.13, 0.2, 0.02));
  const legs = [];
  for (const [lx, lz] of [
    [-0.18, -0.3],
    [0.18, -0.3],
    [-0.18, 0.3],
    [0.18, 0.3],
  ]) {
    const leg = new THREE.Mesh(pivotGeo(0.15, 0.32, 0.15), mat(P));
    leg.position.set(lx, 0.32, lz);
    g.add(leg);
    legs.push(leg);
  }
  return { group: g, parts: { head, headDown: -0.9, legs, arms: [] } };
}

function buildCow() {
  const g = new THREE.Group();
  const W = 0xefe8dc; // branco
  const D = 0x4a443e; // escuro
  g.add(box(0.6, 0.62, 1.0, W, 0, 0.62, 0));
  // "pintas" nas laterais
  g.add(box(0.2, 0.16, 0.22, D, -0.31, 0.66, -0.18));
  g.add(box(0.18, 0.14, 0.2, D, 0.31, 0.58, 0.18));
  g.add(box(0.16, 0.12, 0.16, D, -0.31, 0.5, 0.22));
  const head = new THREE.Mesh(headGeo(0.44, 0.44, 0.5), mat(D));
  head.position.set(0, 0.78, -0.44);
  g.add(head);
  head.add(box(0.3, 0.22, 0.14, 0xe8c9c0, 0, -0.08, -0.58)); // focinho claro
  head.add(box(0.14, 0.08, 0.1, D, -0.25, 0.1, -0.05)); // orelhas
  head.add(box(0.14, 0.08, 0.1, D, 0.25, 0.1, -0.05));
  const legs = [];
  for (const [lx, lz] of [
    [-0.2, -0.34],
    [0.2, -0.34],
    [-0.2, 0.36],
    [0.2, 0.36],
  ]) {
    const leg = new THREE.Mesh(pivotGeo(0.17, 0.34, 0.17), mat(D));
    leg.position.set(lx, 0.34, lz);
    g.add(leg);
    legs.push(leg);
  }
  const tail = box(0.05, 0.42, 0.05, D, 0, 0.6, 0.52);
  tail.rotation.x = 0.18;
  g.add(tail);
  return { group: g, parts: { head, headDown: -0.85, legs, arms: [] } };
}

function buildSheep() {
  const g = new THREE.Group();
  const O = 0xf2efe4; // lã
  const F = 0xd9c8a2; // face
  const L = 0x6b6157; // pernas
  g.add(box(0.62, 0.58, 0.85, O, 0, 0.6, 0));
  g.add(box(0.66, 0.22, 0.72, O, 0, 0.9, 0.02)); // topo "peludo"
  const head = new THREE.Mesh(headGeo(0.3, 0.32, 0.38), mat(F));
  head.position.set(0, 0.74, -0.36);
  g.add(head);
  head.add(box(0.1, 0.05, 0.12, F, -0.19, 0.06, 0.02)); // orelhas
  head.add(box(0.1, 0.05, 0.12, F, 0.19, 0.06, 0.02));
  const legs = [];
  for (const [lx, lz] of [
    [-0.18, -0.27],
    [0.18, -0.27],
    [-0.18, 0.27],
    [0.18, 0.27],
  ]) {
    const leg = new THREE.Mesh(pivotGeo(0.12, 0.36, 0.12), mat(L));
    leg.position.set(lx, 0.36, lz);
    g.add(leg);
    legs.push(leg);
  }
  return { group: g, parts: { head, headDown: -1.0, legs, arms: [] } };
}

function buildVillager() {
  const g = new THREE.Group();
  const R = 0x6d4a5e; // robe roxo
  const S = 0xb9825c; // pele
  g.add(box(0.5, 0.62, 0.3, R, 0, 0.91, 0)); // torso
  const head = new THREE.Mesh(headGeo(0.42, 0.44, 0.4), mat(S));
  head.position.set(0, 1.22, -0.02);
  g.add(head);
  head.add(box(0.1, 0.14, 0.1, S, 0, -0.08, -0.42)); // nariz
  const legs = [];
  for (const lx of [-0.12, 0.12]) {
    const leg = new THREE.Mesh(pivotGeo(0.2, 0.6, 0.24), mat(R));
    leg.position.set(lx, 0.6, 0);
    g.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const lx of [-0.33, 0.33]) {
    const arm = new THREE.Mesh(pivotGeo(0.16, 0.52, 0.16), mat(S));
    arm.position.set(lx, 1.18, 0);
    g.add(arm);
    arms.push(arm);
  }
  return { group: g, parts: { head, headDown: 0, legs, arms } };
}

function buildBat() {
  const g = new THREE.Group();
  const B = 0x3a3a46;
  g.add(box(0.22, 0.18, 0.3, B, 0, 0, 0));
  g.add(box(0.16, 0.14, 0.14, B, 0, 0.02, -0.18)); // cabeça
  g.add(box(0.04, 0.12, 0.05, B, -0.05, 0.14, -0.18)); // orelhas
  g.add(box(0.04, 0.12, 0.05, B, 0.05, 0.14, -0.18));
  // asas com pivô na raiz (corpo) — flap via rotation.z
  const wlGeo = new THREE.BoxGeometry(0.5, 0.025, 0.34);
  wlGeo.translate(-0.25, 0, 0);
  const wrGeo = new THREE.BoxGeometry(0.5, 0.025, 0.34);
  wrGeo.translate(0.25, 0, 0);
  const wl = new THREE.Mesh(wlGeo, mat(B));
  const wr = new THREE.Mesh(wrGeo, mat(B));
  wl.position.set(-0.1, 0.02, 0);
  wr.position.set(0.1, 0.02, 0);
  g.add(wl, wr);
  return { group: g, parts: { wings: [wl, wr] } };
}

// Fase 10: zumbi — humanoides com braços para frente (pose
// clássica), pele verde, camisa azul-esverdeada, calça roxa.
function buildZombie() {
  const g = new THREE.Group();
  const S = 0x5f8f4f; // pele verde
  const SHT = 0x2f5e7a; // camisa
  const PNT = 0x39396b; // calça
  g.add(box(0.45, 0.6, 0.28, SHT, 0, 0.9, 0)); // torso
  const head = new THREE.Mesh(headGeo(0.4, 0.42, 0.38), mat(S));
  head.position.set(0, 1.2, -0.02);
  g.add(head);
  head.add(box(0.07, 0.09, 0.03, 0x182514, -0.09, 0.06, -0.4)); // olhos
  head.add(box(0.07, 0.09, 0.03, 0x182514, 0.09, 0.06, -0.4));
  const legs = [];
  for (const lx of [-0.11, 0.11]) {
    const leg = new THREE.Mesh(pivotGeo(0.18, 0.6, 0.22), mat(PNT));
    leg.position.set(lx, 0.6, 0);
    g.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const lx of [-0.31, 0.31]) {
    const arm = new THREE.Mesh(pivotGeo(0.15, 0.5, 0.15), mat(S));
    arm.position.set(lx, 1.16, 0);
    arm.rotation.x = -1.35; // braços estendidos p/ frente
    g.add(arm);
    arms.push(arm);
  }
  return { group: g, parts: { head, headDown: 0, legs, arms } };
}

const BUILDERS = {
  pig: buildPig,
  cow: buildCow,
  sheep: buildSheep,
  villager: buildVillager,
  bat: buildBat,
  zombie: buildZombie,
};

const SPECIES_LIST = [
  "pig",
  "pig",
  "pig",
  "pig",
  "pig",
  "pig",
  "cow",
  "cow",
  "cow",
  "cow",
  "cow",
  "sheep",
  "sheep",
  "sheep",
  "sheep",
  "sheep",
  "villager",
  "villager",
  "villager",
  "villager",
  "bat",
  "bat",
  "zombie",
  "zombie",
  "zombie",
];

const rnd = Math.random;

export class NPCSystem {
  constructor(scene, world, player, particles = null) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.particles = particles; // Fase 10: "poof" de morte
    this.npcs = [];
    // Fase 10: callbacks (ligados em main.js)
    this.isPlayerDead = () => false; // inclui "não está jogando"
    this.onPlayerHit = null; // (dmg) => aplica dano ao jogador
    for (const species of SPECIES_LIST) {
      const b = BUILDERS[species]();
      scene.add(b.group);
      const n = {
        species,
        group: b.group,
        parts: b.parts,
        pos: new THREE.Vector3(),
        yaw: rnd() * Math.PI * 2,
        targetYaw: 0,
        state: "idle",
        stateT: rnd() * 1.5,
        phase: rnd() * 10,
        headRot: 0,
        headYaw: 0, // Fase 10: villager olha o jogador
        hp: MOB_HP[species] ?? 10, // Fase 10
        dead: false, // Fase 10
        fleeT: 0, // Fase 10: fuga após dano (passivos)
        fleeYaw: 0,
        attackCd: rnd(), // Fase 10: zumbi
        burnT: 0, // Fase 10: zumbi (dia)
        lungeT: 0, // Fase 10: zumbi (animação de ataque)
        velY: 0, // bugfix: velocidade vertical (queda) dos andadores
        bat:
          species === "bat"
            ? {
                anchor: new THREE.Vector3(),
                baseH: 4 + rnd() * 4,
                r: 2.5 + rnd() * 3.5,
                ang: rnd() * Math.PI * 2,
                angSpeed: (0.4 + rnd() * 0.5) * (rnd() < 0.5 ? 1 : -1),
                flapT: rnd() * 10,
              }
            : null,
      };
      this.npcs.push(n);
    }
    // posiciona todos perto do spawn inicial do jogador
    // (zumbis um pouco mais perto — são hostis)
    const p0 = this.player.pos;
    for (const n of this.npcs) {
      const [rMin, rMax] = n.species === "zombie" ? [8, 22] : [10, 42];
      this.relocate(n, p0, rMin, rMax);
    }
  }

  // topo sólido em (x,z) → y dos pés (y do bloco + 1), ou null.
  // maxY limita a varredura de cima p/ baixo — para andadores usamos
  // "pouco acima dos pés", para achar o chão sob o NPC (não a copa
  // de uma árvore ou um pilar construído por cima).
  groundAt(x, z, maxY = HEIGHT - 1) {
    const bx = Math.floor(x),
      bz = Math.floor(z);
    // y inteiro: getBlock indexa o array direto (índice fracionário → undefined)
    for (let y = Math.floor(Math.min(maxY, HEIGHT - 1)); y >= 0; y--) {
      const id = this.world.getBlock(bx, y, bz);
      if (id !== AIR) return { y: y + 1, top: id };
    }
    return null;
  }

  // encontra posição válida em [rMin, rMax] de (px,pz) e aplica ao npc
  relocate(n, playerPos, rMin = 10, rMax = 42) {
    let spot = null;
    for (let i = 0; i < 28 && !spot; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rMin + rnd() * (rMax - rMin);
      const x = Math.floor(playerPos.x + Math.cos(a) * r) + 0.5;
      const z = Math.floor(playerPos.z + Math.sin(a) * r) + 0.5;
      const g = this.groundAt(x, z);
      if (!g) continue;
      if (n.bat) {
        spot = { x, z, y: g.y + n.bat.baseH, groundY: g.y };
        continue;
      }
      if (!WALKABLE_TOP.has(g.top)) continue; // sem água, copa, etc.
      // espaço livre acima (cabeça + folga)
      if (
        this.world.getBlock(Math.floor(x), g.y + 1, Math.floor(z)) !== AIR ||
        this.world.getBlock(Math.floor(x), g.y + 2, Math.floor(z)) !== AIR
      )
        continue;
      spot = { x, z, y: g.y };
    }
    if (!spot) {
      // fallback raro: perto do jogador, mas SEMPRE com chão andável —
      // o antigo usava o topo sólido da coluna (p. ex. copa de árvore),
      // deixando o mob "voando" na altura das copas
      let fx = playerPos.x + 2,
        fz = playerPos.z + 2,
        fy = 21;
      for (let i = 0; i < 10; i++) {
        const a = rnd() * Math.PI * 2;
        fx = playerPos.x + Math.cos(a) * (2 + rnd() * 3);
        fz = playerPos.z + Math.sin(a) * (2 + rnd() * 3);
        const c = this.groundAt(fx, fz);
        if (c && WALKABLE_TOP.has(c.top)) {
          fy = c.y;
          break;
        }
      }
      spot = { x: fx, z: fz, y: fy };
    }
    n.pos.set(spot.x, spot.y, spot.z);
    n.yaw = rnd() * Math.PI * 2;
    n.state = "idle";
    n.stateT = 0.5 + rnd() * 1.5;
    n.headRot = 0;
    n.headYaw = 0;
    if (n.bat) {
      n.bat.anchor.set(
        playerPos.x + (rnd() - 0.5) * 30,
        0,
        playerPos.z + (rnd() - 0.5) * 30,
      );
    }
    this.place(n);
  }

  // aplica pos/yaw ao group (chão para andadores, centro p/ bat)
  place(n) {
    n.group.position.copy(n.pos);
    n.group.rotation.y = n.yaw;
  }

  // Fase 10: um passo na direção do yaw, com desvio (água, abismo,
  // subida >1 bloco). @returns {boolean} true se andou.
  stepWalk(n, dt, speed) {
    const fx = -Math.sin(n.yaw),
      fz = -Math.cos(n.yaw);
    const nx = n.pos.x + fx * speed * dt;
    const nz = n.pos.z + fz * speed * dt;
    const gNow = this.groundAt(n.pos.x, n.pos.z, n.pos.y + 1.5);
    const gAhead = this.groundAt(nx, nz, n.pos.y + 1.5);
    const bx = Math.floor(nx),
      bz = Math.floor(nz);
    const blocked =
      !gAhead ||
      !WALKABLE_TOP.has(gAhead.top) ||
      (gNow && gAhead.y < gNow.y - 1.5) || // queda >1,5
      (gNow && gAhead.y > gNow.y + 1.5) || // subida >1 bloco
      // folga para o corpo (cabeça) no novo bloco — não enfiar em talude
      this.world.getBlock(bx, gAhead.y, bz) !== AIR ||
      this.world.getBlock(bx, gAhead.y + 1, bz) !== AIR;
    if (blocked) return false;
    n.pos.x = nx;
    n.pos.z = nz;
    n.phase += dt * 7;
    return true;
  }

  // Fase 10: acompanha o chão sólido sob os pés (cavar/construir
  // do jogador). Sem chão → realoca. @returns {boolean}
  //
  // bugfix (mobs "voando"/"dentro de bloco"): o antigo lerp lento
  // (dt*10) fazia o corpo descer pairando quando o chão sumia e
  // atravessar o bloco quando subia um degrau. Agora:
  //  - mesmo nível / fração: assenta na hora (snap)
  //  - chão bem abaixo (jogador cavou): queda com gravidade + vel. máx.
  //  - chão acima (degrau ≤1 bloco, ok em stepWalk): sobe na hora
  //  - chão muito acima (corpo enfiado em talude, ex.: knockback):
  //    assenta na superfície em vez de atravessar ou teleportar
  trackGround(n, dt) {
    const g = this.groundAt(n.pos.x, n.pos.z, n.pos.y + 1.5);
    if (!g || !WALKABLE_TOP.has(g.top)) {
      // sem chão sólido sob os pés (borda cavada, água, etc.) → realocar
      const [rMin, rMax] = n.species === "zombie" ? [8, 22] : [10, 42];
      this.relocate(n, this.player.pos, rMin, rMax);
      return false;
    }
    const dy = g.y - n.pos.y;
    if (dy >= -0.15) {
      // chão no mesmo nível ou acima (até degrau de 1 bloco):
      // assenta imediatamente — sem atravessar bloco nem "pairar"
      n.pos.y = g.y;
      n.velY = 0;
    } else {
      // chão abaixo dos pés: queda com gravidade (velocidade máxima)
      n.velY = (n.velY || 0) - 24 * dt;
      if (n.velY < -16) n.velY = -16;
      n.pos.y += n.velY * dt;
      if (n.pos.y <= g.y) {
        n.pos.y = g.y;
        n.velY = 0;
      }
    }
    return true;
  }

  // ---------- andadores (passivos) ----------
  updateWalker(n, dt, playerPos) {
    const parts = n.parts;

    // Fase 10: fuga após ser atingido (foge do jogador)
    if (n.fleeT > 0) {
      n.fleeT -= dt;
      n.state = "walk";
      n.targetYaw = n.fleeYaw;
    }

    // máquina de estados
    n.stateT -= dt;
    if (n.stateT <= 0) {
      const grass = this.groundAt(n.pos.x, n.pos.z, n.pos.y + 1.5);
      const onGrass = grass && grass.top === GRASS;
      if (n.state === "walk") {
        n.state = "idle";
        n.stateT = 0.8 + rnd() * 2;
      } else if (n.state === "eat") {
        n.state = "idle";
        n.stateT = 0.4 + rnd() * 0.6;
      } else if (n.fleeT <= 0) {
        const r = rnd();
        // Fase 10: ovelhas pastam mais; vacas também; villagers
        // caminham mais (e não comem)
        const eatP = onGrass
          ? n.species === "sheep"
            ? 0.6
            : n.species === "cow"
              ? 0.4
              : 0
          : 0;
        const walkP = eatP + (n.species === "villager" ? 0.8 : 0.6);
        if (r < eatP) {
          n.state = "eat";
          n.stateT = 2 + rnd() * 2;
        } else if (r < walkP) {
          n.state = "walk";
          n.stateT =
            n.species === "villager" ? 2.5 + rnd() * 3 : 1.5 + rnd() * 3;
          n.targetYaw = rnd() * Math.PI * 2;
        } else {
          n.stateT = 0.6 + rnd() * 1.2; // continua parado
        }
      }
    }

    const moving = n.state === "walk";
    if (moving) {
      // gira suave para o targetYaw
      let dy = n.targetYaw - n.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      n.yaw += dy * Math.min(1, dt * 3);
      const moved = this.stepWalk(n, dt, 1.0);
      if (!moved) {
        n.state = "idle";
        n.stateT = 0.4 + rnd() * 0.8;
        n.targetYaw = rnd() * Math.PI * 2;
      }
    }

    if (!this.trackGround(n, dt)) return;

    // ---- animação ----
    const amp = moving ? 0.6 : 0;
    for (let i = 0; i < parts.legs.length; i++) {
      const t = Math.sin(n.phase + i * Math.PI) * amp;
      parts.legs[i].rotation.x +=
        (t - parts.legs[i].rotation.x) * Math.min(1, dt * 12);
    }
    for (let i = 0; i < parts.arms.length; i++) {
      const t = Math.sin(n.phase + (i % 2 === 0 ? Math.PI : 0)) * amp * 0.8;
      parts.arms[i].rotation.x +=
        (t - parts.arms[i].rotation.x) * Math.min(1, dt * 12);
    }
    // cabeça: come grama (desce) / ocioso (retorna)
    const targetHead = n.state === "eat" ? parts.headDown : moving ? -0.06 : 0;
    n.headRot += (targetHead - n.headRot) * Math.min(1, dt * 5);
    parts.head.rotation.x = n.headRot;
    // Fase 10: villager vira a cabeça para o jogador (se perto)
    let headYaw = 0;
    if (n.species === "villager") {
      const dx = playerPos.x - n.pos.x,
        dz = playerPos.z - n.pos.z;
      if (Math.hypot(dx, dz) < 8) {
        const wy = Math.atan2(-dx, -dz);
        let rel = wy - n.yaw;
        while (rel > Math.PI) rel -= Math.PI * 2;
        while (rel < -Math.PI) rel += Math.PI * 2;
        headYaw = Math.max(-1.1, Math.min(1.1, rel * 0.8));
      }
    }
    n.headYaw += (headYaw - n.headYaw) * Math.min(1, dt * 5);
    parts.head.rotation.y = n.headYaw;
    // bob sutil ao andar
    n.group.position.y =
      n.pos.y + (moving ? Math.abs(Math.sin(n.phase)) * 0.03 : 0);
  }

  // ---------- zumbi (Fase 10) ----------
  updateZombie(n, dt, playerPos, dayTime) {
    const parts = n.parts;
    n.lungeT = Math.max(0, n.lungeT - dt);

    // queima de dia (simplificado: 2 dano/s enquanto dayTime 0.27–0.73)
    if (dayTime > 0.27 && dayTime < 0.73) {
      n.burnT += dt;
      if (n.burnT >= 1) {
        n.burnT = 0;
        if (this.particles)
          this.particles.burst(n.pos.x, n.pos.y + 0.9, n.pos.z, 0xff8c33, 8);
        this.hurtMob(n, 2, null);
      }
    } else {
      n.burnT = 0;
    }

    const playing = !this.isPlayerDead();
    const dx = playerPos.x - n.pos.x;
    const dz = playerPos.z - n.pos.z;
    const dist = Math.hypot(dx, dz);
    let moving = false;

    if (playing && dist <= ATTACK_RANGE) {
      // ---- atacar (corpo-a-corpo, 2–3 dano, cd 1s) ----
      n.yaw = Math.atan2(-dx, -dz);
      n.attackCd -= dt;
      if (n.attackCd <= 0) {
        n.attackCd = 1.0;
        n.lungeT = 0.3;
        const dmg = rnd() < 0.5 ? 2 : 3;
        if (this.onPlayerHit) this.onPlayerHit(dmg);
      }
    } else if (playing && dist <= CHASE_DIST) {
      // ---- perseguir (parar a 1,1 bloco p/ não atravessar o player) ----
      const targetYaw = Math.atan2(-dx, -dz);
      let dy = targetYaw - n.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      n.yaw += dy * Math.min(1, dt * 4);
      if (dist > 1.1) moving = this.stepWalk(n, dt, Z_SPEED);
    } else {
      // ---- vagar (mesma lógica dos passivos, sem pastar) ----
      n.stateT -= dt;
      if (n.stateT <= 0) {
        if (n.state === "walk") {
          n.state = "idle";
          n.stateT = 0.8 + rnd() * 2;
        } else if (rnd() < 0.65) {
          n.state = "walk";
          n.stateT = 1.5 + rnd() * 3;
          n.targetYaw = rnd() * Math.PI * 2;
        } else {
          n.stateT = 0.6 + rnd() * 1.2;
        }
      }
      if (n.state === "walk") {
        let dy = n.targetYaw - n.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        n.yaw += dy * Math.min(1, dt * 3);
        moving = this.stepWalk(n, dt, 1.0);
        if (!moving) {
          n.state = "idle";
          n.stateT = 0.4 + rnd() * 0.8;
          n.targetYaw = rnd() * Math.PI * 2;
        }
      }
    }

    if (!this.trackGround(n, dt)) return;

    // ---- animação ----
    const amp = moving ? 0.6 : 0;
    for (let i = 0; i < parts.legs.length; i++) {
      const t = Math.sin(n.phase + i * Math.PI) * amp;
      parts.legs[i].rotation.x +=
        (t - parts.legs[i].rotation.x) * Math.min(1, dt * 12);
    }
    // braços para frente (pose clássica) + avanço no ataque
    const armBase = -1.35 - (n.lungeT > 0 ? 0.35 : 0);
    for (let i = 0; i < parts.arms.length; i++) {
      const t =
        armBase +
        Math.sin(n.phase + (i % 2 === 0 ? Math.PI : 0)) * (moving ? 0.1 : 0.03);
      parts.arms[i].rotation.x +=
        (t - parts.arms[i].rotation.x) * Math.min(1, dt * 12);
    }
    n.group.position.y =
      n.pos.y + (moving ? Math.abs(Math.sin(n.phase)) * 0.03 : 0);
  }

  // ---------- morcego ----------
  updateBat(n, dt, playerPos) {
    const b = n.bat;
    b.ang += b.angSpeed * dt;
    b.flapT += dt;
    // Fase 10: âncora acompanha lentamente o jogador (morcego
    // continua em círculos, mas por onde ele anda)
    b.anchor.x += (playerPos.x - b.anchor.x) * Math.min(1, dt * 0.2);
    b.anchor.z += (playerPos.z - b.anchor.z) * Math.min(1, dt * 0.2);
    const g = this.groundAt(b.anchor.x, b.anchor.z);
    const baseY = g ? g.y : 20;
    const y = baseY + b.baseH + Math.sin(b.flapT * 0.6) * 1.1;
    n.pos.set(
      b.anchor.x + Math.cos(b.ang) * b.r,
      y,
      b.anchor.z + Math.sin(b.ang) * b.r,
    );
    // yaw = tangente do círculo
    const vx = -Math.sin(b.ang) * Math.sign(b.angSpeed);
    const vz = Math.cos(b.ang) * Math.sign(b.angSpeed);
    n.yaw = Math.atan2(-vx, -vz);
    const flap = Math.sin(b.flapT * 13) * 0.8;
    n.parts.wings[0].rotation.z = flap;
    n.parts.wings[1].rotation.z = -flap;
  }

  // ---------- combate (Fase 10) ----------
  /**
   * Aplica dano a um mob.
   * @param {object} n mob alvo
   * @param {number} dmg dano
   * @param {{x:number,z:number}|null} kb direção de knockback
   *   (normalizada, afastando do jogador); null = sem knockback
   * @returns {boolean} true se morreu
   */
  hurtMob(n, dmg, kb = null) {
    if (n.dead) return false;
    n.hp -= dmg;
    playHurt();
    if (kb) this.applyKnockback(n, kb);
    if (n.hp <= 0) {
      this.killMob(n);
      return true;
    }
    if (n.species !== "zombie" && kb) {
      // passivo: foge do jogador por ~1,6s
      n.fleeT = 1.6;
      n.fleeYaw = Math.atan2(-kb.x, -kb.z);
      n.state = "walk";
    }
    return false;
  }

  applyKnockback(n, kb) {
    if (n.bat) {
      n.bat.anchor.x += kb.x * 1.2;
      n.bat.anchor.z += kb.z * 1.2;
      return;
    }
    n.pos.x += kb.x * 0.4;
    n.pos.z += kb.z * 0.4;
  }

  killMob(n) {
    n.dead = true;
    n.hp = 0;
    n.group.visible = false;
    this.scene.remove(n.group);
    // "poof" de morte (partículas na cor do mob)
    if (this.particles)
      this.particles.burst(n.pos.x, n.pos.y + 0.8, n.pos.z, 0x8fbc6e, 20);
    playBreak(0.3);
  }

  update(dt, playerPos, dayTime = 0.32) {
    for (const n of this.npcs) {
      if (n.dead) continue;
      const dx = n.pos.x - playerPos.x;
      const dz = n.pos.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > RELOC_DIST) {
        const [rMin, rMax] = n.species === "zombie" ? [8, 22] : [10, 42];
        this.relocate(n, playerPos, rMin, rMax);
        continue;
      }
      n.group.visible = dist < VIEW_DIST;
      if (n.bat) this.updateBat(n, dt, playerPos);
      else if (n.species === "zombie")
        this.updateZombie(n, dt, playerPos, dayTime);
      else this.updateWalker(n, dt, playerPos);
      n.group.rotation.y = n.yaw;
    }
  }

  // para testes/inspeção
  list() {
    return this.npcs.map((n) => ({
      species: n.species,
      x: +n.pos.x.toFixed(1),
      y: +n.pos.y.toFixed(1),
      z: +n.pos.z.toFixed(1),
      state: n.state,
      visible: n.group.visible,
      hp: n.hp,
      dead: n.dead,
    }));
  }
}
