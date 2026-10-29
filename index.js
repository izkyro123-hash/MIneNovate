import "dotenv/config";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";
import fs from "node:fs/promises";
import path from "node:path";

const required = ["DISCORD_TOKEN", "CLIENT_ID"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Faltan variables obligatorias: ${missing.join(", ")}. Copia .env.example a .env y complétalo.`);
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "community.json");
const currency = process.env.CURRENCY_NAME || "MineCoins";
const startingBalance = Number(process.env.STARTING_BALANCE || 100);
let database = { users: {}, warnings: {} };

async function loadDatabase() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    database = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") console.error("No se pudo leer la base de datos:", error);
    await saveDatabase();
  }
}
async function saveDatabase() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(database, null, 2));
}
function getUser(userId) {
  database.users[userId] ??= { balance: startingBalance, dailyAt: 0, workAt: 0 };
  return database.users[userId];
}
function isModerator(member) {
  if (!member) return false;
  const permissions = member.permissions;
  const roleIds = [process.env.ADMIN_ROLE_ID, process.env.MODERATOR_ROLE_ID].filter(Boolean);
  return permissions.has(PermissionsBitField.Flags.Administrator) ||
    permissions.has(PermissionsBitField.Flags.ModerateMembers) ||
    roleIds.some((id) => member.roles.cache.has(id));
}
async function sendLog(guild, embed) {
  const channelId = process.env.MOD_LOG_CHANNEL_ID;
  if (!channelId) return;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (channel?.isTextBased()) await channel.send({ embeds: [embed] }).catch(() => {});
}
const commands = [
  new SlashCommandBuilder().setName("help").setDescription("Muestra los comandos de MineNovate Bot"),
  new SlashCommandBuilder().setName("ping").setDescription("Comprueba la conexión del bot"),
  new SlashCommandBuilder().setName("serverinfo").setDescription("Muestra información del servidor Minecraft"),
  new SlashCommandBuilder().setName("balance").setDescription("Consulta tus MineCoins"),
  new SlashCommandBuilder().setName("daily").setDescription("Reclama tu recompensa diaria"),
  new SlashCommandBuilder().setName("work").setDescription("Trabaja para ganar MineCoins"),
  new SlashCommandBuilder().setName("pay").setDescription("Envía MineCoins a otro miembro")
    .addUserOption(o => o.setName("usuario").setDescription("Quién recibirá las monedas").setRequired(true))
    .addIntegerOption(o => o.setName("cantidad").setDescription("Cantidad a enviar").setMinValue(1).setRequired(true)),
  new SlashCommandBuilder().setName("leaderboard").setDescription("Top 10 de la economía"),
  new SlashCommandBuilder().setName("ticket-panel").setDescription("Publica el panel para abrir tickets"),
  new SlashCommandBuilder().setName("ticket-close").setDescription("Cierra el ticket actual"),
  new SlashCommandBuilder().setName("ban").setDescription("Banea a un miembro")
    .addUserOption(o => o.setName("usuario").setDescription("Miembro").setRequired(true))
    .addStringOption(o => o.setName("motivo").setDescription("Motivo del baneo").setMaxLength(500)),
  new SlashCommandBuilder().setName("kick").setDescription("Expulsa a un miembro")
    .addUserOption(o => o.setName("usuario").setDescription("Miembro").setRequired(true))
    .addStringOption(o => o.setName("motivo").setDescription("Motivo").setMaxLength(500)),
  new SlashCommandBuilder().setName("timeout").setDescription("Aplica un timeout")
    .addUserOption(o => o.setName("usuario").setDescription("Miembro").setRequired(true))
    .addIntegerOption(o => o.setName("minutos").setDescription("Duración en minutos").setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption(o => o.setName("motivo").setDescription("Motivo").setMaxLength(500)),
  new SlashCommandBuilder().setName("warn").setDescription("Advierte a un miembro")
    .addUserOption(o => o.setName("usuario").setDescription("Miembro").setRequired(true))
    .addStringOption(o => o.setName("motivo").setDescription("Motivo").setRequired(true).setMaxLength(500)),
  new SlashCommandBuilder().setName("clear").setDescription("Elimina mensajes recientes")
    .addIntegerOption(o => o.setName("cantidad").setDescription("Entre 1 y 100").setMinValue(1).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder().setName("ai").setDescription("Pregunta al asistente de MineNovate")
    .addStringOption(o => o.setName("pregunta").setDescription("Tu consulta").setRequired(true).setMaxLength(1000)),
  new SlashCommandBuilder().setName("music").setDescription("Información del módulo de música")
].map(command => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  const route = process.env.GUILD_ID
    ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
    : Routes.applicationCommands(process.env.CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log(`Comandos registrados: ${commands.length} (${process.env.GUILD_ID ? "servidor de pruebas" : "globales"}).`);
}

client.once("ready", () => {
  console.log(`MineNovate Bot conectado como ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: "MineNovate Network", type: 0 }], status: "online" });
});

