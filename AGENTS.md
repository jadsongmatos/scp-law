# Murphy Law SCP Game — Agent Guide

## Core Architecture
- **Tech:** React + Vite 8 + Tailwind CSS + Lucide Icons + @base-ui/react@1.4.1.
- **Source of Truth:** `src/game_data.json` defines rooms, interactables, terminal documents, phone contacts.
- **State Management:** In `src/App.tsx`. `localRooms` mirrors `game_data.json` for in-memory updates.
- **Audio Engine:** `src/audio.ts`. Async init. Uses Web Audio API `GainNodes` for category volume (Master, Ambient, SFX, Voice). `rainGainNode` for per-room rain volume; `setRainVolume()` method. Room config: `rain?: { volume: number }` in `src/data.ts` Room interface.
- **Terminal:** `react-xtermjs` fork (local `file:./react-xtermjs`) displays logs, investigative documents. Exports `useXTerm` hook + `XTerm` component. Fork has ESM+CJS dual build (`dist/index.mjs` + `dist/index.js`).
- **SCP UI Components:** `src/components/ui/` — Button, Card, Badge, Toast, Accordion, Tooltip adapted from `scpcn-ui/` (local fork, NOT npm linked). Styles in `src/styles/scp.css`.
- **Dev Inspector:** `src/components/DevInspector.tsx`. Filesystem-style tree of all rooms/interactables. Left-click context menu (create/remove items). Monaco JSON editor (`@monaco-editor/react`) for live-editing selected item. Replaces inventory panel when `devMode=true`.

## High-Signal Facts
- **No Resources:** Murphy Law "preparado". NO money counters, energy bars, hunger mechanics.
- **Deduction Puzzle:** Core "logic puzzle". 5x5 Einstein grid (5 suspects, 5 locations, 5 weapons, 5 motives, 5 times × 5 positions). 18 puzzle hints scattered in physical rooms. NOTE: App's `DEDUCTION_SOLUTION`/labels (German: Gasthof/Volkspolizei/Kommissar) are hand-relabeled and diverge from the generator's labels (Bar Vila Nova/Delegacia/Delegado Mendes) — they describe the same logical solution.
- **Win conditions:** 50% completion = deduction grid resolved correctly (`setGameCompleted(true)`). 100% completion = deduction + player acts following ZD-GTFT-2 (Zero Determinant Generous Tit-for-Tat): cooperates first, never defects when NPC cooperated (CC/DC states → C), retaliates when necessary but forgives. Implemented via `src/lib/axelrod.ts` ZDGTFT2. Compliance check in `calculateGameCompletion()` in `App.tsx`.
- **Puzzle two-JSON pipeline:**
  - **Input:** `puzzle_input.json` (repo root) — generator config: `seed`, `difficulty`, `n_rooms`, `categories`, `room_names`, `puzzle_rooms`. CLI flags override it; missing file → hardcoded defaults in `noir_generator.py`.
  - **Generator:** `scripts/puzzle/noir_generator.py` (OR-Tools CP-SAT; requires `ortools`). `python3 -m scripts.puzzle.noir_generator` reads `puzzle_input.json`. `--output puzzle_output.json` → structured artifact (`categories`/`solution`/structured `hints`/`unique_solution`). `--merge src/game_data.json` → embeds hints/terminals as PT text.
  - **Output (generated):** `puzzle_output.json` (repo root) — the structured generated puzzle.
  - **Solvability test:** `src/lib/puzzleSolver.ts` (independent TS CSP backtracker, semantics mirror `_make_constraint_for_hint`) + `puzzleSolver.test.ts` proves the generated hints entail a UNIQUE solution equal to the declared one (i.e. the case is 100% solvable by deduction).
