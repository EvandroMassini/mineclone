# Minecraft Clone — Plano de Implementação

Clone jogável em HTML/CSS/JS puro (Three.js/WebGL), 100% offline (Three.js vendored).

## Arquitetura

```
minecraft/
  index.html          # entrypoint, importmap, UI (hotbar, crosshair, menus)
  css/style.css       # fullscreen, hotbar, crosshair, HUD
  js/main.js          # bootstrap: renderer, scene, loop, física do player, combate
  js/world.js         # chunking, geração procedural, meshing culling
  js/noise.js         # ruído procedural (terreno)
  js/blocks.js        # catálogo de blocos + texturas (canvas atlas)
  js/npcs.js          # mobs: porcos, vacas, ovelhas, villagers, morcegos, zumbis
  js/items.js         # itens, ferramentas, receitas de crafting
  js/inventory.js     # hotbar/inventário, stacks, duração
  js/survival.js      # vida, fome, oxigênio, morte/respawn
  js/raycast.js       # ray voxel (mineração/colocação)
  js/particles.js     # partículas (quebra, poof de morte)
  js/sounds.js        # WebAudio sintetizado (passos, quebra, dano)
  vendor/three.module.js
```

## Fases

### Fase 1 — Fundação ✅

- [x] Scaffold do projeto + Three.js vendored
- [x] Renderer WebGL fullscreen + resize
- [x] Scene, fog, sky básica, luzes
- [x] Câmera first-person + pointer lock manual (WASD, mouse, sprint, pulo simples)
- [x] Mundo de teste (quadro de blocos) para validar render
- [x] Smoke test no browser (console limpo, movimento)
- [x] Revisão crítica + correção antes de seguir (21/11: W/A/D/S, sprint 1,52×, pulo/queda, mouse look 0,0021/px ignorado sem lock, hotbar, blur, resize aspect exato — tudo verificado; 0 erros no console)

### Fase 2 — Mundo aberto ✅

- [x] Geração procedural de terreno (value noise, biomas simples, água, árvores)
- [x] Chunks 16x16 com meshing por face visível (culling)
- [x] Atlas de texturas procedural (canvas): grama, terra, pedra, madeira, folhas, água, areia
- [x] Carregar/descarregar chunks conforme o jogador anda
- [x] Revisão crítica

Revisão Fase 2 (21/11): bug de cor por posição corrigido (`base = pos.length/3`); água real
(parametrizada, topo 0.88, só contra ar); **re-mesh de vizinhos** quando um chunk novo
aparece (faces de borda culadas corretamente — `dirtyRemesh`); física validada (spawn,
andar, colisão, head-bump, streaming 160 blocos); 129 chunks, 0 buffers inválidos,
~165 FPS; hotbar translúcida conferida (correto, não é bug).

### Fase 3 — Jogador completo ✅

- [x] Física: gravidade, colisão AABB contra voxels, pulo, nado
- [x] Voo (duplo espaço / F2), sprint, agachar
- [x] Câmera suave + colisão com o mundo
- [x] Revisão crítica

Revisão Fase 3 (22/11): todos os modos de movimento implementados e verificados no
browser com números. **Nado**: afundar −2.4, subir +4.0 (espaço), afundar rápido
−3.4 (Shift), horizontal ≈1.64 m/s (×0.42). **Voo**: toggle F2/duplo-espaço, sem
teclas não deriva, subir +8.56, descer −7.49, avançar 5.447, Ctrl = 2×.
**Agachar**: câmera 1.5 (olhos), andar 2.15 m/s, pulo bloqueado ao agachar,
auto-resolve ao soltar Ctrl quando o teto permite. **Guarda de borda** (agachado):
jogador não cai com a coluna 0.6×0.6 sem suporte (validado por contraste com
desagachado, que cai). **Piso do teto**: empurra para baixo, `maxY` exatamente
`23 − 1.8 − EPS` = 21.199, assenta em 21, sem clipping. `node --check` passou.
129 chunks, 165 FPS, console limpo (só linha info esperada).

Correção da revisão: fallback de `requestPointerLock` tinha promise sem `.catch`
(rejeição não tratada no console quando o retry falha, ex. cooldown pós-Esc) —
corrigido. **Aceitos e documentados** (semântica do guarda): centro pode passar
até ~0.3 m da borda mantendo apoio (mesmo do vanilla, nunca cai); voo com
espaço+Shift simultâneos → +1.07 líquido (duplo-espaço também funciona no ar,
consistente com criativo).

### Fase 4 — Interação com blocos ✅

