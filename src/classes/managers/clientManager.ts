import { ActivityType, 
    ChatInputCommandInteraction, 
    Client, 
    Collection, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    TextChannel, 
    VoiceState } from "discord.js";
import ErrorCommand from "../../commands/error";
import LeaveCommand from "../../commands/leave";
import LoopCommand from "../../commands/loop";
import MoveCommand from "../../commands/move";
import NowPlayingCommand from "../../commands/np";
import PauseCommand from "../../commands/pause";
import PlayCommand from "../../commands/play";
import QueueCommand from "../../commands/queue";
import ReaddCommand from "../../commands/re-add";
import RecoverCommand from "../../commands/recover";
import RemoveCommand from "../../commands/remove";
import ReplayCommand from "../../commands/replay";
import RestoreCommand from "../../commands/restore";
import ScanCommand from "../../commands/scan";
import ShuffleCommand from "../../commands/shuffle";
import SkipCommand from "../../commands/skip";
import WhereAmICommand from "../../commands/whereami";
import CommandInterface from "../../types/commandInterface";
import { discordLogger, logBotStartup, logCommandUsage, logError } from "../../utils/loggerUtil";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import checkDiscordStatus from "../../utils/checkDiscordStatusUtil";
import { AtGrokIsThisTrueService } from "../../services/atGrokIsThisTrueService";
import { Player, Track } from "discord-player/dist";
import { DIContainer } from "../diContainer";
import cron from 'node-cron';
import { DatabasePoolWrapper } from "./databaseManager";

// Extend the Client interface to include a 'commands' property
declare module 'discord.js' {
    interface Client {
        commands: Collection<string, CommandInterface>;
        diContainer: DIContainer;
        cachedQueueStates?: QueueState[];
    }
}

interface StatusMessage {
    status: string;
}
interface QueueState {
    guildId: string;
    tracks: Track<unknown>[];
}

interface CommandCache {
    commands: [string, string, string][];
    timestamp: Date;
}

export class ClientManager {

    public client: Client;
    private player?: Player;
    private rest: REST;
    private diContainer?: DIContainer;
    public currentStatus: string = '';
    public commands: Collection<string, CommandInterface>;
    private restrictedCommands: { [key: string]: string } = {
            scan: '644950708160036864',
            error: '644950708160036864',
    }

