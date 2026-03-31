import { Miniverse, PropSystem, Editor, createStandardSpriteConfig } from '@miniverse/core';
import type { AgentState, AgentStatus, SceneConfig, SpriteSheetConfig, CitizenConfig } from '@miniverse/core';

const STATES: AgentState[] = ['working', 'idle', 'thinking', 'sleeping', 'speaking', 'error', 'waiting'];
const TASKS = [
  'Reviewing PR #42',
  'Fixing auth bug',
  'Writing tests',
  'Code review',
  'Deploying v2.1',
  'Refactoring API',
  'Updating docs',
  null,
];

const agentStates: Record<string, { state: AgentState; task: string | null; energy: number }> = {
  morty: { state: 'working', task: 'Reviewing PR #42', energy: 0.8 },
  dexter: { state: 'idle', task: null, energy: 0.5 },
  nova: { state: 'thinking', task: 'Designing UI mockups', energy: 0.9 },
  rio: { state: 'working', task: 'Writing tests', energy: 0.7 },
};

function mockAgentData(): AgentStatus[] {
  return Object.entries(agentStates).map(([id, data]) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    state: data.state,
    task: data.task,
    energy: data.energy,
  }));
}

// --- World registry ---
interface WorldEntry { id: string; name: string; }

function getWorldId(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('world') ?? 'cozy-startup';
}

function worldBasePath(worldId: string): string {
  return `/worlds/${worldId}`;
}

function buildSceneConfig(
  cols: number,
  rows: number,
  floor: string[][] | undefined,
  tiles: Record<string, string> | undefined,
  basePath: string,
): SceneConfig {
  const safeFloor: string[][] = floor ?? Array.from({ length: rows }, () => Array(cols).fill(''));
  const walkable: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    walkable[r] = [];
    for (let c = 0; c < cols; c++) {
      walkable[r][c] = (safeFloor[r]?.[c] ?? '') !== '';
    }
  }

  const resolvedTiles: Record<string, string> = { ...(tiles ?? {}) };
  for (const [key, src] of Object.entries(resolvedTiles)) {
    if (/^(blob:|data:|https?:\/\/)/.test(src)) continue;
    const clean = src.startsWith('/') ? src.slice(1) : src;
    resolvedTiles[key] = `${basePath}/${clean}`;
  }

  return {
    name: 'main',
    tileWidth: 32,
    tileHeight: 32,
    layers: [safeFloor],
    walkable,
    locations: {},
    tiles: resolvedTiles,
  };
}

