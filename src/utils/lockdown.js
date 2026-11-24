const { ChannelType } = require('discord.js');
const db = require('./db');

const LOCKABLE = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum];

/** Verrouille tous les salons textuels (@everyone ne peut plus écrire). */
async function lockdown(guild, reason = 'Lockdown') {
  const g = db.guild(guild.id);
  if (g.lockdown.active) return 0;
  const everyone = guild.roles.everyone;
  let count = 0;
  for (const ch of guild.channels.cache.values()) {
    if (!LOCKABLE.includes(ch.type)) continue;
    const ow = ch.permissionOverwrites.cache.get(everyone.id);
    if (ow?.deny.has('SendMessages')) continue; // déjà verrouillé : on n'y touche pas
    g.lockdown.channels[ch.id] = ow?.allow.has('SendMessages') ? true : null;
    try {
      await ch.permissionOverwrites.edit(everyone, { SendMessages: false, SendMessagesInThreads: false }, { reason });
      count++;
    } catch {
      delete g.lockdown.channels[ch.id];
    }
  }
  g.lockdown.active = true;
  db.save();
  return count;
}

/** Restaure l'état précédent des salons verrouillés par lockdown(). */
async function unlockdown(guild, reason = 'Fin du lockdown') {
  const g = db.guild(guild.id);
  if (!g.lockdown.active) return 0;
  const everyone = guild.roles.everyone;
  let count = 0;
  for (const [id, prev] of Object.entries(g.lockdown.channels)) {
    const ch = guild.channels.cache.get(id);
    if (!ch) continue;
    try {
      await ch.permissionOverwrites.edit(everyone, { SendMessages: prev, SendMessagesInThreads: prev }, { reason });
      count++;
    } catch {}
  }
  g.lockdown = { active: false, channels: {} };
  db.save();
  return count;
}

module.exports = { lockdown, unlockdown };
