const { EmbedBuilder } = require('discord.js');
const db = require('./db');
const { colors } = require('../config');

function embed(title, description, color = 'info') {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description ?? null)
    .setColor(colors[color] ?? color)
    .setTimestamp();
}

/** Envoie un embed dans le salon de logs configuré (silencieux en cas d'échec). */
async function sendLog(guild, emb) {
  const id = db.guild(guild.id).logChannel;
  const ch = id && (guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null)));
  if (ch?.isTextBased()) await ch.send({ embeds: [emb] }).catch(() => {});
}

/** Prévient le propriétaire en DM (alertes de sécurité). */
async function alertOwner(guild, emb) {
  const owner = await guild.fetchOwner().catch(() => null);
  if (owner) await owner.send({ embeds: [emb] }).catch(() => {});
}

module.exports = { embed, sendLog, alertOwner };
