# MineClone ⛏️

Um clone jogável de Minecraft em **HTML/CSS/JS puro** + [Three.js](https://threejs.org) (WebGL).
Sem build, sem frameworks, sem dependência de rede: o Three.js vem vendored em
[`vendor/`](vendor/) e as texturas são geradas por código (canvas) — o jogo roda
**100% offline**, inclusive direto do GitHub Pages.

> Projeto de estudo e demonstração. Sem afiliação com a Mojang ou a Microsoft —
> "Minecraft" é marca da Mojang Studios.

---

## ▶ Jogue agora

- **GitHub Pages:** `https://evandromassini.github.io/minecraft/` _(após publicar — [instruções](#publicar-no-github-pages))_
- **Local:** sirva a pasta por HTTP (XAMPP, `python -m http.server`, `npx serve`…) e abra
  `http://localhost/minecraft/`. Por usar ES Modules, `file://` não funciona.

Requisitos: qualquer browser moderno com WebGL (Chrome, Edge, Firefox).
Medido em uma RTX 3090: **~165 FPS** com 129 chunks ativos e console limpo.

---

## O que tem dentro

O núcleo jogável do survival clássico, entregue em **10 fases** (diário completo em
[PLAN.md](PLAN.md)):

| Fase                          | Entrega                                                                                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — Fundação**              | Renderer WebGL fullscreen, céu, névoa, luzes, câmera first-person com pointer lock, hotbar                                                                            |
| **2 — Mundo aberto**          | Terreno procedural (value noise, seed fixa), chunks 16×16×48 com streaming, meshing por face visível (culling), atlas de texturas procedural (canvas), árvores e água |
| **3 — Jogador completo**      | Gravidade, colisão AABB contra voxels, pulo, **nado**, **voo** (F2 / duplo espaço), sprint, agachar com guarda de borda                                               |
| **4 — Interação com blocos**  | Raycast voxel por DDA, **mineração** com dureza por bloco e barra de progresso, **colocação** (bloqueada na célula do jogador), sons sintetizados                     |
| **5 — NPCs**                  | 22 mobs voxelados (6 porcos, 5 vacas, 5 ovelhas, 4 vilões, 2 morcegos) com IA `idle/walk/eat`, spawn em posições válidas, culling por distância                       |
| **6 — Dia/noite + polimento** | Ciclo de **240 s** (shader de céu, sol/lua, estrelas, névoa sincronizada), partículas de quebra, tela de pausa (ESC), contador de FPS                                 |
| **7 — Inventário real**       | Grade de 27 slots + hotbar de 9, empilhar e mover itens com clique                                                                                                    |
| **8 — Itens e crafting**      | 6 receitas fixas, **picareta e pá de madeira** (velocidade + durabilidade), drops (maçã: ~10% de folhas)                                                              |
| **9 — Sobrevivência**         | Vida (corações), fome, oxigênio, inanição, afogamento, dano de queda, tela de morte + respawn (R)                                                                     |
| **10 — Combate**              | **Zumbi hostil** (persegue, ataca, queima ao sol), melee do jogador com dano, knockback e durabilidade                                                                |

### Modos de jogo

- **Sobrevivência (padrão)** — fome, vida, oxigênio, crafting, combate.
- **Voo** — `F2` ou duplo espaço; subir/descer com espaço/Shift, `Ctrl` acelera 2×.
- **Nado** — afundar (Shift), subir (espaço); o ar é finito e o afogamento mata.

### Controles

| Tecla               | Ação                               |
| ------------------- | ---------------------------------- |
| `WASD`              | mover                              |
| `Mouse`             | olhar                              |
| `Shift`             | correr / afundar (na água)         |
| `Espaço`            | pular / nadar para cima            |
| `Ctrl`              | agachar / 2× no voo                |
| `F2` ou `2× Espaço` | ligar/desligar voo                 |
| `Mouse esq.`        | quebrar bloco (segurar)            |
| `Mouse dir.`        | colocar bloco                      |
| `1–9`               | selecionar slot da hotbar          |
| `E`                 | abrir/fechar inventário + crafting |
| `R`                 | ressuscitar (tela de morte)        |
| `ESC`               | pausar / liberar o mouse           |

---

## Arquitetura

```
minecraft/
  index.html              # entrypoint, importmap, HUD (hotbar, mira, inventário, HUD de sobrevivência)
  css/style.css           # estilos fullscreen, HUD, tela de título, menus
  js/main.js              # bootstrap: renderer, cena, loop, física do player, combate
  js/world.js             # chunks, geração procedural, meshing com culling de faces
  js/noise.js             # ruído procedural (terreno)
  js/blocks.js            # catálogo de blocos + atlas de texturas (canvas)
  js/npcs.js              # mobs: passivos + zumbi hostil
  js/items.js             # itens, ferramentas, receitas de crafting
  js/inventory.js         # hotbar/inventário, stacks, durabilidade
  js/survival.js          # vida, fome, oxigênio, morte/respawn
  js/raycast.js           # ray voxel por DDA (mineração/colocação)
  js/particles.js         # partículas de quebra
  js/sounds.js            # WebAudio sintetizado (passos, quebra, dano)
  vendor/three.module.js  # Three.js vendored (jogo 100% offline, sem CDN)
```

- **Blocos (9):** grama, terra, pedra, areia, neve, tronco, folhas, água e tábuas.
- **Mundo:** procedural infinito (seed `20261121`), chunks `16×16` com altura `48`,
  re-mesh incremental, fog + distância de render.
- **Áudio:** 100% sintetizado em runtime (WebAudio) — nenhum arquivo de som no repo.
- **Sem estado externo:** nada de fetch, XHR ou APIs; todo asset é relativo.

---

## Limitações conscientes (honestidade)

Este clone **não** é o Minecraft completo. Lacunas em relação ao original, assumidas
no escopo:

1. **Mobs** — o único hostil é o zumbi; faltam esqueleto, creeper, aranha, bruxa,
   enderman e mobs de dimensões; sem pathfinding, IA de grupo ou spawn por nível de luz.
2. **Combate/equipamento** — sem arco/projéteis, armadura, escudo, poções ou
   encantamentos; dano de melee fixo (sem críticos).
3. **Progressão de itens** — apenas madeira; sem minérios, fornos, metalurgia,
   vidro, telhas ou ferramentas de pedra/ferro/diamante.
4. **Mundo** — sem cavernas nem minérios no subsolo; neve/areia existem apenas como
   cobertura de superfície; sem The End, Nether ou dimensões.
5. **Sistemas** — sem save/persistência, sem multiplayer, sem efeitos de status,
   sem sons posicionais.
6. **Sobrevivência** — sem camas; o HUD exibe vida e fome (o oxigênio existe
   internamente); o inventário é **preservado** ao morrer (mais gentil que o original).

Detalhes e decisões: [PLAN.md](PLAN.md) (seções "Regras" e "Revisão Geral").

---

## Desenvolvimento

- `npm run check` — roda `node --check` nos módulos principais (sanidade de sintaxe).
- [PLAN.md](PLAN.md) — diário de implementação fase a fase, com testes e bugs corrigidos.
- [prompt.txt](prompt.txt) — prompt original de desenvolvimento (contexto histórico).

## Crédito

Este jogo foi **criado por um agente de IA**: **OpenCode**, rodando o modelo
`qwen3.8:27b` (via Ollama) — **sob a direção, revisão e decisões do usuário, Evandro**.
Cada fase foi implementada e testada pelo agente (baterias de teste no browser com
console limpo), conforme o diário em [PLAN.md](PLAN.md).

## Publicar no GitHub Pages

O repositório já vem com o workflow
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml):

1. Crie um repositório vazio no GitHub (ex.: `minecraft`).
2. Conecte e envie o código:
   ```bash
   git remote add origin https://github.com/EvandroMassini/minecraft.git
   git push -u origin main
   ```
3. No GitHub: **Settings → Pages → Source → `GitHub Actions`**.
4. Aguarde o workflow **"Deploy to GitHub Pages"** ficar verde (aba _Actions_).
5. Jogue em `https://evandromassini.github.io/minecraft/`.

> Como todo o projeto usa caminhos relativos (`./vendor/...`, `css/`, `js/`) e o
> Three.js está vendored, o site funciona em **qualquer subpasta** do Pages —
> inclusive `evandromassini.github.io/minecraft/` — sem nenhum ajuste de configuração.

## Licença

Código sob **GNU AGPL v3.0** — veja [LICENSE](LICENSE).
Projeto independente, sem afiliação com a Mojang ou a Microsoft.