- [x] Raycast por DDA voxel
- [x] Quebrar (botão esquerdo + tempo de mineração) e colocar (direito)
- [x] Hotbar 1–9 com seleção, texturas de bloco, UI
- [x] Sons sintetizados (quebra, colocação, passos)
- [x] Revisão crítica

Revisão Fase 4 (22/11): **bug real corrigido** — `raycast.js` declarava
`tMaxX/tMaxY/tMaxZ` como `const` e os reatribuía no loop DDA
(`TypeError: Assignment to constant variable`, pego no teste) → `let`.
Testado no browser (URL `bustN/` p/ burlar cache heurístico do XAMPP, sem
`Cache-Control` no cache do browser): raycast DDA acerta grama à frente
(`prev` = célula AIR); highlight wireframe aparece/some conforme o alvo;
colocação no `prev` funciona e é **recusada na célula do jogador**
(`overlapsPlayer` true em pés/cabeça, false no `prev` livre); mineração com
barra de progresso (`51%` a 200 ms no grass `hard=0.45`) e bloco → AIR;
hotbar 9 slots com texturas dataURL, teclas 1–9 verificadas
(`Digit4`→"sand", `Digit9`→"water"); sons sintetizados executam sem erro no
console (áudio em si não verificável em browser headless — registrado como
limitação). `world.getBlock/setBlock` re-mesha o chunk e marca vizinhos de
borda (`markDirtyIfBuilt`). 0 erros no console; 165 FPS.
Notas honestas: água colocada é estática (sem simulação de fluido —
simplificação desta fase); o "hit null" do primeiro teste era o raio
horizontalem altura dos olhos passando sobre o terreno (comportamento
correto da DDA), não bug.

### Fase 5 — NPCs ✅

- [x] Modelos voxelados simples (villager, porco, vaca, ovelha, bat)
- [x] Animação simples (caminhar, comer grama, andar aleatório)
- [x] Spawn em posições válidas, culling por distância
- [x] Revisão crítica

Revisão Fase 5 (22/11): **22 NPCs** (6 porco, 5 vaca, 5 ovelha, 4 vilão, 2
morcego). Modelos voxelados com `MeshLambertMaterial` em cache por cor.
Animação: pernas/braços balançam ao andar (pivot no quadril/ombro), ovelha/vaca
desem a cabeça ao comer grama, morcego bate as asas em voo circular. IA é uma
máquina de estados `idle/walk/eat`; wander com **desvio** (água, queda >1,5,
subida >1 bloco, topo não-passeável). NPCs acompanham o chão quando o jogador
cava/constrói e são **realocados** se perderem o chão sólido. Spawn via
`relocate()` (28 tentativas r=10..42, exige topo passeável + 2 blocos de ar
acima); culling `VIEW_DIST=42`, relocação `RELOC_DIST=48`.

**Bugs reais achados e corrigidos na revisão:** (1) `groundAt` passava `maxY`
fracionário e `world.getBlock` indexava o array direto → índice decimal
retornava `undefined`; endurecido com `Math.floor` no loop (e `getBlock`
defensivo). (2) O "acompanha o chão" ancorava um andador **sobre a água**
(tratava qualquer bloco não-ar como chão) → agora topo não-passeável =
"sem chão" → realoca. (3) O walker só checava _queda_ e "teleportava" morros de
2+ blocos → limitado a subida de ~1 bloco.

Testado no browser (`bust5`, URL inédita p/ burlar cache): **20/20 andadores
sobre chão sólido e passeável, 0 sobre água** (antes havia 1); morcegos com
asas animando (2 amostras distintas); 3 estados ativos (`eat/idle/walk`);
19/22 se moveram em 8 s; **0 erros/warnings no console**; ~166 FPS.
`node --check` em `npcs.js`, `world.js`, `main.js` → OK.

Limitações honestas (fora do escopo desta fase): sem dano/interação do jogador
com NPCs (sem combate, sem pegar itens); sem IA de fuga; sem som de passos dos
NPCs; água continua estática (característica da Fase 4).

### Fase 6 — Ciclo dia/noite + polimento ✅

- [x] Ciclo dia/noite (cor do céu, sol/lua, luz ambiente, estrelas)
- [x] Partículas de quebra de bloco
- [x] Tela de pausa (ESC) com instruções
- [x] FPS counter
- [x] Revisão crítica final + testes

