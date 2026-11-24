const db = require('./db');

/** Propriétaire, bot lui-même ou utilisateur whitelisté : exempté des protections. */
function isTrusted(guild, userId) {
  if (!userId) return false;
  return (
    userId === guild.ownerId ||
    userId === guild.client.user.id ||
    db.guild(guild.id).whitelist.includes(userId)
  );
}

module.exports = { isTrusted };
