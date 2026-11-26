// Enchères TikTok : serveur + bot qui écoute le chat/les cadeaux du live.
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
app.use(express.static('public'));

// ---------- État de l'enchère ----------
const defaults = () => ({
  status: 'idle',            // idle | running | paused | ended
  duration: 60,              // durée initiale (s)
  remaining: 60,
  minBid: 1,                 // pièces minimum pour compter
  snipeDelay: 30,            // fenêtre anti-snipe (s)
  bonusTime: 30,             // secondes ajoutées si enchère dans la fenêtre
  bonusEnabled: true,
  tieOvertime: false,
  bids: {},                  // uniqueId -> {uniqueId, nickname, avatar, coins}
  totalCoins: 0,
  giftCount: 0,
  log: [],                   // derniers cadeaux
  winner: null,
});
let S = defaults();
const botState = { connected: false, username: '', error: null, chat: [] };

const leaderboard = () =>
  Object.values(S.bids).sort((a, b) => b.coins - a.coins).slice(0, 10);

function snapshot() {
  return { ...S, bids: undefined, leaderboard: leaderboard(), participants: Object.keys(S.bids).length, bot: botState };
}
function broadcast(type = 'state', extra = {}) {
  const msg = JSON.stringify({ type, state: snapshot(), ...extra });
  wss.clients.forEach((c) => c.readyState === 1 && c.send(msg));
}

// ---------- Compter un cadeau ----------
function addGift({ uniqueId, nickname, avatar, giftName, coins, count = 1 }) {
  if (S.status !== 'running') return false;          // on ne compte que pendant l'enchère
  const total = coins * count;
  if (total < S.minBid) return false;
  const u = (S.bids[uniqueId] ||= { uniqueId, nickname, avatar, coins: 0 });
  u.coins += total; u.nickname = nickname; u.avatar = avatar || u.avatar;
  S.totalCoins += total; S.giftCount += 1;
  S.log.unshift({ t: Date.now(), nickname, giftName, count, coins: total });
  S.log.length = Math.min(S.log.length, 30);
  let bonus = false;
  if (S.bonusEnabled && S.remaining <= S.snipeDelay) { S.remaining += S.bonusTime; bonus = true; }
  broadcast('gift', { gift: { nickname, avatar, giftName, count, coins: total, bonus } });
  return true;
}

// ---------- Timer ----------
setInterval(() => {
  if (S.status !== 'running') return;
  S.remaining = Math.max(0, S.remaining - 1);
  if (S.remaining === 0) {
    const lb = leaderboard();
    if (S.tieOvertime && lb.length > 1 && lb[0].coins === lb[1].coins) {
      S.remaining = S.bonusTime;                       // égalité → prolongation
    } else {
      S.status = 'ended'; S.winner = lb[0] || null;
    }
  }
  broadcast();
}, 1000);

// ---------- Bot TikTok ----------
let conn = null;
async function connectBot(username) {
  await disconnectBot();
  username = String(username || '').replace(/^@/, '').trim();
  if (!username) return;
  botState.username = username; botState.error = null; botState.chat = [];
  conn = new TikTokLiveConnection(username);
  conn.on(WebcastEvent.CHAT, (d) => {
    botState.chat.push({ nickname: d.user?.nickname, comment: d.comment });
    botState.chat = botState.chat.slice(-30);
    broadcast('chat', { chat: { nickname: d.user?.nickname, comment: d.comment } });
  });
  conn.on(WebcastEvent.GIFT, (d) => {
    // Cadeau "streakable" (giftType 1) : on ne compte qu'à la fin du combo.
    if (d.giftDetails?.giftType === 1 && !d.repeatEnd) return;
    addGift({
      uniqueId: d.user?.uniqueId, nickname: d.user?.nickname || d.user?.uniqueId,
      avatar: d.user?.profilePicture?.url?.[0],
      giftName: d.giftDetails?.giftName, coins: d.giftDetails?.diamondCount || 0,
      count: d.repeatCount || 1,
    });
  });
  conn.on('disconnected', () => { botState.connected = false; broadcast(); });
  conn.on('error', (e) => { botState.error = String(e?.message || e); broadcast(); });
  try {
    await conn.connect();
    botState.connected = true;
  } catch (e) {
    botState.connected = false; botState.error = String(e?.message || e);
  }
  broadcast();
}
async function disconnectBot() {
  if (conn) { try { conn.disconnect(); } catch {} conn = null; }
  botState.connected = false;
}

// ---------- Commandes du tableau de bord ----------
const actions = {
  start() {
    if (S.status === 'ended' || S.status === 'idle' && S.remaining <= 0) reset();
    S.status = 'running'; S.winner = null;
  },
  pause() { if (S.status === 'running') S.status = 'paused'; },
  reset() { reset(); },
  addTime({ seconds }) { S.remaining = Math.max(0, S.remaining + Number(seconds || 0)); },
  settings(p) {
    for (const k of ['minBid', 'snipeDelay', 'bonusTime']) if (p[k] != null) S[k] = Math.max(0, Number(p[k]) || 0);
    if (p.bonusEnabled != null) S.bonusEnabled = !!p.bonusEnabled;
    if (p.tieOvertime != null) S.tieOvertime = !!p.tieOvertime;
    if (p.duration != null) {
      S.duration = Math.max(5, Number(p.duration) || 60);
      if (S.status === 'idle') S.remaining = S.duration;
    }
  },
  simulate({ nickname = 'TestViewer', giftName = 'Rose', coins = 1, count = 1 }) {
    addGift({ uniqueId: nickname.toLowerCase(), nickname, giftName, coins: Number(coins), count: Number(count) });
  },
  removeBid({ uniqueId }) {
    const u = S.bids[uniqueId]; if (!u) return;
    S.totalCoins -= u.coins; delete S.bids[uniqueId];
  },
};
function reset() {
  const keep = { duration: S.duration, minBid: S.minBid, snipeDelay: S.snipeDelay, bonusTime: S.bonusTime, bonusEnabled: S.bonusEnabled, tieOvertime: S.tieOvertime };
  S = { ...defaults(), ...keep, remaining: keep.duration };
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'state', state: snapshot() }));
  ws.on('message', async (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.cmd === 'connect') await connectBot(m.username);
    else if (m.cmd === 'disconnect') { await disconnectBot(); broadcast(); }
    else if (actions[m.cmd]) { actions[m.cmd](m); broadcast(); }
  });
});

server.listen(PORT, () => console.log(`Enchères TikTok → http://localhost:${PORT}  (overlay OBS : /overlay.html)`));
