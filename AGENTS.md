# Repository Guidelines

Guidelines for AI coding assistants working on **Murphy Law — Investigações Privadas** — a film-noir detective game with SCP Foundation meta-lore, deployed at `scp-law.pages.dev`. All facts below were verified against the current code; older AGENTS.md copies under `scratch/` are outdated — do not consult them.

## Project Overview

- **Stack:** React 19 + Vite 8 + TypeScript + Tailwind v4 SPA. No router, no SSR — the entire game renders from `src/App.tsx` (~1680 lines).
- **Core loop:** explore 12 rooms, click-to-discover **invisible** interactables (106 total: 39 `terminal_read`, 31 `inspect`, 23 `travel`, 9 `phone_call`, 4 `pickup`), collect hints, pin clues on the investigation mural (cork board with red threads, `src/components/board/MuralOverlay.tsx`), solve a 5×5 Einstein deduction grid (`src/components/DetectiveBoard.tsx`), and negotiate Iterated Prisoner's Dilemma (PD) dialogues with 9 contacts.
- **Win conditions** (`calculateGameCompletion()`, `src/App.tsx:148`): 50% = deduction grid correct. 100% = additionally play as ZD-GTFT-2 (Zero-Determinant Generous Tit-for-Tat, `src/lib/axelrod.ts`): cooperate first, never defect against cooperation, retaliate-but-forgive. Compliance is computed by replaying each contact's `pdChoiceHistory` against its `axelrodStrategy`.
- **No survival mechanics** — Murphy is "preparado": no money, energy, or hunger.
- **Language:** ALL user-facing text in PT-BR; German terms (Gasthof, Lagerhaus, Volkspolizei, GESCHLOSSEN) are intentional lore only. Never English in user-facing strings or image prompts. Setting: fictional country mixing Germany, USA, and a failed Soviet state.

## Architecture & Data Flow

**Entry:** `index.html` → `src/main.tsx` (imports `index.css` + `styles/scp.css` + `styles/board.css`) → `App.tsx`.

