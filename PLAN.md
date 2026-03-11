# Miniverse -- Project Plan

## Vision

A tiny pixel world for your AI agents. Instead of monitoring agents through logs or dashboards, give them a living pixel art world. Tamagotchi for AI agents.

## Distribution -- Three Tiers, Same Core

### 1. The App (Tauri) -- lowest friction

- Download Miniverse.app, double click, pixel world opens
- Tauri-based (5-10MB, uses system webview, not Electron's 150MB)
- Tray icon with endpoint URL, "copy webhook" button
- Bundles the local server automatically
- Empty office on first launch with onboarding via the in-world intercom: "Paste this into your Claude Code settings to connect an agent"

### 2. The CLI -- developer-first

- `npx miniverse` -- starts server, opens browser
- Zero config, just works
- For people already in terminal running agents

### 3. The Library (npm embed)

- `npm install miniverse` and drop the canvas into your own app/dashboard
- Framework-agnostic core, optional React/Vue/Svelte wrappers

## Architecture

```
+---------------------------------------------+
|  Tauri App  |  CLI + Browser  |  npm        |
+-------------+-----------------+-------------+
|         Local HTTP/WS Server                |
+---------------------------------------------+
|         Miniverse Core Engine               |
|   (canvas, sprites, pathfinding, etc)       |
+---------------------------------------------+
```

All three tiers share the same core engine and server. The only difference is the shell.

### Packages

- `packages/core` -- Canvas renderer, sprite system, animation engine, pathfinding
- `packages/server` -- Local HTTP + WebSocket server, ingest API, serves web frontend
- `packages/react`, `packages/vue`, `packages/svelte` -- Framework wrappers (future)
- `apps/desktop` -- Tauri app wrapper (future)

### Server (the linchpin)

The server is the piece that makes everything real. It:

- Serves the pixel world web frontend on a local port
- Exposes `POST /api/heartbeat` for agents to report state
- Pushes updates to the frontend via WebSocket in real-time
- Keeps agent state in memory with auto-timeout to "offline"
- Exposes `GET /api/agents` for reading current state
- WebSocket at `/ws` for bidirectional communication

### Ingest API

Agents report activity via a single HTTP POST:

```
POST /api/heartbeat
Content-Type: application/json

{
  "agent": "claude",
  "state": "working",
  "task": "Reviewing PR #42",
  "energy": 0.8,
  "metadata": {}
}
```

That's it. One HTTP call. The pixel world updates in real time.

Valid states: working, idle, thinking, error, waiting, collaborating, sleeping, listening, speaking, offline

Agents that stop sending heartbeats auto-transition to "offline" after a configurable timeout (default 30s).

## Integration

### Claude Code

Claude Code has hooks -- shell commands that fire on lifecycle events. Integration is copy-paste:

```json
{
  "hooks": {
    "on_tool_call": "miniverse report working --task \"$TOOL_NAME\"",
    "on_stop": "miniverse report idle"
  }
}
```

Or with raw curl:

```bash
curl -s -X POST http://localhost:4321/api/heartbeat \
  -d '{"agent":"claude","state":"working","task":"Using tool: read_file"}'
```

### OpenClaw / Other Agent Frameworks

- Any system that can make an HTTP POST works
- For systems with lifecycle hooks: configure hooks to POST to the heartbeat endpoint
- For systems without hooks: wrap the process with `miniverse watch -- your-command` (future)
- For log-based systems: `miniverse tail --pattern "STATE:(.+)" -- agent.log` (future)

### The Onboarding Moment

1. User opens Miniverse (app or CLI)
2. Empty pixel office appears
3. Intercom on the wall shows: "Paste this into your agent config to connect"
4. User copies the snippet, adds it to their Claude Code hooks
5. They start Claude Code, and a character walks into the office and sits down
6. That's the "holy shit" moment

## Core Engine (already built)

- Pure HTML5 Canvas rendering with `image-rendering: pixelated`
- Sprite sheet system with named animations per state
- Tile-based rooms with A* pathfinding on walkable grid
- Layered rendering: floor -> props -> characters (y-sorted) -> particles -> UI
- State machine per resident: maps agent states to animations and behaviors
- Interactive objects: intercom (shakes on input, all agents face it), whiteboard, monitors (glow when working), coffee machine
- Particle effects: Zzz for sleeping, thought bubbles, exclamation marks for errors
- Speech bubbles showing current task
- Signal connector supporting REST polling, WebSocket, and mock data

## World Theme Packs

Community-contributable worlds:

- `pixel-office` (default, ships with core)
- Future: fantasy-tavern, space-station, underwater-lab, pixel-garden, medieval-scriptorium, cozy-cafe

Each world is a self-contained directory with tilesets, scene layouts, animation configs, and interactive objects.

## Roadmap

### v0.1 (current) -- Foundation

- [x] Core canvas engine with sprites, pathfinding, animations
- [x] pixel-office world with procedural placeholder art
- [x] Mock signal connector for demo
- [x] Interactive objects, particles, speech bubbles
- [x] Click-to-inspect citizens

### v0.2 -- The Server

- [x] Local HTTP + WebSocket server
- [x] POST /api/heartbeat ingest API
- [x] Real-time WebSocket push to frontend
- [x] CLI entry point with auto browser open
- [x] Agent auto-timeout to offline (30s sweep)
- [x] Onboarding UX (shows curl snippet when no agents connected)
- [x] `miniverse report` CLI helper for hooks
- [x] Self-contained frontend (no build step, inline pixel art generation)
- [ ] `npx miniverse` (publish to npm)

### v0.3 -- Claude Code Integration

- [ ] Pre-built hook configs for Claude Code
- [ ] Auto-detect Claude Code and suggest config
- [ ] Agent name/avatar customization via heartbeat metadata

### v0.4 -- The App

- [ ] Tauri desktop app
- [ ] Menu bar tray icon
- [ ] Auto-start server on launch
- [ ] System notifications for agent errors

### v0.5 -- Community

- [ ] World theme pack contribution guide
- [ ] Custom sprite upload via API
- [ ] Multiple world support (switch scenes)
- [ ] Day/night cycle, ambient weather

### Future

- Framework-specific adapters (CrewAI, AutoGen, LangGraph)
- `miniverse watch` process wrapper
- `miniverse tail` log watcher
- React/Vue/Svelte component wrappers
- Sound effects (keyboard clacking, coffee brewing)
- Multi-room support (agents move between scenes)
- Remote/team mode (shared miniverse over network)