Revisão Fase 6 (22/11): **Ciclo dia/noite** — `dayTime` em [0,1)
(0=meia-noite, 0.25=nascer, 0.5=meio-dia) avança `dt/DAY_LENGTH` (240 s/dia)
no `animate` (anda mesmo pausado). Elevação `e = sin((dayTime−0.25)·2π)`.
Céu: lerp dos keyframes `SKY_NG → SKY_DAY` por `smoothstep` e um toque de
`SKY_TW` no crepúsculo nos uniforms `topColor/midColor/bottomColor` do shader
(esfera `BackSide`), com a **névoa sincronizada** à cor do horizonte. Sol:
`DirectionalLight` com intensidade/cor (laranja→branco) pela elevação; posição
num círculo inclinado. Lua: `DirectionalLight` oposta (`0.6·max(0,−e)`) + disco
`moonDisc`. Estrelas: `THREE.Points` (500 pts num domo, `sizeAttenuation:false`),
opacidade `1−dayF` (só à noite). `hemi`/`ambient` escalam com o dia. `sunDisc`/
`moonDisc` e `stars` acompanham a câmera; discos só visíveis acima do horizonte.

**Partículas** (`js/particles.js`, novo) — `ParticleSystem` com pool (teto 240,
recicla a mais antiga), `burst(x,y,z,color,16)`: cubinhos 0.13 com velocidade
aleatória, gravidade 14, rotação, escala e **fade-out** nos últimos 30% da vida;
`update(dt)` no loop; `dispose()` de material ao expirar. Cor = **amostra do
canvas do atlas** (tile `side` do bloco, 8×8 px centrais → média RGB → hex),
então cada bloco quebra na própria cor. Disparado no `updateBreak` ao `p>=1`.

**Pausa** — flag `started`; no `pointerlockchange`, se já jogou e o mouse foi
liberado, o `h1` vira **"Pausa"** e `.play` vira **"Clique para continuar"**
(estilos de overlay já existiam; sem mudança de CSS). Item **`ESC` pausar**
adicionado à lista `.keys` do `index.html`.

**FPS counter** — já existia (atualiza a cada 0,5 s); verificado ativo (163–165
FPS nos testes).

**Bug real achado e corrigido:** `updateSky` lia `u.botColor` mas o uniform do
shader se chama `bottomColor` → `TypeError: reading 'value'` a cada frame.
Corrigido (2 ocorrências). Sintoma clássico de uniform com nome divergente.

Testado no browser (`bust7`, URL inédita p/ burlar cache; aba limpa):
**0 erros/warnings no console**; `dayTime` avança; estados do céu corretos —
meio-dia (topo `#2f6fd6`, horizon `#cfe9f7`, sol visível `int 2.35`, sem
estrelas), meia-noite (topo `#04060d`, horizon `#182238`, lua `int 0.6` visível,
estrelas opac. 1), crepúsculo (horizon alaranjado, estrel. 0.72, sol fraco);
partículas `count` 0 → 16 (burst) → 0 (expiradas em 2,5 s); pausa some no lock e
reaparece com "Pausa" no unlock; screenshots dia **e** noite conferidas.
`node --check` em `main.js` e `particles.js` → OK.

Limitações honestas (fora do escopo desta fase): dia/noite **não persiste** ao
recarregar (sempre reinicia de manhã); NPCs não dormem/mudam de comportamento à
noite; estrelas são um domo estático (sem parallax/rotação); sem textura de
face interna para o "lado" das partículas (cor média amostrada, não a face
exata); água continua estática (Fase 4).

### Fase 7 — Inventário real (modo sobrevivência)

- [x] Blocos quebrados viram itens no inventário (com drops: grama→terra, folhas→nada)
- [x] Colocar bloco consome do slot ativo; sem item no slot → nada é colocado
- [x] Tela de inventário (tecla E): grade 27 + hotbar 9, mover/merge/swap por mouse
- [x] Botão direito na tela de inventário = metade da pilha (1 se for 1)
- [x] Hotbar dinâmica no HUD: textura do item + contagem; teclas 1–9 continuam
- [x] Inventário inicia vazio (fiel ao survival; mineração é a fonte de blocos)
- [x] Hook `__mc.inventory` para testes; `node --check`; teste no browser

**Revisão Fase 7 (22/11)** — implementado `js/inventory.js` (classe `Inventory`,
36 slots, pilhas 64, `addItem`/`takeFrom`/`takePartial`/`placeAt`/`countOf`/
`clear`/`snapshot`), campo `drop` em `blocks.js` (grama→terra, folhas→nada),
tela de inventário (grade 27 + hotbar 9) com drag de mouse (esq. = pilha toda /
merge / swap; dir. = metade ou 1; fundo = descarte), hotbar HUD com `.tex` +
`.cnt`, e guarda `invOpen`/`started` no fluxo de pointer-lock/pausa.