- **Asset Generation:**
  - **Voices:** Generated via `python3 -m scripts.generate.voices` (uses Fish Audio S2-Pro via local `s2.cpp` HTTP server; migrated from `edge-tts`). Config in `scripts/shared/config.py`. Triggered in `npm run build` if `VITE_VOICE_GEN=1`.
  - **Images:** Generated via `python3 -m scripts.generate.images` (uses Gemini via OpenRouter).
  - **Vision Pipeline (DINOv2):** `scripts/vision/extract_positions.py` — DINOv2-large (ViT-L/14) replaces YOLO. Extracts patch embeddings → DBSCAN clusters semantic regions (cosine metric) → Gemma-4-31b-it classifies in noir game context (PT-BR labels). `KNOWN_ROOMS` maps the 8 actual scene files: `rua_chuva`, `escritorio`, `escola`, `diretoria`, `delegacia`, `beco`, `bar`, `armazem`. `guess_room_id()` strips `bg_` prefix and matches against `KNOWN_ROOMS`. Dependencies: `torch`, `transformers`, `scikit-learn`. Modes: `--mode patches` (clustering only), `--mode cls` (scene similarity via CLS token), `--mode full` (patches + Gemma). `--dry-run` skips Gemma API. `--eps`, `--min-samples` tune DBSCAN. `fix_overlaps.py` uses `scripts/shared/geometry.py` for bounding box math (generic — no per-room hardcoded positions). `merge_extracted.py` merges `extracted_positions.json` into `game_data.json` using `NOIR_ROOMS` dict (no SCP room/keycard/door references).
