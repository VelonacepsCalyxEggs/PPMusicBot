import { Client, GatewayIntentBits, Collection, REST, Routes, ActivityType, VoiceState, Interaction, TextChannel, ChatInputCommandInteraction, ClientUser } from 'discord.js';
import { Player, GuildQueue, Track } from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';
import { YoutubeiExtractor } from 'discord-player-youtubei';
import { Pool } from 'pg';
import axios from 'axios';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import CommandInterface from './types/commandInterface';
import dotenv from 'dotenv';
dotenv.config();
import cron from 'node-cron';
import TrackMetadata from './types/trackMetadata';
import { 
    logBotStartup, 
    logCommandUsage, 
    logPlayerEvent, 
    logError,
    discordLogger,
    playerLogger,
    databaseLogger,
    closeLogger, // Add this import
} from './utils/loggerUtil';
import { join } from 'path';
import ErrorCommand from './commands/error';
import LeaveCommand from './commands/leave';
import LoopCommand from './commands/loop';
import MoveCommand from './commands/move';
import NowPlayingCommand from './commands/np';
import PauseCommand from './commands/pause';
import PlayCommand from './commands/play';
import QueueCommand from './commands/queue';
import ReaddCommand from './commands/re-add';
import RemoveCommand from './commands/remove';
import ReplayCommand from './commands/replay';
import ScanCommand from './commands/scan';
import ShuffleCommand from './commands/shuffle';
import SkipCommand from './commands/skip';
import WhereAmICommand from './commands/whereami';
import RecoverCommand from './commands/recover';
import { ServiceInterface } from './types/serviceInterface';
import { AtGrokIsThisTrueService } from './services/atGrokIsThisTrueService';
import { NetworkFileService } from './services/networkFileService';
import GetQuouteCommand from './commands/getQuote';

// Extend the Client interface to include a 'commands' property
declare module 'discord.js' {
    interface Client {
        commands: Collection<string, CommandInterface>;
        services: Collection<string, ServiceInterface>;
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
    public commands: Collection<string, CommandInterface>;
    private restrictedCommands: { [key: string]: string } = {
            scan: '644950708160036864',
            error: '644950708160036864',
    }
    public currentStatus: string = '';

