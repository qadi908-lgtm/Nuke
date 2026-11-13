const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const express = require('express');

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = '!';
const PORT = process.env.PORT || 8080;

// ---------- keep-alive ----------
const app = express();
app.get('/', (_req, res) => res.send('nuke bot alive'));
app.listen(PORT, () => console.log(`keep-alive on :${PORT}`));

// ---------- client ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration
  ]
});

// ---------- actions ----------

async function spamChannels(guild, count = 50) {
  for (let i = 0; i < count; i++) {
    await guild.channels.create({ name: 'nuked-by-andreo' }).catch(() => {});
  }
}

async function spamRoles(guild, count = 50) {
  for (let i = 0; i < count; i++) {
    await guild.roles.create({ name: `nuked-${i}` }).catch(() => {});
  }
}

async function wipeChannels(guild) {
  for (const [, ch] of guild.channels.cache) {
    await ch.delete().catch(() => {});
  }
}

async function wipeRoles(guild) {
  for (const [, role] of guild.roles.cache) {
    if (role.id === guild.id) continue;      // @everyone
    if (role.managed) continue;              // bot roles
    await role.delete().catch(() => {});
  }
}

async function banAll(guild) {
  const members = await guild.members.fetch();
  for (const [, m] of members) {
    if (m.id === client.user.id) continue;
    if (!m.bannable) continue;
    await guild.members.ban(m.id, { reason: 'nuked' }).catch(() => {});
  }
}

// ---------- command router ----------

client.on('messageCreate', async (msg) => {
  if (msg.author.bot || !msg.guild) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const cmd = msg.content.slice(PREFIX.length).split(/\s+/)[0].toLowerCase();
  if (!msg.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  switch (cmd) {
    case 'nuke':
      await msg.delete().catch(() => {});
      await spamChannels(msg.guild);
      await spamRoles(msg.guild);
      await wipeChannels(msg.guild);
      await wipeRoles(msg.guild);
      await banAll(msg.guild);
      break;

    case 'wipe':
      await msg.delete().catch(() => {});
      await wipeChannels(msg.guild);
      await wipeRoles(msg.guild);
      break;

    case 'banall':
      await msg.delete().catch(() => {});
      await banAll(msg.guild);
      break;

    case 'spam':
      await msg.delete().catch(() => {});
      await spamChannels(msg.guild);
      await spamRoles(msg.guild);
      break;
  }
});

client.once('ready', () => {
  console.log(`logged in as ${client.user.tag} | ${client.guilds.cache.size} guilds`);
});

client.login(TOKEN);