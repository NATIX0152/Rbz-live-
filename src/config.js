const { PermissionFlagsBits: P } = require('discord.js');

module.exports = {
  colors: {
    ok: 0x57f287,
    err: 0xed4245,
    warn: 0xfee75c,
    info: 0x5865f2,
    sec: 0xeb459e,
  },
  // Sanctions automatiques en fonction du nombre d'avertissements
  warnThresholds: { timeout: 3, timeoutMs: 60 * 60 * 1000, kick: 5 },
  // Permissions considérées comme dangereuses (antinuke)
  dangerousPerms: [
    P.Administrator,
    P.ManageGuild,
    P.ManageRoles,
    P.ManageChannels,
    P.BanMembers,
    P.KickMembers,
    P.ManageWebhooks,
  ],
};
