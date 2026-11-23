// MineClone — Fase 10: combate (zumbi hostil + melee do jogador)
import * as THREE from "three";
import { World } from "./world.js";
import {
  AIR,
  WATER,
  GRASS,
  DIRT,
  STONE,
  SAND,
  SNOW,
  LOG,
  LEAVES,
  PLANKS,
  BLOCKS,
  TILE,
  ATLAS,
  atlasCanvas,
  tileDataURL,
} from "./blocks.js";
import { ParticleSystem } from "./particles.js";
import { Inventory } from "./inventory.js";
import { raycastVoxel } from "./raycast.js";
import {
  playBreak,
  playPlace,
  playStep,
  playSelect,
  playCraft,
  playToolBreak,
  playHurt,
  playEat,
  playDeath,
} from "./sounds.js";
import { NPCSystem, MOB_HITBOX } from "./npcs.js";
// Fase 8: itens (graveto + ferramentas), crafting e ícones
import {
  isItem,
  itemName,
  stackOf,
  toolSpeed,
  RECIPES,
  canCraft,
  craft,
  itemTexURL,
  ITEMS,
  APPLE,
  SWORD,
  heartDataURL,
  foodDataURL,
} from "./items.js";
import { Survival, MAX_FOOD } from "./survival.js";

// ============================================================
// Renderer (WebGL, fullscreen)
// ============================================================
const canvas = document.getElementById("game");
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
} catch (err) {
  console.error("WebGL indisponível:", err);
  document.getElementById("overlay-box").innerHTML =
    '<h1 style="color:#f88">WebGL indisponível</h1><p>Seu navegador não suportou a criação do contexto WebGL.</p>';
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ============================================================
// Cena, céu e luzes
// ============================================================
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xa8d8f0, 55, 90);

// Céu: esfera gigante com gradiente (topo azul → horizonte claro)
const SKY_RADIUS = 500;
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(SKY_RADIUS, 24, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2f6fd6) },
      midColor: { value: new THREE.Color(0x7db9e8) },
      bottomColor: { value: new THREE.Color(0xcfe9f7) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      varying vec3 vDir;
      void main() {
        float h = normalize(vDir).y;
        vec3 c = h > 0.0 ? mix(midColor, topColor, pow(h, 0.6)) : mix(midColor, bottomColor, pow(-h, 0.8));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  }),
);
scene.add(sky);

const hemi = new THREE.HemisphereLight(0xdfefff, 0x5d7a3a, 1.0);
scene.add(hemi);

const sunLight = new THREE.DirectionalLight(0xfff1c4, 2.2);
sunLight.position.set(80, 120, 40);
scene.add(sunLight);
const ambient = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambient);

// Sol visível (disco) + nuvens simples (caixas brancas achatadas)
const sunDisc = new THREE.Mesh(
  new THREE.SphereGeometry(14, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false }),
);
sunDisc.position.set(300, 420, 150);
scene.add(sunDisc);

function makeCloud(x, y, z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const puffs = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < puffs; i++) {
    const w = 8 + Math.random() * 14;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, 2.5 + Math.random() * 2, 6 + Math.random() * 8),
      mat,
    );
    m.position.set(
      i * (w * 0.55) - puffs * 4,
      Math.random() * 2,
      Math.random() * 6 - 3,
    );
    g.add(m);
  }
  g.position.set(x, y, z);
  return g;
}
const clouds = [];
for (let i = 0; i < 10; i++) {
  const c = makeCloud(
    (Math.random() - 0.5) * 360,
    90 + Math.random() * 40,
    (Math.random() - 0.5) * 360,
  );
  clouds.push(c);
  scene.add(c);
}

// ============================================================
// Fase 6: ciclo dia/noite (sol, lua, céu, névoa, estrelas)
// dayTime: 0 = meia-noite · 0.25 = nascer do sol · 0.5 = meio-dia
// ============================================================
const DAY_LENGTH = 240; // segundos por dia completo
let dayTime = 0.32; // começa de manhã

// Keyframes do céu (topo / meio / horizonte)
const SKY_DAY = {
  top: new THREE.Color(0x2f6fd6),
  mid: new THREE.Color(0x7db9e8),
  bot: new THREE.Color(0xcfe9f7),
};
const SKY_TW = {
  top: new THREE.Color(0x28355f),
  mid: new THREE.Color(0xd97b4a),
  bot: new THREE.Color(0xf2b26a),
};
const SKY_NG = {
  top: new THREE.Color(0x04060d),
  mid: new THREE.Color(0x0a101f),
  bot: new THREE.Color(0x182238),
};
const SUN_DAY = new THREE.Color(0xfff1c4);
const SUN_TW = new THREE.Color(0xff8a3d);

// Luz da lua (só "liga" quando o sol está abaixo do horizonte)
const moonLight = new THREE.DirectionalLight(0x9db4ff, 0);
scene.add(moonLight);

// Disco da lua (oposto ao sol)
const moonDisc = new THREE.Mesh(
  new THREE.SphereGeometry(10, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0xdfe8f4, fog: false }),
);
scene.add(moonDisc);

// Estrelas: pontos num domo, opacidade acompanha a noite
const stars = (() => {
  const N = 500;
  const R = 470;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(0.1 + Math.random() * 0.9); // domo acima do horizonte
    pos[i * 3] = R * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = R * Math.cos(ph);
    pos[i * 3 + 2] = R * Math.sin(ph) * Math.sin(th);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.8,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const p = new THREE.Points(g, m);
  scene.add(p);
  return p;
})();

// Partículas de quebra de bloco (Fase 6)
const particles = new ParticleSystem(scene);

// Cor média do tile "lado" do bloco, amostrada do canvas do atlas
const _atlasCtx = atlasCanvas.getContext("2d");
function blockColor(id) {
  const tile = BLOCKS[id]?.side ?? 3;
  const ox = (tile % ATLAS) * TILE + 4;
  const oy = Math.floor(tile / ATLAS) * TILE + 4;
  const d = _atlasCtx.getImageData(ox, oy, 8, 8).data;
  let r = 0,
    g = 0,
    b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
  }
  const n = d.length / 4;
  const hex =
    ((Math.round(r / n) << 16) |
      (Math.round(g / n) << 8) |
      Math.round(b / n)) >>>
    0;
  return new THREE.Color(hex);
}

