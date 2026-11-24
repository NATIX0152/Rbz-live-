const { ActivityType } = require('discord.js');
const antiraid = require('../modules/antiraid');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Connecté en tant que ${client.user.tag} (${client.guilds.cache.size} serveur(s))`);
    client.user.setActivity('/help • protection active', { type: ActivityType.Watching });

    const body = client.commands.map((c) => c.data.toJSON());
    try {
      const gid = process.env.GUILD_ID;
      if (gid) await client.guilds.cache.get(gid)?.commands.set(body);
      else await client.application.commands.set(body);
      console.log(`📜 ${body.length} commandes slash enregistrées${gid ? ` (serveur ${gid})` : ' (global)'}`);
    } catch (err) {
      console.error('Enregistrement des commandes impossible :', err);
    }

    antiraid.resume(client);
  },
};