Testado no browser (`bust8`, URL inédita p/ burlar cache; aba limpa; sim de
pointer-lock): **0 erros no console**; 8/8 verificações passaram — HUD
(`addItem(2,5)` → cnt "5", textura url, `countOf`=5); toast de slot vazio;
colocar consome (3→2, célula vira 2); grama quebra → +terra e célula 0;
folhas quebram → +0 (drops corretos); painel visível com 9+27 slots e paint
correto; drag pegou 10 → swap (slot 1 ficou 10, drag 3) → soltou na grade
(slot 9 = 3 pedras) → dir. = metade (20→10+10) → dir. de novo = 1 (10→9+1) →
descarte no fundo; tecla E fechou, overlay de pausa não apareceu e cursor-item
escondeu. `node --check` em `main.js`, `inventory.js`, `blocks.js` → OK.

Limitações honestas (fora do escopo desta fase): drops vão direto ao inventário
(não há entidades de item no mundo / magnetismo / atirar item); sem persistência
(recarregar = inventário vazio de novo); itens só existem como blocos — ferramentas
e crafting chegam na Fase 8; stack máxima 64 não se aplica a nada que
transcenda o bloco (ainda não há itens não-bloco); inventário não é sensível
a largura de pilha por item (todos 64, como blocos vanilla).

### Fase 8 — Itens, ferramentas e crafting ✅

- [x] Itens que não são blocos: graveto, picareta, machado, pá e espada de madeira (com ícone na hotbar/inventário)
- [x] Ferramentas aceleram a mineração do tipo certo (picareta→pedra, machado→madeira, pá→terra/areia, espada→folhas); sem ferramenta, velocidade base
- [x] Duração: ferramenta perde 1 uso por bloco quebrado; ao zerar, quebra (some do slot + toast)
- [x] Crafting na tela de inventário: madeira→tábuas; tábuas→gravetos; madeira+gravetos→ferramenta (botões só habilitam com material suficiente)
- [x] Ferramenta não coloca bloco (clique direito com ferramenta = acena a arma, não coloca)
- [x] Braço em 1ª pessoa segurando o item ativo, animação de aceno ao quebrar/colocar
- [x] Hook `__mc` para testes; `node --check`; teste no browser com revisão crítica e assinatura

**Revisão Fase 8 (22/11)** — implementado `js/items.js` (itens id 101–105,
`ITEMS` com `dur=64`/`goodFor`, `TOOL_SPEED=4`, `RECIPES` 6 receitas,
`canCraft(inv,i)`/`craft(inv,i)`, ícones pixel-art 16×16 por canvas com cache,
`itemTexURL`), duração por slot (`s.dur`, init via `ITEMS[id].dur`),
`toolSpeed(slot,blockId)` (ferramenta certa no bloco certo → ×4, senão ×1),
arm em 1ª pessoa (grupo na câmera: mão + plano com a textura do item ativo,
`swingArm()`/`updateArm(dt)` decaimento no loop), 6 botões de crafting em
`#crafting` (construídos em JS, `refreshCraft()` no `renderInventory()`),
guarda `isItem` no `placeBlockNow` (clique direito com item = só acena),
`updateBreak` com `hard/toolSpeed` + decremento de duração (quebra em 0,
toast + `playToolBreak`), `js/sounds.js` (`playCraft`, `playToolBreak`),
`js/inventory.js` (`takeFromAny`, `stackOf`: ferramentas não empilham,
graveto 16, blocos 64).

Testado no browser (`bust9`, URL inédita p/ burlar cache; aba limpa; sim de
pointer-lock): **0 erros no console**. Verificações: (1) **itens** —
`itemName(102)="picareta de madeira"`, `stackOf(102)=1`, `stackOf(101)=16`,
ícone da picareta visível na hotbar (screenshot, slot ativo com borda branca);
(2) **velocidade** — pedra (`hard=1.8`) quebra em **484 ms com picareta** vs
**1853 ms com mão vazia** (razão 3,8× ≈ `TOOL_SPEED=4`); matriz `toolSpeed`
correta (picareta/pedra=4, picareta/grama=1, pá/grama=4, null=1, graveto=1);
(3) **duração** — `setDur(slot,1)` → quebra 1 bloco → slot vira `null`
(toast); ferramenta nova (sem `dur`) funciona via `?? ITEMS[id].dur`
(`durAfterTool=63` após 1 uso); (4) **crafting** — cadeia completa
`4 madeira → 4 tábuas → 4 gravetos → 1 picareta` com `craft(inv,i)=true` e
botões habilitando/desabilitando corretamente a cada etapa (todos desabilitados
no início; `btn0` liga com 1 madeira; após consumir, `btn` desliga);
`canCraft(inv,2)=false` quando falta madeira; (5) **ferramenta não coloca** —
clique direito com picareta no slot ativo: célula adjacente ficou AIR
(`adjAfter=0`), item intacto; (6) **braço** — `armVisible()=true` com
ferramenta no slot ativo, `false` com slot vazio. `node --check` em
`main.js`, `items.js`, `inventory.js`, `sounds.js` → OK.