    public async init(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            try 
            {
                
            discordLogger.info('Initializing Discord client...');
            this.client = new Client({
                intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates
                ],
            });
            if (!this.diContainer) throw new Error('DI Container is not set in ClientManager');
            this.client.diContainer = this.diContainer;

            this.client.on('clientReady', async () => {
                try {
                    this.initializeRest();
                    this.intializeClientEvents();
                    await this.initializeCommands();
                    this.checkIfStatusFileExists();
                    this.updateBotStatusMessage();
        
                    logBotStartup();
                    cron.schedule('*/2 * * * *', () => {
                        discordLogger.debug('[Cron] Running status update check...');
                        this.updateBotStatusMessage();
                    });
                    // In case connection is lost
                    cron.schedule('*/60 * * * *', () => {
                        discordLogger.debug('[Cron] Running forced status update...');
                        this.updateBotStatusMessage(true);
                    });
                    discordLogger.info('Client is ready!');
                }
                catch (error) {
                    logError(error as Error, 'ClientManager_init_ready', { message: 'Failed to initialize client' });
                    throw new Error('Failed to initialize client: ' + (error as Error).message);
                }
            });
            resolve();
            }
            catch (error) {
                logError(error as Error, 'ClientManager_init', { message: 'Failed to initialize ClientManager' });
                discordLogger.error('Failed to initialize ClientManager:', error);
                reject(error);
            }
        });
    }

    public setPlayer(player: Player): void {
        this.player = player;
        discordLogger.debug('Player has been set in the client manager.');
    }

    public setDiContainer(diContainer: DIContainer): void {
        this.diContainer = diContainer;
        discordLogger.debug('DI Container has been set in the client manager.');
    }

    public async login() {
        if (!this.player) throw new Error('Player is not set in ClientManager');
        // Load queue states if any
        this.loadActiveQueueStates();
        // then login.
        if (!process.env.TOKEN) {
            throw new Error('TOKEN environment variable is not set.');
        }
        await this.client.login(process.env.TOKEN);
        discordLogger.info('Logged in to Discord as ' + this.client.user?.tag);
    }

    private initializeRest() {
        discordLogger.info('Initializing REST client...');
        if (!process.env.TOKEN) {
            throw new Error('TOKEN environment variable is not set.');
        }
        this.rest = new REST({ version: '9' }).setToken(process.env.TOKEN || '');
    }

    private async initializeCommands() {
        this.commands = new Collection<string, CommandInterface>();
        discordLogger.info('Initializing commands...');

        this.commands.set(PlayCommand.commandName, new PlayCommand());
        this.commands.set(QueueCommand.commandName, new QueueCommand());
        this.commands.set(LeaveCommand.commandName, new LeaveCommand());
        this.commands.set(LoopCommand.commandName, new LoopCommand());
        this.commands.set(MoveCommand.commandName, new MoveCommand());
        this.commands.set(NowPlayingCommand.commandName, new NowPlayingCommand());
        this.commands.set(PauseCommand.commandName, new PauseCommand());
        this.commands.set(ScanCommand.commandName, new ScanCommand());
        this.commands.set(ShuffleCommand.commandName, new ShuffleCommand());
        this.commands.set(SkipCommand.commandName, new SkipCommand());
        this.commands.set(ReplayCommand.commandName, new ReplayCommand());
        this.commands.set(ReaddCommand.commandName, new ReaddCommand());
        this.commands.set(RemoveCommand.commandName, new RemoveCommand());
        this.commands.set(WhereAmICommand.commandName, new WhereAmICommand());
        this.commands.set(ErrorCommand.commandName, new ErrorCommand());
        this.commands.set(RecoverCommand.commandName, new RecoverCommand());
        this.commands.set(RestoreCommand.commandName, new RestoreCommand());
        for (const command of this.commands.values()) {
            discordLogger.debug(`Loaded command: ${command.data.name}`);
        }
        discordLogger.info(`Total commands loaded: ${this.commands.size}`);
        const cachedCommands = this.loadCommandsFromCache();

        const currentCommandsArray = this.commands.map((command) => [
            command.data.name, 
            command.constructor.name,
            JSON.stringify(command.data.toJSON())
        ]);
        const isSame =
            cachedCommands.commands.length === currentCommandsArray.length &&
            cachedCommands.commands.every(
                ([name, ctor, data], idx) =>
                    name === currentCommandsArray[idx][0] && 
                    ctor === currentCommandsArray[idx][1] &&
                    data === currentCommandsArray[idx][2] // Compare serialized command data
            );
        if (isSame) {
            discordLogger.info('Commands are up to date, skipping registration.');
            return;
        }
        else discordLogger.info('Commands have changed, updating registration...');

        this.createCommandsCache();

        const guild_ids = this.client.guilds.cache.map(guild => guild.id);

        for (const guildId of guild_ids) {
            const guildCommands = Array.from(this.commands.values()).filter((command: CommandInterface) => {
                if (this.restrictedCommands[command.data.name]) {
                    return this.restrictedCommands[command.data.name] === guildId;
                }
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

    private loadCommandsFromCache(): CommandCache {
        if (!process.env.CACHE_DIR) {
            throw new Error('CACHE_DIR environment variable is not set.');
        }

        if (!existsSync(join(process.env.CACHE_DIR, 'commands', 'commandCache.json'))) {
            discordLogger.warn('Command cache file does not exist, creating a new one.');
            mkdirSync(join(process.env.CACHE_DIR, 'commands'), { recursive: true });
            writeFileSync(join(process.env.CACHE_DIR, 'commands', 'commandCache.json'), JSON.stringify({ commands: [], timestamp: new Date() }, null, 2), { encoding: 'utf-8' });
            return { commands: [], timestamp: new Date() };
        }

        const cacheData = readFileSync(join(process.env.CACHE_DIR, 'commands', 'commandCache.json'), { encoding: 'utf-8' });
        const cache: CommandCache = JSON.parse(cacheData);

        return cache;
    }

    private createCommandsCache(): void {
        if (!process.env.CACHE_DIR) {
            throw new Error('CACHE_DIR environment variable is not set.');
        }

        const cache: CommandCache = {
            commands: this.commands.map((command) => [
                command.data.name, 
                command.constructor.name,
                JSON.stringify(command.data.toJSON()) // Add serialized command data
            ]),
            timestamp: new Date()
        };
        const cacheDir = join(process.env.CACHE_DIR, 'commands');
        if (!existsSync(cacheDir)) {
            discordLogger.info('Creating command cache directory: ' + cacheDir);
            mkdirSync(cacheDir, { recursive: true });
        }
        writeFileSync(join(cacheDir, 'commandCache.json'), JSON.stringify(cache, null, 2), { encoding: 'utf-8' });
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
                    
                    const status = await checkDiscordStatus();
                    discordLogger.warn('Discord API Status:', status);
                    
                    // Fetch a random quote from the database
                    try {
                        const res = await this.diContainer?.get<DatabasePoolWrapper>("DatabasePool").pool.query('SELECT quote_text FROM quotes ORDER BY RANDOM() LIMIT 1');
                        if (!res || res.rows.length === 0) {
                            throw new Error('No quotes found in the database.');
                        }
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
                        logError(quoteError);
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
            if (message.author.bot) return;
            
            if (!message.content) return;
            
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
                    const grokService = this.client.diContainer.get<AtGrokIsThisTrueService>('AtGrokIsThisTrueService');
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
                    await this.diContainer?.get<DatabasePoolWrapper>("DatabasePool").pool.query(query, values);
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

        this.client.on('debug', (message: string) => {
            discordLogger.debug(message);
        });
    }

    private updateBotStatusMessage(forced=false) {
        if (!process.env.PATH_TO_STATUS_JSON) {
            discordLogger.error('PATH_TO_STATUS_JSON environment variable is not set.');
            return;
        }
        const data: string = readFileSync(join(process.env.PATH_TO_STATUS_JSON, 'status.json'), { encoding: 'utf-8' });
        const parsedData: StatusMessage = JSON.parse(data);
        if (this.currentStatus == parsedData.status && !forced) return;
        discordLogger.info('Updating bot status message...');
        this.currentStatus = parsedData.status;
        if (!this.client.user) {
            discordLogger.error('Client user is not set, cannot update status.');
            return;
        }
        this.client.user.setPresence({
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
            mkdirSync(process.env.PATH_TO_STATUS_JSON.replace(/[^/]+$/, ''), { recursive: true });
            writeFileSync(join(process.env.PATH_TO_STATUS_JSON, 'status.json'), JSON.stringify({ status: 'Hello There!' }, null, 2), { encoding: 'utf-8' });
        }
    }

    public saveActiveQueueStates(player: Player): void {
        discordLogger.info('Saving active queue states...');
        const activeQueues = player.queues.cache.filter(queue => queue.tracks.size > 0);
        const queueStates: QueueState[] = activeQueues.map(queue => ({
            guildId: queue.guild.id,
            tracks: queue.tracks.toArray() as Track<unknown>[]
        }));

        writeFileSync(join(process.env.CACHE_DIR!, 'activeQueues.json'), JSON.stringify(queueStates, null, 2), { encoding: 'utf-8' })
        discordLogger.info('Active queue states saved successfully.');
    }

    private loadActiveQueueStates(): void {
        discordLogger.info('Loading active queue states...');
        if (!existsSync(join(process.env.CACHE_DIR!, 'activeQueues.json'))) {
            discordLogger.warn('No active queue states found, skipping load.');
            return;
        }

        const data = readFileSync(join(process.env.CACHE_DIR!, 'activeQueues.json'), { encoding: 'utf-8' });
        this.client.cachedQueueStates = JSON.parse(data);
        if (!Array.isArray(this.client.cachedQueueStates)) {
            discordLogger.warn('No valid queue states found, resetting cache.');
            this.client.cachedQueueStates = [];
        }
        discordLogger.info(`Loaded ${this.client.cachedQueueStates.length} active queue states.`);
    }
}