async function main() {
  const container = document.getElementById('miniverse-container')!;
  const tooltip = document.getElementById('tooltip')!;
  const statusBar = document.getElementById('status-bar')!;
  const worldSelect = document.getElementById('world-select') as HTMLSelectElement;

  // Load world registry and populate selector
  const worldId = getWorldId();
  const basePath = worldBasePath(worldId);
  const worlds: WorldEntry[] = await fetch('/worlds/index.json').then(r => r.json()).catch(() => []);
  for (const w of worlds) {
    const opt = document.createElement('option');
    opt.value = w.id;
    opt.textContent = w.name;
    if (w.id === worldId) opt.selected = true;
    worldSelect.appendChild(opt);
  }
  worldSelect.addEventListener('change', () => {
    const params = new URLSearchParams(window.location.search);
    params.set('world', worldSelect.value);
    window.location.search = params.toString();
  });

  // Load world data
  const worldData = await fetch(`${basePath}/world.json`).then(r => r.json()).catch(() => null);

  const gridCols = worldData?.gridCols ?? 16;
  const gridRows = worldData?.gridRows ?? 12;
  const sceneConfig = buildSceneConfig(
    gridCols, gridRows,
    worldData?.floor,
    worldData?.tiles,
    basePath,
  );

  const tileSize = 32;

  // Build citizens from world.json if available, else fall back to hardcoded demo citizens
  const citizenDefs: any[] = worldData?.citizens ?? worldData?.characterDefs ?? [];
  let citizens: CitizenConfig[];
  let spriteSheets: Record<string, SpriteSheetConfig>;

  if (citizenDefs.length > 0) {
    // Data-driven: citizens come from world.json
    citizens = citizenDefs.map((def: any) => ({
      agentId: def.agentId ?? def.id,
      name: def.name,
      sprite: def.sprite,
      position: def.position,
      npc: def.type === 'npc',
    }));
    spriteSheets = {};
    for (const def of citizenDefs) {
      spriteSheets[def.sprite] = createStandardSpriteConfig(def.sprite);
    }
  } else {
    // Fallback: hardcoded demo citizens
    citizens = [
      { agentId: 'morty', name: 'Morty', sprite: 'morty', position: 'desk_0_0' },
      { agentId: 'dexter', name: 'Dexter', sprite: 'dexter', position: 'desk_1_0' },
      { agentId: 'nova', name: 'Nova', sprite: 'nova', position: 'whiteboard_2_0' },
      { agentId: 'rio', name: 'Rio', sprite: 'rio', position: 'couch_5_0' },
    ];
    spriteSheets = {};
    for (const r of citizens) {
      spriteSheets[r.sprite] = createStandardSpriteConfig(r.sprite);
    }
  }

  // In production (behind nginx), connect to the server via WebSocket.
  // In dev mode, use mock data so the demo works without a running server.
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
  const signal = import.meta.env.DEV
    ? { type: 'mock' as const, mockData: mockAgentData, interval: 2000 }
    : { type: 'websocket' as const, url: wsUrl };

  const mv = new Miniverse({
    container,
    world: worldId,
    scene: 'main',
    signal,
    citizens,
    scale: 2,
    width: gridCols * tileSize,
    height: gridRows * tileSize,
    sceneConfig,
    spriteSheets,
    objects: [],
  });

  // Click handler for tooltip
  mv.on('citizen:click', (data: unknown) => {
    const d = data as { name: string; state: string; task: string | null; energy: number };
    tooltip.style.display = 'block';
    tooltip.querySelector('.name')!.textContent = d.name;
    tooltip.querySelector('.state')!.textContent = `State: ${d.state}`;
    tooltip.querySelector('.task')!.textContent = d.task ? `Task: ${d.task}` : 'No active task';
    setTimeout(() => { tooltip.style.display = 'none'; }, 3000);
  });

  container.addEventListener('mousemove', (e) => {
    tooltip.style.left = e.clientX + 12 + 'px';
    tooltip.style.top = e.clientY + 12 + 'px';
  });

  // Update status bar
  setInterval(() => {
    statusBar.innerHTML = Object.entries(agentStates)
      .map(([id, data]) => {
        const name = id.charAt(0).toUpperCase() + id.slice(1);
        return `<div class="agent"><span class="status-dot ${data.state}"></span>${name}: ${data.state}</div>`;
      })
      .join('');
  }, 500);

  // --- Props system ---
  const props = new PropSystem(32, 2);

  const propImages: Record<string, string> = worldData?.propImages ?? worldData?.spriteMap ?? {};
  await Promise.all(
    Object.entries(propImages).map(([id, src]) => {
      const clean = (src as string).startsWith('/') ? (src as string).slice(1) : src as string;
      return props.loadSprite(id, `${basePath}/${clean}`);
    }),
  );

  props.setLayout(worldData?.props ?? []);
  if (worldData?.wanderPoints) {
    props.setWanderPoints(worldData.wanderPoints);
  }

  props.setDeadspaceCheck((col, row) => {
    const floor = mv.getFloorLayer();
    return floor?.[row]?.[col] === '';
  });

  const syncProps = () => {
    mv.setTypedLocations(props.getLocations());
    mv.updateWalkability(props.getBlockedTiles());
  };
  syncProps();
  props.onSave(syncProps);

  await mv.start();

  mv.addLayer({ order: 5, render: (ctx) => props.renderBelow(ctx) });
  mv.addLayer({ order: 15, render: (ctx) => props.renderAbove(ctx) });

  // --- Editor ---
  const editor = new Editor({
    canvas: mv.getCanvas(),
    props,
    miniverse: mv,
    worldId,
    onSave: async (scene) => {
      const res = await fetch('/api/save-world', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scene, worldId }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
  });
  editor.loadCitizenDefs(worldData?.citizens ?? worldData?.characterDefs);
  mv.addLayer({ order: 50, render: (ctx) => {
    editor.renderOverlay(ctx);
    if (editor.isActive()) syncProps();
  } });

  // Expose controls to window
  (window as unknown as Record<string, unknown>).triggerIntercom = () => {
    mv.triggerEvent('intercom', { message: 'Hey team, status update?' });
  };

  (window as unknown as Record<string, unknown>).cycleState = (agentId: string) => {
    const agent = agentStates[agentId];
    if (!agent) return;
    const currentIdx = STATES.indexOf(agent.state);
    agent.state = STATES[(currentIdx + 1) % STATES.length];
    agent.task = TASKS[Math.floor(Math.random() * TASKS.length)];
    agent.energy = Math.random();
  };
}

main().catch(console.error);
