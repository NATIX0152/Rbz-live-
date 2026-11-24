const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const seen = new Set();

/**
 * Récupère l'entrée récente du journal d'audit correspondant (≤ 10 s).
 * Chaque entrée n'est renvoyée qu'une fois.
 */
async function getAuditEntry(guild, type, { targetId, filter, retries = 2 } = {}) {
  for (let i = 0; i <= retries; i++) {
    try {
      const logs = await guild.fetchAuditLogs({ type, limit: 8 });
      const entry = logs.entries.find(
        (e) =>
          !seen.has(e.id) &&
          Date.now() - e.createdTimestamp < 10_000 &&
          (!targetId || e.target?.id === targetId) &&
          (!filter || filter(e)),
      );
      if (entry) {
        seen.add(entry.id);
        setTimeout(() => seen.delete(entry.id), 60_000).unref();
        return entry;
      }
    } catch {
      return null; // permission « Voir les logs du serveur » manquante
    }
    if (i < retries) await sleep(800);
  }
  return null;
}

module.exports = { getAuditEntry };
