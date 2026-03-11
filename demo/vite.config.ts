import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

function worldSavePlugin() {
  return {
    name: 'world-save',
    configureServer(server: any) {
      server.middlewares.use('/api/save-world', (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }
        let body = '';
        req.on('data', (chunk: string) => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const worldId = data.worldId ?? 'cozy-startup';
            delete data.worldId;

            const safeId = worldId.replace(/[^a-zA-Z0-9_-]/g, '');
            const worldDir = path.resolve(__dirname, 'public/worlds', safeId);
            if (!fs.existsSync(worldDir)) {
              fs.mkdirSync(worldDir, { recursive: true });
            }

            const filePath = path.join(worldDir, 'world.json');
            let existing: Record<string, unknown> = {};
            if (fs.existsSync(filePath)) {
              try { existing = JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch {}
            }
            const merged = { ...existing, ...data };

            fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
            console.log('[world-save] Written to', filePath);
          } catch (e: any) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });
    },
  };
}

function tilesListPlugin() {
  return {
    name: 'tiles-list',
    configureServer(server: any) {
      server.middlewares.use('/api/tiles', (req: any, res: any) => {
        const url = new URL(req.url, 'http://localhost');
        const worldId = (url.searchParams.get('worldId') || '').replace(/[^a-zA-Z0-9_-]/g, '');
        const tilesDir = worldId
          ? path.resolve(__dirname, 'public/worlds', worldId, 'world_assets/tiles')
          : path.resolve(__dirname, 'public/universal_assets/tiles');
        let names: string[] = [];
        if (fs.existsSync(tilesDir)) {
          names = fs.readdirSync(tilesDir)
            .filter((f: string) => f.endsWith('.png') && f !== 'office.png')
            .map((f: string) => f.replace('.png', ''));
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(names));
      });
    },
  };
}

function citizensListPlugin() {
  return {
    name: 'citizens-list',
    configureServer(server: any) {
      server.middlewares.use('/api/citizens', (_req: any, res: any) => {
        const citizensDir = path.resolve(__dirname, 'public/universal_assets/citizens');
        let names: string[] = [];
        if (fs.existsSync(citizensDir)) {
          names = fs.readdirSync(citizensDir)
            .filter((f: string) => f.endsWith('_walk.png'))
            .map((f: string) => f.replace('_walk.png', ''));
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(names));
      });
    },
  };
}

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [worldSavePlugin(), tilesListPlugin(), citizensListPlugin()],
});