    private async initializeDatabase() {
        databaseLogger.info('Loading DB config...');
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is not set.');
        }
        this.pool = new Pool({connectionString: process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/mydatabase'});
        databaseLogger.info('Connecting to DB...');
        this.pool.connect();
    }

    private initializeClient() {
        discordLogger.info('Initializing Discord client...');
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

            discordLogger.info('Initializing Discord client events...');
            // This event is triggered when any interaction is created, i.e. a message or a command.
            this.client.on('interactionCreate', async (interaction: ChatInputCommandInteraction) => {
                if (interaction.isCommand()) {

                
                    const command = this.commands.get(interaction.commandName);
                    if (!command) return;

                    try {
                        if (!interaction.guild || !interaction.guildId)return interaction.followUp({ content: 'You need to be in a guild.', flags: ['Ephemeral'] });
                        
                        logCommandUsage(interaction.commandName, interaction.user.id, interaction.guildId || undefined, true);
                        
                        await command.execute({ client: this.client, player: this.player, interaction });
                    } catch (error) {
                        const errorObj = error as Error;
                        logError(errorObj, 'command execution', { 
                            commandName: interaction.commandName,
                            userId: interaction.user.id,
                            guildId: interaction.guildId 
                        });

                        
                        logCommandUsage(interaction.commandName, interaction.user.id, interaction.guildId || undefined, false);

                        // Check if it's a YouTube/extractor related error
                        let errorMessage = "Oops! Something went wrong.";
                        if (errorObj.message.includes('fetch failed') || errorObj.message.includes('ConnectTimeoutError') || errorObj.message.includes('youtubei')) {
                            errorMessage = "YouTube connection timeout occurred. This is usually temporary - please try again in a moment.";
                        }
                        
                        const status = await this.checkDiscordStatus();
                        discordLogger.warn('Discord API Status:', status); // Logs the status for your reference
                        
                        // Fetch a random quote from the database
                        try {
                            const res = await this.pool.query('SELECT quote_text FROM quotes ORDER BY RANDOM() LIMIT 1');
                            const randomQuote = res.rows[0].quote_text;
                            const quoteLines = randomQuote.split('\n');
                            const randomLineIndex = Math.floor(Math.random() * quoteLines.length);
                            const randomLine = quoteLines[randomLineIndex];

                            // Reply with the random line and the error message
                            if (interaction.deferred) {
                                await interaction.editReply({
                                    content: `${errorMessage}\n\nHere's a random quote to lighten the mood:\n"${randomLine}"\n\nDiscord API Status: ${status}`
                                });
                            } else {
                                await (interaction.channel as TextChannel).send({
                                    content: `${errorMessage}\nHere's a random quote:\n"${randomLine}"\n\nDiscord API Status: ${status}`
                                });
                            }
                        } catch (quoteError) {
                            // Fallback if quote fetching fails
                            if (interaction.deferred) {
                                await interaction.editReply({
                                    content: `${errorMessage}\n\nDiscord API Status: ${status}`
                                });
                            } else {
                                await (interaction.channel as TextChannel).send({
                                    content: `${errorMessage}\n\nDiscord API Status: ${status}`
                                });
                            }
                        }
                    }
                }
        });

            // This event is triggered when a regular message is sent
    this.client.on('messageCreate', async (message) => {
        // Ignore messages from bots
        if (message.author.bot) return;
        
        // Ignore messages that don't have content (embeds, files only, etc.)
        if (!message.content) return;
        
        // Only process messages in guilds
        if (!message.guild) return;

        if (message.content == '@Grok is this true?') {
            if (message.reference && message.reference.messageId) {
                await message.channel.sendTyping();
                const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
                if (!referencedMessage) {

                    await message.reply({
                        content: `@${message.author.username}, I couldn't find the message you referenced.`,
                        flags: ['SuppressNotifications']
                    });
                    return;
                }
                const grokService = this.client.services.get('AtGrokIsThisTrueService') as AtGrokIsThisTrueService;
                if (!grokService) {
                    discordLogger.error('AtGrokIsThisTrueService is not initialized.');
                    return;
                }
                try {
                    let response: string;
                    discordLogger.debug(`Processing Grok query for message with possible attachments: ${referencedMessage.attachments.first()}`);
                    discordLogger.debug(`Referenced message content: ${referencedMessage.content}`);
                    if (referencedMessage.attachments.first() && referencedMessage.attachments.first()!.contentType?.startsWith('image/')) {
                        response = await grokService.query('Is this true? ' + referencedMessage.content, message.guild.id, referencedMessage.attachments.first()!.url);
                    }
                    else {
                        response = await grokService.query('Is this true? ' + referencedMessage.content, message.guild.id);
                    }
                    await message.reply({
                        content: `<@${message.author.id}>, ${response}`,
                        flags: ['SuppressNotifications']
                        
                    });
                } catch (error) {
                    logError(error as Error, 'Grok query', { userId: message.author.id, guildId: message.guild.id });
                    await message.reply({
                        content: `<@${message.author.id}>, there was an error processing your request.`,
                        flags: ['SuppressNotifications']
                    });
                }
            }
        }
    });

        // This event is triggered when a user joins or leaves a voice channel
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
                    discordLogger.info('Voice state update recorded', {
                        userId,
                        oldChannel,
                        newChannel,
                        serverName,
                        timestamp
                    });
                } catch (err) {
                    logError(err as Error, 'voice state update', { userId, serverName });
                }
            }
        });
    }

    private initializePlayerEvents() {
            discordLogger.info('Initializing Discord Player events...');

            // This event is triggered when everyone leaves the voice channel
            this.player.events.on('emptyChannel', (queue: GuildQueue) => {
                const interaction = queue.metadata as Interaction;
                try {
                    if ( queue.connection && queue.connection.state.status === 'destroyed') {
                        return; 
                    }
                    (interaction.channel as TextChannel).send({content : `Everyone left the channel.`, flags: ['SuppressNotifications']});
                } catch (error) {
                    discordLogger.error('Error when handling emptyChannel:', error);
                }
            });
            
            // This event is triggered when a track finishes playing
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
            
            // This event is triggered when a track is added to the queue
            this.player.events.on('audioTrackAdd', async (queue: GuildQueue, track: Track<TrackMetadata>) => {
                if (queue.tracks.size !== 0) {
                    const trackMeta = (queue.tracks.at(0) as Track<TrackMetadata>).metadata;
                    if (trackMeta) {
                        trackMeta.startedPlaying = new Date();
                    }
                }
            });
            
            // This event is triggered when the player encounters a playback error
            this.player.events.on('playerError', (queue: GuildQueue, error: Error) => {
                logPlayerEvent('playerError', queue.guild?.id, { error: error.message });
                
                // Check if it's a YouTube/extractor related error
                if (error.message.includes('fetch failed') || error.message.includes('ConnectTimeoutError') || error.message.includes('youtubei')) {
                    playerLogger.warn('YouTube extractor error detected, attempting recovery...');
                    
                    const interaction = queue.metadata as Interaction;
                    if (interaction && interaction.channel) {
                        try {
                            (interaction.channel as TextChannel).send({
                                content: '⚠️ Connection timeout occurred while fetching track data. Attempting to continue...',
                                flags: ['SuppressNotifications']
                            });
                        } catch (sendError) {
                            logError(sendError as Error, 'error_message_send', { guildId: queue.guild?.id });
                        }
                    }
                    
                    // Try to skip to next track if available
                    if (queue.tracks.size > 0) {
                        try {
                            queue.node.skip();
                            playerLogger.info('Skipped problematic track due to extractor error');
                        } catch (skipError) {
                            logError(skipError as Error, 'recovery_skip_failed', { guildId: queue.guild?.id });
                        }
                    }
                }
            });
            
            this.player.events.on('playerStart', (queue: GuildQueue) => {
                
            });
            
            // This event is triggered when the player encounters a regular error.
            this.player.events.on('error', (queue: GuildQueue, error: Error) => {
                logPlayerEvent('queueError', queue.guild?.id, { 
                    error: error.message,
                    currentTrack: queue.currentTrack?.title 
                });
            });
            
            // This event is triggered when the queue is empty
            this.player.events.on('emptyQueue', (queue: GuildQueue) => {
                if ( queue.connection && queue.connection.state.status !== 'destroyed') {
                    const interaction = queue.metadata as Interaction;
                    if (!interaction || !interaction.channel) {
                        discordLogger.error("No interaction or channel found.");
                        return;
                    }
                    try {
                        (interaction.channel as TextChannel).send({ content: 'The queue is now empty.', flags: ['SuppressNotifications']},);
                    } catch (error) {
                        logError(error as Error, 'Queue', { interaction });
                    }
                }
            });
        
        // This event is triggered when the connection to the voice channel is destroyed
        this.player.events.on('connectionDestroyed', (queue: GuildQueue) => {
                const interaction = queue.metadata as Interaction;
                if (!interaction || !interaction.channel) {
                    discordLogger.error("No interaction or channel found.");
                    return;
                }
                try {
                    if ( queue.connection && queue.connection.state.status !== 'destroyed') {
                        (interaction.channel as TextChannel).send({ content: 'The connection to the voice channel was destroyed. The queue has been cleared.', flags: ['SuppressNotifications'] });
                    } else {
                        return;
                    }
                } catch (error) {
                    logError(error as Error, 'connectionDestroyed', { interaction });
                }
            });
        
        // This event is triggered when a connection is established to a voice channel
        this.player.events.on('connection', (queue: GuildQueue) => {
            
        });
    }

    private initializeRest() {
        discordLogger.info('Initializing REST client...');
        if (!process.env.TOKEN) {
            throw new Error('TOKEN environment variable is not set.');
        }
        this.rest = new REST({ version: '9' }).setToken(process.env.TOKEN || '');
    }

    private initializePlayer() {
        playerLogger.info('Initializing Discord Player...');
        this.player = new Player(this.client, {
            skipFFmpeg: false,
        });
        
        try {
            this.player.extractors.loadMulti(DefaultExtractors);
            
            // Initialize YouTube extractor with additional error handling
            try {
                this.player.extractors.register(YoutubeiExtractor, {
                    streamOptions: {
                        useClient: "WEB_EMBEDDED",
                        // Add timeout and retry options if available
                    },
                    //cookie: process.env.YT_COOKIE || '',
                    //generateWithPoToken: true,
                    //authentication: process.env.YT_ACCESS_TOKEN,
                });
                playerLogger.info('YouTube extractor registered successfully');
            } catch (youtubeError) {
                logError(youtubeError as Error, 'youtube_extractor_init', { message: 'Failed to register YouTube extractor' });
                playerLogger.warn('YouTube extractor failed to initialize, some features may not work');
            }
            
            playerLogger.info(this.player.scanDeps());
            
            // Add error handling for the player itself
            this.player.on('debug', playerLogger.debug);
            this.player.events.on('debug', (_, m) => playerLogger.debug(m));
            
            // Add error handler for extractor errors
            this.player.events.on('error', (queue: GuildQueue, error: Error) => {
                logError(error, 'player_error', {
                    guildId: queue.guild?.id,
                    currentTrack: queue.currentTrack?.title,
                    queueSize: queue.tracks.size
                });
                
                // Try to recover by skipping the current track if possible
                if (queue.currentTrack && queue.tracks.size > 0) {
                    try {
                        queue.node.skip();
                        playerLogger.info('Skipped problematic track and continued playback');
                    } catch (skipError) {
                        logError(skipError as Error, 'skip_after_error', { guildId: queue.guild?.id });
                    }
                }
            });
            
        } catch (error) {
            logError(error as Error, 'player_initialization', { message: 'Failed to initialize player' });
            throw error;
        }
    }
    private async initializeCommands() {
        this.commands = new Collection<string, CommandInterface>();
        discordLogger.info('Initializing commands...');
        this.commands.set('play', new PlayCommand());
        this.commands.set('queue', new QueueCommand());
        this.commands.set('leave', new LeaveCommand());
        this.commands.set('loop', new LoopCommand());
        this.commands.set('move', new MoveCommand());
        this.commands.set('np', new NowPlayingCommand());
        this.commands.set('pause', new PauseCommand());
        this.commands.set('scan', new ScanCommand());
        this.commands.set('shuffle', new ShuffleCommand());
        this.commands.set('skip', new SkipCommand());
        this.commands.set('replay', new ReplayCommand());
        this.commands.set('re-add', new ReaddCommand());
        this.commands.set('remove', new RemoveCommand());
        this.commands.set('whereami', new WhereAmICommand());
        this.commands.set('error', new ErrorCommand());
        this.commands.set('recover', new RecoverCommand());
        this.commands.set('getQuote', new GetQuouteCommand());
        // Get all ids of the servers
        const guild_ids = this.client.guilds.cache.map(guild => guild.id);

        for (const guildId of guild_ids) {
            // Convert the commands map to an array and then filter based on the guild ID
            const guildCommands = Array.from(this.commands.values()).filter((command: CommandInterface) => {
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
            .then(() => discordLogger.info('Successfully updated commands for guild ' + guildId))
            .catch(discordLogger.error);
        }
    }

    private async initializeServices() {
        discordLogger.info('Initializing services...');
        this.client.services = new Collection<string, ServiceInterface>();
        // Initialize the AtGrokIsThisTrueService
        const grokService = new AtGrokIsThisTrueService();
        await grokService.init()
            .then(() => discordLogger.info('AtGrokIsThisTrueService initialized successfully'))

        //const youtubeFallbackService = new YtdlFallbackService();
        //await youtubeFallbackService.init()
        //    .then(() => discordLogger.info('YtdlFallbackService initialized successfully'))

        const networkFileService = new NetworkFileService();
        await networkFileService.init()
            .then(() => discordLogger.info('NetworkFileService initialized successfully'));
        
        this.client.services.set('AtGrokIsThisTrueService', grokService);
        //this.client.services.set('YtdlFallbackService', youtubeFallbackService);
        this.client.services.set('NetworkFileService', networkFileService);
    }

    private updateBotStatusMessage(forced=false) {
        if (!process.env.PATH_TO_STATUS_JSON) {
            discordLogger.error('PATH_TO_STATUS_JSON environment variable is not set.');
            return;
        }
        const data: string = readFileSync(join(process.env.PATH_TO_STATUS_JSON, 'status.json'), { encoding: 'utf-8' });
        const parsedData: StatusMessage = JSON.parse(data);
        if (this.currentStatus == parsedData.status && forced == false) return;
        discordLogger.info('Updating bot status message...');
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

    private checkIfStatusFileExists() {
        if (!process.env.PATH_TO_STATUS_JSON) {
            throw new Error('PATH_TO_STATUS_JSON environment variable is not set.');
        }
        if (!existsSync(process.env.PATH_TO_STATUS_JSON)) {
            discordLogger.warn('Status file does not exist, creating a new one.');
            mkdirSync(process.env.PATH_TO_STATUS_JSON.replace(/\/[^\/]+$/, ''), { recursive: true });
            writeFileSync(join(process.env.PATH_TO_STATUS_JSON, 'status.json'), JSON.stringify({ status: 'Hello There!' }, null, 2), { encoding: 'utf-8' });
        }
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

    private setupGlobalErrorHandlers() {
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
            console.error('Unhandled Rejection:', reason);
            
            // Try to log but don't crash if logging fails
            try {
                if (reason && typeof reason === 'object' && 'message' in reason) {
                    const error = reason as Error;
                    // Don't log YouTube connection errors as they're temporary
                    if (!error.message.includes('fetch failed') && 
                        !error.message.includes('ECONNRESET') && 
                        !error.message.includes('youtubei')) {
                        logError(error, 'unhandled_rejection');
                    }
                }
            } catch (logErr) {
                console.error('Failed to log unhandled rejection:', logErr);
            }
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error: Error) => {
            console.error('Uncaught Exception:', error);
            
            // Don't try to log the winston "write after end" errors
            if (!error.message.includes('write after end')) {
                try {
                    discordLogger.error('Uncaught Exception:', error);
                } catch (logErr) {
                    console.error('Failed to log uncaught exception:', logErr);
                }
            }
            
            // Exit gracefully
            this.gracefulShutdown();
        });

        // Handle SIGINT (Ctrl+C)
        process.on('SIGINT', () => {
            console.log('Received SIGINT, shutting down gracefully...');
            try {
                discordLogger.info('Received SIGINT, shutting down gracefully...');
            } catch (err) {
                console.error('Failed to log SIGINT:', err);
            }
            this.gracefulShutdown();
        });

        // Handle SIGTERM
        process.on('SIGTERM', () => {
            console.log('Received SIGTERM, shutting down gracefully...');
            try {
                discordLogger.info('Received SIGTERM, shutting down gracefully...');
            } catch (err) {
                console.error('Failed to log SIGTERM:', err);
            }
            this.gracefulShutdown();
        });
    }

    private gracefulShutdown() {
        console.log('Initiating graceful shutdown...');
        
        try {
            discordLogger.info('Initiating graceful shutdown...');
        } catch (err) {
            console.error('Failed to log shutdown:', err);
        }
        
        // Close logger first to prevent further write attempts
        closeLogger();
        
        // Destroy Discord client
        if (this.client) {
            this.client.destroy();
        }
        
        // Close database connection
        if (this.pool) {
            this.pool.end();
        }
        
        // Give time for cleanup
        setTimeout(() => {
            process.exit(0);
        }, 1000); // Reduced timeout since logger is already closed
    }

    public async run() {
        // Setup global error handlers first
        this.setupGlobalErrorHandlers();
        
        await this.initializeDatabase();
        this.initializeClient();
        
        // Register the 'ready' event handler first
        this.client.on('ready', async () => {
            discordLogger.info('Client is ready!');
            this.initializeRest();
            this.initializePlayer();
            await this.initializeCommands();
            await this.initializeServices();
            this.intializeClientEvents();
            this.initializePlayerEvents();

            this.checkIfStatusFileExists();
            this.updateBotStatusMessage();

            logBotStartup();
            cron.schedule('*/2 * * * *', () => {
                discordLogger.debug('[Cron] Running status update check...');
                this.updateBotStatusMessage();
            });
            cron.schedule('*/30 * * * *', () => {
                discordLogger.debug('[Cron] Running forced status update...');
                this.updateBotStatusMessage(true);
            });
            discordLogger.info('Bot is online and ready');
        });
        
        // Then login to Discord - this must be OUTSIDE the 'ready' handler
        discordLogger.info('Logging in to Discord...');
        if (!process.env.TOKEN) {
            throw new Error('TOKEN environment variable is not set.');
        }
        await this.client.login(process.env.TOKEN);
    }
}

async function startBot() {
    const bot = new BotApplication();
    try {
        await bot.run();
    }
    catch (error) {
        logError(error as Error, 'Bot runtime', { message: 'Bot process failed.' });
        discordLogger.error(`Bot exited with error: ${error}`);
    }

}
// Start the bot
startBot();