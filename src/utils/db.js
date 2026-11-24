const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../../data/db.json');
let data = {};
let timer = null;

const defaults = () => ({
  logChannel: null,
  whitelist: [],
  antiraid: {
    enabled: false,
    threshold: 5, // nb d'arrivées…
    seconds: 10, // …en X secondes
    action: 'kick', // kick | ban | timeout
    minAccountAgeDays: 0,
    noAvatar: false,
    duration: 10, // durée du mode raid (minutes)
    autoLockdown: true,
    until: 0,
    lockedByRaid: false,
  },
  antibot: { enabled: false, action: 'kick', punishAdder: true, adderAction: 'derank', allowed: [] },
  antinuke: {
    enabled: false,
    punishment: 'ban', // ban | kick | derank
    window: 10, // secondes
    // Une action est sanctionnée quand le nombre dans la fenêtre dépasse la limite
    limits: {
      channelDelete: 2,
      channelCreate: 3,
      roleDelete: 2,
      roleCreate: 3,
      ban: 3,
      kick: 3,
      webhookCreate: 2,
      dangerousRole: 0,
    },
  },
  automod: { antilink: false, antiinvite: false, antispam: false, massmention: false },
  lockdown: { active: false, channels: {} },
  warns: {},
});

const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v);
function fill(obj, def) {
  for (const k of Object.keys(def)) {
    if (obj[k] === undefined) obj[k] = structuredClone(def[k]);
    else if (isPlain(def[k]) && isPlain(obj[k])) fill(obj[k], def[k]);
  }
  return obj;
}

function load() {
  try {
    data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    data = {};
  }
}

function flush() {
  clearTimeout(timer);
  timer = null;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(data, null, 2));
  fs.renameSync(FILE + '.tmp', FILE);
}

/** Sauvegarde différée (regroupe les écritures). */
function save() {
  if (timer) return;
  timer = setTimeout(() => {
    try {
      flush();
    } catch (e) {
      console.error('[db] écriture impossible', e);
    }
  }, 500);
}

function guild(id) {
  if (!data[id]) data[id] = defaults();
  return fill(data[id], defaults());
}

module.exports = { load, save, flush, guild, allGuildIds: () => Object.keys(data) };