const _sunDir = new THREE.Vector3();
function updateSky(dt) {
  dayTime = (dayTime + dt / DAY_LENGTH) % 1;
  const a = (dayTime - 0.25) * Math.PI * 2; // 0.25 = nascer · 0.75 = pôr
  const e = Math.sin(a); // elevação: +1 meio-dia · −1 meia-noite
  const dayF = THREE.MathUtils.smoothstep(e, -0.12, 0.35);
  const twiF = Math.max(0, 1 - Math.abs(e) / 0.45) * 0.85;

  // Direção do sol (círculo com leve inclinação) — a lua é o oposto
  _sunDir.set(Math.cos(a), e, 0.35).normalize();
  sunLight.position.copy(_sunDir).multiplyScalar(130);
  moonLight.position.copy(_sunDir).multiplyScalar(-130);

  // Sol: forte alto no céu, alaranjado perto do horizonte
  sunLight.intensity = 0.25 * dayF + 2.1 * Math.max(0, e);
  sunLight.color
    .copy(SUN_TW)
    .lerp(SUN_DAY, THREE.MathUtils.smoothstep(e, -0.05, 0.45));

  // Lua + luzes de preenchimento (noite)
  moonLight.intensity = 0.6 * Math.max(0, -e);
  hemi.intensity = 0.18 + 0.82 * dayF;
  ambient.intensity = 0.13 + 0.24 * dayF;

  // Gradiente do céu + névoa sincronizada
  const u = sky.material.uniforms;
  u.topColor.value
    .copy(SKY_NG.top)
    .lerp(SKY_DAY.top, dayF)
    .lerp(SKY_TW.top, twiF);
  u.midColor.value
    .copy(SKY_NG.mid)
    .lerp(SKY_DAY.mid, dayF)
    .lerp(SKY_TW.mid, twiF);
  u.bottomColor.value
    .copy(SKY_NG.bot)
    .lerp(SKY_DAY.bot, dayF)
    .lerp(SKY_TW.bot, twiF);
  scene.fog.color.copy(u.bottomColor.value);

  // Estrelas só à noite
  stars.material.opacity = 1 - dayF;

  // Discos seguem sol/lua relativos à câmera
  sunDisc.position.copy(camera.position).addScaledVector(_sunDir, 400);
  moonDisc.position.copy(camera.position).addScaledVector(_sunDir, -400);
  sunDisc.visible = e > -0.15;
  moonDisc.visible = -e > -0.15;
}

// ============================================================
// Mundo: geração procedural em chunks + streaming ao redor do jogador
// ============================================================
const world = new World(scene, 20261121);
const SPAWN = world.spawn;

// ============================================================
// Jogador: estado + física (fase 3: nado, voo, agachar, step-up)
// ============================================================
const EYE_HEIGHT = 1.62;
const EYE_HEIGHT_CROUCH = 1.5;
const PLAYER_HW = 0.3; // meia-largura do AABB (largura 0.6)
const PLAYER_H = 1.8; // altura do AABB (em pé)
const CROUCH_H = 1.5; // altura do AABB (agachado)

const player = {
  pos: new THREE.Vector3(SPAWN.x, SPAWN.y, SPAWN.z), // posição dos PÉS
  vel: new THREE.Vector3(),
  yaw: Math.PI * 0.25,
  pitch: 0,
  onGround: true,
  crouching: false,
  flying: false,
  inWater: false,
  speed: 4.3,
  sprintSpeed: 6.5,
  crouchSpeed: 2.15,
  flySpeed: 10.7,
  jumpVel: 8.6,
  gravity: 26,
  // nado
  swimGravity: 7,
  swimMaxFall: 2.4,
  swimUp: 4.0,
  swimDown: 3.4,
  swimSpeedFactor: 0.42,
};

// ============================================================
// NPCs (Fase 5): modelos voxelados, wander, animação, culling
// ============================================================
const npcs = new NPCSystem(scene, world, player, particles);
// Fase 10: zumbi só persegue/ataca um jogador vivo, jogando (pointer lock)
npcs.isPlayerDead = () =>
  survival.dead || document.pointerLockElement !== canvas;
// Fase 10: golpe do zumbi → dano no jogador (survival cuida de som/HUD/morte)
npcs.onPlayerHit = (dmg) => survival.takeDamage(dmg);

// ============================================================
// Câmera
// ============================================================
const camera = new THREE.PerspectiveCamera(
  72,
  window.innerWidth / window.innerHeight,
  0.1,
  SKY_RADIUS * 2,
);
camera.rotation.order = "YXZ";

