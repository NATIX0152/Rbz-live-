// Branche les événements du serveur sur le module antinuke.
// (Un seul fichier : il enregistre plusieurs listeners via des "events" déclarés ci-dessous.)
const antinuke = require('../modules/antinuke');

const map = [
  ['channelDelete', (ch) => ch.guild && antinuke.channelDelete(ch)],
  ['channelCreate', (ch) => ch.guild && antinuke.channelCreate(ch)],
  ['roleDelete', (r) => antinuke.roleDelete(r)],
  ['roleCreate', (r) => antinuke.roleCreate(r)],
  ['roleUpdate', (o, n) => antinuke.roleUpdate(o, n)],
  ['guildMemberUpdate', (o, n) => antinuke.memberUpdate(o, n)],
  ['guildBanAdd', (b) => antinuke.ban(b)],
  ['guildMemberRemove', (m) => antinuke.kick(m)],
  ['webhooksUpdate', (ch) => ch.guild && antinuke.webhookCreate(ch)],
];

// Le loader d'index.js accepte un seul événement par fichier : on exporte donc un
// événement synthétique qui s'abonne à tous les autres au démarrage.
module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    for (const [name, fn] of map) {
      client.on(name, async (...args) => {
        try {
          await fn(...args);
        } catch (err) {
          console.error(`[antinuke:${name}]`, err);
        }
      });
    }
  },
};
