const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { colors } = require('../config');
const { sendLog, embed } = require('./log');

/** Réponse uniforme (gère reply / editReply / followUp). */
async function reply(i, { title, desc, color = 'ok', ephemeral = false, fields } = {}) {
  const e = new EmbedBuilder().setColor(colors[color] ?? color).setTimestamp();
  if (title) e.setTitle(title);
  if (desc) e.setDescription(desc);
  if (fields) e.addFields(fields);
  const payload = { embeds: [e], ephemeral };
  if (i.deferred) return i.editReply(payload);
  if (i.replied) return i.followUp(payload);
  return i.reply(payload);
}

const fail = (i, desc) => reply(i, { desc: `❌ ${desc}`, color: 'err', ephemeral: true });

/** Vérifie hiérarchie et cible. Renvoie un message d'erreur ou null. */
function checkTarget(i, member) {
  if (!member) return null; // utilisateur hors du serveur
  const { guild } = i;
  const me = guild.members.me;
  if (member.id === i.user.id) return 'Tu ne peux pas te cibler toi-même.';
  if (member.id === guild.ownerId) return 'Tu ne peux pas sanctionner le propriétaire du serveur.';
  if (member.id === me.id) return 'Je ne peux pas me sanctionner moi-même.';
  if (i.user.id !== guild.ownerId && member.roles.highest.position >= i.member.roles.highest.position)
    return 'Ce membre a un rôle supérieur ou égal au tien.';
  if (member.roles.highest.position >= me.roles.highest.position)
    return "Mon rôle n'est pas assez haut pour agir sur ce membre.";
  return null;
}

/** Réservé au propriétaire du serveur. */
async function requireOwner(i) {
  if (i.user.id === i.guild.ownerId) return true;
  await fail(i, 'Seul le **propriétaire du serveur** peut utiliser cette commande.');
  return false;
}

/** Réservé aux administrateurs. */
async function requireAdmin(i) {
  if (i.memberPermissions.has(PermissionFlagsBits.Administrator)) return true;
  await fail(i, 'Permission **Administrateur** requise.');
  return false;
}

async function dm(user, text) {
  await user.send(text).catch(() => {});
}

/** Journalise une action de modération dans le salon de logs. */
function modLog(guild, { action, target, moderator, reason, extra }) {
  const e = embed(`🔨 ${action}`, null, 'warn').addFields(
    { name: 'Cible', value: `${target} (\`${target.id}\`)`, inline: true },
    { name: 'Modérateur', value: `${moderator}`, inline: true },
    { name: 'Raison', value: reason || 'Aucune' },
  );
  if (extra) e.addFields({ name: 'Détails', value: extra });
  return sendLog(guild, e);
}

module.exports = { reply, fail, checkTarget, requireOwner, requireAdmin, dm, modLog };