**Nota de teste (não é bug no jogo):** o "bug de crafting" inicialmente
reportado era o _harness_ chamando `canCraft(0)`/`craft(0)` — assinatura real
é `canCraft(inv, i)`/`craft(inv, i)` (inventário primeiro). O código do jogo
(`main.js:716`) já chama `canCraft(inventory, i)` corretamente. Com a
assinatura certa, toda a cadeia craftou. Slots com `id` mas `count` ausente
(ex. `102xundefined`) eram artefatos de testes anteriores que gravavam
`inv.slots[3]={id:102}` diretamente — fora do fluxo normal.

Limitações honestas (fora do escopo desta fase): crafting por **6 botões de
receita fixa**, não grid 3×3 interativo (limitação registrada p/ a revisão);
sem ferramentas de pedra/ferro/diamante (só madeira); sem encantamentos;
sem dano de espada a NPCs/players (combate chega na Fase 10); ferramentas não
empilham (como no vanilla) mas a duração é por slot, não por item; drops
continam indo direto ao inventário (sem entidades de item); sem persistência.

### Fase 9 — Sobrevivência: vida, fome, oxigênio, queda, morte ✅

- [x] HUD de sobrevivência: 10 corações (vida) + 10 frangos (fome), com meias metades e estados vazio
- [x] Classe `Survival` pura (sem DOM/Three): `hp/food/air/dead`, `takeDamage/heal/feed/respawn/update(dt,ctx)`
- [x] Dano de queda (> 3 blocos → dano progressivo) e dano do vazio (teleporta ao spawn)
- [x] Afogamento: em água com oxigênio zerado → dano contínuo; fora da água o ar repõe
- [x] Inanição: fome esgota → perda de vida lenta; regeneração com comida (exige fome > 0)
- [x] Comer maçã (clique direito, só quando fome < cheia; fome cheia não consome a maçã)
- [x] Maçãs dropam de folhas quebradas (~10%)
- [x] Tela de morte + ressurreção com **R** (mantém inventário, volta ao spawn)
- [x] Feedback visual: flash vermelho de dano; sons de dano/comer/morte
- [x] Hook `__mc` para testes; `node --check`; teste no browser com revisão crítica e assinatura

**Revisão Fase 9 (22/11)** — `js/survival.js` (classe `Survival` pura,
`MAX_HP=20/MAX_FOOD=20/MAX_AIR=15`, `feed()` só devolve `false` se morto;
regeneração 3,5 s com fome > 0: hp+1/fome−1; inanição 1 hp/6 s; afogamento
2 dano/2 s com ar=0 em água; dano de queda `floor(dist−3)` se > 3,5).
`js/items.js`: maçã (id 106, `food=4`), ícone pixel-art, `heartDataURL(state)`
(completo/meio/vazio) e `foodDataURL()`. `js/sounds.js`: `playHurt/playEat/
playDeath`. `js/main.js`: HUD de 10 `<img>` de corações + 10 de fome com
metade via `clipPath` e vazio via `visibility`, `syncHUD()` com cache,
`flashDamage()` (vignette 180 ms), dano de queda rastreando pico da altura
(`fallPeak`), vazio → `takeDamage(9999)` + teleport ao spawn, maçã das
folhas (10%), `eatItem()` (bloqueia com fome cheia e **não consome** a
maçã, toast "Sua fome já está cheia"), tela `#death` + respawn com **R**
(mantém inventário), hooks `__mc`. `index.html`: `#hud`, `#dmgflash`,
`#death`; `css/style.css`: posições, vignette, overlay de morte (z-30).
Correção durante os testes: `feed()` sempre devolvia `true` quando vivo,
então o bloqueio de fome cheia migrou para `eatItem()` checar
`survival.food >= MAX_FOOD` antes de consumir.

