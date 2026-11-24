const { SlashCommandBuilder: S, PermissionFlagsBits: P, ChannelType } = require('discord.js');
const db = require('../../utils/db');
const { reply, fail, requireOwner, requireAdmin } = require('../../utils/mod');
const { lockdown, unlockdown } = require('../../utils/lockdown');
const { sendLog, embed } = require('../../utils/log');
const antiraid = require('../../modules/antiraid');

const admin = (name, desc) => new S().setName(name).setDescription(desc).setDefaultMemberPermissions(P.Administrator).setDMPermission(false);
const onoff = (b) => (b ? '🟢 Activé' : '🔴 Désactivé');
const ACTIONS = [
  { name: 'Expulser (kick)', value: 'kick' },
  { name: 'Bannir (ban)', value: 'ban' },
];

module.exports = [
  // ═════════════════════ /antiraid ═════════════════════
  {
    data: admin('antiraid', 'Protection anti-raid (arrivées massives)')
      .addSubcommand((s) => s.setName('enable').setDescription('Activer'))
      .addSubcommand((s) => s.setName('disable').setDescription('Désactiver'))
      .addSubcommand((s) => s.setName('status').setDescription('Voir la configuration'))
      .addSubcommand((s) => s.setName('stop').setDescription('Arrêter le mode raid en cours (et déverrouiller)'))
      .addSubcommand((s) =>
        s
          .setName('config')
          .setDescription('Configurer')
          .addIntegerOption((o) => o.setName('threshold').setDescription("Nombre d'arrivées déclenchant le raid").setMinValue(2).setMaxValue(50))
          .addIntegerOption((o) => o.setName('seconds').setDescription('…dans cette fenêtre (secondes)').setMinValue(2).setMaxValue(120))
          .addStringOption((o) =>
            o.setName('action').setDescription('Sanction des arrivants').addChoices(...ACTIONS, { name: 'Mute 24h (timeout)', value: 'timeout' }),
          )
          .addIntegerOption((o) => o.setName('min_account_age').setDescription("Âge minimum du compte en jours (0 = off)").setMinValue(0).setMaxValue(365))
          .addBooleanOption((o) => o.setName('block_no_avatar').setDescription('Sanctionner les comptes sans avatar'))
          .addIntegerOption((o) => o.setName('duration').setDescription('Durée du mode raid (minutes)').setMinValue(1).setMaxValue(1440))
          .addBooleanOption((o) => o.setName('auto_lockdown').setDescription('Verrouiller les salons pendant un raid')),
      ),
    async execute(i) {
      if (!(await requireAdmin(i))) return;
      const c = db.guild(i.guild.id).antiraid;
      const sub = i.options.getSubcommand();
      if (sub === 'enable' || sub === 'disable') {
        c.enabled = sub === 'enable';
        db.save();
        return reply(i, { desc: `🛡️ Anti-raid ${c.enabled ? '**activé**' : '**désactivé**'}.` });
      }
      if (sub === 'stop') {
        const was = await antiraid.endRaid(i.guild, `Arrêté par ${i.user.tag}`);
        return reply(i, { desc: was ? '✅ Mode raid arrêté.' : "Aucun mode raid en cours." });
      }
      if (sub === 'config') {
        const o = i.options;
        c.threshold = o.getInteger('threshold') ?? c.threshold;
        c.seconds = o.getInteger('seconds') ?? c.seconds;
        c.action = o.getString('action') ?? c.action;
        c.minAccountAgeDays = o.getInteger('min_account_age') ?? c.minAccountAgeDays;
        c.noAvatar = o.getBoolean('block_no_avatar') ?? c.noAvatar;
        c.duration = o.getInteger('duration') ?? c.duration;
        c.autoLockdown = o.getBoolean('auto_lockdown') ?? c.autoLockdown;
        db.save();
      }
      await reply(i, {
        title: '🛡️ Anti-raid',
        color: 'sec',
        desc: [
          `**Statut :** ${onoff(c.enabled)}${antiraid.isRaid(i.guild.id) ? ' — 🚨 **RAID EN COURS**' : ''}`,
          `**Déclencheur :** ${c.threshold} arrivées en ${c.seconds}s`,
          `**Sanction :** ${c.action}`,
          `**Âge min. du compte :** ${c.minAccountAgeDays ? c.minAccountAgeDays + ' j' : 'off'}`,
          `**Sans avatar :** ${c.noAvatar ? 'sanctionné' : 'toléré'}`,
          `**Durée du mode raid :** ${c.duration} min`,
          `**Lockdown auto :** ${c.autoLockdown ? 'oui' : 'non'}`,
        ].join('\n'),
      });
    },
  },

  // ═════════════════════ /antibot ═════════════════════
  {
    data: admin('antibot', "Protection anti-bot (ajout de bots non autorisés)")
      .addSubcommand((s) => s.setName('enable').setDescription('Activer'))
      .addSubcommand((s) => s.setName('disable').setDescription('Désactiver'))
      .addSubcommand((s) => s.setName('status').setDescription('Voir la configuration'))
      .addSubcommand((s) =>
        s
          .setName('config')
          .setDescription('Configurer')
          .addStringOption((o) => o.setName('action').setDescription('Sanction du bot').addChoices(...ACTIONS))
          .addBooleanOption((o) => o.setName('punish_adder').setDescription("Sanctionner aussi la personne qui a ajouté le bot"))
          .addStringOption((o) =>
            o.setName('adder_action').setDescription("Sanction de l'ajouteur").addChoices(...ACTIONS, { name: 'Retirer tous ses rôles (derank)', value: 'derank' }),
          ),
      )
      .addSubcommand((s) => s.setName('allow').setDescription('Autoriser un bot').addStringOption((o) => o.setName('bot_id').setDescription('ID du bot').setRequired(true)))
      .addSubcommand((s) => s.setName('disallow').setDescription('Retirer un bot de la liste').addStringOption((o) => o.setName('bot_id').setDescription('ID du bot').setRequired(true))),
    async execute(i) {
      if (!(await requireAdmin(i))) return;
      const c = db.guild(i.guild.id).antibot;
      const sub = i.options.getSubcommand();
      if (sub === 'enable' || sub === 'disable') {
        c.enabled = sub === 'enable';
        db.save();
        return reply(i, { desc: `🤖 Anti-bot ${c.enabled ? '**activé**' : '**désactivé**'}.` });
      }
      if (sub === 'allow' || sub === 'disallow') {
        const id = i.options.getString('bot_id', true).trim();
        if (!/^\d{15,22}$/.test(id)) return fail(i, 'ID invalide.');
        if (sub === 'allow') {
          if (!c.allowed.includes(id)) c.allowed.push(id);
        } else c.allowed = c.allowed.filter((b) => b !== id);
        db.save();
        return reply(i, { desc: `🤖 Bot \`${id}\` ${sub === 'allow' ? 'autorisé ✅' : 'retiré de la liste'}.` });
      }
      if (sub === 'config') {
        c.action = i.options.getString('action') ?? c.action;
        c.punishAdder = i.options.getBoolean('punish_adder') ?? c.punishAdder;
        c.adderAction = i.options.getString('adder_action') ?? c.adderAction;
        db.save();
      }
      await reply(i, {
        title: '🤖 Anti-bot',
        color: 'sec',
        desc: [
          `**Statut :** ${onoff(c.enabled)}`,
          `**Sanction du bot :** ${c.action}`,
          `**Sanction de l'ajouteur :** ${c.punishAdder ? c.adderAction : 'aucune'}`,
          `**Bots autorisés :** ${c.allowed.length ? c.allowed.map((b) => `\`${b}\``).join(', ') : 'aucun'}`,
          '',
          "_Un bot ajouté par le propriétaire ou un membre de la whitelist est toujours accepté._",
        ].join('\n'),
      });
    },
  },

  // ═════════════════════ /antinuke ═════════════════════
  {
    data: admin('antinuke', 'Protection antinuke (suppressions/créations massives, permissions dangereuses…)')
      .addSubcommand((s) => s.setName('enable').setDescription('Activer (propriétaire uniquement)'))
      .addSubcommand((s) => s.setName('disable').setDescription('Désactiver (propriétaire uniquement)'))
      .addSubcommand((s) => s.setName('status').setDescription('Voir la configuration'))
      .addSubcommand((s) =>
        s
          .setName('punishment')
          .setDescription('Sanction appliquée (propriétaire uniquement)')
          .addStringOption((o) =>
            o.setName('type').setDescription('Sanction').setRequired(true).addChoices(...ACTIONS, { name: 'Retirer tous ses rôles (derank)', value: 'derank' }),
          ),
      )
      .addSubcommand((s) =>
        s
          .setName('limit')
          .setDescription("Définir la limite d'une action (propriétaire uniquement)")
          .addStringOption((o) =>
            o.setName('type').setDescription('Action').setRequired(true).addChoices(
              { name: 'Suppression de salons', value: 'channelDelete' },
              { name: 'Création de salons', value: 'channelCreate' },
              { name: 'Suppression de rôles', value: 'roleDelete' },
              { name: 'Création de rôles', value: 'roleCreate' },
              { name: 'Bannissements', value: 'ban' },
              { name: 'Expulsions', value: 'kick' },
              { name: 'Création de webhooks', value: 'webhookCreate' },
              { name: 'Permissions dangereuses', value: 'dangerousRole' },
            ),
          )
          .addIntegerOption((o) => o.setName('value').setDescription('Actions tolérées dans la fenêtre (0 = aucune)').setMinValue(0).setMaxValue(20).setRequired(true)),
      )
      .addSubcommand((s) =>
        s
          .setName('window')
          .setDescription('Fenêtre de comptage en secondes (propriétaire uniquement)')
          .addIntegerOption((o) => o.setName('seconds').setDescription('Secondes').setMinValue(3).setMaxValue(120).setRequired(true)),
      ),
    async execute(i) {
      if (!(await requireAdmin(i))) return;
      const c = db.guild(i.guild.id).antinuke;
      const sub = i.options.getSubcommand();
      if (sub !== 'status' && !(await requireOwner(i))) return;

      if (sub === 'enable' || sub === 'disable') {
        c.enabled = sub === 'enable';
        db.save();
        return reply(i, { desc: `☢️ Antinuke ${c.enabled ? '**activé**' : '**désactivé**'}.` });
      }
      if (sub === 'punishment') c.punishment = i.options.getString('type', true);
      if (sub === 'limit') c.limits[i.options.getString('type', true)] = i.options.getInteger('value', true);
      if (sub === 'window') c.window = i.options.getInteger('seconds', true);
      db.save();

      const L = c.limits;
      await reply(i, {
        title: '☢️ Antinuke',
        color: 'sec',
        desc: [
          `**Statut :** ${onoff(c.enabled)}`,
          `**Sanction :** ${c.punishment}`,
          `**Fenêtre :** ${c.window}s _(sanction si le nombre dépasse la limite)_`,
          '',
          `Suppression de salons : **${L.channelDelete}**`,
          `Création de salons : **${L.channelCreate}**`,
          `Suppression de rôles : **${L.roleDelete}**`,
          `Création de rôles : **${L.roleCreate}**`,
          `Bannissements : **${L.ban}**`,
          `Expulsions : **${L.kick}**`,
          `Webhooks créés : **${L.webhookCreate}**`,
          `Permissions dangereuses : **${L.dangerousRole}**`,
          '',
          '_Exemptés : propriétaire, bot, whitelist. Les actions de masse sont annulées automatiquement (salons/rôles recréés ou supprimés, bans levés…)._',
          `_Whitelist : **${db.guild(i.guild.id).whitelist.length}** membre(s) — voir \`/whitelist list\`._`,
        ].join('\n'),
      });
    },
  },

  // ═════════════════════ /whitelist ═════════════════════
  {
    data: admin('whitelist', 'Utilisateurs exemptés des protections (propriétaire uniquement)')
      .addSubcommand((s) => s.setName('add').setDescription('Ajouter').addUserOption((o) => o.setName('user').setDescription('Utilisateur').setRequired(true)))
      .addSubcommand((s) => s.setName('remove').setDescription('Retirer').addUserOption((o) => o.setName('user').setDescription('Utilisateur').setRequired(true)))
      .addSubcommand((s) => s.setName('list').setDescription('Afficher la whitelist')),
    async execute(i) {
      if (!(await requireOwner(i))) return;
      const g = db.guild(i.guild.id);
      const sub = i.options.getSubcommand();
      if (sub === 'list')
        return reply(i, {
          title: '✅ Whitelist',
          color: 'sec',
          desc: g.whitelist.length ? g.whitelist.map((id) => `<@${id}> (\`${id}\`)`).join('\n') : 'Vide (seul le propriétaire est exempté).',
          ephemeral: true,
        });
      const user = i.options.getUser('user', true);
      if (sub === 'add') {
        if (!g.whitelist.includes(user.id)) g.whitelist.push(user.id);
      } else g.whitelist = g.whitelist.filter((id) => id !== user.id);
      db.save();
      await reply(i, { desc: `${sub === 'add' ? '✅ Ajouté à' : '🗑️ Retiré de'} la whitelist : ${user}`, ephemeral: true });
      sendLog(i.guild, embed('✅ Whitelist modifiée', `${i.user} : **${sub}** ${user} (\`${user.id}\`)`, 'sec'));
    },
  },

  // ═════════════════════ /automod ═════════════════════
  {
    data: admin('automod', 'Modération automatique des messages')
      .addSubcommand((s) => s.setName('status').setDescription('Voir les règles'))
      .addSubcommand((s) =>
        s
          .setName('set')
          .setDescription('Activer/désactiver une règle')
          .addStringOption((o) =>
            o.setName('rule').setDescription('Règle').setRequired(true).addChoices(
              { name: 'Anti-liens', value: 'antilink' },
              { name: "Anti-invitations Discord", value: 'antiinvite' },
              { name: 'Anti-spam', value: 'antispam' },
              { name: 'Anti-mentions de masse', value: 'massmention' },
            ),
          )
          .addBooleanOption((o) => o.setName('enabled').setDescription('Activé ?').setRequired(true)),
      ),
    async execute(i) {
      if (!(await requireAdmin(i))) return;
      const c = db.guild(i.guild.id).automod;
      if (i.options.getSubcommand() === 'set') {
        c[i.options.getString('rule', true)] = i.options.getBoolean('enabled', true);
        db.save();
      }
      await reply(i, {
        title: '🤖 Automod',
        color: 'sec',
        desc: [
          `Anti-liens : ${onoff(c.antilink)}`,
          `Anti-invitations : ${onoff(c.antiinvite)}`,
          `Anti-spam (5 msg / 5s → mute 10 min) : ${onoff(c.antispam)}`,
          `Anti-mentions (≥ 5 → mute 10 min) : ${onoff(c.massmention)}`,
          '',
          '_Les membres avec « Gérer les messages » et la whitelist sont exemptés._',
        ].join('\n'),
      });
    },
  },

  // ═════════════════════ /lockdown ═════════════════════
  {
    data: admin('lockdown', 'Verrouiller / déverrouiller tous les salons')
      .addSubcommand((s) => s.setName('start').setDescription('Verrouiller tous les salons textuels'))
      .addSubcommand((s) => s.setName('end').setDescription('Restaurer les salons')),
    async execute(i) {
      if (!(await requireAdmin(i))) return;
      await i.deferReply();
      if (i.options.getSubcommand() === 'start') {
        if (db.guild(i.guild.id).lockdown.active) return fail(i, 'Un lockdown est déjà actif.');
        const n = await lockdown(i.guild, `Lockdown par ${i.user.tag}`);
        await reply(i, { title: '🔒 Lockdown', desc: `**${n}** salon(s) verrouillé(s).`, color: 'err' });
      } else {
        const n = await unlockdown(i.guild, `Fin du lockdown par ${i.user.tag}`);
        await reply(i, { title: '🔓 Fin du lockdown', desc: `**${n}** salon(s) restauré(s).` });
      }
    },
  },

  // ═════════════════════ /setlogs ═════════════════════
  {
    data: admin('setlogs', 'Définir le salon de logs (modération + sécurité)').addChannelOption((o) =>
      o.setName('channel').setDescription('Salon (vide = désactiver)').addChannelTypes(ChannelType.GuildText),
    ),
    async execute(i) {
      if (!(await requireAdmin(i))) return;
      const ch = i.options.getChannel('channel');
      db.guild(i.guild.id).logChannel = ch?.id ?? null;
      db.save();
      await reply(i, { desc: ch ? `📝 Logs envoyés dans ${ch}.` : '📝 Logs désactivés.' });
      if (ch) sendLog(i.guild, embed('📝 Logs activés', 'Les actions de modération et alertes de sécurité apparaîtront ici.', 'ok'));
    },
  },
];
