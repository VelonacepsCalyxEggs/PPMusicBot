import { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType, VoiceState, Interaction, TextChannel, CommandInteraction, ClientUser, NewsChannel } from 'discord.js';
import { Player, GuildQueue, Track } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';
import { YoutubeiExtractor } from 'discord-player-youtubei';
import { Client as PgClient, Pool } from 'pg';
import axios from 'axios';
import fs, { readFileSync } from 'fs';
import commandInterface from './types/commandInterface';
import playCommand from './commands/play';
import leaveCommand from './commands/leave';
import loopCommand from './commands/loop';
import moveCommand from './commands/move';
import nowPlayingCommand  from './commands/np';
import pauseCommand  from './commands/pause';
import scanCommand from './commands/scan';
import shuffleCommand from './commands/shuffle';
import skipCommand from './commands/skip';
import replayCommand from './commands/replay';
import readdCommand from './commands/re-add';
import removeCommand from './commands/remove';
import whereami from './commands/whereami';
import queueCommand from './commands/queue';
import dotenv from 'dotenv';
import cron from 'node-cron';
import TrackMetadata from './types/trackMetadata';

// Extend the Client interface to include a 'commands' property
declare module 'discord.js' {
    interface Client {
        commands: Collection<string, commandInterface>;
    }
}
interface StatusMessage {
    status: string;
}
class BotApplication {
    public client: Client;
    private rest: REST;
    public player: Player;
    public pool: Pool;
    public commands: Collection<string, commandInterface>;
    private restrictedCommands: { [key: string]: string } = {
            scan: '644950708160036864',
    }
    public currentStatus: string = '';
    
    constructor() {
        dotenv.config();
    }

    private async initializeDatabase() {
        console.log('Loading DB config...');
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is not set.');
        }
        this.pool = new Pool({connectionString: process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/mydatabase'});
        console.log('Connecting to DB...');
        this.pool.connect();
    }
    private initializeClient() {
        console.log('Initializing Discord client...');
        this.client = new Client({
            intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildVoiceStates
            ],
        });
    }

