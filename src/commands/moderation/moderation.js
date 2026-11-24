const { SlashCommandBuilder: S, PermissionFlagsBits: P } = require('discord.js');
const db = require('../../utils/db');
const config = require('../../config');
const { reply, fail, checkTarget, dm, modLog } = require('../../utils/mod');
const { parseDuration, formatDuration } = require('../../utils/time');

const MAX_TIMEOUT = 28 * 864e5;
const base = (name, desc, perm) => new S().setName(name).setDescription(desc).setDefaultMemberPermissions(perm).setDMPermission(false);
const userOpt = (o, desc = 'Membre') => o.setName('user').setDescription(desc).setRequired(true);
const reasonOpt = (o) => o.setName('reason').setDescription('Raison');
const getReason = (i) => i.options.getString('reason') ?? 'Aucune raison fournie';

module.exports = [
  // ───────────── /ban ─────────────
  {
    data: base('ban', 'Bannir un membre', P.BanMembers)
      .addUserOption((o) => userOpt(o))
      .addStringOption(reasonOpt)
      .addIntegerOption((o) => o.setName('delete_days').setDescription('Jours de messages à supprimer (0-7)').setMinValue(0).setMaxValue(7)),
    async execute(i) {
      const user = i.options.getUser('user', true);
      const err = checkTarget(i, i.options.getMember('user'));
      if (err) return fail(i, err);
      const reason = getReason(i);
      await dm(user, `🔨 Tu as été **banni** de **${i.guild.name}**.\nRaison : ${reason}`);
      await i.guild.members.ban(user, {
        reason: `${i.user.tag} : ${reason}`,
        deleteMessageSeconds: (i.options.getInteger('delete_days') ?? 0) * 86400,
      });
      await reply(i, { title: '🔨 Membre banni', desc: `${user.tag} a été banni.\n**Raison :** ${reason}` });
      modLog(i.guild, { action: 'Ban', target: user, moderator: i.user, reason });
    },
  },

  // ───────────── /unban ─────────────
  {
    data: base('unban', 'Débannir un utilisateur', P.BanMembers)
      .addStringOption((o) => o.setName('user_id').setDescription("ID de l'utilisateur banni").setRequired(true))
      .addStringOption(reasonOpt),
    async execute(i) {
      const id = i.options.getString('user_id', true).trim();
      const ban = await i.guild.bans.fetch(id).catch(() => null);
      if (!ban) return fail(i, "Cet utilisateur n'est pas banni (ID invalide ?).");
      const reason = getReason(i);
      await i.guild.members.unban(id, `${i.user.tag} : ${reason}`);
      await reply(i, { title: '✅ Membre débanni', desc: `${ban.user.tag} a été débanni.` });
      modLog(i.guild, { action: 'Unban', target: ban.user, moderator: i.user, reason });
    },
  },

  // ───────────── /kick ─────────────
  {
    data: base('kick', 'Expulser un membre', P.KickMembers).addUserOption((o) => userOpt(o)).addStringOption(reasonOpt),
    async execute(i) {
      const member = i.options.getMember('user');
      if (!member) return fail(i, "Ce membre n'est pas sur le serveur.");
      const err = checkTarget(i, member);
      if (err) return fail(i, err);
      const reason = getReason(i);
      await dm(member.user, `👢 Tu as été **expulsé** de **${i.guild.name}**.\nRaison : ${reason}`);
      await member.kick(`${i.user.tag} : ${reason}`);
      await reply(i, { title: '👢 Membre expulsé', desc: `${member.user.tag} a été expulsé.\n**Raison :** ${reason}` });
      modLog(i.guild, { action: 'Kick', target: member.user, moderator: i.user, reason });
    },
  },

  // ───────────── /softban ─────────────
  {
    data: base('softban', "Bannir puis débannir (supprime les messages récents)", P.BanMembers)
      .addUserOption((o) => userOpt(o))
      .addStringOption(reasonOpt),
    async execute(i) {
      const user = i.options.getUser('user', true);
      const err = checkTarget(i, i.options.getMember('user'));
      if (err) return fail(i, err);
      const reason = getReason(i);
      await i.guild.members.ban(user, { reason: `Softban par ${i.user.tag} : ${reason}`, deleteMessageSeconds: 7 * 86400 });
      await i.guild.members.unban(user, 'Softban');
      await reply(i, { title: '🧹 Softban', desc: `${user.tag} a été softban (messages des 7 derniers jours supprimés).` });
      modLog(i.guild, { action: 'Softban', target: user, moderator: i.user, reason });
    },
  },

  // ───────────── /mute (timeout) ─────────────
  {
    data: base('mute', 'Rendre muet un membre (timeout)', P.ModerateMembers)
      .addUserOption((o) => userOpt(o))
      .addStringOption((o) => o.setName('duration').setDescription('Durée : 10m, 2h, 7d… (max 28d)').setRequired(true))
      .addStringOption(reasonOpt),
    async execute(i) {
      const member = i.options.getMember('user');
      if (!member) return fail(i, "Ce membre n'est pas sur le serveur.");
      const err = checkTarget(i, member);
      if (err) return fail(i, err);
      const ms = parseDuration(i.options.getString('duration', true));
      if (!ms || ms > MAX_TIMEOUT) return fail(i, 'Durée invalide. Exemples : `30s`, `10m`, `2h`, `7d` (max 28d).');
      const reason = getReason(i);
      await member.timeout(ms, `${i.user.tag} : ${reason}`);
      await dm(member.user, `🔇 Tu as été **rendu muet** sur **${i.guild.name}** pendant ${formatDuration(ms)}.\nRaison : ${reason}`);
      await reply(i, { title: '🔇 Membre muet', desc: `${member.user.tag} est muet pendant **${formatDuration(ms)}**.\n**Raison :** ${reason}` });
      modLog(i.guild, { action: 'Mute', target: member.user, moderator: i.user, reason, extra: `Durée : ${formatDuration(ms)}` });
    },
  },

  // ───────────── /unmute ─────────────
  {
    data: base('unmute', 'Retirer le mute (timeout) d\'un membre', P.ModerateMembers).addUserOption((o) => userOpt(o)).addStringOption(reasonOpt),
    async execute(i) {
      const member = i.options.getMember('user');
      if (!member) return fail(i, "Ce membre n'est pas sur le serveur.");
      if (!member.isCommunicationDisabled()) return fail(i, "Ce membre n'est pas muet.");
      const reason = getReason(i);
      await member.timeout(null, `${i.user.tag} : ${reason}`);
      await reply(i, { title: '🔊 Mute retiré', desc: `${member.user.tag} peut de nouveau parler.` });
      modLog(i.guild, { action: 'Unmute', target: member.user, moderator: i.user, reason });
    },
  },

  // ───────────── /warn ─────────────
  {
    data: base('warn', 'Avertir un membre', P.ModerateMembers).addUserOption((o) => userOpt(o)).addStringOption((o) => reasonOpt(o).setRequired(true)),
    async execute(i) {
      const user = i.options.getUser('user', true);
      const member = i.options.getMember('user');
      const err = checkTarget(i, member);
      if (err) return fail(i, err);
      if (user.bot) return fail(i, "Impossible d'avertir un bot.");
      const reason = getReason(i);
      const g = db.guild(i.guild.id);
      const list = (g.warns[user.id] ??= []);
      list.push({ id: Date.now().toString(36), mod: i.user.id, reason, date: Date.now() });
      db.save();

      let extra = '';
      const t = config.warnThresholds;
      if (member && list.length >= t.kick) {
        await member.kick(`Auto : ${list.length} avertissements`).catch(() => {});
        extra = `\n👢 **Expulsion automatique** (${list.length} avertissements).`;
      } else if (member && list.length >= t.timeout) {
        await member.timeout(t.timeoutMs, `Auto : ${list.length} avertissements`).catch(() => {});
        extra = `\n🔇 **Mute automatique** de ${formatDuration(t.timeoutMs)} (${list.length} avertissements).`;
      }
      await dm(user, `⚠️ Tu as reçu un **avertissement** sur **${i.guild.name}**.\nRaison : ${reason}\nTotal : ${list.length}`);
      await reply(i, { title: '⚠️ Avertissement', desc: `${user.tag} a reçu un avertissement (**${list.length}** au total).\n**Raison :** ${reason}${extra}`, color: 'warn' });
      modLog(i.guild, { action: 'Warn', target: user, moderator: i.user, reason, extra: `Total : ${list.length}` });
    },
  },

  // ───────────── /warnings ─────────────
  {
    data: base('warnings', "Voir les avertissements d'un membre", P.ModerateMembers).addUserOption((o) => userOpt(o)),
    async execute(i) {
      const user = i.options.getUser('user', true);
      const list = db.guild(i.guild.id).warns[user.id] ?? [];
      if (!list.length) return reply(i, { desc: `✅ ${user.tag} n'a aucun avertissement.`, ephemeral: true });
      const lines = list
        .slice(-15)
        .map((w) => `\`${w.id}\` • <t:${Math.floor(w.date / 1000)}:d> • par <@${w.mod}>\n└ ${w.reason}`);
      await reply(i, { title: `⚠️ Avertissements de ${user.tag} (${list.length})`, desc: lines.join('\n'), color: 'warn' });
    },
  },

  // ───────────── /clearwarns ─────────────
  {
    data: base('clearwarns', 'Effacer les avertissements d\'un membre', P.ModerateMembers)
      .addUserOption((o) => userOpt(o))
      .addStringOption((o) => o.setName('id').setDescription("ID d'un avertissement précis (sinon tous)")),
    async execute(i) {
      const user = i.options.getUser('user', true);
      const g = db.guild(i.guild.id);
      const id = i.options.getString('id');
      const list = g.warns[user.id] ?? [];
      if (!list.length) return fail(i, "Ce membre n'a aucun avertissement.");
      if (id) {
        const idx = list.findIndex((w) => w.id === id);
        if (idx === -1) return fail(i, 'Avertissement introuvable.');
        list.splice(idx, 1);
      } else delete g.warns[user.id];
      db.save();
      await reply(i, { title: '🧽 Avertissements effacés', desc: id ? `Avertissement \`${id}\` supprimé.` : `Tous les avertissements de ${user.tag} ont été effacés.` });
      modLog(i.guild, { action: 'Clearwarns', target: user, moderator: i.user, reason: id ? `ID ${id}` : 'Tous' });
    },
  },

  // ───────────── /nick ─────────────
  {
    data: base('nick', "Changer le pseudo d'un membre", P.ManageNicknames)
      .addUserOption((o) => userOpt(o))
      .addStringOption((o) => o.setName('nickname').setDescription('Nouveau pseudo (vide = réinitialiser)').setMaxLength(32)),
    async execute(i) {
      const member = i.options.getMember('user');
      if (!member) return fail(i, "Ce membre n'est pas sur le serveur.");
      const err = checkTarget(i, member);
      if (err) return fail(i, err);
      const nick = i.options.getString('nickname');
      await member.setNickname(nick, `Par ${i.user.tag}`);
      await reply(i, { desc: nick ? `✏️ Pseudo de ${member} changé en **${nick}**.` : `✏️ Pseudo de ${member} réinitialisé.` });
    },
  },

  // ───────────── /role ─────────────
  {
    data: base('role', 'Ajouter ou retirer un rôle', P.ManageRoles)
      .addSubcommand((s) =>
        s.setName('add').setDescription('Ajouter un rôle').addUserOption((o) => userOpt(o)).addRoleOption((o) => o.setName('role').setDescription('Rôle').setRequired(true)),
      )
      .addSubcommand((s) =>
        s.setName('remove').setDescription('Retirer un rôle').addUserOption((o) => userOpt(o)).addRoleOption((o) => o.setName('role').setDescription('Rôle').setRequired(true)),
      ),
    async execute(i) {
      const member = i.options.getMember('user');
      const role = i.options.getRole('role', true);
      if (!member) return fail(i, "Ce membre n'est pas sur le serveur.");
      if (role.managed || role.id === i.guild.id) return fail(i, 'Ce rôle ne peut pas être géré manuellement.');
      if (role.position >= i.guild.members.me.roles.highest.position) return fail(i, "Ce rôle est au-dessus du mien.");
      if (i.user.id !== i.guild.ownerId && role.position >= i.member.roles.highest.position)
        return fail(i, 'Ce rôle est supérieur ou égal à ton rôle le plus haut.');
      if (i.options.getSubcommand() === 'add') {
        await member.roles.add(role, `Par ${i.user.tag}`);
        await reply(i, { desc: `✅ Rôle ${role} ajouté à ${member}.` });
      } else {
        await member.roles.remove(role, `Par ${i.user.tag}`);
        await reply(i, { desc: `✅ Rôle ${role} retiré à ${member}.` });
      }
    },
  },
];
