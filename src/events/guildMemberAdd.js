const antiraid = require('../modules/antiraid');
const antibot = require('../modules/antibot');

module.exports = {
  name: 'guildMemberAdd',
  async execute(client, member) {
    if (member.user.bot) return antibot.handleBotJoin(member);
    return antiraid.handleJoin(member);
  },
};
