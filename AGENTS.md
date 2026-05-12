# Murphy Law SCP Game — Agent Guide

## Core Architecture
- **Tech:** React + Vite + Tailwind CSS + Lucide Icons.
- **Source of Truth:** `src/game_data.json` defines rooms, interactables, terminal documents.
- **State Management:** In `src/App.tsx`. `localRooms` mirrors `game_data.json` for in-memory updates.
- **Audio Engine:** `src/audio.ts`. Uses Web Audio API `GainNodes` for category volume (Master, Ambient, SFX, Voice).
- **Terminal:** `react-xtermjs` displays logs, investigative documents.

## High-Signal Facts
- **No Resources:** Murphy Law "preparado". NO money counters, energy bars, hunger mechanics.
- **Deduction Puzzle:** Core "logic puzzle" hardcoded via `DEDUCTION_SOLUTION`, `DEDUCTION_GRID` in `App.tsx`.
- **Asset Generation:**
    - **Voices:** Generated via `python3 generate_voices.py` (uses `edge-tts`). Triggered in `npm run build` if `VITE_VOICE_GEN=1`.
    - **Images:** Generated via `python3 generate_noir_images.py` (uses Gemini via OpenRouter).
- **Interaction Types:**
    - `inspect`: Pure description.
    - `pickup`: Adds item to inventory.
    - `travel`: Moves to `targetRoom`.
    - `terminal_read`: Opens document in xterm.

## Developer Commands
- `npm run dev`: Local dev server (port 3000).
- `npm run lint`: Typecheck using `tsc --noEmit`.
- `npm run build`: Build production. Triggers voice generation if `VITE_VOICE_GEN=1`.
- `python3 generate_voices.py`: Update voices after changing `game_data.json` (requires `edge-tts`).

## Conventions & Style
- **Tone:** Noir meta-narrative (Film Noir aesthetic, high contrast, amber/black).
- **Icons:** Use `lucide-react`. Mapping in `src/Icons.tsx`.
- **Data Bridge:** `src/data.ts` merges `game_data.json` with static image imports.
- **Secrets:** `GEMINI_API_KEY` required in `.env.local` for build-time injection.
- **Persistence:** Game state in-memory only. NO LocalStorage save/load.

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
