const { SlashCommandBuilder: S, EmbedBuilder, version } = require('discord.js');
const { colors } = require('../../config');
const { reply } = require('../../utils/mod');

const base = (name, desc) => new S().setName(name).setDescription(desc).setDMPermission(false);
const ts = (ms) => `<t:${Math.floor(ms / 1000)}:F> (<t:${Math.floor(ms / 1000)}:R>)`;

module.exports = [
  {
    data: base('ping', 'Latence du bot'),
    async execute(i) {
      await reply(i, { desc: `🏓 Pong ! **${i.client.ws.ping} ms**` });
    },
  },
  {
    data: base('help', 'Liste des commandes'),
    async execute(i) {
      const cats = { moderation: '🔨 Modération', security: '🛡️ Sécurité', utility: '🔧 Utilitaires' };
      const e = new EmbedBuilder().setTitle('📖 Aide').setColor(colors.info).setFooter({ text: `discord.js v${version}` });
      for (const [key, label] of Object.entries(cats)) {
        const list = i.client.commands.filter((c) => c.category === key).map((c) => `\`/${c.data.name}\``);
        if (list.length) e.addFields({ name: label, value: list.join(' ') });
      }
      e.setDescription('Utilise la complétion Discord pour voir les options de chaque commande.');
      await i.reply({ embeds: [e], ephemeral: true });
    },
  },
  {
    data: base('userinfo', "Infos sur un membre").addUserOption((o) => o.setName('user').setDescription('Membre')),
    async execute(i) {
      const user = i.options.getUser('user') ?? i.user;
      const m = i.options.getMember('user') ?? (user.id === i.user.id ? i.member : null);
      const e = new EmbedBuilder()
        .setTitle(user.tag)
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .setColor(colors.info)
        .addFields(
          { name: 'ID', value: user.id, inline: true },
          { name: 'Bot', value: user.bot ? 'Oui' : 'Non', inline: true },
          { name: 'Compte créé', value: ts(user.createdTimestamp) },
        );
      if (m) {
        e.addFields(
          { name: 'A rejoint', value: ts(m.joinedTimestamp) },
          { name: 'Rôles', value: m.roles.cache.filter((r) => r.id !== i.guild.id).map((r) => `${r}`).join(' ') || 'Aucun' },
        );
      }
      await i.reply({ embeds: [e] });
    },
  },
  {
    data: base('serverinfo', 'Infos sur le serveur'),
    async execute(i) {
      const g = i.guild;
      const e = new EmbedBuilder()
        .setTitle(g.name)
        .setThumbnail(g.iconURL({ size: 256 }))
        .setColor(colors.info)
        .addFields(
          { name: 'Propriétaire', value: `<@${g.ownerId}>`, inline: true },
          { name: 'Membres', value: `${g.memberCount}`, inline: true },
          { name: 'Salons', value: `${g.channels.cache.size}`, inline: true },
          { name: 'Rôles', value: `${g.roles.cache.size}`, inline: true },
          { name: 'Boosts', value: `${g.premiumSubscriptionCount ?? 0}`, inline: true },
          { name: 'Créé', value: ts(g.createdTimestamp) },
        );
      await i.reply({ embeds: [e] });
    },
  },
  {
    data: base('avatar', "Avatar d'un membre").addUserOption((o) => o.setName('user').setDescription('Membre')),
    async execute(i) {
      const user = i.options.getUser('user') ?? i.user;
      const e = new EmbedBuilder().setTitle(`Avatar de ${user.tag}`).setImage(user.displayAvatarURL({ size: 1024 })).setColor(colors.info);
      await i.reply({ embeds: [e] });
    },
  },
];
