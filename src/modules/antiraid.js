const db = require('../utils/db');
const { isTrusted } = require('../utils/perms');
const { punish } = require('../utils/punish');
const { lockdown, unlockdown } = require('../utils/lockdown');
const { embed, sendLog, alertOwner } = require('../utils/log');

const joins = new Map(); // guildId -> [{ t, id }]
const timers = new Map(); // guildId -> Timeout

const isRaid = (guildId) => db.guild(guildId).antiraid.until > Date.now();

async function sanction(member, why) {
  const c = db.guild(member.guild.id).antiraid;
  const ok = await punish(member.guild, member.id, c.action, `Anti-raid : ${why}`);
  await sendLog(
    member.guild,
    embed('🛡️ Anti-raid', `${member.user.tag} (\`${member.id}\`)\n**Raison :** ${why}\n**Action :** ${c.action} ${ok ? '✅' : '❌ (échec)'}`, 'sec'),
  );
}

function scheduleEnd(guild) {
  clearTimeout(timers.get(guild.id));
  const left = db.guild(guild.id).antiraid.until - Date.now();
  timers.set(guild.id, setTimeout(() => endRaid(guild, 'Durée écoulée'), Math.max(left, 0)));
}

async function startRaid(guild, why) {
  const c = db.guild(guild.id).antiraid;
  c.until = Date.now() + c.duration * 60_000;
  const alert = embed(
    '🚨 RAID DÉTECTÉ',
    `${why}\nMode raid actif pendant **${c.duration} min** : les nouveaux arrivants sont sanctionnés (\`${c.action}\`).`,
    'err',
  );
  if (c.autoLockdown) {
    const n = await lockdown(guild, 'Anti-raid : lockdown automatique');
    c.lockedByRaid = n > 0;
    alert.addFields({ name: 'Lockdown', value: `${n} salon(s) verrouillé(s)` });
  }
  db.save();
  scheduleEnd(guild);
  await sendLog(guild, alert);
  await alertOwner(guild, alert);
}

async function endRaid(guild, why = 'Arrêt manuel') {
  clearTimeout(timers.get(guild.id));
  const c = db.guild(guild.id).antiraid;
  const wasActive = c.until > 0;
  c.until = 0;
  if (c.lockedByRaid) await unlockdown(guild, 'Fin du mode raid');
  c.lockedByRaid = false;
  db.save();
  if (wasActive) await sendLog(guild, embed('✅ Fin du mode raid', why, 'ok'));
  return wasActive;
}

async function handleJoin(member) {
  const { guild } = member;
  const c = db.guild(guild.id).antiraid;
  if (!c.enabled || isTrusted(guild, member.id)) return;

  const age = (Date.now() - member.user.createdTimestamp) / 864e5;
  if (c.minAccountAgeDays > 0 && age < c.minAccountAgeDays)
    return sanction(member, `compte trop récent (${age.toFixed(1)} j < ${c.minAccountAgeDays} j)`);
  if (c.noAvatar && !member.user.avatar) return sanction(member, 'compte sans avatar');
  if (isRaid(guild.id)) return sanction(member, 'mode raid actif');

  const now = Date.now();
  const list = (joins.get(guild.id) ?? []).filter((j) => now - j.t < c.seconds * 1000);
  list.push({ t: now, id: member.id });
  joins.set(guild.id, list);

  if (list.length >= c.threshold) {
    joins.delete(guild.id);
    await startRaid(guild, `${list.length} arrivées en moins de ${c.seconds}s.`);
    for (const j of list) {
      const m = guild.members.cache.get(j.id);
      if (m) await sanction(m, 'participation présumée au raid');
    }
  }
}

/** Au démarrage : reprend ou termine les raids en cours. */
function resume(client) {
  for (const id of db.allGuildIds()) {
    const guild = client.guilds.cache.get(id);
    if (!guild) continue;
    const c = db.guild(id).antiraid;
    if (c.until > Date.now()) scheduleEnd(guild);
    else if (c.until > 0) endRaid(guild, 'Raid terminé pendant l’arrêt du bot');
  }
}

module.exports = { handleJoin, startRaid, endRaid, isRaid, resume };
