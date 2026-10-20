# Contributing to OpenBots

Thanks for helping. This guide gets you from clone to merged pull request.

## Set up

```bash
git clone https://github.com/alexvladimirovich888/agnes123.git openbots
cd openbots
nvm use            # Node.js 20, see .nvmrc
npm ci
cp .env.example .env
npm run dev        # http://localhost:3000
```

No keys are required to work on the UI: without a provider the agents answer with built-in templates.

## Before you open a pull request

```bash
npm run check      # lint → typecheck → tests → production build
```

CI runs the same steps on Node.js 20 and 22, builds the Docker image and smoke-tests the server.

## Where things live

| Path | What it is |
|---|---|
| `api/chat.ts` | Chat endpoint: provider routing, agent loop, tools, x402 parsing, SSRF guard |
| `server.ts` | Express server used for local and Docker runs |
| `src/lib/agents.ts` | Agent personas: names, prompts, specialties |
| `src/components/three/` | 3D agents and their animation states |
| `src/components/` | UI: hero, hover cards, chat window, Run locally guide |
| `tests/` | Vitest suite |

## Adding a tool

1. Add its schema to `AGENT_TOOLS` and its executor in `runClaudeAgent` (`api/chat.ts`).
2. Validate every input on the server. Treat model-supplied arguments as untrusted.
3. Give it a readable name in the tool trail (`describeServerTool` or the `toolsUsed` push).
4. Add tests with a mocked `fetch` (see `tests/agent-loop.test.ts`).
5. Document it in the README tools table and, if it touches the network or money, in `SECURITY.md`.

## Adding an agent

Add an entry to `INITIAL_AGENTS` in `src/lib/agents.ts` with a unique, stable `id` (ids key the saved chat
history), a palette in `src/lib/palette.ts`, and update `tests/agents.test.ts`.

## Commit style

Short imperative subject (`Add weather tool`, `Fix hover card on Safari`), body explaining why when it is not obvious.

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
