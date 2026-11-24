// Serveur : sert le site + lit les cadeaux du live TikTok et les pousse au site en temps réel (SSE).
const http = require('http'), fs = require('fs'), path = require('path');
const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');

const PORT = process.env.PORT || 3000;
const clients = new Set();
// Compte à suivre automatiquement (variable Render TIKTOK_USERNAME, ou dernier @ saisi sur le site)
let target = (process.env.TIKTOK_USERNAME || '').replace(/^@/, '').trim();
let conn = null, current = '', stats = { chat: 0, gifts: 0, members: 0 };
const send = (type, data = {}) => { const m = `data: ${JSON.stringify({ type, ...data })}\n\n`; clients.forEach(c => c.write(m)); };

async function disconnect(manual) { if (conn) { try { conn.disconnect(); } catch {} conn = null; } current = ''; if (manual) target = ''; send('status', { connected: false }); }

async function connect(username) {
  await disconnect();
  username = username.replace(/^@/, '').trim();
  const streaks = new Map();
  conn = new TikTokLiveConnection(username, { enableExtendedGiftInfo: true, ...(process.env.EULER_API_KEY ? { signApiKey: process.env.EULER_API_KEY } : {}) });
  // Chaque cadeau est compté dès qu'il arrive. Pour les séries (roses...), on ajoute seulement l'écart depuis le dernier événement.
  conn.on(WebcastEvent.GIFT, d => {
    const g = d.gift || {};
    const unit = Number(d.extendedGiftInfo?.diamond_count ?? d.extendedGiftInfo?.diamondCount ?? g.diamondCount ?? d.diamondCount ?? d.giftDetails?.diamondCount ?? 0); // prix du cadeau en coins
    const streakable = (g.type ?? d.giftType) === 1;
    const u = d.user || {};
    const who = u.uniqueId || u.displayId || u.nickname || String(u.userId || u.id || 'inconnu');
    const key = String(u.userId || u.id || who) + ':' + String(d.giftId || g.id);
    const rep = Number(d.repeatCount) || 1;
    let n = rep;
    if (streakable) { n = rep - (streaks.get(key) || 0); if (d.repeatEnd) streaks.delete(key); else streaks.set(key, rep); }
    const coins = unit * Math.max(n, 0);
    stats.gifts++; pushStats();
    console.log('GIFT', who, g.name || d.extendedGiftInfo?.name || d.giftId, 'x' + n, '=', coins, 'coins');
    if (coins > 0) send('gift', { user: '@' + who, coins, giftName: g.name || '' });
    else send('giftunknown', { user: '@' + who, giftName: g.name || d.extendedGiftInfo?.name || String(d.giftId || '') });
    if (!(coins > 0)) console.warn('Cadeau sans valeur lisible :', JSON.stringify(d, (k, x) => typeof x === 'bigint' ? String(x) : x).slice(0, 400));
  });
  stats = { chat: 0, gifts: 0, members: 0 };
  const pushStats = () => send('stats', stats);
  conn.on(WebcastEvent.CHAT, d => { stats.chat++; pushStats(); send('chat', { user: '@' + (d.user?.uniqueId || d.user?.nickname || '?'), text: d.comment || '' }); });
  conn.on(WebcastEvent.MEMBER, () => { stats.members++; pushStats(); });
  conn.on(ControlEvent.WEBSOCKET_CONNECTED, () => console.log('WebSocket TikTok connecté'));
  conn.on(ControlEvent.ERROR, e => { console.error('Erreur TikTok :', e?.info || e?.message || e); send('status', { connected: !!conn, warn: String(e?.info || e?.message || e) }); });
  const lost = msg => { conn = null; current = ''; send('status', { connected: false, error: msg }); };
  conn.on(ControlEvent.DISCONNECTED, () => lost('Live déconnecté — reconnexion automatique…'));
  conn.on(WebcastEvent.STREAM_END, () => lost('Le live est terminé — reconnexion automatique…'));
  const state = await conn.connect();
  current = username; target = username;
  send('status', { connected: true, username, roomId: state.roomId });
}

const body = req => new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

http.createServer(async (req, res) => {
  if (req.url === '/health') { res.writeHead(200); return res.end('ok'); }
  if (req.url === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`data: ${JSON.stringify({ type: 'status', connected: !!conn, username: current || target })}\n\n`); res.write(`data: ${JSON.stringify({ type: 'stats', ...stats })}\n\n`);
    clients.add(res); req.on('close', () => clients.delete(res)); return;
  }
  if (req.method === 'POST' && req.url === '/api/connect') {
    const { username } = await body(req);
    res.setHeader('Content-Type', 'application/json');
    if (!username) { res.statusCode = 400; return res.end('{"error":"Pseudo manquant"}'); }
    target = username.replace(/^@/, '').trim();
    try { await connect(username); res.end('{"ok":true}'); }
    catch (e) { conn = null; res.statusCode = 502; res.end(JSON.stringify({ error: 'Connexion impossible : ' + (e.message || e) + ' (le compte est-il bien en live ?)' })); }
    return;
  }
  if (req.method === 'POST' && req.url === '/api/disconnect') { await disconnect(true); return res.end('{"ok":true}'); }
  const file = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!['index.html', 'app.js', 'style.css'].includes(path.relative(__dirname, file))) { res.statusCode = 404; return res.end('Not found'); }
  fs.readFile(file, (e, d) => { if (e) { res.statusCode = 404; return res.end('Not found'); } res.setHeader('Content-Type', types[path.extname(file)] || 'text/plain'); res.end(d); });
}).listen(PORT, '0.0.0.0', () => console.log(`RBZ Live sur http://localhost:${PORT}`));

// Connexion automatique : tant qu'un compte est défini, le bot (re)tente toutes les 20 s (live pas encore lancé, coupure, redémarrage...)
let trying = false;
setInterval(async () => {
  if (conn || trying || !target) return;
  trying = true;
  try { await connect(target); console.log('Connecté automatiquement à', target); }
  catch (e) { conn = null; send('status', { connected: false, username: target, waiting: true, error: `En attente du live de @${target}… (réessai auto)` }); }
  trying = false;
}, 20000);
