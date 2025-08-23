import { DefaultExtractors } from "@discord-player/extractor";
import { YoutubeiExtractor } from "discord-player-youtubei";
import { Player, GuildQueue, Track } from "discord-player";
import { Client, Interaction, TextChannel } from "discord.js";
import TrackMetadata from "../../types/trackMetadata";
import { playerLogger, logError, discordLogger, logPlayerEvent } from "../../utils/loggerUtil";
import { KenobiAPIExtractor } from "src/extractors/kenobiAPIExtractor";

export class PlayerManager {
    public player: Player;
    private client?: Client;


    public async init(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            try 
            {
                playerLogger.info('Initializing Discord Player...');
                if (!this.client) throw new Error('Client is not set in PlayerManager');
                this.player = new Player(this.client, {
                    skipFFmpeg: false,
                });
                this.player.extractors.loadMulti(DefaultExtractors);
                this.player.extractors.register(KenobiAPIExtractor, { baller: true });
                // Initialize YouTube extractor with additional error handling
                try {
                    this.player.extractors.register(YoutubeiExtractor, {
                        streamOptions: {
                            useClient: "WEB_EMBEDDED",
                        },
                    });
                    playerLogger.info('YouTube extractor registered successfully');
                } catch (youtubeError) {
                    logError(youtubeError as Error, 'youtube_extractor_init', { message: 'Failed to register YouTube extractor' });
                    playerLogger.warn('YouTube extractor failed to initialize, some features may not work');
                }
                playerLogger.info(this.player.scanDeps());
                this.initializePlayerEvents()
                resolve();
            } catch (error) {
                logError(error as Error, 'PlayerManager_init', { message: 'Failed to initialize PlayerManager' });
                playerLogger.error('Failed to initialize PlayerManager:', error);
                reject(error);
            }
        });
    }

    public setClient(client: Client): void {
        this.client = client;
        playerLogger.debug('Client has been set in the player manager.');
    }

    private initializePlayerEvents() {
            discordLogger.info('Initializing Discord Player events...');

            // player debug
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
            this.player.events.on('audioTrackAdd', async (queue: GuildQueue) => {
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
                    if (!interaction?.channel) {
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
            if (!interaction?.channel) {
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
    }
}