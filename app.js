const $ = s => document.querySelector(s);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
// Les enchères sont en pièces TikTok (coins)
const eur = n => Number(n).toLocaleString('fr-FR') + ' coins';

let history = load('history', []);
let settings = { ...{ username: '', minimum: 0, duration: 60, snipe: 30, sound: true }, ...load('settings', {}) };
let auction = null, tick = null;

// ---------- Navigation ----------
function route() {
  const p = (location.hash || '#dashboard').slice(1);
  document.querySelectorAll('.page').forEach(e => e.classList.toggle('active', e.id === 'page-' + p));
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('active', a.dataset.page === p));
  renderAll();
}
addEventListener('hashchange', route);

// ---------- Rendering ----------
function renderAll() {
  $('#st-count').textContent = history.length;
  const total = history.reduce((s, h) => s + h.price, 0);
  $('#st-total').textContent = eur(total);
  $('#st-best').textContent = history.length ? eur(Math.max(...history.map(h => h.price))) : '–';

  $('#hist-body').innerHTML = history.slice().reverse().map(h => `<tr><td>${new Date(h.date).toLocaleString('fr-FR')}</td><td>${esc(h.coin || 'Enchère')}</td><td>${esc(h.winner || '—')}</td><td>${eur(h.price)}</td></tr>`).join('') || '<tr><td colspan=4 class="muted">Aucune vente.</td></tr>';
    renderConn();
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Settings ----------
const sf = $('#settings-form');
function fillSettings() {
  for (const [k, v] of Object.entries(settings)) {
    const el = sf.elements[k]; if (!el) continue;
    el.type === 'checkbox' ? el.checked = v : el.value = v;
  }
  $('#overlay-url').value = location.origin + location.pathname.replace(/[^/]*$/, '') + 'overlay.html';
}
sf.onsubmit = e => {
  e.preventDefault();
  for (const el of sf.elements) {
    if (!el.name) continue;
    settings[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value;
  }
  save('settings', settings); $('#saved').textContent = '✔ Enregistré'; setTimeout(() => $('#saved').textContent = '', 2000); renderAll();
};
let connected = false, connErr = '';
function renderConn() {
  const u = settings.username || '';
  $('#side-status').innerHTML = `<i class="dot ${connected ? '' : 'off'}"></i> ${connected ? 'Connecté ' + esc(u) : 'TikTok déconnecté'}`;
  $('#conn-status').textContent = connected ? '🟢 Connecté à ' + u + ' — les cadeaux sont comptés automatiquement' : (connErr || 'Déconnecté');
  $('#btn-connect').textContent = connected ? 'Se déconnecter' : 'Se connecter au live';
  $('#live-warn').hidden = connected;
}
$('#btn-connect').onclick = async () => {
  if (connected) { await fetch('/api/disconnect', { method: 'POST' }); return; }
  const u = sf.elements.username.value.trim();
  if (!u) { connErr = 'Entre ton nom d\'utilisateur TikTok.'; return renderConn(); }
  settings.username = u; save('settings', settings);
  connErr = 'Connexion…'; renderConn();
  try {
    const r = await fetch('/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u }) });
    const j = await r.json().catch(() => null);
    if (!j) throw new Error('NOSERVER');
    if (!r.ok) throw new Error(j.error);
  } catch (e) { connErr = '❌ ' + (['Failed to fetch', 'NOSERVER', 'Load failed'].includes(e.message) ? 'Le serveur du bot ne répond pas : ouvre le site depuis ton serveur (npm start ou Render), pas depuis l\'aperçu Claude' : e.message); renderConn(); }
};
// Flux temps réel du serveur : statut + cadeaux TikTok
try {
  const es = new EventSource('/events');
  es.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.type === 'status') { connected = m.connected; connErr = m.error ? '⚠ ' + m.error : ''; if (m.username) { settings.username = m.username; } renderConn(); }
    if (m.type === 'gift') window.onTikTokGift(m.user, m.coins);
  };
} catch {}

// ---------- Auction ----------
const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
function log(html, cls = '') { const f = $('#feed'); f.insertAdjacentHTML('beforeend', `<div class="${cls}">${html}</div>`); f.scrollTop = f.scrollHeight; }
function beep() {
  if (!settings.sound) return;
  try { const c = new AudioContext(), o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 880; o.start(); o.stop(c.currentTime + .12); } catch {}
}
const MEDALS = ['🥇', '🥈', '🥉'];
const ranking = () => Object.entries(auction.gifted).sort((x, y) => y[1] - x[1]);
function drawAuction() {
  $('#lot-empty').hidden = !!auction; $('#lot-active').hidden = !auction;
  if (!auction) return;
  const min = settings.minimum;
  $('#badge-min').textContent = min > 0 ? '✅ MINIMUM ' + eur(min) : '✅ AUCUN MINIMUM';
  $('#badge-snipe').textContent = settings.snipe + ' S';
  const sniping = auction.left <= settings.snipe;
  $('#lot-timer-label').textContent = sniping ? 'SNIPE DELAY' : 'TEMPS RESTANT';
  $('#lot-timer').textContent = fmt(auction.left);
  $('#lot-timer').classList.toggle('low', auction.left <= 10);
  const all = ranking(), ok = all.filter(r => r[1] >= min), below = all.filter(r => r[1] < min);
  const row = (r, i, dim) => `<div class="lb-row ${dim ? 'dim' : 'rank' + i}"><span class="medal">${dim ? '•' : (MEDALS[i] || (i + 1))}</span><div><b>${esc(r[0])}</b><div class="coins">${r[1].toLocaleString('fr-FR')} 🟡${dim ? ' <small>(sous le minimum, non compté)</small>' : ''}</div></div></div>`;
  $('#lb').innerHTML = ok.map((r, i) => row(r, i)).join('') + below.map(r => row(r, 0, true)).join('') || '<p class="muted">En attente de cadeaux…</p>';
  $('#lb-total').textContent = '👥 Total participants : ' + all.length;
}
$('#btn-start').onclick = () => {
  if (auction) return alert('Une enchère est déjà en cours.');
  auction = { left: settings.duration, gifted: {}, snipeHit: false };
  log(`🔔 Comptage ouvert :  ${fmt(settings.duration)}, minimum ${settings.minimum > 0 ? eur(settings.minimum) : 'aucun'}`);
  tick = setInterval(() => { if (--auction.left <= 0) endAuction(); else drawAuction(); }, 1000);
  drawAuction();
};
function endAuction() {
  clearInterval(tick); if (!auction) return;
  const a = auction; auction = null;
  const top = Object.entries(a.gifted).sort((x, y) => y[1] - x[1]).find(r => r[1] >= settings.minimum && r[1] > 0);
  history.push({ date: Date.now(), coin: 'Enchère', winner: top && top[0], price: top ? top[1] : 0 });
  save('history', history);
  log(top ? `🏆 Gagnant : ${esc(top[0])} avec ${eur(top[1])} !` : '⏹ Terminé : personne n\'a atteint le minimum.', 'win');
  drawAuction(); renderAll();
}
$('#btn-end').onclick = endAuction;
$('#btn-plus').onclick = () => { if (auction) { auction.left += 10; drawAuction(); } };

// Cadeau TikTok reçu : ajoute sa valeur en coins au total du spectateur, uniquement pendant le temps de comptage
window.onTikTokGift = (user, coinValue) => {
  if (!(coinValue > 0)) return;
  if (!auction) return log(`🎁 ${esc(user)} a envoyé ${eur(coinValue)} — pas compté : aucune enchère en cours (clique sur « Démarrer le comptage »)`, 'no');
  const t = auction.gifted[user] = (auction.gifted[user] || 0) + coinValue;
  const counted = t >= settings.minimum;
  log(`🎁 ${esc(user)} +${eur(coinValue)} (total ${eur(t)})${counted ? '' : ' — sous le minimum'}`, counted ? 'ok' : 'no');
  if (counted) {
    beep();
    if (auction.left < settings.snipe) { auction.left = settings.snipe; auction.snipeHit = true; } // snipe delay
  }
  drawAuction();
};

fillSettings(); route(); drawAuction();