Testado no browser (`bust10`, URL inédita p/ burlar cache; aba limpa; sim de
pointer-lock): **0 erros no console** em todas as baterias. Verificações:
(1) **HUD** — 10 corações + 10 frangos renderizados, `hp/food/air = 20/20/15`,
overlay de morte escondido; (2) **dano** — `damage(2)` → hp 18, flash
vermelho liga/desliga, coração vira estado vazio (src muda); (3)
**regeneração** — 4,2 s → fome 20→19 e hp 18→19; (4) **inanição** — fome
zerada, 6,8 s → hp 19→18; (5) **queda** — +10 blocos → 6 dano (amostragem
de altura ≈ 9,9 → `floor(6,9)=6`, dentro do esperado); (6) **curar** — `heal(5)`
→ +5; (7) **afogamento** — jogador submerso, `air=0`, 2,5 s → hp 20→18,
saiu da água → ar repõe a 15; (8) **maçã** — fome 12 → clique direito →
fome 16 e maçã consumida (slot vira vazio); (9) **fome cheia** — `food=20`

- maçã → `eatItem()` bloqueia, toast "Sua fome já está cheia", maçã mantida
  no slot; (10) **morte + respawn** — `damage(9999)` → overlay visível e
  `dead=true`; tecla **R** → `dead=false`, hp 20, fome 20, ar 15, posição
  spawn (30,5 / 22 / −6,5), overlay escondido e inventário **idêntico**
  antes/depois (106×1). Screenshot: HUD com 10 corações + 10 frangos acima da
  hotbar, maçã no slot ativo. `node --check` em `main.js`, `survival.js`,
  `items.js`, `sounds.js`, `inventory.js` → OK.

Limitações honestas (fora do escopo desta fase): sem HUD de bolhas de
oxigênio (o ar existe internamente, mas não é exibido); sem saturação de
fome (a barra "invisível" do vanilla); sem armadura, camas, poções ou
escudo; inventário **preservado** na morte (o original perde os drops — aqui
é mais gentil, diferença registrada); maçã é o único alimento; sem knockback
nem partículas de dano (só o flash); afogamento por corpo em água, não por
cabeça (mais simples).

### Fase 10 — Combate: zumbi hostil + melee do jogador ✅

- [x] Zumbi hostil: spawn 8–22 blocos, persegue ≤ 16 blocos, melee 2–3 dano (cd 1 s)
- [x] Zumbi queima de dia (2 dano/s entre 27%–73% do ciclo); poof verde na morte
- [x] Melee do jogador: raycast na AABB do mob (limitado pelo hit de bloco), punho 1 / espada 3
- [x] Duração da espada (−1 por golpe); quebra → slot vazio + toast + `playToolBreak`
- [x] Knockback normalizado no mob, cd de ataque 0,45 s, animação do braço
- [x] Passivos reagem: fogem 1,6 s após dano; villager olha o player; morcego acompanha
- [x] Mobs distantes são relocalizados perto do player (culling de distância + visibilidade)
- [x] Hooks `__mc`; `node --check`; teste no browser com revisão crítica e assinatura

**Revisão Fase 10 (22/11)** — `js/npcs.js` reescrito como
`NPCSystem(scene, world, player, particles)` com callbacks `isPlayerDead`/
`onPlayerHit` e `update(dt, playerPos, dayTime)`. `n.pos` é a fonte da
verdade (pés p/ andadores, centro p/ morcego — flag `n.bat`) e
`group.position.copy(n.pos)` a segue. Exports: `NPCSystem`, `MOB_HITBOX`
(AABB por espécie), `MOB_HP`, `CHASE_DIST=16`, `ATTACK_RANGE=1.6`,
`hurtMob/applyKnockback/killMob`, `list()`. Zumbi: spawn 8–22 blocos,
persegue ≤ 16 (≈1,5 blocos/s), melee 2–3 dano cd 1 s via `onPlayerHit` →
`Survival.takeDamage`, queima 2 dano/s quando `dayTime>0.27 && <0.73`,
`trackGround` no terreno, poof verde na morte. Passivos: fuga 1,6 s após
dano (`fleeYaw`), villager `headYaw` acompanha o player, morcego lerp
`dt*0.2` em âncora que segue o player, ovelhas 0,6 / vacas 0,4. Relocação
automática quando `dist > RELOC_DIST` (8–22 p/ zumbis, 10–42 p/ demais) e
`group.visible` por `VIEW_DIST`. `js/main.js`: `mobInRay` + `raycastMob`
(AABB via `THREE.Ray.intersectBox`, `maxDist` = hit do ray voxel) e
`meleeAttack(n)` — punho 1 / espada 3 (`SWORD=105`, dur −1/golpe; quebra →
slot `null` + toast + `playToolBreak`), `swingArm()`, cd 0,45 s, knockback
normalizado; `mousedown button:0` tenta **mob primeiro** (`raycastMob()`),
senão minera. `js/npcs.js` sons: `playHurt` (dano recebido) e
`playBreak(0.3)` (morte).

