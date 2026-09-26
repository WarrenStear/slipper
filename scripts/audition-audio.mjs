import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

// Development-only entry; neither this server nor its client is an app dependency.
const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--port')) throw new Error('Usage: node scripts/audition-audio.mjs [--port 4399]');
const port = args.length ? Number(args[1]) : 4399;
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Port must be an integer from 1024 to 65535');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Narrative audio audition</title>
<style>body{max-width:1000px;margin:2rem auto;padding:0 1rem;background:#12181d;color:#e6e4de;font:16px/1.5 system-ui}h1{font-size:1.7rem}fieldset{border:1px solid #63717a;margin:1rem 0;display:flex;gap:1rem;flex-wrap:wrap}label{display:flex;gap:.4rem;align-items:center}button,select,input{font:inherit}button,select{padding:.45rem;background:#24333c;color:inherit;border:1px solid #96a2a7;border-radius:4px}button:disabled{opacity:.5}pre{overflow:auto;padding:1rem;background:#0c1115;max-height:36rem}a{color:#b8ddea}</style>
<h1>Narrative audio audition</h1><p>Development fixture using the actual stem bank, SceneLook mix, production loader and 350 ms replacement. Audio starts only after Enable. All shipping stems currently remain procedural; this tool never promotes files or manufactures reviewed recordings.</p>
<fieldset><legend>Playback and cold-start profile</legend><label>Sample rate <select id="rate"><option value="0">Device default</option><option>44100</option><option>48000</option><option>96000</option></select></label><button id="enable">Enable / profile a fresh context</button><button id="pause">Pause</button><button id="resume">Resume</button><button id="dispose">Dispose</button><label>Volume <input id="volume" type="range" min="0" max="1" step=".01" value=".15"></label><button id="download">Download report</button></fieldset>
<fieldset><legend>Listening comparison</legend><label>Mode <select id="mode"><option value="scene">Scene mix</option><option value="fallback">Isolated procedural stem</option><option value="reviewed">Isolated reviewed stem, if supplied</option></select></label><label>Stem <select id="stem"></select></label><label>Scene <select id="scene"></select></label><label>Opening reveal <input id="reveal" type="range" min="0" max="1" step=".5" value="0"></label><label><input id="still" type="checkbox">Seer stillness</label><button id="surrender">Accept Surrender</button><button id="restore">Restore outside air</button><button id="seam" disabled>Hear selected loop wrap</button></fieldset>
<p id="status" role="status">Silent. No AudioContext or audio buffers allocated yet.</p><p>The profile measures browser CPU allocation and first scheduling, not time to the speaker, device FPS, listening approval or mobile certification. Scene mix uses high quality, zero resonance, full domestic compression, no event transients and the production shared stillness helper. The loop-wrap button starts the selected stem 150 ms before its boundary; use headphones at a comfortable level.</p><pre id="report" aria-label="Audio review measurements">{}</pre><script type="module" src="/scripts/audio-audition-client.ts"></script></html>`;
const server = await createServer({ root, configFile: false, appType: 'custom',
  cacheDir: resolve(tmpdir(), `slipper-audio-audition-${process.pid}`),
  server: { host: '127.0.0.1', port, strictPort: true },
});
server.middlewares.use((req, res, next) => {
  if (req.url !== '/' && req.url !== '/__audio-audition') return next();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(html);
});
await server.listen();
console.log(`Audio audition (development only): http://127.0.0.1:${port}/__audio-audition`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0); });
