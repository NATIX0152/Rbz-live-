const { AuditLogEvent } = require('discord.js');
const db = require('../utils/db');
const { isTrusted } = require('../utils/perms');
const { getAuditEntry } = require('../utils/audit');
const { punish } = require('../utils/punish');
const { embed, sendLog, alertOwner } = require('../utils/log');

/** Un bot rejoint : on le garde seulement s'il est autorisé ou ajouté par un utilisateur de confiance. */
async function handleBotJoin(member) {
  const { guild } = member;
  const c = db.guild(guild.id).antibot;
  if (!c.enabled || isTrusted(guild, member.id) || c.allowed.includes(member.id)) return;

  const entry = await getAuditEntry(guild, AuditLogEvent.BotAdd, { targetId: member.id, retries: 3 });
  const adderId = entry?.executor?.id;
  if (adderId && isTrusted(guild, adderId)) return;

  const removed = await punish(guild, member.id, c.action, 'Anti-bot : bot non autorisé');
  let adderMsg = 'Auteur de l’ajout introuvable (permission « Voir les logs du serveur » ?)';
  if (adderId) {
    adderMsg = `${entry.executor.tag} (\`${adderId}\`)`;
    if (c.punishAdder) {
      const ok = await punish(guild, adderId, c.adderAction, 'Anti-bot : ajout d’un bot non autorisé');
      adderMsg += ` → ${c.adderAction} ${ok ? '✅' : '❌'}`;
    }
  }

  const e = embed(
    '🤖 Anti-bot',
    `Bot **${member.user.tag}** (\`${member.id}\`) ${removed ? `expulsé (${c.action})` : '⚠️ NON retiré (hiérarchie ?)'}.\n**Ajouté par :** ${adderMsg}`,
    'sec',
  );
  await sendLog(guild, e);
  await alertOwner(guild, e);
}

module.exports = { handleBotJoin };
