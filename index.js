"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const discord_player_1 = require("discord-player");
const extractor_1 = require("@discord-player/extractor");
const discord_player_youtubei_1 = require("discord-player-youtubei");
const pg_1 = require("pg");
const dbCfg_1 = __importDefault(require("./config/dbCfg"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const botCfg_1 = require("./config/botCfg");
// PostgreSQL client setup using the imported config
console.log('Loading DB config...');
const pgClient = new pg_1.Client(dbCfg_1.default);
console.log('Connecting to DB...');
pgClient.connect();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Starting main...');
        const client = new discord_js_1.Client({
            intents: [
                discord_js_1.GatewayIntentBits.Guilds,
                discord_js_1.GatewayIntentBits.GuildMessages,
                discord_js_1.GatewayIntentBits.MessageContent,
                discord_js_1.GatewayIntentBits.GuildVoiceStates
            ]
        });
        console.log('Initializing player...');
        // Add the player on the client
        const player = new discord_player_1.Player(client, {});
        console.log('Loading default extractors.');
        yield player.extractors.loadMulti(extractor_1.DefaultExtractors);
        console.log('Loading Youtubei extractor.');
        yield player.extractors.register(discord_player_youtubei_1.YoutubeiExtractor, {
        // authentication: youtubeCfg.YTTOKEN
        });
        const commandsPath = path_1.default.join(__dirname, 'commands');
        const commandFiles = fs_1.default.readdirSync(commandsPath).filter(file => file.endsWith('.js')); // Change to .js
        commandFiles.forEach(file => {
            console.log(file);
        });
        const commandData = [];
        const commands = new Map();
        console.log('Sorting commands...');
        for (const file of commandFiles) {
            console.log(file);
            const filePath = path_1.default.join(commandsPath, file);
            console.log(`Importing ${filePath}...`);
            const { command } = require(filePath);
            commands.set(command.data.name, command);
            commandData.push(command.data.toJSON());
        }
        console.log('Waiting for client...');
        client.on('ready', () => __awaiter(this, void 0, void 0, function* () {
            console.log('Client is ready!');
            // A list of commands that are restricted to specific guilds
            const restrictedCommands = {
                scan: '644950708160036864',
                updquotes: '644950708160036864',
                playin: '644950708160036864',
                movein: '644950708160036864',
                queuein: '644950708160036864',
                removein: '644950708160036864'
                // ... add more commands and their respective guild IDs
            };
            // Get all ids of the servers
            const guild_ids = client.guilds.cache.map(guild => guild.id);
            console.log('Registering bot...');
            const rest = new discord_js_1.REST({ version: '9' }).setToken(botCfg_1.TOKEN);
            for (const guildId of guild_ids) {
                // Convert the commands map to an array and then filter based on the guild ID
                const guildCommands = Array.from(commands.values()).filter((command) => {
                    // If the command is restricted, check if the guild ID matches
                    if (restrictedCommands[command.data.name]) {
                        return restrictedCommands[command.data.name] === guildId;
                    }
                    // If the command is not restricted, include it
                    return true;
                });
                // Register the filtered list of commands for the guild
                yield rest.put(discord_js_1.Routes.applicationGuildCommands(botCfg_1.CLIENT_ID, guildId), {
                    body: guildCommands.map(command => command.data.toJSON())
                })
                    .then(() => console.log('Successfully updated commands for guild ' + guildId))
                    .catch(console.error);
            }
            updateBotStatusMessage();
            // Call the function every 45 minutes
            setInterval(updateBotStatusMessage, 45 * 60 * 1000);
            if (client.channels.cache.get('1129406347448950845')) {
                // (client.channels.cache.get('1129406347448950845') as TextChannel).send('The bot is online.')
            }
            console.log(`[${new Date()}] Bot is online.`);
            console.log(client.player.scanDeps());
            player.on('debug', console.log).events.on('debug', (_, m) => console.log(m));
        }));
        // Function to check Discord status
        function checkDiscordStatus() {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const response = yield axios_1.default.get('https://discordstatus.com/api/v2/status.json');
                    const status = response.data.status.description;
                    return status;
                }
                catch (error) {
                    console.error('Error fetching Discord status:', error);
                    return 'Error fetching status';
                }
            });
        }
        // Function to update the status message.
        function updateBotStatusMessage() {
            return __awaiter(this, void 0, void 0, function* () {
                console.log('Updating bot status message...');
                const statusList = [':satellite: :satellite: :satellite:', 'sqrt(1764)', 'Wow! I can change status messages now!', 'Something, something uptime 99%...', 'func_kenobi is neither dead nor alive, until I look inzide the box.', '/fortytwo/secret'];
                client.user.setPresence({
                    activities: [{
                            name: statusList[Math.floor(Math.random() * statusList.length)],
                            type: discord_js_1.ActivityType.Custom,
                            url: 'http://www.funckenobi42.space'
                        }],
                    status: 'dnd'
                });
            });
        }
        client.on('interactionCreate', (interaction) => __awaiter(this, void 0, void 0, function* () {
            if (!interaction.isCommand())
                return;
            const command = commands.get(interaction.commandName);
            if (!command)
                return;
            try {
                if (!interaction.guild || !interaction.guildId)
                    return interaction.followUp('You need to be in a guild.');
                console.log(`[${new Date().toISOString()}] Command: ${interaction.commandName} | User: ${interaction.user.tag} | Guild: ${interaction.guild.name !== undefined}`);
                yield command.execute({ client, interaction });
            }
            catch (error) {
                console.error(error);
                const status = yield checkDiscordStatus();
                console.log('Discord API Status:', status); // Logs the status for your reference
                // Fetch a random quote from the database
                const res = yield pgClient.query('SELECT quote FROM quotes ORDER BY RANDOM() LIMIT 1');
                const randomQuote = res.rows[0].quote;
                const quoteLines = randomQuote.split('\n');
                const randomLineIndex = Math.floor(Math.random() * quoteLines.length);
                const randomLine = quoteLines[randomLineIndex];
                // Reply with the random line and the error message
                if (interaction.deferred) {
                    yield interaction.editReply({
                        content: `Oops! Something went wrong. Here's a random quote to lighten the mood:\n"${randomLine}"\n\nError details: \`\`\`js\n${error}\`\`\`\n 'Discord API Status: ${status}`
                    });
                }
                else {
                    yield interaction.channel.send({
                        content: `Oops! Something went wrong. Here's a random quote to lighten the mood:\n"${randomLine}"\n\nError details: \`\`\`js\n${error}\`\`\`\n 'Discord API Status: ${status}`
                    });
                }
            }
        }));
        client.on('voiceStateUpdate', (oldState, newState) => __awaiter(this, void 0, void 0, function* () {
            if (oldState.channelId !== newState.channelId) {
                const userId = newState.id;
                const oldChannel = oldState.channelId;
                const newChannel = newState.channelId;
                const serverName = newState.guild.id;
                const timestamp = new Date();
                const query = `
                INSERT INTO discord_data_join (user_id, old_channel, new_channel, timestamp, server_id)
                VALUES ($1, $2, $3, $4, $5)
            `;
                const values = [userId, oldChannel, newChannel, timestamp, serverName];
                try {
                    yield pgClient.query(query, values);
                    console.log(`User ${userId} moved from ${oldChannel} to ${newChannel} in server ${serverName} at ${timestamp}`);
                }
                catch (err) {
                    console.error('Error saving voice state:', err);
                }
            }
        }));
        player.events.on('emptyChannel', (queue) => {
            const interaction = queue.metadata;
            try {
                if (queue.connection && queue.connection.state.status === 'destroyed') {
                    return;
                }
                interaction.channel.send("Everyone left the channel.");
                queue.delete();
                console.log('Managed to delete a queue like a normal person.');
            }
            catch (error) {
                console.log('No queue was deleted:', error);
            }
        });
        player.events.on('playerFinish', (queue) => {
            if (queue.tracks.size !== 0) {
                queue.tracks.at(0).startedPlaying = new Date();
            }
            else {
                queue.currentTrack.startedPlaying = new Date();
            }
        });
        // Use the extended type in your event handler
        player.events.on('audioTrackAdd', (queue, track) => __awaiter(this, void 0, void 0, function* () {
            console.log('track added');
            if (queue.tracks.size !== 0) {
                queue.tracks.at(0).startedPlaying = new Date();
            }
        }));
        player.events.on('playerError', (queue, error) => {
            const interaction = queue.metadata;
            if (interaction && interaction.channel && 'send' in interaction.channel) {
                interaction.channel.send(`The player encountered an error while trying to play the track: \n\`\`\`js\n${error.message}\`\`\``);
            }
            else {
                console.log(`Player Error: ${error.message}`);
            }
        });
        player.events.on('playerStart', (queue) => {
            // Your logic here
        });
        player.events.on('error', (queue, error) => {
            const interaction = queue.metadata;
            if (interaction && interaction.channel) {
                interaction.channel.send(`The queue encountered an error while trying to play the track: \n\`\`\`js\n${error.message}\`\`\``);
            }
            else {
                console.log(`Queue Error: ${error.message}`);
                console.log(queue.currentTrack);
            }
        });
        player.events.on('emptyQueue', (queue) => {
            if (queue.connection && queue.connection.state.status !== 'destroyed') {
                const interaction = queue.metadata;
                if (!interaction || !interaction.channel) {
                    console.log("No interaction or channel found.");
                    return;
                }
                try {
                    interaction.channel.send("The queue is now empty.");
                }
                catch (error) {
                    console.error('Error when handling emptyQueue:', error);
                }
            }
        });
        player.events.on('connectionDestroyed', (queue) => {
            const interaction = queue.metadata;
            if (!interaction || !interaction.channel) {
                console.log("No interaction or channel found.");
                return;
            }
            try {
                if (queue.connection && queue.connection.state.status !== 'destroyed') {
                    interaction.channel.send("I was manually disconnected.");
                }
                else {
                    return;
                }
                queue.delete();
                console.log('Managed to delete a queue like a normal person.');
            }
            catch (error) {
                console.error('Error when handling connectionDestroyed:', error);
            }
        });
        player.events.on('connection', (queue) => {
            // Your logic here
        });
        client.login(botCfg_1.TOKEN);
    });
}
function startBot() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield main();
        }
        catch (error) {
            const typedError = error;
            if (shouldHandleError(typedError)) {
                handleCrash(typedError);
            }
            else {
                throw typedError;
            }
        }
    });
}
function shouldHandleError(error) {
    // Only handle 'terminated' errors
    return error.message === 'terminated';
}
process.on('uncaughtException', (error) => {
    if (shouldHandleError(error)) {
        handleCrash(error);
    }
});
process.on('unhandledRejection', (reason, promise) => {
    if (shouldHandleError(reason)) {
        handleCrash(reason);
    }
});
function handleCrash(error) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${error.message}\n${error.stack}\n`;
    fs_1.default.writeFile('./logs/crash_log.txt', logMessage, (err) => {
        if (err) {
            console.error('Error writing crash log:', err);
        }
        console.error('Caught terminated error:', error);
        process.exit(1); // Exit to trigger the restart
    });
}
// Start the bot
startBot();