**State = XState v5 (not useState):** `src/state/gameMachine.ts` exports `gameMachine` (id `detetive`, initial `exploring`) with 20 context fields (`currentRoomId`, `inventory`, `pdChoiceHistory`, `pdCutoffContacts`, `deductionGrid`, `mural`, `unlockedObjects`, `localRooms`, `gameCompleted`, `diretoraPhoneUnlocked`, …) and 21 events (`MOVE_ROOM`, `PICKUP_ITEM`, `START_PHONE_CALL`, `RECORD_PD_ACTION`, `SET_DEDUCTION_RESULT`, `UPDATE_MURAL`, `UNLOCK_DIRETORA_PHONE`, `RESTORE_STATE`, …). `App.tsx:29`: `const [snapshot, send] = useMachine(gameMachine)` — game state is `snapshot.context`; UI-only state (modals, xterm, `objMenu`) stays local in App.tsx. Persistence: `localStorage` under `SAVE_KEY = 'scp_law_save'`; auto-save effect keyed on ~20 context fields — the first write is skipped when restoring a save (the first commit's snapshot predates `RESTORE_STATE`; writing it would clobber the save — see `firstSaveSkipRef`); load dispatches `RESTORE_STATE`.

**Data flow:** `src/game_data.json` (source of truth: `GAME_ROOMS` ×12, `ITEM_NAMES`, `PHONE_CONTACTS` ×9, `_interviewClueMap`) → `src/data.ts` (typed exports + static image imports) → machine context `localRooms` (in-memory mirror mutated during play).

**Puzzle pipeline:**

1. `puzzle_input.json` (seed, difficulty, n_rooms, categories, room_names, puzzle_rooms — CLI flags override) →
2. `scripts/puzzle/noir_generator.py` (OR-Tools CP-SAT): `--output puzzle_output.json` (structured artifact), `--merge src/game_data.json` embeds PT-BR hints/terminals →
3. Solvability proof at test time: `src/lib/gameDataPuzzle.ts` parses the puzzle embedded in the shipped `game_data.json` (18 `puzzle_hint_*` + 5 `interview_clue_*` constraints) → `src/lib/puzzleSolver.ts` (independent CSP backtracker) proves a UNIQUE solution equal to the envelope (`puzzle_solution_terminal`) and to App.tsx's `DEDUCTION_SOLUTION`.
- `App.tsx`'s `DEDUCTION_SOLUTION`/`DEDUCTION_LOCATIONS` use hand-relabeled German values (Kommissar Mendes, Gasthof Vila Nova, Volksschule, Volkspolizeistation 8º; categories `suspeito`/`local_crime`/`arma`/`motivo`/`horario`) — the same logical solution as the generator's labels.

**PD engine:** strategies in `src/lib/` — `axelrod.ts` (ZDGTFT2, TitForTat, Grudger, SoftGrudger, Forgiver, WinStayLoseShift, SneakyTitForTat, RandomStrategy), `eugineNier.ts`, `hardProber.ts`. All randomness is seeded: `mulberry32(42)` = `rng42` (`src/lib/rng.ts`) — identical action sequences give identical outcomes. Exactly 3 choices per PD node: Cooperar (C), Trair (D), Encerrar (E). Only a `D` at a terminal node can trigger `CUT_OFF_CONTACT` (permanent; thresholds are strategy-specific — see the `isCutoff` computation in App.tsx ~:1110-1140); **E never cuts**.

Current contact→strategy mapping (authoritative: `PHONE_CONTACTS[*].axelrodStrategy` in `game_data.json`):

| id | name | strategy | access |
|---|---|---|---|
| `diretora_elvira` | Diretora Elvira Campos | Forgiver | presencial na diretoria; telefone só após `diretoraPhoneUnlocked` |
| `santos` | Polizist Santos | SneakyTitForTat | telefone |
| `zeca` | Zeca do Gasthof | TitForTat | telefone |
| `seu_jonas` | Seu Jonas | WinStayLoseShift | carta (beco) |
| `dra_cunha` | Dra. Cunha | SoftGrudger | hospital (presencial) |
| `padre_miguel` | Padre Miguel | EugineNier | igreja (presencial) |
| `wohltat` | Wohltat | HardProber | telefone (vilão) |
| `agente_scp` | Agente Stern | Forgiver | telefone (Fundação SCP) |
| `fazendeiro` | Caseiro da Fazenda | WinStayLoseShift | fazenda (presencial) |

**Services:** `src/audio.ts` `SoundEngine` — Web Audio with category `GainNode`s (master/ambient/sfx/voice), per-room rain via `HTMLAudioElement` + `rainGainNode`/`setRainVolume()` (`rain?: {volume:number}` in `data.ts` `Room`). `src/useXTerm.ts` wraps npm `@xterm/xterm@^6` + `@xterm/addon-fit` (NOT the react-xtermjs fork).

**Item-use/locks:** pure fn `resolveItemUse` (`src/lib/itemUse.ts`, vitest-tested): correct `requiredItem` → `successMessage` + action + permanent `UNLOCK_OBJECT`; wrong item or still-locked interact → `failedMessage`; free/unlocked object + item → "não serve aqui". Locked objects today: `escola_fachada` (cartao_visita), `porta_armazem` (fotografia), `gaveta_diretora` + `porta_aco` (isqueiro), `terminal_fosforo` + `porta_armazem_beco` + `terminal_final` (fita_magnetica), `arquivo_mendes` + `puzzle_solution_terminal` (cedula_500). `PERMANENT_ITEMS = ['isqueiro', 'gravador_cassete']`; the cassette recorder (records all dialogues; own sidebar button + modal) has no map object.

**Discovery mechanic:** in play mode interactables are invisible (no icons/tooltips/hover). Clicking the scene opens a cursor-anchored context menu (`fixed` div + `window` click/Escape close; `src/lib/useMenuPosition.ts`; `objMenu` state). Do NOT use `@base-ui/react` Menu for this. Dev mode (`devMode`) shows all icons/labels/drag handles and replaces inventory with `src/components/DevInspector.tsx` (Monaco JSON live editor, room/interactable tree, context-menu create/remove).

**Gating rules (verified examples):** telefone/agenda only from `escritorio` (App.tsx:640, 1023); `escola_fachada` also requires visiting `casa_mae` first (App.tsx:484); Diretora Elvira's number unlocks only via the cooperative path to node `de_confirma` (App.tsx:1217). The `detective_board` interactable (escritório, `inspect`) opens the MuralOverlay; `puzzle_deduction_terminal` keeps the 5×5 grid.

## Key Directories

| Path | Purpose |
|---|---|
| `src/` | Game SPA — `App.tsx` (all flows + rendering), `state/`, `lib/`, `components/`, `styles/`, `assets/images/noir/` (`bg_*.png`, `maps/`, `items/`) |
| `src/components/ui/` | 20 primitive files adapted from `scpcn-ui` (button, card, badge, toast, dialog, tooltip, accordion, …); `toast.tsx` uses `sonner` + `motion/react` |
| `src/lib/` | Pure logic with colocated vitest: `axelrod`, `eugineNier`, `hardProber`, `rng`, `itemUse`, `puzzleSolver`, `gameDataPuzzle`, `useMenuPosition`, `utils` |
| `scripts/generate/` | `voices.py` (s2.cpp TTS), `images.py` (9Router), `dialogue_graph.py` (prebuild → `doc_dialogos.dot`), `images_csv.py`, `images_edit_csv.py`, `maps_*.py` (NVIDIA Flux) |
| `scripts/puzzle/` | `noir_generator.py` (CP-SAT), `interview.py` (axelrod-python PD engine: `simulate`/`tournament`/`validate`/`generate-clue-map`/`merge-interview-clues`) |
| `scripts/vision/` | `extract_positions.py` (DINOv2 + Gemma) |
| `scripts/audit/` | `dialogue_audit.py` (CP-SAT dialogue auditor), `backgrounds.py`, `signage.py` (vision audits) |
| `scripts/data/` | `fix_overlaps.py`, `merge_extracted.py` (generic bbox math in `shared/geometry.py`) |
| `scripts/shared/` | `config.py` (paths/models/env), `geometry.py` + `geometry_test.py`, `openrouter.py`, `ninerouter.py`, `nvidia*.py`, `ipv4_fix.py` |
| `public/voice/` | Generated MP3s (checkpoint `_done.json`; `voice.backup/`) |
| `scpcn-ui/` | **git submodule** — upstream UI primitives; tsconfig-excluded |
| `react-xtermjs/` | Legacy standalone fork (own git repo; NOT a dependency, NOT a submodule). Never `git add` without `.gitmodules` (gitlink breaks) |
| `s2.cpp/`, `s2-models/` | Fish Audio S2-Pro TTS engine + GGUF models (gitignored, ~3.5 GB) |
| `docs/`, `scratch/` | Dated plans/logs; scratch is gitignored |

## Development Commands

| Command | Effect |
|---|---|
| `npm run dev` | Vite dev server, port 3000, host 0.0.0.0 (set `DISABLE_HMR=true` to disable HMR) |
| `npm run lint` | `tsc --noEmit` — typecheck ONLY (no ESLint/Prettier/Biome exists) |
| `npm test` / `npm run test:watch` | vitest run / watch (node env, `src/**/*.test.ts`) |
| `npm run build` | prebuild regenerates `doc_dialogos.dot`, then `VITE_VOICE_GEN=1 vite build` — voice gen is **always attempted**; failures are warn-and-continue (plugin timeout 300 s) |
| `npm run build:novoice` | prebuild + `vite build`, no voice gen |
| `npm run preview` / `npm run clean` | `vite preview` / `rm -rf dist` |
| `npm run generate:voices` | `python3 -m scripts.generate.voices` — s2.cpp wav → ffmpeg mp3 into `public/voice/`; `--force` ignores checkpoint |
| `npm run generate:images` | `python3 -m scripts.generate.images` — 9Router; `--missing-only` |
| `npm run audit:backgrounds` / `audit:signage` | Vision audits of room art / sign text (OpenRouter gemini-2.5-flash) |
| `npm run fix:overlaps` / `merge:extracted` | game_data hitbox assignment/clamp/dedupe; merge `extracted_positions.json` |
| `npm run extract:positions` | `python3 -m scripts.vision.extract_positions <images> --mode full` |
| `.venv/bin/python -m scripts.puzzle.noir_generator --merge src/game_data.json` | Generate + embed puzzle (`--seed`, `--difficulty easy\|medium\|hard`, `--output`, `--dry-run`) |
| `.venv/bin/python scripts/audit/dialogue_audit.py` | CP-SAT audit of dialogue trees (all 9 contacts must be ✓) |
| `.venv/bin/python -m scripts.puzzle.interview validate` | Validate game_data.json against PD schema (also `simulate`, `tournament`, `merge-interview-clues`) |
| `.venv/bin/python -m pytest scripts/shared/geometry_test.py -v` | 28 geometry tests |
| `npx playwright test` | E2E critical path (`playwright.config.ts` auto-starts dev server on :3000; once: `npx playwright install chromium`) |
| `npx wrangler pages deploy dist/ --project-name=scp-law` | Manual deploy (static; no wrangler.toml) |

Notes: `build` uses POSIX inline-env syntax (breaks on Windows cmd). npm pre-hooks auto-run `dialogue_graph.py` before both build variants. No CI exists (`.github/` absent at root). Python tooling runs in the project venv (system python3 has no pip): `python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt`.

## Code Conventions & Common Patterns

- **TypeScript:** non-strict tsconfig, ES2022, `moduleResolution: bundler`, `@/*` → `src/*` alias (duplicated in vite.config, vitest.config, tsconfig). Typecheck excludes: `scpcn-ui`, `s2.cpp`, `s2-models`, `react-xtermjs/tests`, `react-xtermjs/example`, `scratch`, `interactive-detective-board-development` (protótipo standalone com tsconfig próprio).
- **Styling:** Tailwind v4 CSS-first — `src/index.css` = `@import "tailwindcss"` + `@theme` noir palette (no tailwind.config, no PostCSS config). Fonts: JetBrains Mono + Playfair Display. Component/scene CSS in `src/styles/scp.css`: `scp-` prefix, `.institutional` font class, two dialogue families — `.dlg-carta-*` (carta/cassette: amber phosphor CRT) and `.dlg-radio-*` (telefone: radio transmitter) — both with `prefers-reduced-motion` fallbacks.
- **UI stack:** `@base-ui/react` (NOT Radix), `class-variance-authority` + `cn()` helper (`clsx` + `tailwind-merge`, `src/lib/utils.ts`), `sonner` `<Toaster>`, `motion/react`, `lucide-react` via `IconMap` in `src/Icons.tsx`.
- **SCP severity classes** color badges/tooltips/toasts: pickup=safe, denied=keter, contact=euclid (cutoff=keter, called=safe), deduction-correct=safe, deduction-incomplete=euclid, deduction-wrong=keter; tooltip variant by interactable type: pickup=safe, travel=euclid, terminal_read=keter, phone_call=thaumiel.
- **Logic rule:** game decisions are pure functions/classes in `src/lib/*.ts` with colocated `*.test.ts`; `App.tsx` only wires them to UI. All randomness via seeded `rng42` — never `Math.random()`.
- **Data-edit workflow:** edit `src/game_data.json` (or regenerate via scripts) → `npm run fix:overlaps` → `python3 scripts/audit/dialogue_audit.py` → `npm test` (`gameDataPuzzle.test.ts` fails if hints stop entailing the unique solution). `doc_dialogos.dot` regenerates on next build.
- **PD dialogue data:** exactly 3 choices per node (C/D/E), no `hint` field on choices, no PISTA badges inline.

## Important Files

- **Entry/config:** `index.html` (`lang="pt-BR"`), `src/main.tsx`, `package.json`, `vite.config.ts` (plugin order: `voiceGenPlugin()` → `react()` → `tailwindcss()`; `@` alias; manualChunks), `vitest.config.ts`, `playwright.config.ts`, `tsconfig.json`, `.env.example`, `.gitmodules`, `.gitignore`
- **Core:** `src/App.tsx`, `src/state/gameMachine.ts`, `src/data.ts`, `src/game_data.json` (137 KB source of truth)
- **UI:** `src/components/DetectiveBoard.tsx`, `src/components/board/` (mural: `MuralOverlay`, `Board`, `Inspector`, `ClueEditor`, `Modal`, pure data layer in `data.ts`), `src/components/DevInspector.tsx`, `src/components/ui/*`, `src/styles/scp.css`, `src/styles/board.css`, `src/Icons.tsx`
- **Services:** `src/audio.ts`, `src/useXTerm.ts`
- **Puzzle artifacts:** `puzzle_input.json`, `puzzle_output.json`, `doc_dialogos.dot` (generated, gitignored), `extracted_positions.json`
- **E2E:** `playwright.config.ts` (root; `webServer` auto-starts `npm run dev` on :3000; chromium project) + `e2e_critical_path.spec.ts` (BASE hardcoded inside the spec)

## Runtime/Tooling Preferences

- **Node + npm only.** Root `package-lock.json` (lockfileVersion 3); no `engines`/`packageManager` declared — effective floor is Vite 8's `^20.19.0 || >=22.12.0`. Do not introduce bun/pnpm/yarn.
- **Python 3** for `scripts/`, via project venv (gitignored `.venv/`; system python has NO pip): `python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt`. Deps: `requests`, `Pillow`, `ortools` (puzzle + audit), `pytest` (geometry); optional: `axelrod` (interview.py), `torch` + `transformers` + `scikit-learn` (vision — `requirements-vision.txt`). Voices also need system binaries: ffmpeg + built `s2.cpp/tmp/s2`.
- **Voice TTS:** local `s2.cpp/tmp/s2` binary + `s2-models/*.gguf` (Fish Audio S2-Pro), invoked as a subprocess (`LD_LIBRARY_PATH=s2.cpp/tmp`), wav → mp3 via ffmpeg.
- **Image generation:** local 9Router HTTP gateway (default `http://localhost:20128`), model `ag/gemini-3.1-flash-image` — not google-genai.
- **Vision:** `facebook/dinov2-large` patch embeddings → DBSCAN → `google/gemma-4-31b-it` via OpenRouter. `KNOWN_ROOMS` in `extract_positions.py` covers only the original 8 scenes; `merge_extracted.py`'s `NOIR_ROOMS` covers all 12 rooms.
- **Env vars (where read):** `VITE_VOICE_GEN` (vite.config.ts), `DISABLE_HMR` (vite.config.ts), `OPENROUTER_API_KEY` (shared/config.py; required for `--mode full`), `NINEROUTER_API_URL`/`NINEROUTER_API_KEY`/`NINEROUTER_IMAGE_MODEL` (shared/ninerouter.py), `NVIDIA_API_KEY` (scripts/generate/maps_*.py), `CLOUDFLARE_API_TOKEN` (wrangler; lives in root `.env`). Dead: `GEMINI_API_KEY` (read in config.py, consumed by nothing), `APP_URL` (.env.example boilerplate).
- **Secrets:** root `.env` (gitignored) holds live tokens — never quote values, never commit. `.env.local` does not exist; `README.md` documents the real setup (prerequisites, commands, env, deploy).

## Testing & QA

- **Vitest** (`npm test`): 12 files / 104 tests, node env, `src/**/*.test.ts` only, deliberately loads NO Vite plugins (isolated from the game build). Pure logic only — no jsdom/@testing-library, no component tests. Compile gate is `npm run lint` (tsc).
- **Must-stay-green:** `src/lib/gameDataPuzzle.test.ts` — shipped `game_data.json` hints must entail a unique solution matching both the `puzzle_solution_terminal` envelope and App.tsx `DEDUCTION_SOLUTION`. Run after ANY puzzle/dialogue data change.
- Other suites: `axelrod`/`zdgtft`/`eugineNier`/`hardProber` (strategy behavior), `puzzleSolver` (CSP semantics), `roomReachability`, `itemUse`, `useMenuPosition`, `utils`, `components/board/data` (data layer do mural de pistas).
- **Python QA:** `.venv/bin/python -m pytest scripts/shared/geometry_test.py` (28 bbox/overlap/clamp tests, 28/28 pass); `.venv/bin/python scripts/audit/dialogue_audit.py` (unreachable nodes, broken edges, cycles, missing `pdAction`; all 9 contacts clean; degrades gracefully without ortools).
- **Playwright:** `npx playwright test` — `playwright.config.ts` (root) auto-starts the dev server, ignores `scratch/` spec copies; browsers once via `npx playwright install chromium`. ⚠️ The spec itself is STALE — it predates the context-menu interaction UX (click opens `objMenu` → `▸ Interagir`), permanent starting items, current interactable positions, and the current HUD/inventory DOM (selectors `header p.text-sm.font-bold` and `.w-56.bg-black.p-4` no longer exist) — all 8 tests fail; rewrite before using as QA.
- **No CI**, no coverage tooling. Legacy Jest tests live in `react-xtermjs/` (own repo, optional, not a game dependency).
- Empirical baseline: `npm test` → 104/104 pass; `npm run lint` → clean; `npm run build:novoice` → prebuild + full build OK (<1 s); `.venv` geometry tests → 28/28 pass; `.venv/bin/python scripts/audit/dialogue_audit.py` → 9/9 contacts ✓; `npx playwright test` → runner OK, 8/8 spec failures (stale spec — see Playwright bullet).

## Agent Behavior Rules

- **Never remove/exclude files from the deploy without asking the user first.** If a file exceeds Cloudflare Pages' 25 MiB limit: stop and ask. No silent skips/deletes.
- **Never use `/tmp` for file operations** — use the project directory for temp work.
- **Always ask the user before choosing audio/video processing parameters** (bitrate, channels, codec, duration cuts). Propose options; never assume.
- **Disciplina Lógica Operacional:** every change requires base convention + explicit request (missing one? don't do it — avoid escopo fantasma, dependência clandestina, estilo imperial); read the real implementation/tests/behavior before editing; empirical TDD verification (Red → Green → Refactor) — no conclusion without test; atomic increments (1 logic per commit, no broken state, no exploration code); refactor only within task scope (out-of-scope problems = technical debt, report them); dependencies only with explicit authorization; security by default (validate external input, no secrets in code/logs, network timeout/retry/backoff); proactively report (format: IMPACTO → OPÇÕES → RECOMENDAÇÃO) when complexity exceeds estimate, an architectural trade-off arises, a blocker is found, or a convention is broken.
