import { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType, VoiceState, Interaction, TextChannel, CommandInteraction } from 'discord.js';
import { Player, GuildQueue, Track } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';
import { YoutubeiExtractor } from 'discord-player-youtubei';
import { Client as PgClient } from 'pg';
import dbConfig from './config/dbCfg';
import youtubeCfg from './config/ytCfg';
import { exec } from 'child_process';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { TOKEN, CLIENT_ID } from './config/botCfg';
import { SlashCommandBuilder } from '@discordjs/builders';

export interface Command {
    data: SlashCommandBuilder;
    execute: ({ client, interaction }: { client: Client; interaction: CommandInteraction }) => Promise<void>;
}

// Define the extended Track type with an optional property 
interface ExtendedTrack<T> extends Track<T> { 
    startedPlaying?: Date; 
}

// PostgreSQL client setup using the imported config
console.log('Loading DB config...');
const pgClient = new PgClient(dbConfig);
console.log('Connecting to DB...');
pgClient.connect();

async function main() {
    console.log('Starting main...');
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildVoiceStates
        ]
    });

    console.log('Initializing player...');
    // Add the player on the client
    const player = new Player(client, {
    });
    console.log('Loading default extractors.');
    await player.extractors.loadMulti(DefaultExtractors);
    console.log('Loading Youtubei extractor.');
    await player.extractors.register(YoutubeiExtractor, {
        // authentication: youtubeCfg.YTTOKEN
    });

    
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js')); // Change to .js
    commandFiles.forEach(file => {
        console.log(file);
    });
    const commandData = [];
    const commands: Map<string, Command> = new Map();
    console.log('Sorting commands...');
    
    for (const file of commandFiles) {
        console.log(file);
        const filePath = path.join(commandsPath, file);
        console.log(`Importing ${filePath}...`);
        const { command } = require(filePath) as { command: Command };
        
        commands.set(command.data.name, command);
        commandData.push(command.data.toJSON());
    }
    
    
    console.log('Waiting for client...');
    client.on('ready', async () => {
        console.log('Client is ready!');
        // A list of commands that are restricted to specific guilds
        const restrictedCommands: { [key: string]: string } = {
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
        const rest = new REST({ version: '9' }).setToken(TOKEN);

        for (const guildId of guild_ids) {
            // Convert the commands map to an array and then filter based on the guild ID
            const guildCommands = Array.from(commands.values()).filter((command: Command) => {
                // If the command is restricted, check if the guild ID matches
                if (restrictedCommands[command.data.name]) {
                    return restrictedCommands[command.data.name] === guildId;
                }
                // If the command is not restricted, include it
                return true;
            });
        
            // Register the filtered list of commands for the guild
            await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), {
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
        console.log((client as any).player.scanDeps());
        player.on('debug', console.log).events.on('debug', (_, m) => console.log(m));
    });

    // Function to check Discord status
    async function checkDiscordStatus(): Promise<string> {
        try {
            const response = await axios.get('https://discordstatus.com/api/v2/status.json');
            const status = response.data.status.description;
            return status;
        } catch (error) {
            console.error('Error fetching Discord status:', error);
            return 'Error fetching status';
        }
    }

    // Function to update the status message.
    async function updateBotStatusMessage() {
        console.log('Updating bot status message...');
        const statusList = [':satellite: :satellite: :satellite:', 'sqrt(1764)', 'Wow! I can change status messages now!', 'Something, something uptime 99%...', 'func_kenobi is neither dead nor alive, until I look inzide the box.', '/fortytwo/secret'];
        (client.user as any).setPresence({
            activities: [{
                name: statusList[Math.floor(Math.random() * statusList.length)],
                type: ActivityType.Custom,
                url: 'http://www.funckenobi42.space'
            }],
            status: 'dnd'
        });
    }

    client.on('interactionCreate', async (interaction: Interaction) => {
        if (!interaction.isCommand()) return;
    
        const command = commands.get(interaction.commandName);
        if (!command) return;

        try {
            if (!interaction.guild || !interaction.guildId)return interaction.followUp('You need to be in a guild.');
            console.log(`[${new Date().toISOString()}] Command: ${interaction.commandName} | User: ${interaction.user.tag} | Guild: ${interaction.guild.name !== undefined}`);
            
            await command.execute({ client, interaction });
        } catch (error) {
            console.error(error);
            const status = await checkDiscordStatus();
            console.log('Discord API Status:', status); // Logs the status for your reference
            // Fetch a random quote from the database
            const res = await pgClient.query('SELECT quote FROM quotes ORDER BY RANDOM() LIMIT 1');
            const randomQuote = res.rows[0].quote;
            const quoteLines = randomQuote.split('\n');
            const randomLineIndex = Math.floor(Math.random() * quoteLines.length);
            const randomLine = quoteLines[randomLineIndex];

            // Reply with the random line and the error message
            if (interaction.deferred) {
                await interaction.editReply({
                    content: `Oops! Something went wrong. Here's a random quote to lighten the mood:\n"${randomLine}"\n\nError details: \`\`\`js\n${error}\`\`\`\n 'Discord API Status: ${status}`
                });
            } else {
                await (interaction.channel as TextChannel).send({
                    content: `Oops! Something went wrong. Here's a random quote to lighten the mood:\n"${randomLine}"\n\nError details: \`\`\`js\n${error}\`\`\`\n 'Discord API Status: ${status}`
                });
            }
        }
    });

    client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
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
                await pgClient.query(query, values);
                console.log(`User ${userId} moved from ${oldChannel} to ${newChannel} in server ${serverName} at ${timestamp}`);
            } catch (err) {
                console.error('Error saving voice state:', err);
            }
        }
    });
    
    player.events.on('emptyChannel', (queue: GuildQueue) => {
        const interaction = queue.metadata as Interaction;
        try {
            if ( queue.connection && queue.connection.state.status === 'destroyed') {
                return; 
            }
            (interaction.channel as TextChannel).send("Everyone left the channel.");
            queue.delete();
            console.log('Managed to delete a queue like a normal person.');
        } catch (error) {
            console.log('No queue was deleted:', error);
        }
    });
    
    player.events.on('playerFinish', (queue: GuildQueue) => {
        if (queue.tracks.size !== 0) {
            (queue.tracks.at(0) as ExtendedTrack<unknown>).startedPlaying = new Date();
        } else {
            (queue.currentTrack as ExtendedTrack<unknown>).startedPlaying = new Date();
        }
    });
    
    // Use the extended type in your event handler
    player.events.on('audioTrackAdd', async (queue: GuildQueue, track: ExtendedTrack<unknown>) => {
        console.log('track added');
        if (queue.tracks.size !== 0) {
            (queue.tracks.at(0) as ExtendedTrack<unknown>).startedPlaying = new Date();
        }
    });
    
    
    player.events.on('playerError', (queue: GuildQueue, error: Error) => {
        const interaction = queue.metadata as Interaction;
        if (interaction && interaction.channel && 'send' in interaction.channel) {
            (interaction.channel as TextChannel).send(`The player encountered an error while trying to play the track: \n\`\`\`js\n${error.message}\`\`\``);
        } else {
            console.log(`Player Error: ${error.message}`);
        }
    });
    
    
    player.events.on('playerStart', (queue: GuildQueue) => {
        // Your logic here
    });
    
    player.events.on('error', (queue: GuildQueue, error: Error) => {
        const interaction = queue.metadata as Interaction;
        if (interaction && interaction.channel) {
            (interaction.channel as TextChannel).send(`The queue encountered an error while trying to play the track: \n\`\`\`js\n${error.message}\`\`\``);
        } else {
            console.log(`Queue Error: ${error.message}`);
            console.log(queue.currentTrack);
        }
    });
    
    player.events.on('emptyQueue', (queue: GuildQueue) => {
        if ( queue.connection && queue.connection.state.status !== 'destroyed') {
            const interaction = queue.metadata as Interaction;
            if (!interaction || !interaction.channel) {
                console.log("No interaction or channel found.");
                return;
            }
            try {
                (interaction.channel as TextChannel).send("The queue is now empty.");
            } catch (error) {
                console.error('Error when handling emptyQueue:', error);
            }
        }
    });
    
   player.events.on('connectionDestroyed', (queue: GuildQueue) => {
        const interaction = queue.metadata as Interaction;
        if (!interaction || !interaction.channel) {
            console.log("No interaction or channel found.");
            return;
        }
        try {
            if ( queue.connection && queue.connection.state.status !== 'destroyed') {
                (interaction.channel as TextChannel).send("I was manually disconnected.");
            } else {
                return;
            }
            queue.delete();
            console.log('Managed to delete a queue like a normal person.');
        } catch (error) {
            console.error('Error when handling connectionDestroyed:', error);
        }
    });
    
    player.events.on('connection', (queue: GuildQueue) => {
        // Your logic here
    });

    client.login(TOKEN);
}

async function startBot() {
    try {
        await main();
    } catch (error) {
        const typedError = error as Error;
        if (shouldHandleError(typedError)) {
            handleCrash(typedError);
        } else {
            throw typedError;
        }
    }
}


function shouldHandleError(error: Error): boolean {
    // Only handle 'terminated' errors
    return error.message === 'terminated';
}

process.on('uncaughtException', (error) => {
    if (shouldHandleError(error)) {
        handleCrash(error);
    }
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    if (shouldHandleError(reason)) {
        handleCrash(reason);
    }
});

function handleCrash(error: Error) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${error.message}\n${error.stack}\n`;

    fs.writeFile('./logs/crash_log.txt', logMessage, (err) => {
        if (err) {
            console.error('Error writing crash log:', err);
        }
        console.error('Caught terminated error:', error);
        process.exit(1);  // Exit to trigger the restart
    });
}

// Start the bot
startBot();