let eyeOffset = EYE_HEIGHT;
function updateCamera(dt) {
  // altura dos olhos com lerp suave (pé ↔ agachado)
  const target = player.crouching ? EYE_HEIGHT_CROUCH : EYE_HEIGHT;
  eyeOffset += (target - eyeOffset) * Math.min(1, dt * 14);
  camera.position.set(player.pos.x, player.pos.y + eyeOffset, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
}

// ============================================================
// Fase 8: braço em primeira pessoa com o item na mão
// (só aparece segurando ferramenta; "swing" decaiu em updateArm)
// ============================================================
scene.add(camera); // necessário para o filho (braço) renderizar
const arm = new THREE.Group();
arm.position.set(0.55, -0.45, -0.6);
arm.visible = false;
const armHand = new THREE.Mesh(
  new THREE.BoxGeometry(0.13, 0.13, 0.32),
  new THREE.MeshLambertMaterial({ color: 0xd8a06a }), // pele
);
armHand.rotation.y = -0.35;
arm.add(armHand);
const armItem = new THREE.Mesh(
  new THREE.PlaneGeometry(0.4, 0.4),
  new THREE.MeshBasicMaterial({ transparent: true }),
);
armItem.rotation.y = -0.5;
armItem.position.set(0.06, 0.1, -0.06);
armItem.visible = false;
arm.add(armItem);
camera.add(arm);

let swingT = 0;
let armItemID = -1;
const armTexLoader = new THREE.TextureLoader();

/** Dispara o "swing" (colocar/segurar direito com ferramenta). */
export function swingArm() {
  swingT = 1;
}

/** Atualiza visibilidade do braço + decai o swing (chamado no loop). */
function updateArm(dt) {
  const s = inventory.slots[activeSlot];
  const hasTool = !!(s && isItem(s.id));
  arm.visible = hasTool;
  if (hasTool) {
    if (s.id !== armItemID) {
      armItemID = s.id;
      armItem.visible = true;
      armTexLoader.load(itemTexURL(s.id), (t) => {
        if (armItemID !== s.id) return; // load atrasado de outro item
        armItem.material.map = t;
        armItem.material.needsUpdate = true;
      });
    }
  } else {
    armItemID = -1;
    armItem.visible = false;
  }
  if (swingT > 0) {
    swingT = Math.max(0, swingT - dt * 3.5);
    arm.rotation.x = -Math.sin(swingT * Math.PI) * 0.9;
  } else if (arm.rotation.x !== 0) {
    arm.rotation.x = 0;
  }
}

// ============================================================
// Entrada: teclado + mouse (pointer lock)
// ============================================================
const keys = new Set();
const overlay = document.getElementById("overlay");

function lockPointer() {
  const p = canvas.requestPointerLock({ unadjustedMovement: true });
  // fallback sem unadjustedMovement; o .catch final evita rejection não tratada
  // no console quando o retry falha (ex.: cooldown de ~1.25s após um Esc)
  if (p && p.catch)
    p.catch(() => canvas.requestPointerLock().catch?.(() => {}));
}

canvas.addEventListener("click", () => {
  if (document.pointerLockElement !== canvas) lockPointer();
});
overlay.addEventListener("click", lockPointer);

const overlayBox = document.getElementById("overlay-box");
let started = false;

document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === canvas;
  if (invOpen) {
    // inventário aberto (Fase 7): nunca mostrar a tela de pausa por cima
    overlay.classList.add("hidden");
    return;
  }
  overlay.classList.toggle("hidden", locked);
  if (locked) {
    started = true;
  } else if (started) {
    // ESC depois de já ter jogado → a tela de título vira a de pausa
    overlayBox.querySelector("h1").textContent = "Pausa";
    overlayBox.querySelector(".play").textContent = "Clique para continuar";
  }
  if (!locked) {
    keys.clear();
    player.crouching = false;
    leftDown = false; // solta a mineração ao liberar o pointer lock
  }
});

document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== canvas) return;
  const SENS = 0.0021;
  player.yaw -= e.movementX * SENS;
  player.pitch -= e.movementY * SENS;
  const LIM = Math.PI / 2 - 0.02;
  player.pitch = Math.max(-LIM, Math.min(LIM, player.pitch));
});

let lastSpaceAt = 0;

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2200);
}

function toggleFly() {
  player.flying = !player.flying;
  player.vel.y = 0;
  toast(
    player.flying
      ? "Voo ativado · Espaço sobe · Shift desce · Ctrl acelera"
      : "Voo desativado",
  );
}

document.addEventListener("keydown", (e) => {
  // Fase 7: E abre/fecha o inventário (só após começar a jogar)
  if (e.code === "KeyE" && !e.repeat) {
    if (started) toggleInventory();
    return;
  }
  // Fase 9: R = respawn após a morte (vale mesmo com o inventário aberto)
  if (e.code === "KeyR" && !e.repeat && survival.dead) respawn();
  if (invOpen) return; // inventário aberto: mundo pausado, teclas de jogo não valem
  keys.add(e.code);
  // voo: F2 ou duplo espaço (como no modo criativo do Minecraft), só durante o jogo
  const locked = document.pointerLockElement === canvas;
  if (e.code === "F2" && !e.repeat) {
    e.preventDefault();
    if (locked) toggleFly();
  } else if (e.code === "Space" && !e.repeat) {
    const now = performance.now();
    if (locked && now - lastSpaceAt < 300) toggleFly();
    lastSpaceAt = now;
  }
  // hotbar: selecionar bloco (1–9)
  if (e.code >= "Digit1" && e.code <= "Digit9")
    selectSlot(Number(e.code.slice(5)) - 1);
});
document.addEventListener("keyup", (e) => {
  if (invOpen) {
    keys.clear(); // nunca deixar teclas "presas" com o inventário aberto
    return;
  }
  keys.delete(e.code);
});
document.addEventListener("blur", () => keys.clear());

// ============================================================
// Fase 9: sobrevivência — HP (10 corações), fome (10 ícones), ar,
// maçã, dano de queda, afogamento, morte/respawn
// ============================================================
const survival = new Survival();
const hudHearts = document.getElementById("hearts");
const hudFood = document.getElementById("food");
const dmgFlash = document.getElementById("dmgflash");
const deathEl = document.getElementById("death");

let fallPeak = SPAWN.y; // pico da queda (dano de queda na Fase 9)

// Monta o HUD: 10 corações + 10 ícones de fome (dataURL 16×16 dos itens)
for (let i = 0; i < 10; i++) {
  const h = document.createElement("img");
  h.src = heartDataURL("full");
  h.alt = "";
  h.draggable = false;
  hudHearts.appendChild(h);
  const f = document.createElement("img");
  f.src = foodDataURL();
  f.alt = "";
  f.draggable = false;
  hudFood.appendChild(f);
}

/** Estado do coração i (0 = esquerda, 9 = direita) para hp 0–20. */
function heartState(i, hp) {
  const v = hp - (9 - i) * 2;
  return v >= 2 ? "full" : v >= 1 ? "half" : "empty";
}

let dmgFlashT = null;
function flashDamage() {
  dmgFlash.classList.add("on");
  clearTimeout(dmgFlashT);
  dmgFlashT = setTimeout(() => dmgFlash.classList.remove("on"), 180);
}

let _hudHp = -1,
  _hudFood = -1;
/** Sincroniza o HUD com survival.hp / survival.food (com cache). */
function syncHUD() {
  const hp = survival.hp,
    food = survival.food;
  if (hp === _hudHp && food === _hudFood) return;
  _hudHp = hp;
  _hudFood = food;
  const hs = hudHearts.children;
  for (let i = 0; i < 10; i++) hs[i].src = heartDataURL(heartState(i, hp));
  const fs = hudFood.children;
  for (let i = 0; i < 10; i++) {
    const v = food - (9 - i) * 2;
    // ícone cheio, ícone pela metade (metade direita cortada) ou invisível
    fs[i].style.visibility = v >= 1 ? "visible" : "hidden";
    fs[i].style.clipPath =
      v >= 2 ? "none" : v >= 1 ? "inset(0 50% 0 0)" : "inset(0 100% 0 0)";
  }
}

