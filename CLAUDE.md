# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Miniverse

A pixel world visualization for AI agents. Agents report state via HTTP/WebSocket heartbeats and appear as animated characters in a browser-based canvas world. Framework-agnostic — any agent that can make HTTP calls works.

## Commands

```bash
# Development (runs demo with Vite + hot reload)
npm run dev

# Build core + server (must build core first — server depends on it)
npm run build

# Build all packages including generate and create-miniverse
npm run build:all

# Build server only (after core is already built)
npm run build:server

# Type checking (core package only)
npm run typecheck

# Lint
npm run lint

# Start production server
npm start

# Run the server directly during development
cd packages/server && npx tsx src/cli.ts
```

There is no test framework configured. No test commands exist.

## Architecture

### Monorepo Layout (npm workspaces)

- **`packages/core`** — Browser-side canvas engine (Vite library build). Pure client-side: HTML5 Canvas rendering, sprite sheets, A* pathfinding, animations, particles, speech bubbles. The `Miniverse` class in `src/index.ts` is the main entry point that orchestrates all subsystems.
- **`packages/server`** — Node.js HTTP + WebSocket server (esbuild). REST API for agent heartbeats/actions, WebSocket for real-time updates, serves a status page frontend. The `MiniverseServer` class in `src/server.ts` handles all routes.
- **`packages/generate`** — AI sprite generation pipeline (esbuild). Uses fal.ai for image generation and sharp for processing. Generates character sprite sheets, props, textures, and entire worlds.
- **`packages/create-miniverse`** — `npx create-miniverse` CLI scaffolder. Copies templates to create new projects.
- **`demo/`** — Vite dev app that uses `@miniverse/core` with mock data (no server needed).
- **`my-miniverse/`** — Local dev world (not part of npm workspaces, has hardcoded paths).

### Core ↔ Server Communication

Core and server share **no TypeScript code**. They communicate via the **Signal** connector (`packages/core/src/signal/Signal.ts`):
- `rest` mode — polls `GET /api/agents`
- `websocket` mode — connects to `ws://localhost:4321/ws`
- `mock` mode — uses callback for demo/testing

### Build System

- **core**: Vite (`vite.config.ts`) → ES module library with `.d.ts` via `vite-plugin-dts`
- **server**: esbuild (`build.js`) → Node.js ESM, bundles `cli.ts` and `index.ts`, externalizes `ws`
- **generate**: esbuild (`build.js`) → Node.js ESM
- All packages use ESM (`"type": "module"`) and target ES2020+

### Key Domain Types

- `AgentState`: `'working' | 'idle' | 'thinking' | 'sleeping' | 'speaking' | 'error' | 'waiting' | 'offline'`
- `AgentStatus`: `{ id, name, state, task, energy }` — what the Signal connector delivers
- `CitizenConfig`: `{ agentId, name, sprite, position, npc? }` — defines a world character
- `TypedLocation` / `AnchorType`: typed positions in the world (`'work' | 'rest' | 'social' | 'utility' | 'wander'`)
- `AgentAction`: union type for interactive protocol actions (move, speak, message, emote, status, channels)

### Server API Routes

Default port: `4321` (auto-increments if busy)

| Route | Purpose |
|---|---|
| `POST /api/heartbeat` | Agent status updates |
| `POST /api/act` | Agent actions (speak, move, message, etc.) |
| `GET /api/observe` | World snapshot + events |
| `GET /api/agents` | List all agents |
| `GET /api/inbox?agent=X` | Drain pending messages |
| `POST /api/hooks/claude-code` | Claude Code lifecycle hook endpoint |
| `POST /api/save-world` | Save world.json edits |
| `GET /api/info` | Server version and stats |
| `ws://host/ws` | WebSocket for real-time updates |

### World System

Worlds live in `worlds/<world-id>/` with:
- `world.json` — grid dimensions, floor layout, tiles, props, wander points, citizen definitions
- `scenes/` — scene configs (e.g. `main.json`)
- Sprite assets in `universal_assets/citizens/` (shared) and world-specific directories

Auto-spawn: when the server sends an unknown agent ID, core automatically creates a citizen with a round-robin sprite from `defaultSprites` (`nova`, `rio`, `dexter`, `morty`).

## Code Patterns

- All state transitions are debounced (8s `TRANSITION_DEBOUNCE_MS`) to prevent rapid hook events from causing visual jitter
- The server uses an in-memory `AgentStore` with a sweep timer — agents transition from active → sleeping (2min) → offline (4min) without heartbeats
- Events use a ring-buffer `EventLog` (200 max) with incremental polling via `since` parameter
- Props system manages anchor points for typed locations — citizens pathfind to appropriate anchors based on their state
- The `TileReservation` system prevents multiple citizens from occupying the same tile
