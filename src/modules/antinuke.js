const { AuditLogEvent } = require('discord.js');
const db = require('../utils/db');
const config = require('../config');
const { isTrusted } = require('../utils/perms');
const { getAuditEntry } = require('../utils/audit');
const { punish } = require('../utils/punish');
const { embed, sendLog, alertOwner } = require('../utils/log');

const buckets = new Map(); // guild:user:type -> [{ t, revert }]
const punished = new Map(); // guild:user -> timestamp de sanction

const LABELS = {
  channelDelete: 'suppression de salons',
  channelCreate: 'création de salons',
  roleDelete: 'suppression de rôles',
  roleCreate: 'création de rôles',
  ban: 'bannissements',
  kick: 'expulsions',
  webhookCreate: 'création de webhooks',
  dangerousRole: 'attribution de permissions dangereuses',
};

/**
 * Cœur de l'antinuke.
 * - retrouve l'auteur via le journal d'audit ;
 * - ignore propriétaire / bot / whitelist ;
 * - compte les actions dans la fenêtre ; au-delà de la limite : sanction + annulation de toutes les actions de la fenêtre.
 */
async function track(guild, { type, auditType, targetId, filter, retries, revert }) {
  const cfg = db.guild(guild.id).antinuke;
  if (!cfg.enabled) return;

  const entry = await getAuditEntry(guild, auditType, { targetId, filter, retries });
  const executor = entry?.executor;
  if (!executor || isTrusted(guild, executor.id)) return;

  const undo = () => revert?.(entry);
  const pKey = `${guild.id}:${executor.id}`;

  // Déjà sanctionné il y a peu : on annule directement ses actions restantes.
  if (Date.now() - (punished.get(pKey) ?? 0) < 60_000) return void (await undo()?.catch(() => {}));

  const key = `${pKey}:${type}`;
  const now = Date.now();
  const list = (buckets.get(key) ?? []).filter((e) => now - e.t < cfg.window * 1000);
  list.push({ t: now, undo });
  buckets.set(key, list);

  if (list.length <= cfg.limits[type]) return;

  // ---- Seuil dépassé ----
  buckets.delete(key);
  punished.set(pKey, now);
  setTimeout(() => punished.delete(pKey), 60_000).unref();

  const ok = await punish(guild, executor.id, cfg.punishment, `Antinuke : ${LABELS[type]}`);
  let restored = 0;
  for (const e of list) {
    try {
      await e.undo();
      restored++;
    } catch {}
  }

  const emb = embed(
    '☢️ ANTINUKE',
    `**${executor.tag}** (\`${executor.id}\`) a dépassé la limite : **${LABELS[type]}** (${list.length} en ${cfg.window}s, limite ${cfg.limits[type]}).`,
    'err',
  ).addFields(
    { name: 'Sanction', value: `${cfg.punishment} ${ok ? '✅' : '❌ (échec : hiérarchie des rôles ?)'}`, inline: true },
    { name: 'Actions annulées', value: `${restored}/${list.length}`, inline: true },
  );
  await sendLog(guild, emb);
  await alertOwner(guild, emb);
}

const A = AuditLogEvent;
const hasDanger = (perms) => perms.any(config.dangerousPerms);

module.exports = {
  channelDelete: (ch) =>
    track(ch.guild, {
      type: 'channelDelete',
      auditType: A.ChannelDelete,
      targetId: ch.id,
      revert: () =>
        ch.guild.channels.create({
          name: ch.name,
          type: ch.type,
          parent: ch.parentId,
          topic: ch.topic ?? undefined,
          nsfw: ch.nsfw,
          position: ch.rawPosition,
          permissionOverwrites: ch.permissionOverwrites?.cache.map((o) => ({
            id: o.id,
            type: o.type,
            allow: o.allow,
            deny: o.deny,
          })),
          reason: 'Antinuke : restauration du salon',
        }),
    }),

  channelCreate: (ch) =>
    track(ch.guild, {
      type: 'channelCreate',
      auditType: A.ChannelCreate,
      targetId: ch.id,
      revert: () => ch.delete('Antinuke : annulation de la création'),
    }),

  roleDelete: (role) =>
    track(role.guild, {
      type: 'roleDelete',
      auditType: A.RoleDelete,
      targetId: role.id,
      revert: () =>
        role.guild.roles.create({
          name: role.name,
          color: role.color,
          hoist: role.hoist,
          mentionable: role.mentionable,
          permissions: role.permissions,
          reason: 'Antinuke : restauration du rôle',
        }),
    }),

  roleCreate: (role) =>
    track(role.guild, {
      type: 'roleCreate',
      auditType: A.RoleCreate,
      targetId: role.id,
      revert: () => role.delete('Antinuke : annulation de la création'),
    }),

  roleUpdate: (oldRole, newRole) => {
    if (hasDanger(oldRole.permissions) || !hasDanger(newRole.permissions)) return;
    return track(newRole.guild, {
      type: 'dangerousRole',
      auditType: A.RoleUpdate,
      targetId: newRole.id,
      revert: () => newRole.setPermissions(oldRole.permissions, 'Antinuke : permissions dangereuses annulées'),
    });
  },

  memberUpdate: (oldM, newM) => {
    if (oldM.partial) return;
    const added = newM.roles.cache.filter((r) => !oldM.roles.cache.has(r.id) && hasDanger(r.permissions));
    if (!added.size) return;
    return track(newM.guild, {
      type: 'dangerousRole',
      auditType: A.MemberRoleUpdate,
      targetId: newM.id,
      revert: () => newM.roles.remove([...added.keys()], 'Antinuke : rôle dangereux retiré'),
    });
  },

  ban: (ban) =>
    track(ban.guild, {
      type: 'ban',
      auditType: A.MemberBanAdd,
      targetId: ban.user.id,
      revert: () => ban.guild.members.unban(ban.user.id, 'Antinuke : annulation du bannissement'),
    }),

  // Une expulsion = départ + entrée d'audit MemberKick (impossible à annuler)
  kick: (member) =>
    track(member.guild, {
      type: 'kick',
      auditType: A.MemberKick,
      targetId: member.id,
      retries: 1,
    }),

  webhookCreate: (channel) =>
    track(channel.guild, {
      type: 'webhookCreate',
      auditType: A.WebhookCreate,
      revert: async (entry) => {
        const wh = await channel.client.fetchWebhook(entry.target.id);
        await wh.delete('Antinuke : webhook supprimé');
      },
    }),
};
