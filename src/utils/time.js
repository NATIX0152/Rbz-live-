const UNITS = { s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5 };

/** "10m", "2h", "7d" -> millisecondes (null si invalide) */
function parseDuration(str) {
  const m = /^(\d+)\s*([smhdw])$/i.exec(String(str ?? '').trim());
  return m ? Number(m[1]) * UNITS[m[2].toLowerCase()] : null;
}

function formatDuration(ms) {
  const parts = [];
  for (const [label, size] of [['j', 864e5], ['h', 36e5], ['min', 6e4], ['s', 1e3]]) {
    const n = Math.floor(ms / size);
    if (n > 0) {
      parts.push(`${n}${label}`);
      ms -= n * size;
    }
  }
  return parts.join(' ') || '0s';
}

module.exports = { parseDuration, formatDuration };