**Bug encontrado e corrigido nos testes (T7/T8):** no Three r160,
`Ray.intersectBox(box: Box3, target)` retorna **ponto (Vector3) ou null**
(vendor lines 5709/5771). O código anterior passava `(min, max, target)`:
o 1º argumento é um `Vector3`, onde `.min` é **método** — `box.min.x` =
`undefined` → `NaN` → as comparações falhavam silenciosamente e
`raycastMob` **sempre** devolvia `null` (melee nunca acertava, sem
exceção). Correção em `mobInRay`: `new THREE.Box3(minVec, maxVec)` +
`new THREE.Vector3()` como target.

Testado no browser (`bust11`, URL inédita p/ burlar cache; shim de
pointer-lock; `setDayTime(0.1)` nos testes de combate p/ o zumbi não
queimar): **0 erros no console**. Bateria 11/11: (1) **zumbi ataca
player** — hp 20→18 via `onPlayerHit`; (2) **punho** — 1 dano no mob, cd
de ataque (segundo clique imediato ignorado); (3) **espada** — 3 dano +
durabilidade 64→63; (4) **espada quebra** — dur→1, slot `null` + toast;
(5) **sol** — ~2 dano/s com `dayTime>0.27`; (6) **passivo foge** — porco
`fleeT≈1,54` após dano; (7) **raycast** — `raycastMob()` devolve o zumbi
(caso quebrado antes do fix); (8) **clique esq.** — dano no mob (20→19) e
cd respeitado no spam; (9) **morcego** — segue a âncora do player (lerp);
(10) **villager** — `headYaw` acompanha o player (−1,1 rad); (11) **morte
do mob** — removido da scene + poof verde. Screenshot pós-bateria (HUD 10
corações + 10 frangos, respawn com **R** validado). `node --check` em
`npcs.js`, `main.js`, `sounds.js` → OK.

Limitações honestas (fora do escopo desta fase): **zumbi é o único
hostil** — sem esqueleto (flechas), creeper (explosão), aranha, bruxa ou
enderman; **sem projéteis** (arco/flecha); melee é AABB por ray (sem
sweep do hitbox animado, rotação do mob ignorada — inofensivo pelas
hitboxes pequenas); zumbi **sem pathfinding** (perseguição em linha reta +
`trackGround`, não pula obstáculos); respawn = relocalização instantânea
ao passar de `RELOC_DIST` (sem atraso nem densidade por nível de luz); sem
drops no chão (entidades de item); sem armadura, poções, escudo ou
encantamentos; sons dos mobs reusam `playHurt`/`playBreak` (sem vozes
específicas).

**Bug reportado pelo usuário e corrigido (22/11) — mobs "voando" / "dentro de bloco":**
os screenshots do usuário mostravam um porco pairando na altura das copas e um
villager enfiado dentro de um bloco de terra. Diagnóstico (raiz): a física
vertical dos andadores era um lerp lento (`n.pos.y += (g.y - n.pos.y) * min(1,
dt*10)`) aplicado em **ambas** as direções — o corpo descia **pairando** quando
o chão sumia (porco "voando") e **atravessava** o bloco ao subir um degrau
(villager "dentro"). O fallback de `relocate` aceitava o **topo sólido da
coluna** sem checar `WALKABLE_TOP`, o que fixava o mob no topo de uma copa.
Correções em `js/npcs.js`: (1) `trackGround` reescrito — assento instantâneo
(snap) para chão no mesmo nível ou degrau ≤ 1 bloco; **queda com gravidade**
(`v = v − 24·dt`, velocidade máxima −16) quando o chão está abaixo; **snap-up**
quando o chão está acima (corpo enfiado em talude, ex.: knockback) em vez de
atravessar ou teleportar; sem chão andável → `relocate` (comportamento
mantido); (2) fallback de `relocate` agora exige `WALKABLE_TOP` (até 10
tentativas aleatórias num raio de 2–5 blocos do jogador) antes de usar o y
default; (3) `stepWalk` ganhou checagem de folga da cabeça (as 2 células acima
do novo chão devem ser AIR) para não enfiar o corpo em talude; (4) `velY`
inicializado no construtor dos mobs. Testado no browser (`bust12`, URL inédita
p/ burlar cache; shim de pointer-lock; **0 erros no console**): 20/20 andadores
assentados (pés em AIR, base sólida, `gap=0`, `velY=0`); perturbações isoladas
— queda curta (+3), corpo enfiado 2 blocos abaixo do topo (−2), queda longa
(+14) — todas assentaram no chão com `velY=0` em ~2,5 s; knockback duplo
(direções opostas) em porco + vaca: ambos sobreviveram (hp 10→6) **sem** ficar
`inBlock`; 2 morcegos voando (comportamento de design, não bug). Confirmação
visual: porco e vaca assentados na grama, nenhum pairando na copa, nenhum
dentro de bloco.

