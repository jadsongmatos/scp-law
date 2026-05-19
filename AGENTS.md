# Murphy Law SCP Game — Agent Guide

## Core Architecture
- **Tech:** React + Vite 8 + Tailwind CSS + Lucide Icons + @base-ui/react@1.4.1.
- **Source of Truth:** `src/game_data.json` defines rooms, interactables, terminal documents, phone contacts.
- **State Management:** In `src/App.tsx`. `localRooms` mirrors `game_data.json` for in-memory updates.
- **Audio Engine:** `src/audio.ts`. Uses Web Audio API `GainNodes` for category volume (Master, Ambient, SFX, Voice).
- **Terminal:** `react-xtermjs` fork (local `file:./react-xtermjs`) displays logs, investigative documents. Exports `useXTerm` hook + `XTerm` component. Fork has ESM+CJS dual build (`dist/index.mjs` + `dist/index.js`).
- **SCP UI Components:** `src/components/ui/` — Button, Card, Badge, Toast, Accordion, Tooltip adapted from `scpcn-ui/` (local fork, NOT npm linked). Styles in `src/styles/scp.css`.
- **Dev Inspector:** `src/components/DevInspector.tsx`. Filesystem-style tree of all rooms/interactables. Left-click context menu (create/remove items). Monaco JSON editor (`@monaco-editor/react`) for live-editing selected item. Replaces inventory panel when `devMode=true`.

## High-Signal Facts
- **No Resources:** Murphy Law "preparado". NO money counters, energy bars, hunger mechanics.
- **Deduction Puzzle:** Core "logic puzzle". Win condition (`App.tsx:1378`): player's `deductionGrid` must exactly equal hardcoded `DEDUCTION_SOLUTION` → `setGameCompleted(true)`. 5x5 Einstein grid (5 suspects, 5 locations, 5 weapons, 5 motives, 5 times × 5 positions). 18 puzzle hints scattered in physical rooms. NOTE: App's `DEDUCTION_SOLUTION`/labels (German: Gasthof/Volkspolizei/Kommissar) are hand-relabeled and diverge from the generator's labels (Bar Vila Nova/Delegacia/Delegado Mendes) — they describe the same logical solution.
- **Puzzle two-JSON pipeline:**
  - **Input:** `puzzle_input.json` (repo root) — generator config: `seed`, `difficulty`, `n_rooms`, `categories`, `room_names`, `puzzle_rooms`. CLI flags override it; missing file → hardcoded defaults in `noir_generator.py`.
  - **Generator:** `scripts/puzzle/noir_generator.py` (OR-Tools CP-SAT; requires `ortools`). `python3 -m scripts.puzzle.noir_generator` reads `puzzle_input.json`. `--output puzzle_output.json` → structured artifact (`categories`/`solution`/structured `hints`/`unique_solution`). `--merge src/game_data.json` → embeds hints/terminals as PT text.
  - **Output (generated):** `puzzle_output.json` (repo root) — the structured generated puzzle.
  - **Solvability test:** `src/lib/puzzleSolver.ts` (independent TS CSP backtracker, semantics mirror `_make_constraint_for_hint`) + `puzzleSolver.test.ts` proves the generated hints entail a UNIQUE solution equal to the declared one (i.e. the case is 100% solvable by deduction).
- **Asset Generation:**
  - **Voices:** Generated via `python3 generate_voices.py` (uses `edge-tts`). Triggered in `npm run build` if `VITE_VOICE_GEN=1`.
  - **Images:** Generated via `python3 generate_noir_images.py` (uses Gemini via OpenRouter).
