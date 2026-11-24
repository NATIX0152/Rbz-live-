const { PermissionFlagsBits } = require('discord.js');
const db = require('../utils/db');
const { isTrusted } = require('../utils/perms');
const { embed, sendLog } = require('../utils/log');

const INVITE = /(discord\.(gg|io|me|li)|discord(app)?\.com\/invite)\/\S+/i;
const LINK = /https?:\/\/\S+/i;
const spam = new Map(); // guild:user -> [timestamps]

async function flag(msg, rule, timeoutMs) {
  await msg.delete().catch(() => {});
  if (timeoutMs) await msg.member.timeout(timeoutMs, `Automod : ${rule}`).catch(() => {});
  const warn = await msg.channel.send(`⚠️ ${msg.author}, ${rule}.`).catch(() => null);
  if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
  await sendLog(
    msg.guild,
    embed('🤖 Automod', `${msg.author.tag} (\`${msg.author.id}\`) dans ${msg.channel}\n**Règle :** ${rule}`, 'warn'),
  );
}

module.exports = {
  name: 'messageCreate',
  async execute(client, msg) {
    if (!msg.guild || msg.author.bot || !msg.member) return;
    const cfg = db.guild(msg.guild.id).automod;
    if (!Object.values(cfg).some(Boolean)) return;
    if (isTrusted(msg.guild, msg.author.id) || msg.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

    if (cfg.antiinvite && INVITE.test(msg.content)) return flag(msg, "les invitations Discord sont interdites");
    if (cfg.antilink && LINK.test(msg.content)) return flag(msg, 'les liens sont interdits');

    if (cfg.massmention && msg.mentions.users.size + msg.mentions.roles.size >= 5)
      return flag(msg, 'trop de mentions', 10 * 60_000);

    if (cfg.antispam) {
      const key = `${msg.guild.id}:${msg.author.id}`;
      const now = Date.now();
      const list = (spam.get(key) ?? []).filter((t) => now - t < 5000);
      list.push(now);
      spam.set(key, list);
      if (list.length >= 5) {
        spam.delete(key);
        return flag(msg, 'spam détecté', 10 * 60_000);
      }
    }
  },
};
