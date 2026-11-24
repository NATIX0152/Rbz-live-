const { SlashCommandBuilder: S, PermissionFlagsBits: P, ChannelType } = require('discord.js');
const { reply, fail } = require('../../utils/mod');
const { sendLog, embed } = require('../../utils/log');

const base = (name, desc, perm) => new S().setName(name).setDescription(desc).setDefaultMemberPermissions(perm).setDMPermission(false);
const TEXT = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const chanOpt = (o) => o.setName('channel').setDescription('Salon (par défaut : actuel)').addChannelTypes(...TEXT);

module.exports = [
  // ───────────── /clear ─────────────
  {
    data: base('clear', 'Supprimer des messages', P.ManageMessages)
      .addIntegerOption((o) => o.setName('amount').setDescription('Nombre de messages (1-100)').setMinValue(1).setMaxValue(100).setRequired(true))
      .addUserOption((o) => o.setName('user').setDescription('Ne supprimer que les messages de ce membre')),
    async execute(i) {
      await i.deferReply({ ephemeral: true });
      const amount = i.options.getInteger('amount', true);
      const user = i.options.getUser('user');
      let msgs = await i.channel.messages.fetch({ limit: user ? 100 : amount });
      if (user) msgs = msgs.filter((m) => m.author.id === user.id).first(amount);
      const deleted = await i.channel.bulkDelete(msgs, true); // ignore les messages > 14 jours
      await reply(i, { desc: `🧹 **${deleted.size}** message(s) supprimé(s).` });
      sendLog(i.guild, embed('🧹 Clear', `${i.user} a supprimé **${deleted.size}** message(s) dans ${i.channel}${user ? ` de ${user}` : ''}.`, 'warn'));
    },
  },

  // ───────────── /slowmode ─────────────
  {
    data: base('slowmode', 'Définir le mode lent', P.ManageChannels)
      .addIntegerOption((o) => o.setName('seconds').setDescription('Secondes (0 = désactiver, max 21600)').setMinValue(0).setMaxValue(21600).setRequired(true))
      .addChannelOption(chanOpt),
    async execute(i) {
      const ch = i.options.getChannel('channel') ?? i.channel;
      const s = i.options.getInteger('seconds', true);
      await ch.setRateLimitPerUser(s, `Par ${i.user.tag}`);
      await reply(i, { desc: s ? `🐌 Mode lent de **${s}s** dans ${ch}.` : `🐇 Mode lent désactivé dans ${ch}.` });
    },
  },

  // ───────────── /lock ─────────────
  {
    data: base('lock', 'Verrouiller un salon', P.ManageChannels).addChannelOption(chanOpt).addStringOption((o) => o.setName('reason').setDescription('Raison')),
    async execute(i) {
      const ch = i.options.getChannel('channel') ?? i.channel;
      await ch.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: false }, { reason: i.options.getString('reason') ?? `Lock par ${i.user.tag}` });
      await reply(i, { desc: `🔒 ${ch} est verrouillé.`, color: 'warn' });
    },
  },

  // ───────────── /unlock ─────────────
  {
    data: base('unlock', 'Déverrouiller un salon', P.ManageChannels).addChannelOption(chanOpt),
    async execute(i) {
      const ch = i.options.getChannel('channel') ?? i.channel;
      await ch.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: null }, { reason: `Unlock par ${i.user.tag}` });
      await reply(i, { desc: `🔓 ${ch} est déverrouillé.` });
    },
  },

  // ───────────── /purge-bots ─────────────
  {
    data: base('clearbots', 'Supprimer les messages de bots récents', P.ManageMessages),
    async execute(i) {
      await i.deferReply({ ephemeral: true });
      const msgs = (await i.channel.messages.fetch({ limit: 100 })).filter((m) => m.author.bot);
      const deleted = await i.channel.bulkDelete(msgs, true);
      await reply(i, { desc: `🤖 **${deleted.size}** message(s) de bots supprimé(s).` });
    },
  },
];
