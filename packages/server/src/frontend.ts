/**
 * Simple status page served by the miniverse server at /.
 */
export function getFrontendHtml(wsPort: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Miniverse Server</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: #1a1a2e;
  color: #eee;
  font-family: 'Courier New', monospace;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 20px;
}
h1 { font-size: 22px; color: #e94560; letter-spacing: 4px; text-transform: uppercase; }
.subtitle { font-size: 12px; color: #666; }
.status { font-size: 13px; color: #4ade80; }
.agents { margin-top: 12px; }
.agent { display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: 12px; color: #aaa; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot.working { background: #4ade80; }
.dot.idle { background: #fbbf24; }
.dot.thinking { background: #f472b6; }
.dot.sleeping { background: #818cf8; }
.dot.error { background: #ef4444; }
.dot.speaking { background: #22d3ee; }
.dot.offline { background: #444; }
.empty { font-size: 11px; color: #555; }
.hint { max-width: 420px; text-align: center; font-size: 11px; color: #555; line-height: 1.6; margin-top: 8px; }
.hint code {
  display: block;
  background: #16213e;
  border: 1px solid #333;
  padding: 8px 12px;
  margin: 8px 0;
  border-radius: 4px;
  text-align: left;
  font-size: 10px;
  color: #e94560;
}
a { color: #e94560; text-decoration: none; }
a:hover { text-decoration: underline; }
.links { display: flex; gap: 16px; font-size: 11px; margin-top: 4px; }
</style>
</head>
<body>
<h1>Miniverse</h1>
<p class="subtitle">server running on port ${wsPort}</p>
<p class="status" id="status">●  online</p>
<div class="agents" id="agents"></div>
<div class="hint" id="hint">
  <p>No agents connected yet. Send a heartbeat to bring one to life:</p>
  <code>curl -X POST http://localhost:${wsPort}/api/heartbeat \\
  -H "Content-Type: application/json" \\
  -d '{"agent":"claude","state":"working","task":"Hello world"}'</code>
</div>
<div class="links">
  <a href="/api/agents">GET /api/agents</a>
  <a href="/api/events">GET /api/events</a>
  <a href="/api/channels">GET /api/channels</a>
</div>

<script>
const agentsEl = document.getElementById('agents');
const hintEl = document.getElementById('hint');
const ws = new WebSocket('ws://' + location.host + '/ws');

ws.onmessage = (e) => {
  try {
    const msg = JSON.parse(e.data);
    if (msg.type === 'agents') render(msg.agents);
  } catch {}
};
ws.onclose = () => {
  document.getElementById('status').textContent = '○  disconnected';
  document.getElementById('status').style.color = '#ef4444';
};

function render(agents) {
  if (agents.length === 0) {
    agentsEl.innerHTML = '';
    hintEl.style.display = '';
    return;
  }
  hintEl.style.display = 'none';
  agentsEl.innerHTML = agents.map(a =>
    '<div class="agent">' +
      '<span class="dot ' + a.state + '"></span>' +
      '<span>' + (a.name || a.agent) + '</span>' +
      '<span style="color:#555">' + a.state + (a.task ? ' · ' + a.task : '') + '</span>' +
    '</div>'
  ).join('');
}
</script>
</body>
</html>`;
}