survival.onHurt = () => {
  playHurt();
  flashDamage();
  syncHUD();
};
survival.onDeath = () => {
  playDeath();
  deathEl.classList.remove("hidden");
  keys.clear();
  leftDown = false;
  if (document.pointerLockElement === canvas) document.exitPointerLock();
};

function respawn() {
  survival.respawn();
  player.pos.set(SPAWN.x, SPAWN.y, SPAWN.z);
  player.vel.set(0, 0, 0);
  player.flying = false;
  fallPeak = player.pos.y;
  deathEl.classList.add("hidden");
  syncHUD();
  toast("Você ressuscitou");
}

/** Come a maçã do slot ativo (clique direito). @returns {boolean} */
function eatItem() {
  const held = inventory.slots[activeSlot];
  if (!held || held.id !== APPLE) return false;
  if (survival.food >= MAX_FOOD) {
    // fome cheia: não consome a maçã (como no original)
    toast("Sua fome já está cheia");
    return true;
  }
  survival.feed(ITEMS[APPLE].food);
  inventory.takeFrom(activeSlot, 1);
  swingArm();
  playEat();
  syncHUD();
  return true;
}

// ============================================================
// Hotbar + inventário — Fase 7: 36 slots (9 hotbar + 27 grade)
// ============================================================
const inventory = new Inventory(renderInventory);

// Hotbar do HUD (9 slots estáticos no HTML, com .tex/.num/.cnt)
const slots = Array.from(document.querySelectorAll("#hotbar .slot"));
// Tela de inventário: slots gerados aqui (27 grade + 9 hotbar)
function buildInvSlot() {
  const d = document.createElement("div");
  d.className = "inv-slot";
  const tex = document.createElement("div");
  tex.className = "tex";
  d.appendChild(tex);
  const cnt = document.createElement("span");
  cnt.className = "cnt";
  d.appendChild(cnt);
  return d;
}
const mainSlots = [];
const invHot = [];
{
  const mainEl = document.getElementById("inv-main");
  for (let i = 0; i < 27; i++) {
    const el = buildInvSlot();
    mainEl.appendChild(el);
    mainSlots.push(el);
  }
  const hotEl = document.getElementById("inv-hotbar");
  for (let i = 0; i < 9; i++) {
    const el = buildInvSlot();
    hotEl.appendChild(el);
    invHot.push(el);
  }
}

const selEl = document.getElementById("selname");
let activeSlot = 0;

function paintSlot(el, item) {
  const tex = el.querySelector(".tex");
  const cnt = el.querySelector(".cnt");
  tex.style.backgroundImage = item ? `url(${itemTexURL(item.id)})` : "none";
  cnt.textContent = item && item.count > 1 ? String(item.count) : "";
}

function renderInventory() {
  for (let i = 0; i < 9; i++) {
    const s = inventory.slots[i];
    paintSlot(slots[i], s);
    slots[i].classList.toggle("active", i === activeSlot);
    paintSlot(invHot[i], s);
    invHot[i].classList.toggle("active", i === activeSlot);
  }
  for (let i = 0; i < 27; i++) paintSlot(mainSlots[i], inventory.slots[9 + i]);
  refreshCraft();
}

function selectSlot(i) {
  activeSlot = i;
  slots.forEach((s, k) => s.classList.toggle("active", k === i));
  invHot.forEach((s, k) => s.classList.toggle("active", k === i));
  const item = inventory.slots[i];
  selEl.textContent = item ? itemName(item.id) : "vazio";
  selEl.classList.add("show");
  clearTimeout(selEl._t);
  selEl._t = setTimeout(() => selEl.classList.remove("show"), 1500);
  playSelect();
}

// ---------- abrir/fechar inventário (E) ----------
let invOpen = false;
const invPanel = document.getElementById("inventory");

function toggleInventory(force) {
  const want = force === undefined ? !invOpen : force;
  if (want === invOpen) return;
  invOpen = want;
  invPanel.classList.toggle("hidden", !invOpen);
  if (invOpen) {
    overlay.classList.add("hidden");
    keys.clear();
    leftDown = false;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  } else {
    if (drag) {
      drag = null; // segurança: nada fica "na mão" fora do painel
      renderDrag();
      renderInventory();
    }
    lockPointer();
  }
}

// ---------- arrastar/soltar (tela de inventário aberta) ----------
let drag = null; // { id, count } na mão
const cursorItem = document.getElementById("cursor-item");

function renderDrag() {
  if (drag) {
    cursorItem.classList.add("show");
    cursorItem.querySelector(".tex").style.backgroundImage = `url(${itemTexURL(
      drag.id,
    )})`;
    cursorItem.querySelector(".cnt").textContent =
      drag.count > 1 ? String(drag.count) : "";
  } else {
    cursorItem.classList.remove("show");
  }
}

document.addEventListener("mousemove", (e) => {
  if (!drag) return;
  cursorItem.style.left = `${e.clientX}px`;
  cursorItem.style.top = `${e.clientY}px`;
});

function slotIndexFor(el) {
  const mi = mainSlots.indexOf(el);
  if (mi >= 0) return 9 + mi; // grade = slots 9..35
  return invHot.indexOf(el); // hotbar do painel = slots 0..8
}