- **Interaction Types:** Play mode — left-click OR right-click ANY object opens a custom cursor-anchored context menu (a `fixed`-positioned div + `window` click/Escape close, same proven pattern as `DevInspector`'s context menu — NOT `@base-ui/react` Menu, which proved too fragile over the scene overlays/portals). State `objMenu` in `App.tsx`; menu rendered once after the interactables map. `▸ Interagir` performs the action below; each inventory item is an entry that tries to use that item on the object. Dev mode bypasses the menu (drag + click-to-select).
  - `inspect`: Pure description.
  - `pickup`: Adds item to inventory.
  - `travel`: Moves to `targetRoom`.
  - `terminal_read`: Opens document in xterm.
  - `phone_call`: Starts phone/carta dialogue or opens agenda.
- **Item-Use / Locks:** Objects with `requiredItem` are gated. Pure decision fn `resolveItemUse` in `src/lib/itemUse.ts` (vitest-tested): correct item → `successMessage` + action + **permanent unlock**; wrong item or `▸ Interagir` on a still-locked object → `failedMessage`; free or already-unlocked object + item → "não serve aqui". Unlock persists per session only (in-memory `unlockedObjects` Set in `App.tsx`; no save). `chave_escritorio` removed from the game — `porta_escritorio` is now a free door.
- **Phone System:** 5 contacts with Dilema do Prisioneiro (PD) dialogue trees. Each contact has `axelrodStrategy` defining personality. Choices: Cooperar (C), Trair (D), Encerrar (E). PD cutoff permanently blocks contact.
- **Cassette System:** Gravador cassete records all phone/letter conversations. Murphy commentary per dialogue node. Accessible via FITA CASSETE button in sidebar (dedicated modal, not inside agenda). Gravador is a permanent tool — always in inventory, no map object.
- **Protagonist Items:** `isqueiro` and `gravador_cassete` start in inventory. `isqueiro` map object is `type:"inspect"` only (not collectible). `gravador_cassete` has NO map object — it's a permanent tool with its own sidebar button + modal.

## Developer Commands
- `npm run dev`: Local dev server (port 3000).
- `npm run lint`: Typecheck using `tsc --noEmit`.
- `npm test`: Run vitest unit tests (pure logic only, e.g. `src/lib/itemUse.test.ts`). `npm run test:watch` for watch mode. Config: `vitest.config.ts` (node env, isolated — no game Vite plugins).
- `npm run build`: Build production. Triggers voice generation if `VITE_VOICE_GEN=1`.
- `npm run build:novoice`: Build production without voice generation.
- `python3 generate_voices.py`: Update voices after changing `game_data.json` (requires `edge-tts`).
- `cd react-xtermjs && npm test`: Run fork Jest tests (22 tests, 4 suites).

## Conventions & Style
- **Tone:** Noir meta-narrative (Film Noir aesthetic, high contrast, amber/black). Labels/descriptions in PT-BR with DE/EN/PT mix (Lagerhaus, Volkspolizei, Privatermittler). Fictional country: Germany+US+failed Soviet.
- **Icons:** Use `lucide-react`. Mapping in `src/Icons.tsx`.
- **Data Bridge:** `src/data.ts` merges `game_data.json` with static image imports.
- **Secrets:** `GEMINI_API_KEY` required in `.env.local` for build-time injection.
- **Persistence:** Game state in-memory only. NO LocalStorage save/load.
- **react-xtermjs fork:** Local fork at `react-xtermjs/` with own git history. PeerDep `@xterm/xterm@^6.0.0`. Dual ESM+CJS build. 22 Jest tests. After modifying fork source, run `cd react-xtermjs && npm run build` to rebuild dist before building main game.
- **tsconfig exclude:** Main game `tsconfig.json` excludes `react-xtermjs/tests`, `react-xtermjs/example`, and `scpcn-ui/` to prevent typecheck pollution.
- **SCP CSS prefix:** `scp-` classes. Font class: `.institutional` uses game fonts (JetBrains Mono/Playfair Display). Loaded globally via `main.tsx` → `import './styles/scp.css'`.
- **SCP classification mapping:** default→safe, human→euclid, orc→keter, elf→thaumiel, undead→apollyon.
- **Tooltip variant by interactable type:** pickup→safe, travel→euclid, terminal_read→keter, phone_call→thaumiel.
- **Badge classification for events:** pickup=safe, denied=keter, contact=euclid, deduction-correct=safe, deduction-incomplete=euclid, deduction-wrong=keter.
- **Toast classification by event:** same as badge above.
- **Phone choice design:** Exactly 3 options per node — Cooperar (C), Trair (D), Encerrar (E). NO `hint` field on choices. NO PISTA badge inline.
- **NPC axelrod strategy mapping (by tournament score, no repeats):** Dra. Cunha=SoftGrudger (rank 0, score 2.73), Santos=Grudger (rank 1, score 2.67), Zeca=TitForTat (rank 2, score 2.63), Elvira=Forgiver (rank 3, score 2.62), Seu Jonas=WinStayLoseShift (rank 4, score 2.36).
- **PD cutoff rules:** Only `pdAction === 'D'` at terminal node triggers cutoff. Grudger/TitForTat = always cut. SoftGrudger = cut after 3 player defections. WinStayLoseShift = shifts stance (no permanent cutoff). Forgiver = almost never cuts (10% forgive rate).
- **Encerrar (E) never causes PD cutoff.**
- **Phone restrictions:** Telefone only works from escritório. Carta Seu Jonas works from any room.
- **Farmacia:** `type:"inspect"` (porta fechada GESCHLOSSEN) — not a relevant room.
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
