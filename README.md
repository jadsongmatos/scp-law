# Murphy Law — Investigações Privadas

Jogo de detetive em estilo film noir (React 19 + Vite 8 + TypeScript + Tailwind v4) com meta-lore da Fundação SCP. Explore 12 salas, descubra interactables ocultos clicando na cena, cole as pistas no mural de investigações com fios vermelhos e faça a denúncia para fechar o caso — e negocie diálogos de Dilema do Prisioneiro Iterado com 9 contatos, cada um com sua própria estratégia de axelrod.

Produção: `scp-law.pages.dev` (Cloudflare Pages).

## Requisitos

- **Node.js** `^20.19 || >=22.12` + **npm**
- **Python 3** (opcional — ferramentas de `scripts/`: gerador de puzzle, auditorias, vozes/imagens):
  ```bash
  python3 -m venv .venv
  .venv/bin/pip install -r scripts/requirements.txt
  ```
  Pipeline de visão (DINOv2, opcional): `.venv/bin/pip install -r requirements-vision.txt`

## Desenvolvimento

```bash
npm install
npm run dev          # http://localhost:3000
```

| Comando | Efeito |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (porta 3000) |
| `npm run lint` | Typecheck (`tsc --noEmit`) |
| `npm test` | Testes unitários (vitest — lógica pura, 10 suítes) |
| `npm run build` / `npm run build:novoice` | Build de produção (com/sem geração de vozes s2.cpp) |
| `npx playwright test` | E2E do caminho crítico (sobe o dev server sozinho) |
| `.venv/bin/python -m pytest scripts/shared/geometry_test.py` | Testes de geometria de hitboxes |
| `.venv/bin/python scripts/audit/dialogue_audit.py` | Auditoria CP-SAT das árvores de diálogo |
| `.venv/bin/python -m scripts.puzzle.noir_generator --merge src/game_data.json` | Regenera o quebra-cabeça |

## Variáveis de ambiente

Copie `.env.example` para `.env` na raiz (`.env*` é gitignored — nunca comite):

- `OPENROUTER_API_KEY` — pipeline de visão (DINOv2 + Gemma) e audits de arte
- `NINEROUTER_API_URL` / `NINEROUTER_API_KEY` — geração de imagens (gateway local 9Router, padrão `http://localhost:20128`)
- `CLOUDFLARE_API_TOKEN` — deploy via wrangler

## Deploy

```bash
npm run build:novoice
npx wrangler pages deploy dist/ --project-name=scp-law
```

Documentação completa para assistentes de IA: [`AGENTS.md`](AGENTS.md).