## Regras

- `node --check` em todo JS alterado
- Teste no browser a cada fase; revisar console
- Honestidade: registrar o que foi e não foi feito
- Responder em português

## Revisão Geral — Lacunas vs. Minecraft original (encerramento)

O que este clone cobre (Fases 1–10):

- **Mundo**: procedural infinito (seed 20261121), chunks 16×16×48, culling de faces, fog e distância de render, árvores, água
- **Física first-person**: WASD, sprint, pulo, gravidade, colisão AABB, voo (F2), natação, dano de queda
- **Ciclo dia/noite** (240 s) com sol/lua e queima de zumbi de dia
- **Mineração/colocação** com dureza por bloco e ferramentas de madeira (picareta, pá) com velocidade e duração
- **Crafting** (6 receitas fixas), hotbar, inventário
- **Sobrevivência**: vida, fome, oxigênio, inanição, afogamento, maçã (drop ~10% de folhas), tela de morte + respawn (R)
- **Mobs**: 5 passivos (porco, vaca, ovelha, villager, morcego) + zumbi hostil; melee do jogador (punho/espada) com dano, knockback, durabilidade

Lacunas conscientes em relação ao original:

1. **Mobs** — hostil apenas o zumbi; faltam esqueleto (flechas), creeper (explosão), aranha, bruxa, enderman e mobs de The End/Nether; sem pathfinding, sem IA de grupo, sem spawns dinâmicos por nível de luz
2. **Combate e equipamento** — sem arco/projéteis, sem armadura, escudo, poções ou encantamentos; dano de melee fixo (sem críticos, sem força)
3. **Progressão de itens** — só madeira; sem minérios (carvão/ferro/diamante), fornos, metalurgia, vidro, telhas, nem ferramentas de pedra/ferro/diamante
4. **Mundo** — sem cavernas, minérios, biomes nomeados (neve/areia existem só como cobertura), The End, Nether, dimensões
5. **Sistemas** — sem save/persistência, sem multiplayer, sem efeitos de status, sem sons de ambiente posicionais
6. **Sobrevivência** — sem camas, sem saturação de fome exibida, sem HUD de oxigênio (o ar existe internamente), sem inventário de morte (aqui ele é preservado, mais gentil que o original)

O clone cobre o núcleo jogável do survival clássico — mundo, física,
mineração, crafting, fome/vida/oxigênio, mobs passivos e hostis,
defesa e ataque — dentro do escopo "HTML/CSS/JS puro + Three.js
vendored", com as 10 fases assinadas e baterias de teste no browser com
console limpo.

## Tela de título — redesign (22/11)

Pedida do usuário: melhorar a tela de entrada — "o retângulo com a
descrição de botões e com o nome do jogo".

O que mudou (sem tocar em `main.js`):

- `index.html` (bloco do overlay): novo `#overlay-box` com `.title-wrap`
  (`h1` + `.splash` verde "Tente também: Terraria!"), botão `.play`
  "Clique para jogar" e grade `.keys-grid` de 3 colunas
  (Movimento / Blocos / Sistema) com teclas em `kbd` (keycaps).
  Rodapé com versão ("MineClone 1.0 · WebGL puro") e "não afiliado à Mojang".
- `css/style.css` (bloco do overlay): título com extrusão 3D via
  `text-shadow` (contorno + sombra em camadas), splash verde inclinado
  com `@keyframes splashPulse` (oculto em viewport < 900 px), botão
  estilo bloco de Minecraft (borda de 4 cores, anel preto, hover amarelo
  `#ffffa0`, animação `pulse` existente), keycaps com gradiente/bevel,
  colunas com cabeçalho e sublinhado, e `@keyframes boxIn` para entrada.
  `#overlay.hidden { display:none }` mantido.
- Contrato JS preservado: `#overlay` clicável, `#overlay-box`, `h1` e
  `.play` dentro do box, toggle `.hidden` — `main.js` intacto.

Verificado no browser (aba fresca `index.html?b=N`):

- 0 erros no console após o load;
- screenshot da tela de título (título 3D, botão, grade de 3 colunas,
  cantos) e do estado de pausa (h1 "Pausa", `.play` "Clique para
  continuar") com layout consistente;
- o texto do botão de pausa foi aplicado via script simulando o que o
  JS faz (não testei o fluxo real de ESC/pointer-lock nesta sessão —
  o contrato de IDs/classes que o JS usa foi mantido e conferido no
  código).

Limpa: cópia de teste `bust8/` removida; abas antigas fechadas.