invPanel.addEventListener("mousedown", (e) => {
  e.preventDefault();
  if (e.target.closest(".craft-btn")) return; // botões de crafting têm clique próprio
  const el = e.target.closest(".inv-slot");
  if (e.button === 0) {
    if (el) {
      const i = slotIndexFor(el);
      if (drag) {
        // soltar a pilha: mescla (mesmo id) ou troca (id diferente)
        drag = inventory.placeAt(i, drag);
      } else {
        const s = inventory.slots[i];
        if (s) {
          drag = { id: s.id, count: s.count };
          inventory.takeFrom(i, s.count);
        }
      }
    } else if (drag) {
      drag = null; // clique no fundo: descarta a pilha (jogar fora)
    }
  } else if (e.button === 2) {
    if (el && !drag) {
      // botão direito vazio: pega a metade (ou o item único)
      const part = inventory.takePartial(slotIndexFor(el));
      if (part) drag = part;
    } else if (el && drag) {
      const i = slotIndexFor(el);
      const s = inventory.slots[i];
      if (s && s.id !== drag.id) {
        // troca: pilha inteira entra, a antiga volta para a mão
        drag = inventory.placeAt(i, drag);
      } else {
        // solta 1 (ou a pilha inteira se só resta 1)
        inventory.placeAt(i, { id: drag.id, count: Math.min(1, drag.count) });
        drag.count -= 1;
        if (drag.count <= 0) drag = null;
      }
    }
  }
  renderDrag();
  renderInventory();
});

// ============================================================
// Fase 8: crafting — um botão por receita.
// Limitação honesta (registrada na revisão): NÃO há grade 3×3;
// os botões cobrem o fluxo survival inicial madeira → tábuas →
// gravetos → ferramentas.
// ============================================================
const craftEl = document.getElementById("crafting");
const craftBtns = [];
RECIPES.forEach((r, i) => {
  const b = document.createElement("button");
  b.className = "craft-btn";
  b.type = "button";
  const tex = document.createElement("div");
  tex.className = "craft-tex";
  tex.style.backgroundImage = `url(${itemTexURL(r.out.id)})`;
  const name = document.createElement("div");
  name.className = "craft-name";
  name.textContent = `${itemName(r.out.id)} ×${r.out.n}`;
  const mat = document.createElement("div");
  mat.className = "craft-mat";
  mat.textContent = Object.entries(r.in)
    .map(([id, n]) => `${n}× ${itemName(Number(id))}`)
    .join(" + ");
  b.append(tex, name, mat);
  b.addEventListener("click", () => {
    if (!canCraft(inventory, i)) return;
    craft(inventory, i);
    toast(`Criado: ${itemName(r.out.id)} ×${r.out.n}`);
    playCraft();
    renderInventory();
  });
  craftEl.appendChild(b);
  craftBtns.push(b);
});

/** Liga/desliga os botões conforme o material disponível. */
function refreshCraft() {
  craftBtns.forEach((b, i) => (b.disabled = !canCraft(inventory, i)));
}

renderInventory(); // pintura inicial (inventário começa vazio)

// ============================================================
// Interação com blocos (Fase 4): raycast, mineração, colocação
// ============================================================
const REACH = 6; // alcance do crosshair em blocos (como no vanilla)
const mineEl = document.getElementById("mine");
const mineFill = document.getElementById("mine-fill");

// Wireframe escuro no bloco mirado (levemente maior que 1, sem z-fight)
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
  new THREE.LineBasicMaterial({
    color: 0x0c0c0c,
    transparent: true,
    opacity: 0.85,
  }),
);
highlight.visible = false;
scene.add(highlight);

// Botão esquerdo segurado = mineração; direito = colocar (1 clique = 1 bloco)
// Fase 10: se o crosshair mira um mob no alcance, botão esquerdo = melee
let leftDown = false;
canvas.addEventListener("mousedown", (e) => {
  if (document.pointerLockElement !== canvas) return;
  if (e.button === 0) {
    const mob = raycastMob();
    if (mob) meleeAttack(mob);
    else leftDown = true;
  }
  if (e.button === 2) {
    // Fase 9: maçã na mão → comer (em vez de colocar bloco)
    if (eatItem()) return;
    placeBlockNow();
  }
});
document.addEventListener("mouseup", (e) => {
  if (e.button === 0) leftDown = false;
});
document.addEventListener("contextmenu", (e) => e.preventDefault());

// Raycast a partir do olho, na direção do crosshair
function raycastNow() {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  return raycastVoxel(camera.position, dir, REACH, (x, y, z) =>
    world.getBlock(x, y, z),
  );
}

// ---------- Fase 10: combate corpo-a-corpo (melee em mobs) ----------
// Raycast dos mobs (AABB por espécie, alinhado ao mundo — simplificado:
// a rotação do mob é ignorada; hitboxes pequenas tornam isso inofensivo).
const _mobRay = new THREE.Raycaster();
function mobInRay(maxDist) {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  _mobRay.set(camera.position, dir);
  const min = new THREE.Vector3(),
    max = new THREE.Vector3();
  let best = null;
  let bestT = maxDist;
  for (const n of npcs.npcs) {
    if (n.dead) continue;
    const [hx, hy, hz] = MOB_HITBOX[n.species] ?? [0.6, 0.6, 0.6];
    // centro: andadores têm pos nos pés (+hy/2); morcego, pos no centro
    const cy = n.bat ? n.pos.y : n.pos.y + hy / 2;
    min.set(n.pos.x - hx / 2, cy - hy / 2, n.pos.z - hz / 2);
    max.set(min.x + hx, min.y + hy, min.z + hz);
    // Three r160: Ray.intersectBox(box: Box3, target) → ponto (Vector3) ou null
    const pt = _mobRay.ray.intersectBox(
      new THREE.Box3(min, max),
      new THREE.Vector3(),
    );
    if (!pt) continue;
    const d = pt.distanceTo(camera.position);
    if (d < bestT) {
      bestT = d;
      best = n;
    }
  }
  return best;
}

/**
 * Mob sob o crosshair, dentro do alcance e não escondido atrás de bloco
 * (a distância do hit de bloco limita o raycast dos mobs).
 * @returns {object|null} o mob mais próximo no raio, ou null
 */
function raycastMob() {
  let maxDist = REACH;
  const hit = raycastNow();
  if (hit && hit.prev) {
    const [px, py, pz] = hit.prev;
    maxDist = Math.min(
      REACH,
      camera.position.distanceTo(
        new THREE.Vector3(px + 0.5, py + 0.5, pz + 0.5),
      ),
    );
  }
  if (maxDist < 0.4) return null;
  return mobInRay(maxDist);
}

