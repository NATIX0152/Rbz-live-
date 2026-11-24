// Serveur : sert le site + lit les cadeaux du live TikTok et les pousse au site en temps réel (SSE).
const http = require('http'), fs = require('fs'), path = require('path');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const PORT = process.env.PORT || 3000;
const clients = new Set();
let conn = null, current = '';
const send = (type, data = {}) => { const m = `data: ${JSON.stringify({ type, ...data })}\n\n`; clients.forEach(c => c.write(m)); };

async function disconnect() { if (conn) { try { conn.disconnect(); } catch {} conn = null; } current = ''; send('status', { connected: false }); }

async function connect(username) {
  await disconnect();
  username = username.replace(/^@/, '').trim();
  conn = new TikTokLiveConnection(username, process.env.EULER_API_KEY ? { signApiKey: process.env.EULER_API_KEY } : {});
  // Chaque cadeau est compté dès qu'il arrive. Pour les séries (roses...), on ajoute seulement l'écart depuis le dernier événement.
  const streaks = new Map();
  conn.on(WebcastEvent.GIFT, d => {
    const unit = d.diamondCount ?? d.giftDetails?.diamondCount ?? 0; // prix du cadeau en coins
    const key = (d.user?.userId || d.user?.uniqueId) + ':' + d.giftId;
    const rep = d.repeatCount || 1;
    let n = rep;
    if (d.giftType === 1) { n = rep - (streaks.get(key) || 0); if (d.repeatEnd) streaks.delete(key); else streaks.set(key, rep); }
    const coins = unit * Math.max(n, 0);
    if (process.env.DEBUG) console.log('GIFT', d.user?.uniqueId, coins, JSON.stringify(d).slice(0, 300));
    if (coins > 0) send('gift', { user: '@' + (d.user?.uniqueId || 'inconnu'), coins, giftName: d.giftName || d.giftDetails?.giftName || '' });
  });
  conn.on(WebcastEvent.DISCONNECTED, () => send('status', { connected: false, error: 'Live déconnecté' }));
  conn.on(WebcastEvent.STREAM_END, () => send('status', { connected: false, error: 'Le live est terminé' }));
  const state = await conn.connect();
  current = username;
  send('status', { connected: true, username, roomId: state.roomId });
}

const body = req => new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

http.createServer(async (req, res) => {
  if (req.url === '/health') { res.writeHead(200); return res.end('ok'); }
  if (req.url === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`data: ${JSON.stringify({ type: 'status', connected: !!conn, username: current })}\n\n`);
    clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  if (req.method === 'POST' && req.url === '/api/connect') {
    const { username } = await body(req);
    res.setHeader('Content-Type', 'application/json');
    if (!username) { res.statusCode = 400; return res.end('{"error":"Pseudo manquant"}'); }
    try { await connect(username); res.end('{"ok":true}'); }
    catch (e) { conn = null; res.statusCode = 502; res.end(JSON.stringify({ error: 'Connexion impossible : ' + (e.message || e) + ' (le compte est-il bien en live ?)' })); }
    return;
  }
  if (req.method === 'POST' && req.url === '/api/disconnect') { await disconnect(); return res.end('{"ok":true}'); }
  const file = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!['index.html', 'app.js', 'style.css'].includes(path.relative(__dirname, file))) { res.statusCode = 404; return res.end('Not found'); }
  fs.readFile(file, (e, d) => { if (e) { res.statusCode = 404; return res.end('Not found'); } res.setHeader('Content-Type', types[path.extname(file)] || 'text/plain'); res.end(d); });
}).listen(PORT, '0.0.0.0', () => console.log(`RBZ Live sur http://localhost:${PORT}`));
