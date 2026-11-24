require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const db = require('./src/utils/db');

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN manquant. Copie .env.example en .env et remplis-le.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // privilégié
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // privilégié
  ],
  partials: [Partials.GuildMember, Partials.User],
});

client.commands = new Collection();

// --- Chargement des commandes (src/commands/<catégorie>/*.js, un export ou un tableau) ---
const cmdRoot = path.join(__dirname, 'src/commands');
for (const category of fs.readdirSync(cmdRoot)) {
  for (const file of fs.readdirSync(path.join(cmdRoot, category)).filter((f) => f.endsWith('.js'))) {
    const mod = require(path.join(cmdRoot, category, file));
    for (const cmd of [].concat(mod)) {
      cmd.category = category;
      client.commands.set(cmd.data.name, cmd);
    }
  }
}

// --- Chargement des événements ---
const evRoot = path.join(__dirname, 'src/events');
for (const file of fs.readdirSync(evRoot).filter((f) => f.endsWith('.js'))) {
  const ev = require(path.join(evRoot, file));
  const run = async (...args) => {
    try {
      await ev.execute(client, ...args);
    } catch (err) {
      console.error(`[event:${ev.name}]`, err);
    }
  };
  ev.once ? client.once(ev.name, run) : client.on(ev.name, run);
}

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    db.flush();
    process.exit(0);
  });
}

db.load();
client.login(process.env.DISCORD_TOKEN);