// Melee: punho 1 dano / espada 3 dano; cooldown curto (0,45s);
// a espada perde 1 de durabilidade por golpe (quebra em 0, como na mineração)
const ATTACK_CD = 0.45;
let lastAttack = -10;
function meleeAttack(n) {
  const now = performance.now() / 1000;
  if (now - lastAttack < ATTACK_CD) return;
  lastAttack = now;
  const held = inventory.slots[activeSlot];
  const sword = held && held.id === SWORD;
  swingArm();
  const dx = n.pos.x - player.pos.x,
    dz = n.pos.z - player.pos.z;
  const len = Math.hypot(dx, dz) || 1;
  npcs.hurtMob(n, sword ? 3 : 1, { x: dx / len, z: dz / len });
  if (sword) {
    held.dur = (held.dur ?? ITEMS[SWORD].dur) - 1;
    if (held.dur <= 0) {
      inventory.slots[activeSlot] = null;
      renderInventory();
      toast(`A ${ITEMS[SWORD].name} quebrou!`);
      playToolBreak();
    }
  }
}

// A célula (cx,cy,cz) atravessaria o AABB do jogador (pés em pos.y)?
function overlapsPlayer(cx, cy, cz) {
  const p = player.pos;
  const H = player.crouching ? CROUCH_H : PLAYER_H;
  const x0 = Math.floor(p.x - PLAYER_HW),
    x1 = Math.floor(p.x + PLAYER_HW);
  const z0 = Math.floor(p.z - PLAYER_HW),
    z1 = Math.floor(p.z + PLAYER_HW);
  const y0 = Math.floor(p.y),
    y1 = Math.floor(p.y + H - 0.001);
  return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1 && cz >= z0 && cz <= z1;
}

/** Coloca o bloco do slot ativo na célula anterior ao hit (sobre vazio/água). */
function placeBlockNow() {
  const s = inventory.slots[activeSlot];
  if (!s) {
    toast("Slot vazio — quebre blocos para conseguir");
    return;
  }
  // Fase 8: item (ferramenta/graveto) não coloca bloco — só acena
  if (isItem(s.id)) {
    swingArm();
    return;
  }
  const hit = raycastNow();
  if (!hit || !hit.prev) return;
  const [px, py, pz] = hit.prev;
  const cur = world.getBlock(px, py, pz);
  if (cur !== AIR && cur !== WATER) return; // só em espaço vazio ou água
  if (overlapsPlayer(px, py, pz)) return; // nunca dentro do jogador
  if (!world.setBlock(px, py, pz, s.id)) return;
  inventory.takeFrom(activeSlot, 1); // consome 1 do slot ativo
  playPlace();
}

// Mineração: tempo acumulado no bloco (reinicia ao trocar de alvo)
let breakCell = null;
let breakTime = 0;
function updateBreak(dt) {
  const hit = raycastNow();

  // destaque visual do bloco mirado
  if (hit) {
    highlight.visible = true;
    highlight.position.set(
      hit.cell[0] + 0.5,
      hit.cell[1] + 0.5,
      hit.cell[2] + 0.5,
    );
  } else {
    highlight.visible = false;
  }

  // Fase 8: ferramenta certa acelera a mineração (hard / velocidade)
  const hard = hit
    ? BLOCKS[hit.id].hard / toolSpeed(inventory.slots[activeSlot], hit.id)
    : Infinity;
  if (!leftDown || !hit || !Number.isFinite(hard)) {
    breakCell = null;
    breakTime = 0;
    mineEl.classList.remove("show");
    return;
  }
  if (
    !breakCell ||
    breakCell[0] !== hit.cell[0] ||
    breakCell[1] !== hit.cell[1] ||
    breakCell[2] !== hit.cell[2]
  ) {
    breakCell = [hit.cell[0], hit.cell[1], hit.cell[2]];
    breakTime = 0;
  }
  breakTime += dt;
  const p = Math.min(1, breakTime / hard);
  mineFill.style.width = `${Math.round(p * 100)}%`;
  mineEl.classList.add("show");
  if (p >= 1) {
    world.setBlock(hit.cell[0], hit.cell[1], hit.cell[2], AIR);
    playBreak(hard);
    // Fase 6: partículas na cor do bloco quebrado
    particles.burst(
      hit.cell[0] + 0.5,
      hit.cell[1] + 0.5,
      hit.cell[2] + 0.5,
      blockColor(hit.id),
      16,
    );
    // Fase 7: o bloco "cai" como item no inventário
    // (drop omitido no blocks.js = o próprio bloco; drop: null = nada)
    const drop = BLOCKS[hit.id].drop ?? hit.id;
    if (drop != null) inventory.addItem(drop, 1);
    // Fase 9: folhas às vezes soltam uma maçã (~10%)
    if (hit.id === LEAVES && Math.random() < 0.1) {
      inventory.addItem(APPLE, 1);
      toast("Você recebeu uma maçã!");
    }
    // Fase 8: ferramenta na mão perde durabilidade (quebra em 0)
    const held = inventory.slots[activeSlot];
    if (held && isItem(held.id) && ITEMS[held.id].dur != null) {
      held.dur = (held.dur ?? ITEMS[held.id].dur) - 1;
      if (held.dur <= 0) {
        inventory.slots[activeSlot] = null;
        renderInventory();
        toast(`A ${ITEMS[held.id].name} quebrou!`);
        playToolBreak();
      }
    }
    breakCell = null;
    breakTime = 0;
  }
}

// Passos: som por distância percorrida no chão (voo não emite)
let stepAcc = 0;
function updateSteps(dt) {
  const v = Math.hypot(player.vel.x, player.vel.z);
  if (player.flying || !player.onGround || v < 0.6) {
    stepAcc = 0;
    return;
  }
  stepAcc += v * dt;
  if (stepAcc >= 2.2) {
    stepAcc = 0;
    playStep();
  }
}

