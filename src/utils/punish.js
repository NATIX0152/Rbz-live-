/**
 * Applique une sanction. action : ban | kick | derank | timeout
 * Renvoie true si la sanction a été appliquée.
 */
async function punish(guild, userId, action, reason) {
  try {
    if (action === 'ban') {
      await guild.members.ban(userId, { reason });
      return true;
    }
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return false;
    if (action === 'kick') await member.kick(reason);
    else if (action === 'timeout') await member.timeout(24 * 60 * 60 * 1000, reason);
    else if (action === 'derank') {
      const keep = member.roles.cache.filter((r) => r.managed).map((r) => r.id);
      await member.roles.set(keep, reason);
    } else return false;
    return true;
  } catch (err) {
    console.error(`[punish:${action}]`, err.message);
    return false;
  }
}

module.exports = { punish };
