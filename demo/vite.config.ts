import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

function sceneSavePlugin() {
  return {
    name: 'scene-save',
    configureServer(server: any) {
      server.middlewares.use('/api/save-scene', (req: any, res: any) => {
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

            // Sanitize worldId to prevent path traversal
            const safeId = worldId.replace(/[^a-zA-Z0-9_-]/g, '');
            const worldDir = path.resolve(__dirname, 'public/worlds', safeId);
            if (!fs.existsSync(worldDir)) {
              fs.mkdirSync(worldDir, { recursive: true });
            }

            // Merge with existing scene.json to preserve spriteMap, tileNames, etc.
            const filePath = path.join(worldDir, 'scene.json');
            let existing: Record<string, unknown> = {};
            if (fs.existsSync(filePath)) {
              try { existing = JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch {}
            }
            const merged = { ...existing, ...data };

            fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
            console.log('[scene-save] Written to', filePath);
          } catch (e: any) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [sceneSavePlugin()],
});