// ============================================================
// Atualização do jogador (dt em segundos)
// ============================================================
function updatePlayer(dt) {
  const k = keys;
  const wasGround = player.onGround;

  // Fase 9: dano de queda — rastreia o pico da altura durante a queda
  if (!player.onGround && player.vel.y < 0)
    fallPeak = Math.max(fallPeak, player.pos.y);

  // ----- modos: agachado (Ctrl), voo (F2/duplo espaço), nado (em água)
  const shift = k.has("ShiftLeft") || k.has("ShiftRight");
  const ctrl = k.has("ControlLeft") || k.has("ControlRight");
  if (ctrl && !player.flying) player.crouching = true;
  else if (player.crouching) player.crouching = !canStand();
  else player.crouching = false;

  const fx = Math.floor(player.pos.x);
  const fz = Math.floor(player.pos.z);
  player.inWater =
    !player.flying &&
    (world.isWater(fx, Math.floor(player.pos.y + 0.4), fz) ||
      world.isWater(fx, Math.floor(player.pos.y + 1.1), fz));

  // ----- direção relativa ao yaw
  const sin = Math.sin(player.yaw),
    cos = Math.cos(player.yaw);
  let mx = 0,
    mz = 0;
  if (k.has("KeyW")) {
    mx -= sin;
    mz -= cos;
  }
  if (k.has("KeyS")) {
    mx += sin;
    mz += cos;
  }
  if (k.has("KeyA")) {
    mx -= cos;
    mz += sin;
  }
  if (k.has("KeyD")) {
    mx += cos;
    mz -= sin;
  }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len;
    mz /= len;
  }

  // ----- velocidade por modo
  let speed;
  if (player.flying) speed = ctrl ? player.flySpeed * 2 : player.flySpeed;
  else if (player.inWater) speed = player.speed * player.swimSpeedFactor;
  else if (player.crouching) speed = player.crouchSpeed;
  else if (shift) speed = player.sprintSpeed;
  else speed = player.speed;
  player.vel.x = mx * speed;
  player.vel.z = mz * speed;

  // ----- velocidade vertical por modo
  if (player.flying) {
    let vy = 0;
    if (k.has("Space")) vy += player.flySpeed * 0.8;
    if (shift) vy -= player.flySpeed * 0.7;
    player.vel.y = vy;
  } else if (player.inWater) {
    if (k.has("Space")) {
      player.vel.y = player.swimUp;
    } else {
      // afundamento lento (gravidade reduzida) — Shift desce mais rápido
      player.vel.y -= player.swimGravity * dt;
      if (player.vel.y < -player.swimMaxFall)
        player.vel.y = -player.swimMaxFall;
      if (shift && player.vel.y > -player.swimDown)
        player.vel.y = -player.swimDown;
    }
  } else {
    if (k.has("Space") && player.onGround && !player.crouching) {
      player.vel.y = player.jumpVel;
    }
    player.vel.y -= player.gravity * dt;
  }

  // ----- deslocamento horizontal
  let mX = player.vel.x * dt;
  let mZ = player.vel.z * dt;

  // agachado: não despenca da beirada (cancela o eixo sem apoio no destino)
  if (player.crouching && wasGround) {
    const yb = Math.floor(player.pos.y) - 1;
    if (!supportAt(player.pos.x + mX, player.pos.z, yb)) mX = 0;
    if (!supportAt(player.pos.x, player.pos.z + mZ, yb)) mZ = 0;
  }

  // ----- integração e colisão por eixo (AABB 0.6 x H, pés em pos.y)
  player.onGround = false;
  player.pos.x += mX;
  if (mX !== 0) {
    const hit = collideAxis("x");
    // step-up: sobe automaticamente um degrau de 1 bloco
    if (hit && wasGround && canStepUp(hit)) {
      // Sobe o degrau AVANÇANDO sobre o bloco. Se recuássemos ( -= mX ), o box
      // terminaria ao lado da célula, sem apoio, e a gravidade o derrubaria de volta.
      player.pos.y = hit.y + 1;
      player.pos.x += mX;
      collideAxis("x");
    }
  }
  player.pos.z += mZ;
  if (mZ !== 0) {
    const hit = collideAxis("z");
    if (hit && wasGround && canStepUp(hit)) {
      // (idem ao ramo de x) avança sobre o degrau em vez de ficar ao lado dele
      player.pos.y = hit.y + 1;
      player.pos.z += mZ;
      collideAxis("z");
    }
  }
  player.pos.y += player.vel.y * dt;
  collideAxis("y");

  // Fase 9: aterrissagem → dano de queda (queda > 3.5 blocos;
  // nenhum dano em voo ou na água, como no original)
  if (player.onGround) {
    if (!wasGround && !player.flying && !player.inWater) {
      const fallDist = fallPeak - player.pos.y;
      if (fallDist > 3.5) survival.takeDamage(Math.floor(fallDist - 3));
    }
    fallPeak = player.pos.y;
  }

  // Fase 9: cair através do fundo do mundo = morte (antes era um teleport silencioso)
  if (player.pos.y < -16) {
    if (!survival.dead) survival.takeDamage(9999);
    player.pos.copy(SPAWN);
    player.vel.set(0, 0, 0);
  }
}

// apoios: há bloco sólido sob a caixa de destino no nível dos pés?
function supportAt(x, z, yb) {
  const x0 = Math.floor(x - PLAYER_HW),
    x1 = Math.floor(x + PLAYER_HW);
  const z0 = Math.floor(z - PLAYER_HW),
    z1 = Math.floor(z + PLAYER_HW);
  for (let wz = z0; wz <= z1; wz++)
    for (let wx = x0; wx <= x1; wx++)
      if (world.isSolid(wx, yb, wz)) return true;
  return false;
}

// só levanta da agachação se couber a cabeça em pé (como no Minecraft)
function canStand() {
  const p = player.pos;
  const x0 = Math.floor(p.x - PLAYER_HW),
    x1 = Math.floor(p.x + PLAYER_HW);
  const z0 = Math.floor(p.z - PLAYER_HW),
    z1 = Math.floor(p.z + PLAYER_HW);
  const y0 = Math.floor(p.y + CROUCH_H),
    y1 = Math.floor(p.y + PLAYER_H - 0.001);
  for (let wy = y0; wy <= y1; wy++)
    for (let wz = z0; wz <= z1; wz++)
      for (let wx = x0; wx <= x1; wx++)
        if (world.isSolid(wx, wy, wz)) return false;
  return true;
}

// step-up: colidiu em célula sólida no nível dos PÉS, com 2 blocos livres acima
function canStepUp(cell) {
  if (cell.y !== Math.floor(player.pos.y)) return false;
  if (world.isSolid(cell.x, cell.y + 1, cell.z)) return false;
  if (world.isSolid(cell.x, cell.y + 2, cell.z)) return false;
  return true;
}