    private intializeClientEvents() {

            console.log('Initializing client events...');
            this.client.on('interactionCreate', async (interaction: Interaction) => {
            if (!interaction.isCommand()) return;
        
            const command = this.commands.get(interaction.commandName);
            if (!command) return;

            try {
                if (!interaction.guild || !interaction.guildId)return interaction.followUp('You need to be in a guild.');
                console.log(`[${new Date().toISOString()}] Command: ${interaction.commandName} | User: ${interaction.user.tag} | Guild: ${interaction.guild.name !== undefined}`);
                
                await command.execute({ client: this.client, player: this.player, interaction });
            } catch (error) {
                console.error(error);
                const status = await this.checkDiscordStatus();
                console.log('Discord API Status:', status); // Logs the status for your reference
                // Fetch a random quote from the database
                const res = await this.pool.query('SELECT quote_text FROM quotes ORDER BY RANDOM() LIMIT 1');
                const randomQuote = res.rows[0].quote_text;
                const quoteLines = randomQuote.split('\n');
                const randomLineIndex = Math.floor(Math.random() * quoteLines.length);
                const randomLine = quoteLines[randomLineIndex];

                // Reply with the random line and the error message
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: `Oops! Something went wrong. Here's a random quote to lighten the mood:\n"${randomLine}"\n\n Discord API Status: ${status}`
                    });
                } else {
                    await (interaction.channel as TextChannel).send({
                        content: `Oops! Something went wrong. Here's a random quote to lighten the mood:\n${randomLine}\n\n Discord API Status: ${status}`
                    });
                }
            }
        });

        this.client.on('voiceStateUpdate', async (oldState: VoiceState, newState: VoiceState) => {
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
                    await this.pool.query(query, values);
                    console.log(`User ${userId} moved from ${oldChannel} to ${newChannel} in server ${serverName} at ${timestamp}`);
                } catch (err) {
                    console.error('Error saving voice state:', err);
                }
            }
        });
    }

    private initializePlayerEvents() {
            console.log('Initializing Discord Player events...');
            this.player.events.on('emptyChannel', (queue: GuildQueue) => {
                const interaction = queue.metadata as Interaction;
                try {
                    if ( queue.connection && queue.connection.state.status === 'destroyed') {
                        return; 
                    }
                    (interaction.channel as TextChannel).send("Everyone left the channel.");
                } catch (error) {
                    console.error('No queue was deleted:', error);
                }
            });
            
            this.player.events.on('playerFinish', (queue: GuildQueue) => {
                if (queue.tracks.size !== 0) {
                    const track = queue.tracks.at(0) as Track<TrackMetadata>;
                    if (track.metadata) {
                        track.metadata.startedPlaying = new Date();
                    }
                } else {
                    const metadata = (queue.currentTrack as Track<TrackMetadata>).metadata;
                    if (metadata) {
                        metadata.startedPlaying = new Date();
                    }
                }
            });
            
            this.player.events.on('audioTrackAdd', async (queue: GuildQueue, track: Track<TrackMetadata>) => {
                if (queue.tracks.size !== 0) {
                    const trackMeta = (queue.tracks.at(0) as Track<TrackMetadata>).metadata;
                    if (trackMeta) {
                        trackMeta.startedPlaying = new Date();
                    }
                }
            });
            
            this.player.events.on('playerError', (queue: GuildQueue, error: Error) => {
                const interaction = queue.metadata as Interaction;
                if (interaction && interaction.channel && 'send' in interaction.channel) {
                    console.error(`Player Error: ${error.message}`);
                    (interaction.channel as TextChannel).send(`The player encountered an error while trying to play a track.`);
                } else {
                    console.error(`Player Error: ${error.message}`);
                }
            });
            
            this.player.events.on('playerStart', (queue: GuildQueue) => {
                
            });
            
            this.player.events.on('error', (queue: GuildQueue, error: Error) => {
                const interaction = queue.metadata as Interaction;
                if (interaction && interaction.channel) {
                    (interaction.channel as TextChannel).send(`The queue encountered an error while trying to play the track: \n\`\`\`js\n${error.message}\`\`\``);
                } else {
                    console.log(`Queue Error: ${error.message}`);
                    console.log(queue.currentTrack);
                }
            });
            
            this.player.events.on('emptyQueue', (queue: GuildQueue) => {
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
            
        this.player.events.on('connectionDestroyed', (queue: GuildQueue) => {
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
                } catch (error) {
                    console.error('Error when handling connectionDestroyed:', error);
                }
            });
            
        this.player.events.on('connection', (queue: GuildQueue) => {
            
        });
    }

    private initializeRest() {
        console.log('Initializing REST client...');
        if (!process.env.TOKEN) {
            throw new Error('TOKEN environment variable is not set.');
        }
        this.rest = new REST({ version: '9' }).setToken(process.env.TOKEN || '');
    }

    private initializePlayer() {
        console.log('Initializing Discord Player...');
        this.player = new Player(this.client, {
            
            skipFFmpeg: false,
        }
    );
        this.player.extractors.loadMulti(DefaultExtractors);
        this.player.extractors.register(YoutubeiExtractor, {
               streamOptions: {
            useClient: "WEB_EMBEDDED",
        },
        //generateWithPoToken: true,
        //authentication: process.env.YT_ACCESS_TOKEN,
        });
        console.log(this.player.scanDeps());
        this.player.on('debug', console.log).events.on('debug', (_, m) => console.log(m));
    }
    private async initializeCommands() {
        this.commands = new Collection<string, commandInterface>();
        console.log('Loading commands...');
        this.commands.set('play', new playCommand());
        this.commands.set('queue', new queueCommand());
        this.commands.set('leave', new leaveCommand());
        this.commands.set('loop', new loopCommand());
        this.commands.set('move', new moveCommand());
        this.commands.set('np', new nowPlayingCommand());
        this.commands.set('pause', new pauseCommand());
        this.commands.set('scan', new scanCommand());
        this.commands.set('shuffle', new shuffleCommand());
        this.commands.set('skip', new skipCommand());
        this.commands.set('replay', new replayCommand());
        this.commands.set('re-add', new readdCommand());
        this.commands.set('remove', new removeCommand());
        this.commands.set('whereami', new whereami());
        // Get all ids of the servers
        const guild_ids = this.client.guilds.cache.map(guild => guild.id);

        for (const guildId of guild_ids) {
            // Convert the commands map to an array and then filter based on the guild ID
            const guildCommands = Array.from(this.commands.values()).filter((command: commandInterface) => {
                // If the command is restricted, check if the guild ID matches
                if (this.restrictedCommands[command.data.name]) {
                    return this.restrictedCommands[command.data.name] === guildId;
                }
                // If the command is not restricted, include it
                return true;
            });
        
            // Register the filtered list of commands for the guild
            await this.rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID!, guildId), {
                body: guildCommands.map(command => command.data.toJSON())
            })
            .then(() => console.log('Successfully updated commands for guild ' + guildId))
            .catch(console.error);
        }
    }

    private updateBotStatusMessage(forced=false) {
        if (!process.env.PATH_TO_STATUS_JSON) {
            console.error('PATH_TO_STATUS environment variable is not set.');
            return;
        }
        const data: string = readFileSync(process.env.PATH_TO_STATUS_JSON!, { encoding: 'utf-8' });
        const parsedData: StatusMessage = JSON.parse(data);
        if (this.currentStatus == parsedData.status && forced == false) return;
        console.log('Updating bot status message...');
        this.currentStatus = parsedData.status;
        (this.client.user as ClientUser).setPresence({
            activities: [{
                name: this.currentStatus,
                type: ActivityType.Custom,
                url: 'http://www.funckenobi42.space'
            }],
            status: 'dnd'
        });
    }
    // Function to check Discord statusfunction 
    private async checkDiscordStatus(): Promise<string> {
        try {
            const response = await axios.get('https://discordstatus.com/api/v2/status.json');
            const status = response.data.status.description;
            return status;
        } catch (error) {
            console.error('Error fetching Discord status:', error);
            return 'Error fetching status';
        }
    }

    public async run() {
        await this.initializeDatabase();
        this.initializeClient();
        
        // Register the 'ready' event handler first
        this.client.on('ready', async () => {
            console.log('Client is ready!');
            this.initializeRest();
            this.initializePlayer();
            await this.initializeCommands();
            this.intializeClientEvents();
            this.initializePlayerEvents();
            this.updateBotStatusMessage();
            cron.schedule('*/2 * * * *', () => {
                console.log('[Cron] Running status update check...');
                this.updateBotStatusMessage();
            });
            cron.schedule('*/30 * * * *', () => {
                console.log('[Cron] Running forced status update...');
                this.updateBotStatusMessage(true);
            });
            console.log(`[${new Date()}] Bot is online.`);
        });
        
        // Then login to Discord - this must be OUTSIDE the 'ready' handler
        console.log('Logging in to Discord...');
        if (!process.env.TOKEN) {
            throw new Error('TOKEN environment variable is not set.');
        }
        await this.client.login(process.env.TOKEN);
    }
}

async function startBot() {
        const bot = new BotApplication();
        await bot.run();
}


/* function shouldHandleError(error: Error): boolean {
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
}); */

/* function handleCrash(error: Error) {
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
 */
// Start the bot
startBot();