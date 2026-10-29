# MineNovate Bot

Bot oficial para la comunidad de **MineNovate Network**, creado con Node.js 20+ y discord.js v14.

## Funciones incluidas

- Bienvenida y despedida configurables por ID de canal.
- Moderación: `/ban`, `/kick`, `/timeout`, `/warn` y `/clear`.
- Registro de acciones de moderación en `MOD_LOG_CHANNEL_ID`.
- Tickets privados con botón para abrir y cerrar.
- Economía básica: `/balance`, `/daily`, `/work`, `/pay` y `/leaderboard`.
- Asistente IA opcional mediante una API compatible con Chat Completions.
- Información de conexión de Minecraft.
- Registro automático de comandos slash al iniciar.

## Requisitos

- Node.js 20 o superior.
- Una aplicación y un bot creados en Discord Developer Portal.
- Permisos del bot: View Channels, Send Messages, Embed Links, Manage Channels, Read Message History, Moderate Members, Kick Members, Ban Members y Manage Messages (concede solo los que vayas a usar).

## Instalación local (Windows)

1. Instala Node.js 20 LTS o superior.
2. Descarga este repositorio y abre una terminal dentro de la carpeta.
3. Ejecuta `npm install`.
4. Copia `.env.example` como `.env`.
5. Pega el token privado del bot en `DISCORD_TOKEN`. No lo compartas ni lo subas a GitHub.
6. Revisa los IDs de canales y roles.
7. Ejecuta `npm start`.

## Configuración de Discord

En Discord Developer Portal, activa **Server Members Intent** en la sección Bot para que funcionen bienvenida y despedida. Invita el bot con los scopes `bot` y `applications.commands`.

Si `GUILD_ID` tiene un valor, los comandos se registran en ese servidor para probarlos rápidamente. Si lo dejas vacío, se registran globalmente y pueden tardar en aparecer.

## Publicar en Render

1. Crea un servicio de tipo **Background Worker** y conecta este repositorio.
2. Build Command: `npm install`.
3. Start Command: `npm start`.
4. Añade las variables del archivo `.env.example` desde Environment.
5. No configures `DISCORD_TOKEN` en archivos del repositorio; introdúcelo como variable secreta en Render.

El archivo `render.yaml` incluye una plantilla de Worker. Puedes usar Blueprint para desplegarla y completar las variables secretas.

## Tickets

Configura `TICKETS_CHANNEL_ID` para publicar el panel allí, y opcionalmente `TICKET_CATEGORY_ID` y `TICKET_SUPPORT_ROLE_ID`. Ejecuta `/ticket-panel` con una cuenta que tenga permisos de moderación.

## IA

La IA está desactivada hasta que añadas `AI_API_KEY`. Puedes cambiar `AI_MODEL` y `AI_BASE_URL` para usar un proveedor compatible con la API de Chat Completions. La clave se guarda únicamente en las variables del hosting.

## Música

El comando `/music` informa sobre el estado de configuración. La reproducción real requiere un nodo Lavalink externo, además de integrar un reproductor compatible. No se incluye una falsa reproducción ni se simula que el audio está funcionando.

## Datos de economía

Los datos se guardan en `data/community.json`. En servicios con disco efímero, los datos pueden perderse al reiniciar o redeplegar. Configura almacenamiento persistente antes de usar la economía en producción.

## Seguridad

- Nunca subas `.env` ni compartas el token.
- Si el token se filtra, regénéralo en Discord Developer Portal.
- Limita los permisos y roles de moderación a personas de confianza.
