const $ = s => document.querySelector(s);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
// Les enchères sont en pièces TikTok (coins)
const eur = n => Number(n).toLocaleString('fr-FR') + ' coins';

let coins = load('coins', [
  { id: 1, name: '2 € Commémorative 2012', emoji: '🪙', start: 50 },
  { id: 2, name: '1 Franc Semeuse 1960', emoji: '🥈', start: 30 },
]);
let history = load('history', []);
let settings = load('settings', { username: '', keyword: '!bid', increment: 5, duration: 60, snipe: 10, numberOnly: false, gifts: true, sound: true });
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
  $('#st-stock').textContent = coins.length;
  $('#st-best').textContent = history.length ? eur(Math.max(...history.map(h => h.price))) : '–';

  $('#coin-list').innerHTML = coins.map(c => `<div class="card coin"><div class="e">${c.emoji}</div><b>${esc(c.name)}</b><br><small class="muted">Départ : ${eur(c.start)}</small><br><button class="btn ghost" onclick="delCoin(${c.id})">Supprimer</button></div>`).join('') || '<p class="muted">Aucune pièce.</p>';
  $('#lot-select').innerHTML = coins.map(c => `<option value="${c.id}">${c.emoji} ${esc(c.name)} (${eur(c.start)})</option>`).join('');
  $('#hist-body').innerHTML = history.slice().reverse().map(h => `<tr><td>${new Date(h.date).toLocaleString('fr-FR')}</td><td>${esc(h.coin)}</td><td>${esc(h.winner || '—')}</td><td>${eur(h.price)}</td></tr>`).join('') || '<tr><td colspan=4 class="muted">Aucune vente.</td></tr>';
  $('#kw-hint').textContent = settings.keyword + ' 250';
  renderConn();
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Coins ----------
$('#coin-form').onsubmit = e => {
  e.preventDefault();
  const f = new FormData(e.target);
  coins.push({ id: Date.now(), name: f.get('name'), emoji: f.get('emoji') || '🪙', start: +f.get('start') });
  save('coins', coins); e.target.reset(); renderAll();
};
window.delCoin = id => { coins = coins.filter(c => c.id !== id); save('coins', coins); renderAll(); };

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
let connected = false;
function renderConn() {
  const u = settings.username || '';
  $('#side-status').innerHTML = `<i class="dot ${connected ? '' : 'off'}"></i> ${connected ? 'Connecté ' + esc(u) : 'TikTok déconnecté'}`;
  $('#conn-status').textContent = connected ? '🟢 Connecté à ' + u : 'Déconnecté';
  $('#btn-connect').textContent = connected ? 'Se déconnecter' : 'Se connecter au live';
}
$('#btn-connect').onclick = () => {
  if (!connected && !sf.elements.username.value.trim()) return alert('Entre ton nom d\'utilisateur TikTok.');
  settings.username = sf.elements.username.value.trim();
  save('settings', settings);
  connected = !connected; // démo : brancher ici tiktok-live-connector côté serveur
  renderConn();
};

// ---------- Auction ----------
const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
function log(html, cls = '') { const f = $('#feed'); f.insertAdjacentHTML('beforeend', `<div class="${cls}">${html}</div>`); f.scrollTop = f.scrollHeight; }
function beep() {
  if (!settings.sound) return;
  try { const c = new AudioContext(), o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 880; o.start(); o.stop(c.currentTime + .12); } catch {}
}
function drawAuction() {
  $('#lot-empty').hidden = !!auction; $('#lot-active').hidden = !auction;
  if (!auction) return;
  $('#lot-emoji').textContent = auction.coin.emoji;
  $('#lot-name').textContent = auction.coin.name;
  $('#lot-timer').textContent = fmt(auction.left);
  $('#lot-timer').classList.toggle('low', auction.left <= 10);
  $('#lot-bid').textContent = eur(auction.bid);
  $('#lot-bidder').textContent = auction.bidder ? '👑 ' + auction.bidder : 'Aucune offre';
}
$('#btn-start').onclick = () => {
  if (auction) return alert('Une enchère est déjà en cours.');
  const coin = coins.find(c => c.id == $('#lot-select').value); if (!coin) return;
  auction = { coin, bid: coin.start, bidder: null, left: settings.duration, gifted: {} };
  log(`🔔 Enchère ouverte : <b>${esc(coin.name)}</b> à ${eur(coin.start)}`);
  tick = setInterval(() => { if (--auction.left <= 0) endAuction(); else drawAuction(); }, 1000);
  drawAuction();
};
function endAuction() {
  clearInterval(tick); if (!auction) return;
  const a = auction; auction = null;
  history.push({ date: Date.now(), coin: a.coin.name, winner: a.bidder, price: a.bidder ? a.bid : 0 });
  save('history', history);
  log(a.bidder ? `🏆 Vendu à ${esc(a.bidder)} pour ${eur(a.bid)} !` : '⏹ Terminé sans offre.', 'win');
  drawAuction(); renderAll();
}
$('#btn-end').onclick = endAuction;
$('#btn-plus').onclick = () => { if (auction) { auction.left += 10; drawAuction(); } };

function placeBid(user, amount) {
  if (!auction) return log(`${esc(user)} : offre ignorée (pas d'enchère)`, 'no');
  const min = auction.bidder ? auction.bid + settings.increment : auction.bid;
  if (amount < min) return log(`${esc(user)} : ${eur(amount)} refusé (min ${eur(min)})`, 'no');
  auction.bid = amount; auction.bidder = user;
  if (auction.left <= 10) auction.left += settings.snipe;
  log(`💰 ${esc(user)} → <b>${eur(amount)}</b>`, 'ok'); beep(); drawAuction();
}
// Cadeau TikTok reçu : sa valeur en coins s'additionne au total offert par ce spectateur
window.onTikTokGift = (user, coinValue) => {
  if (!settings.gifts || !auction) return;
  const t = auction.gifted[user] = (auction.gifted[user] || 0) + coinValue;
  log(`🎁 ${esc(user)} a offert ${eur(coinValue)} (total ${eur(t)})`);
  if (t > auction.bid || !auction.bidder) placeBid(user, t);
};
// Point d'entrée pour un vrai chat TikTok (ex : relayé par WebSocket depuis ton serveur)
window.onTikTokComment = (user, text) => {
  const kw = settings.keyword.toLowerCase(), t = text.trim().toLowerCase();
  let m = t.startsWith(kw) ? t.slice(kw.length).trim() : (settings.numberOnly ? t : null);
  const n = m && parseFloat(m.replace(',', '.'));
  if (n > 0) placeBid(user, n);
};
$('#btn-sim').onclick = () => placeBid($('#sim-user').value || '@viewer', +$('#sim-amount').value);
$('#btn-gift').onclick = () => window.onTikTokGift($('#sim-user').value || '@viewer', +$('#sim-amount').value);

fillSettings(); route(); drawAuction();
