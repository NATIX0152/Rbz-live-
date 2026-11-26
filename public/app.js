const $ = (s) => document.querySelector(s);
const fmt = (n) => Number(n).toLocaleString('fr-FR');
const mmss = (s) => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0'); };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let ws, state = null, filled = false;

function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onmessage = (e) => { const m = JSON.parse(e.data); state = m.state; render(); if (m.type === 'gift') toast(m.gift); if (m.type === 'chat') addChat(m.chat); };
  ws.onclose = () => setTimeout(connect, 1500);
}
const send = (o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));

document.querySelectorAll('nav button').forEach((b) => b.onclick = () => {
  document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('main section').forEach((s) => s.classList.toggle('hide', s.id !== 'tab-' + b.dataset.tab));
});
document.querySelectorAll('[data-cmd]').forEach((b) => b.onclick = () => send({ cmd: b.dataset.cmd }));
document.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => send({ cmd: 'addTime', seconds: +b.dataset.add }));
$('#save').onclick = () => send({ cmd: 'settings', duration: +$('#s-duration').value, minBid: +$('#s-minBid').value, snipeDelay: +$('#s-snipeDelay').value, bonusTime: +$('#s-bonusTime').value, bonusEnabled: $('#s-bonusEnabled').checked, tieOvertime: $('#s-tieOvertime').checked });
$('#sim').onclick = () => { const [g, c] = $('#sim-g').value.split('|'); send({ cmd: 'simulate', nickname: $('#sim-n').value || 'Viewer', giftName: g, coins: +c, count: +$('#sim-c').value || 1 }); };
$('#b-con').onclick = () => send({ cmd: 'connect', username: $('#b-user').value });
$('#b-dis').onclick = () => send({ cmd: 'disconnect' });
$('#ov-url').value = location.origin + '/overlay.html';
$('#ov-copy').onclick = () => navigator.clipboard.writeText($('#ov-url').value);

const LABEL = { idle: 'En attente', running: 'En cours', paused: 'En pause', ended: 'Terminée' };
function render() {
  const s = state;
  $('#timer').textContent = mmss(s.remaining);
  $('#timer').classList.toggle('low', s.status === 'running' && s.remaining <= 10);
  const b = $('#badge'); b.textContent = LABEL[s.status]; b.className = 'badge ' + s.status;
  $('#total').textContent = fmt(s.totalCoins); $('#parts').textContent = s.participants; $('#gifts').textContent = s.giftCount;
  $('#top').textContent = s.leaderboard[0] ? fmt(s.leaderboard[0].coins) : '–';
  $('#lbempty').classList.toggle('hide', s.leaderboard.length > 0);
  $('#lb').innerHTML = s.leaderboard.map((u, i) => `<li><span class="rank">${i + 1}</span><span class="av" style="background-image:url('${esc(u.avatar || '')}')"></span><span class="nm">${esc(u.nickname)}</span><span class="cn">${fmt(u.coins)} 🪙</span><button class="x" title="Retirer" onclick="send({cmd:'removeBid',uniqueId:'${esc(u.uniqueId)}'})">✕</button></li>`).join('');
  const w = $('#win'); w.classList.toggle('hide', !(s.status === 'ended' && s.winner));
  if (s.winner) w.innerHTML = `🏆 Gagnant : <b>${esc(s.winner.nickname)}</b> avec ${fmt(s.winner.coins)} 🪙`;
  $('#glog').innerHTML = s.log.map((l) => `<div><b>${esc(l.nickname)}</b> — ${esc(l.giftName)} ×${l.count} = ${fmt(l.coins)} 🪙</div>`).join('') || '<div class="empty">Aucun cadeau.</div>';
  $('#botdot').classList.toggle('ok', s.bot.connected);
  $('#bottxt').textContent = s.bot.connected ? 'Bot connecté à @' + s.bot.username : 'Bot déconnecté';
  $('#b-err').textContent = s.bot.error ? 'Erreur : ' + s.bot.error : '';
  if (!filled) { filled = true; ['duration', 'minBid', 'snipeDelay', 'bonusTime'].forEach((k) => $('#s-' + k).value = s[k]); $('#s-bonusEnabled').checked = s.bonusEnabled; $('#s-tieOvertime').checked = s.tieOvertime; $('#b-user').value = s.bot.username || ''; s.bot.chat.forEach(addChat); }
}
function addChat(c) { const d = document.createElement('div'); d.innerHTML = `<b>${esc(c.nickname)}</b> ${esc(c.comment)}`; const l = $('#clog'); l.appendChild(d); while (l.children.length > 50) l.firstChild.remove(); l.scrollTop = l.scrollHeight; }
function toast(g) { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `🎁 <b>${esc(g.nickname)}</b> · ${esc(g.giftName)} ×${g.count} (+${fmt(g.coins)} 🪙)${g.bonus ? ' ⏱ bonus' : ''}`; document.body.appendChild(t); setTimeout(() => t.remove(), 3500); }
connect();