client.on("guildMemberAdd", async (member) => {
  const channel = process.env.WELCOME_CHANNEL_ID
    ? await member.guild.channels.fetch(process.env.WELCOME_CHANNEL_ID).catch(() => null)
    : null;
  if (channel?.isTextBased()) {
    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle("¡Bienvenido a MineNovate NETWORK!")
      .setDescription(`¡Hola ${member}! Gracias por unirte a nuestra comunidad. Revisa las reglas y disfruta del servidor.`)
      .setThumbnail(member.user.displayAvatarURL())
      .setFooter({ text: `Ahora somos ${member.guild.memberCount} miembros` })
      .setTimestamp();
    await channel.send({ embeds: [embed] }).catch(() => {});
  }
});

client.on("guildMemberRemove", async (member) => {
  const channel = process.env.GOODBYE_CHANNEL_ID
    ? await member.guild.channels.fetch(process.env.GOODBYE_CHANNEL_ID).catch(() => null)
    : null;
  if (channel?.isTextBased()) await channel.send(`👋 **${member.user.username}** salió de MineNovate. ¡Hasta pronto!`).catch(() => {});
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === "mn_ticket_open") {
        const existing = interaction.guild.channels.cache.find(c =>
          c.type === ChannelType.GuildText && c.topic === `MineNovate ticket de ${interaction.user.id}`
        );
        if (existing) return interaction.reply({ content: `Ya tienes un ticket abierto: ${existing}`, ephemeral: true });

        const overwrites = [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
        ];
        if (process.env.TICKET_SUPPORT_ROLE_ID) overwrites.push({
          id: process.env.TICKET_SUPPORT_ROLE_ID,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        });
        const ticket = await interaction.guild.channels.create({
          name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90),
          type: ChannelType.GuildText,
          topic: `MineNovate ticket de ${interaction.user.id}`,
          parent: process.env.TICKET_CATEGORY_ID || undefined,
          permissionOverwrites: overwrites
        });
        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("mn_ticket_close").setLabel("Cerrar ticket").setStyle(ButtonStyle.Danger).setEmoji("🔒")
        );
        await ticket.send({ content: `Hola ${interaction.user}, el equipo de MineNovate te atenderá aquí.`, components: [closeRow] });
        return interaction.reply({ content: `Ticket creado: ${ticket}`, ephemeral: true });
      }
      if (interaction.customId === "mn_ticket_close") {
        if (!isModerator(interaction.member) && !interaction.channel.topic?.includes(interaction.user.id)) {
          return interaction.reply({ content: "No tienes permiso para cerrar este ticket.", ephemeral: true });
        }
        await interaction.reply({ content: "Este ticket se cerrará en unos segundos." });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        return;
      }
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;
    const guild = interaction.guild;

    if (["ban", "kick", "timeout", "warn", "clear", "ticket-panel", "ticket-close"].includes(commandName) && !isModerator(interaction.member)) {
      return interaction.reply({ content: "No tienes permisos para usar este comando.", ephemeral: true });
    }

    if (commandName === "help") {
      const embed = new EmbedBuilder().setColor(0x7c3aed).setTitle("MineNovate Bot | Comandos")
        .setDescription("**Comunidad:** /help, /ping, /serverinfo\n**Economía:** /balance, /daily, /work, /pay, /leaderboard\n**Moderación:** /ban, /kick, /timeout, /warn, /clear\n**Soporte:** /ticket-panel, /ticket-close\n**IA:** /ai\n**Música:** /music (requiere configurar Lavalink).");
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    if (commandName === "ping") return interaction.reply(`🏓 Pong: ${client.ws.ping} ms`);
    if (commandName === "serverinfo") {
      return interaction.reply(`🎮 **MineNovate Network**\nIP Java: \`${process.env.MINECRAFT_HOST || "No configurada"}\`\nPuerto: \`${process.env.MINECRAFT_PORT || "25565"}\`\nEstado: consulta el panel del servidor para ver disponibilidad en tiempo real.`);
    }
    if (commandName === "balance") {
      const user = getUser(interaction.user.id); await saveDatabase();
      return interaction.reply(`🪙 Tienes **${user.balance.toLocaleString("es-ES")} ${currency}**.`);
    }
    if (commandName === "daily" || commandName === "work") {
      const user = getUser(interaction.user.id);
      const isDaily = commandName === "daily";
      const key = isDaily ? "dailyAt" : "workAt";
      const cooldown = isDaily ? 86400000 : 3600000;
      const reward = isDaily ? 250 : Math.floor(Math.random() * 101) + 50;
      const remaining = cooldown - (Date.now() - user[key]);
      if (remaining > 0) {
        const minutes = Math.ceil(remaining / 60000);
        return interaction.reply({ content: `⏳ Vuelve a intentarlo en aproximadamente ${minutes} minuto(s).`, ephemeral: true });
      }
      user[key] = Date.now(); user.balance += reward; await saveDatabase();
      return interaction.reply(`✨ Ganaste **${reward} ${currency}**. Saldo: **${user.balance} ${currency}**.`);
    }
    if (commandName === "pay") {
      const target = interaction.options.getUser("usuario");
      const amount = interaction.options.getInteger("cantidad");
      if (target.bot || target.id === interaction.user.id) return interaction.reply({ content: "Elige a otro miembro que no sea un bot.", ephemeral: true });
      const sender = getUser(interaction.user.id);
      if (sender.balance < amount) return interaction.reply({ content: "No tienes suficientes MineCoins.", ephemeral: true });
      sender.balance -= amount; getUser(target.id).balance += amount; await saveDatabase();
      return interaction.reply(`💸 ${interaction.user} envió **${amount} ${currency}** a ${target}.`);
    }
    if (commandName === "leaderboard") {
      const top = Object.entries(database.users).sort((a, b) => b[1].balance - a[1].balance).slice(0, 10);
      const lines = top.map(([id, data], i) => `**${i + 1}.** <@!${id}> — ${data.balance.toLocaleString("es-ES")} ${currency}`);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xfbbf24).setTitle("🏆 Top MineCoins").setDescription(lines.join("\n") || "Todavía no hay datos.") ] });
    }
    if (commandName === "ticket-panel") {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("mn_ticket_open").setLabel("Abrir ticket").setStyle(ButtonStyle.Primary).setEmoji("🎫")
      );
      const embed = new EmbedBuilder().setColor(0x7c3aed).setTitle("🎫 Soporte MineNovate")
        .setDescription("Pulsa el botón para crear un canal privado y hablar con el equipo de soporte.");
      const channel = process.env.TICKETS_CHANNEL_ID ? await guild.channels.fetch(process.env.TICKETS_CHANNEL_ID).catch(() => null) : interaction.channel;
      if (!channel?.isTextBased()) return interaction.reply({ content: "Configura TICKETS_CHANNEL_ID o ejecuta el comando en un canal de texto.", ephemeral: true });
      await channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: "Panel de tickets publicado.", ephemeral: true });
    }
    if (commandName === "ticket-close") {
      if (!interaction.channel.topic?.startsWith("MineNovate ticket de ")) return interaction.reply({ content: "Este canal no parece ser un ticket.", ephemeral: true });
      await interaction.reply("El ticket se cerrará en unos segundos.");
      setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
      return;
    }
    if (["ban", "kick", "timeout", "warn"].includes(commandName)) {
      const target = interaction.options.getMember("usuario");
      const user = interaction.options.getUser("usuario");
      const reason = interaction.options.getString("motivo") || "Sin motivo especificado";
      if (!target) return interaction.reply({ content: "No pude encontrar a ese miembro en el servidor.", ephemeral: true });
      if (target.id === interaction.user.id || target.id === client.user.id) return interaction.reply({ content: "No puedes aplicar esa acción a ese usuario.", ephemeral: true });
      if (guild.ownerId !== interaction.user.id && target.roles.highest.position >= interaction.member.roles.highest.position) {
        return interaction.reply({ content: "No puedes moderar a alguien con un rol igual o superior al tuyo.", ephemeral: true });
      }
      const botMember = await guild.members.fetchMe();
      if (target.roles.highest.position >= botMember.roles.highest.position) {
        return interaction.reply({ content: "Mi rol debe estar por encima del rol de ese miembro para aplicar esta acción.", ephemeral: true });
      }
      if (commandName === "ban") await target.ban({ reason: `${reason} | Por: ${interaction.user.tag}` });
      if (commandName === "kick") await target.kick(`${reason} | Por: ${interaction.user.tag}`);
      if (commandName === "timeout") {
        const minutes = interaction.options.getInteger("minutos");
        await target.timeout(minutes * 60000, reason);
      }
      if (commandName === "warn") {
        database.warnings[user.id] ??= [];
        database.warnings[user.id].push({ reason, moderator: interaction.user.id, at: new Date().toISOString() });
        await saveDatabase();
        try { await user.send(`Has recibido una advertencia en ${guild.name}. Motivo: ${reason}`); } catch {}
      }
      await sendLog(guild, new EmbedBuilder().setColor(0xdc2626).setTitle(`Moderación: ${commandName}`)
        .setDescription(`Usuario: ${user.tag}\nModerador: ${interaction.user.tag}\nMotivo: ${reason}`).setTimestamp());
      return interaction.reply(`✅ Acción **${commandName}** aplicada a ${user.tag}.`);
    }
    if (commandName === "clear") {
      const amount = interaction.options.getInteger("cantidad");
      if (!interaction.channel?.bulkDelete) return interaction.reply({ content: "Este canal no admite limpieza masiva.", ephemeral: true });
      const deleted = await interaction.channel.bulkDelete(amount, true);
      return interaction.reply({ content: `🧹 Eliminé ${deleted.size} mensajes recientes.`, ephemeral: true });
    }
    if (commandName === "ai") {
      if (!process.env.AI_API_KEY) return interaction.reply({ content: "El asistente IA aún no está configurado. Añade AI_API_KEY en las variables de entorno del hosting.", ephemeral: true });
      await interaction.deferReply();
      const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
      const response = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.AI_API_KEY}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          model: process.env.AI_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: "Eres el asistente oficial de MineNovate Network. Responde en español, con claridad y respeto. No inventes datos del servidor." },
            { role: "user", content: interaction.options.getString("pregunta") }
          ],
          max_tokens: 500
        })
      });
      if (!response.ok) {
        console.error("Error del proveedor IA:", response.status, await response.text().catch(() => ""));
        return interaction.editReply("No pude conectar con el servicio de IA. Revisa AI_API_KEY, AI_BASE_URL y AI_MODEL.");
      }
      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content?.trim() || "No recibí una respuesta.";
      return interaction.editReply(answer.slice(0, 1900));
    }
    if (commandName === "music") {
      const configured = process.env.LAVALINK_HOST && process.env.LAVALINK_PASSWORD;
      return interaction.reply({
        content: configured
          ? "Lavalink está configurado en las variables, pero el reproductor de audio todavía debe conectarse a un nodo compatible antes de usar reproducción."
          : "🎵 El módulo de música necesita un servidor Lavalink externo. Configura LAVALINK_HOST, LAVALINK_PORT y LAVALINK_PASSWORD; sin ese servicio no se puede reproducir audio desde Render.",
        ephemeral: true
      });
    }
  } catch (error) {
    console.error("Error procesando interacción:", error);
    const message = "Ocurrió un error. Revisa los permisos del bot y los registros del hosting.";
    if (interaction.deferred || interaction.replied) await interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
    else await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
  }
});

await loadDatabase();
try {
  await registerCommands();
  await client.login(process.env.DISCORD_TOKEN);
} catch (error) {
  console.error("No se pudo iniciar MineNovate Bot:", error);
  process.exit(1);
}