- **Interaction Types:** Play mode — objects are **invisible** on the scene (no icons, no tooltips, no hover effects). Player must click the scene to discover interactables; left-click OR right-click opens a custom cursor-anchored context menu (a `fixed`-positioned div + `window` click/Escape close, same proven pattern as `DevInspector`'s context menu — NOT `@base-ui/react` Menu, which proved too fragile over the scene overlays/portals). State `objMenu` in `App.tsx`; menu rendered once after the interactables map. `▸ Interagir` performs the action below; each inventory item is an entry that tries to use that item on the object. **Dev mode** shows all icons, labels, drag handles; play mode hides them entirely (discovery mechanic).
  - `inspect`: Pure description.
  - `pickup`: Adds item to inventory.
  - `travel`: Moves to `targetRoom`.
  - `terminal_read`: Opens document in xterm.
  - `phone_call`: Starts phone/carta dialogue or opens agenda.
- **Item-Use / Locks:** Objects with `requiredItem` are gated. Pure decision fn `resolveItemUse` in `src/lib/itemUse.ts` (vitest-tested): correct item → `successMessage` + action + **permanent unlock**; wrong item or `▸ Interagir` on a still-locked object → `failedMessage`; free or already-unlocked object + item → "não serve aqui". Unlock persists per session only (in-memory `unlockedObjects` Set in `App.tsx`; no save). `chave_escritorio` removed from the game — `porta_escritorio` is now a free door.
- **Phone System:** 7 contacts (5 originais + Padre Miguel + Wohltat) with Dilema do Prisioneiro (PD) dialogue trees. Each contact has `axelrodStrategy` defining personality. Choices: Cooperar (C), Trair (D), Encerrar (E). PD cutoff permanently blocks contact.
- **PD Algorithm Support:** App.tsx now handles 3 additional algorithms: `EugineNier` (cooperates first, mirrors, cuts after 5 traições), `HardProber` (D,D,C,C probe then permanent D if player cooperated in rounds 2&3, else TFT), `SneakyTitForTat` (cooperates 2 rounds, sneaks D, repents if punished, never truly cuts off). Implemented in `src/lib/eugineNier.ts`, `src/lib/hardProber.ts`, `src/lib/axelrod.ts`.
- **Dialogue Visual Styles:** Two distinct CSS class families in `src/styles/scp.css` (lines ~914-1164):
  - **Carta (WhatsApp-terminal):** `.dlg-carta-*` — amber phosphor CRT scanline overlay (`::before`/`::after` pseudo-elements), left-aligned received bubbles, right-aligned player-choice bubbles, CRT flicker animation. Cassette playback reuses this style.
  - **Telefone (Radio transmitter):** `.dlg-radio-*` — frequency bar, signal bars, static noise backdrop, wave animation, flicker effect, german status labels (`SICHERHEITSKANAL`, `VERBUNDEN`, `GETRENNT`), `TRANSMITIR:` action buttons.
  - All dialogue CSS includes `prefers-reduced-motion` fallbacks (animations disabled, flicker removed).
- **Cassette System:** Gravador cassete records all phone/letter conversations. Murphy commentary per dialogue node. Accessible via FITA CASSETE button in sidebar (dedicated modal, not inside agenda). Gravador is a permanent tool — always in inventory, no map object. Status bar labels: `KASSETTE` / `ABGESPIELT`.
- **Protagonist Items:** `isqueiro` and `gravador_cassete` start in inventory. `isqueiro` map object is `type:"inspect"` only (not collectible). `gravador_cassete` has NO map object — it's a permanent tool with its own sidebar button + modal.

## Developer Commands
- `npm run dev`: Local dev server (port 3000).
- `npm run lint`: Typecheck using `tsc --noEmit`.
- `npm test`: Run vitest unit tests (pure logic only, e.g. `src/lib/itemUse.test.ts`, 5 suites / 35 tests). `npm run test:watch` for watch mode. Config: `vitest.config.ts` (node env, isolated — no game Vite plugins).
- `npm run build`: Build production. Triggers voice generation if `VITE_VOICE_GEN=1`.
- `npm run build:novoice`: Build production without voice generation.
- `python3 -m scripts.generate.voices`: Update voices after changing `game_data.json` (requires Fish Audio S2-Pro via local `s2.cpp` server).
- `python3 -m scripts.vision.extract_positions src/assets/images/noir/*.png --mode full`: Extract interactable positions via DINOv2 + Gemma (requires `torch`, `transformers`, `scikit-learn`, `OPENROUTER_API_KEY`).
- `python3 -m pytest scripts/shared/geometry_test.py -v`: Run geometry bounding-box unit tests (28 tests).
- `python3 -m scripts.data.merge_extracted`: Merge `extracted_positions.json` into `src/game_data.json` (adds DINOv2-detected interactables to existing room data).
- `python3 -m scripts.data.fix_overlaps`: Fix cross-room duplicate IDs, assign hitboxes, clamp bounds, verify no overlaps in `game_data.json`.
- `cd react-xtermjs && npm test`: Run fork Jest tests (22 tests, 4 suites).

## Conventions & Style
- **Tone:** Noir meta-narrative (Film Noir aesthetic, high contrast, amber/black). Labels/descriptions in PT-BR with intentional German lore terms (Lagerhaus, Volkspolizei, Privatermittler, GESCHLOSSEN). All player-facing text must be in Portuguese; German terms are lore-specific only. Fictional country: Germany+US+failed Soviet.
- **Icons:** Use `lucide-react`. Mapping in `src/Icons.tsx`.
- **Data Bridge:** `src/data.ts` merges `game_data.json` with static image imports.
- **Secrets:** `GEMINI_API_KEY` required in `.env.local` for build-time injection.
- **Persistence:** Game state in-memory only. NO LocalStorage save/load.
- **react-xtermjs fork:** Local fork at `react-xtermjs/` with own git history. PeerDep `@xterm/xterm@^6.0.0`. Dual ESM+CJS build. 22 Jest tests. After modifying fork source, run `cd react-xtermjs && npm run build` to rebuild dist before building main game.
- **tsconfig exclude:** Main game `tsconfig.json` excludes `react-xtermjs/tests`, `react-xtermjs/example`, `scpcn-ui/`, `s2.cpp/`, and `s2-models/` to prevent typecheck pollution.
- **SCP CSS prefix:** `scp-` classes. Font class: `.institutional` uses game fonts (JetBrains Mono/Playfair Display). Loaded globally via `main.tsx` → `import './styles/scp.css'`.
- **SCP Classification mapping:** default→safe, human→euclid, orc→keter, elf→thaumiel, undead→apollyon.
- **SCP Foundation meta-lore:** Maria Kraft procurou a Fundação SCP, mas a burocracia atrasou. Uma amiga de Murphy (Agente Stern) pediu a ele pessoalmente. Ele não aceitou dinheiro — fez por amizade e pela criança. A Fundação depois designou Stern como contato/avaliadora oficial.
- **Tooltip variant by interactable type:** pickup→safe, travel→euclid, terminal_read→keter, phone_call→thaumiel.
- **Badge classification for events:** pickup=safe, denied=keter, contact=euclid, deduction-correct=safe, deduction-incomplete=euclid, deduction-wrong=keter.
- **Toast classification by event:** same as badge above.
- **Phone choice design:** Exactly 3 options per node — Cooperar (C), Trair (D), Encerrar (E). NO `hint` field on choices. NO PISTA badge inline.
- **NPC axelrod strategy mapping (by tournament score, no repeats):** Dra. Cunha=SoftGrudger (rank 0, score 2.73), Santos=SneakyTitForTat (rank 1, score 2.67), Zeca=TitForTat (rank 2, score 2.63), Elvira=Forgiver (rank 3, score 2.62), Seu Jonas=WinStayLoseShift (rank 4, score 2.36). Padre Miguel=EugineNier (colaborador). Wohltat=HardProber (vilão).
- **PD cutoff rules:** Only `pdAction === 'D'` at terminal node triggers cutoff. Grudger/TitForTat/HardProber = always cut. SneakyTitForTat = never cuts. EugineNier = cut after 5 player defections. SoftGrudger = cut after 3 player defections. WinStayLoseShift = shifts stance (no permanent cutoff). Forgiver = almost never cuts (10% forgive rate).
- **Encerrar (E) never causes PD cutoff.**
- **Phone restrictions:** Telefone only works from escritório. Carta Seu Jonas works from any room.
- **Farmacia:** `type:"inspect"` (porta fechada GESCHLOSSEN) — not a relevant room.
- **Deploy:** Cloudflare Pages via `npx wrangler pages deploy dist/ --project-name=scp-law`. Project: `scp-law.pages.dev`. No `wrangler.toml` needed for static deploys.
- **Component imports:** Use `@base-ui/react@^1.4.1` (NOT Radix UI). scp.css loaded globally — NO inline CSS imports in adapted components.

## Agent Behavior Rules
- **Never remove/exclude files from deploy without asking user first.** File exceeds platform limits (e.g., Cloudflare Pages 25 MiB limit)? Stop, ask user. NO silent skip/delete.
- **Never use `/tmp` for file operations.** Use project directory for temp work.
- **Always ask user before audio/video processing parameters** (e.g., bitrate, channels, codec, duration cuts). NO assumed settings. Propose options, let user choose.
- **Disciplina Lógica Operacional** (`disciplina-logica-operacional`): Código segue método:
  - **Silogismo da tarefa:** Alteração requer convenção base + pedido explícito. Faltou um? Não faça. Evite: consequência cruel, escopo fantasma, dependência clandestina, estilo imperial.
  - **Código local como verdade primária:** Ler implementação real, testes, comportamento rodando antes de editar.
  - **Verificação empírica (TDD):** Red → Green → Refactor. NO conclusão sem teste.
  - **Incrementos atômicos:** 1 lógica por commit. NO estado quebrado. NO código de exploração.
  - **Refatoração disciplinada:** Apenas escopo da tarefa. Problemas fora = dívida técnica.
  - **Dependências sob autorização:** NO adicionar sem autorização explícita. Justificar stdlib falha, impacto técnico, licença.
  - **Segurança por padrão:** Validar entrada externa, queries parametrizadas. NO secrets em código/logs. Timeout/retry/backoff rede.
  - **Comunicação proativa com o Navegador:** Informar complexidade > estimativa, trade-off arquitetural, bug bloqueante, risco segurança, quebra convenção. Formato: IMPACTO → OPÇÕES → RECOMENDAÇÃO.