// ------------------------------------------------------------
// Colisão AABB vs voxels, um eixo por vez (scan da caixa de colisão)
// ------------------------------------------------------------
const EPS = 1e-3;
function collideAxis(axis) {
  const p = player.pos;
  const H = player.crouching ? CROUCH_H : PLAYER_H;
  const x0 = Math.floor(p.x - PLAYER_HW),
    x1 = Math.floor(p.x + PLAYER_HW);
  const z0 = Math.floor(p.z - PLAYER_HW),
    z1 = Math.floor(p.z + PLAYER_HW);
  const y0 = Math.floor(p.y),
    y1 = Math.floor(p.y + H - 0.001);

  for (let wy = y0; wy <= y1; wy++) {
    for (let wz = z0; wz <= z1; wz++) {
      for (let wx = x0; wx <= x1; wx++) {
        if (!world.isSolid(wx, wy, wz)) continue;
        if (axis === "y") {
          // Resolve para o lado de MENOR deslocamento:
          // - vindo de cima → pousa EXATAMENTE na superfície (sem EPS). Em altas taxas
          //   (~165Hz) a queda de 1 quadro (g·dt² ≈ 1mm) fica menor que EPS: com +EPS o
          //   player oscila entre "acima da superfície" e "re-snap". Snap exato mantém
          //   onGround estável (decisão da Fase 2 — preservada aqui).
          // - sobrepõe um teto (ex.: levantar-se numa fenda baixa) → empurra para BAIXO
          //   em vez de atravessá-lo.
          const landY = wy + 1;
          if (Math.abs(landY - p.y) <= Math.abs(wy - H - EPS - p.y)) {
            p.y = landY;
            player.onGround = true;
          } else {
            p.y = wy - H - EPS;
          }
        } else if (axis === "x") {
          if (player.vel.x > 0) p.x = wx - PLAYER_HW - EPS;
          else p.x = wx + 1 + PLAYER_HW + EPS;
        } else {
          if (player.vel.z > 0) p.z = wz - PLAYER_HW - EPS;
          else p.z = wz + 1 + PLAYER_HW + EPS;
        }
        player.vel[axis] = 0;
        return { x: wx, y: wy, z: wz };
      }
    }
  }
  return null;
}

// ============================================================
// Loop principal + FPS
// ============================================================
const fpsEl = document.getElementById("fps");
let last = performance.now();
let fpsFrames = 0,
  fpsTimer = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  const playing = document.pointerLockElement === canvas;
  if (playing) {
    updatePlayer(dt);
    updateBreak(dt);
    updateSteps(dt);
    // Fase 9: sobrevivência (fome/ar/regeneração) — vivo e jogando
    if (!survival.dead) {
      const hSpeed = Math.hypot(player.vel.x, player.vel.z);
      survival.update(dt, {
        inWater: player.inWater,
        moving: hSpeed > 0.05,
        sprinting: hSpeed > 5,
      });
      syncHUD();
    }
  }

  // Streaming de chunks (roda sempre, mesmo sem pointer lock)
  world.update(player.pos);

  // NPCs: wander/animação/culling (roda sempre — o mundo "vive" pausado)
  // Fase 10: diaTime vai para o zumbi (queima de dia)
  npcs.update(dt, player.pos, dayTime);

  // céu + estrelas acompanham o jogador
  sky.position.set(camera.position.x, 0, camera.position.z);
  stars.position.set(camera.position.x, 0, camera.position.z);

  // Fase 6: ciclo dia/noite (avança mesmo pausado) + partículas
  updateSky(dt);
  particles.update(dt);

  // nuvens derivam lentamente
  for (const c of clouds) {
    c.position.x += 0.6 * dt;
    if (c.position.x > 220) c.position.x = -220;
  }

  updateCamera(dt);
  updateArm(dt); // Fase 8: braço + swing decaem sempre (visível no inventário)
  renderer.render(scene, camera);

  // FPS
  fpsFrames++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    fpsEl.textContent = `${Math.round(fpsFrames / fpsTimer)} FPS`;
    fpsFrames = 0;
    fpsTimer = 0;
  }
}
requestAnimationFrame(animate);

// ============================================================
// Resize
// ============================================================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

console.log(
  "[MineClone] Fase 6 inicializada. WebGL:",
  renderer.capabilities.isWebGL2 ? "WebGL2" : "WebGL1",
);

// Hook de debug/teste (inofensivo em produção)
window.__mc = {
  renderer,
  scene,
  camera,
  player,
  sky,
  clouds,
  world,
  npcs,
  keys,
  toggleFly,
  toast,
  // funções puras de colisão (testes de unidade via browser)
  canStand,
  supportAt,
  canStepUp,
  // Fase 4: interação
  selectSlot,
  placeBlockNow,
  raycastNow,
  overlapsPlayer,
  highlight,
  getBlock: (x, y, z) => world.getBlock(x, y, z),
  setBlock: world.setBlock.bind(world),
  // Fase 6: dia/noite + partículas (testes via browser)
  dayTime: () => dayTime,
  setDayTime: (t) => {
    dayTime = ((t % 1) + 1) % 1;
  },
  particles,
  // Fase 7: inventário (testes via browser)
  inventory,
  toggleInventory,
  invOpen: () => invOpen,
  // Fase 8: itens, crafting, ferramentas (testes via browser)
  isItem,
  itemName,
  stackOf,
  toolSpeed,
  canCraft,
  craft,
  swingArm,
  items: ITEMS,
  armVisible: () => arm.visible,
  setDur: (slotIdx, d) => {
    const s = inventory.slots[slotIdx];
    if (s) s.dur = d;
  },
  getDur: (slotIdx) => inventory.slots[slotIdx]?.dur ?? null,
  // Fase 9: sobrevivência (testes via browser)
  survival,
  survivalHp: () => survival.hp,
  survivalFood: () => survival.food,
  survivalAir: () => survival.air,
  dead: () => survival.dead,
  damage: (n) => survival.takeDamage(n),
  heal: (n) => survival.heal(n),
  feed: (n) => survival.feed(n),
  respawn,
  eatItem,
  syncHUD,
  // Fase 10: combate (testes via browser)
  raycastMob,
  meleeAttack,
  npcList: () => npcs.list(),
};
