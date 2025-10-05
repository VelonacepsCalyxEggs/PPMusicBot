import { DefaultExtractors } from "@discord-player/extractor";
import { YoutubeiExtractor } from "discord-player-youtubei";
import { Player, GuildQueue, Track } from "discord-player";
import { Client, Interaction, TextChannel } from "discord.js";
import TrackMetadata from "../../types/trackMetadata";
import { playerLogger, logError, discordLogger, logPlayerEvent } from "../../utils/loggerUtil";
import { KenobiAPIExtractor } from "../../extractors/kenobiAPIExtractor";
import { VoiceConnectionState } from "discord-voip";
import { IcecastExtractor } from "../../extractors/icecastExtractor";
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
                this.player.extractors.register(IcecastExtractor, { baller: true });
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

            this.player.on('debug', playerLogger.debug);
            this.player.events.on('debug', (_, m) => playerLogger.debug(m));
            
            // Voice connection state diagnostics per queue
            this.player.events.on('connection', (queue) => {
                const vc = queue.connection;
                if (vc) {
                    vc.on('stateChange', (oldState: VoiceConnectionState, newState: VoiceConnectionState) => {
                        playerLogger.debug(`VoiceConnection ${queue.guild?.id} state ${oldState.status} -> ${newState.status}`);
                    });
                }
            });

            // Track timing
            this.player.events.on('playerFinish', (queue: GuildQueue) => {
                if (queue.tracks.size !== 0) {
                    const track = queue.tracks.at(0) as Track<TrackMetadata>;
                    if (track?.metadata) {
                        track.metadata.startedPlaying = new Date();
                    }
                } else {
                    const metadata = (queue.currentTrack as Track<TrackMetadata>)?.metadata;
                    if (metadata) {
                        metadata.startedPlaying = new Date();
                    }
                }
            });

            this.player.events.on('audioTrackAdd', (queue: GuildQueue) => {
                if (queue.tracks.size !== 0) {
                    const trackMeta = (queue.tracks.at(0) as Track<TrackMetadata>)?.metadata;
                    if (trackMeta) {
                        trackMeta.startedPlaying = new Date();
                    }
                }
            });

            // Unified error handler (removed duplicate)
            this.player.events.on('error', (queue: GuildQueue, error: Error) => {
                logError(error, 'player_error', {
                    guildId: queue.guild?.id,
                    currentTrack: queue.currentTrack?.title,
                    queueSize: queue.tracks.size
                });
                logPlayerEvent('queueError', queue.guild?.id, {
                    error: error.message,
                    currentTrack: queue.currentTrack?.title
                });

                const interaction = queue.metadata as Interaction;
                const channel = interaction?.channel as TextChannel | undefined;

                // AbortError: likely timed out stream fetch / invalid stream
                if (error.name === 'AbortError') {
                    if (channel) {
                        channel.send({ content: 'Stream aborted (timeout). Attempting recovery...', flags: ['SuppressNotifications'] })
                            .catch(() => {});
                    }
                    // Force small reconnect cycle if persistent
                    try {
                        if (queue.connection && queue.connection.state.status !== 'destroyed') {                           queue.connection.disconnect();
                            setTimeout(() => {
                                try { queue.connect(queue.channel!); } catch { /* empty */ }
                            }, 1500);
                        }
                    } catch (e) {
                        logError(e as Error, 'abort_reconnect_fail', { guildId: queue.guild?.id });
                    }
                    return;
                }

                // Extractor / network hints
                if (/fetch failed|ConnectTimeoutError|youtubei/i.test(error.message)) {
                    if (channel) {
                        channel.send({
                            content: 'Extractor/network error. Skipping track...',
                            flags: ['SuppressNotifications']
                        }).catch(() => {});
                    }
                    if (queue.tracks.size > 0) {
                        try { queue.node.skip(); } catch (e) {
                            logError(e as Error, 'recovery_skip_failed', { guildId: queue.guild?.id });
                        }
                    }
                }
            });

            this.player.events.on('emptyChannel', (queue: GuildQueue) => {
                const interaction = queue.metadata as Interaction;
                try {
                    if (queue.connection && queue.connection.state.status === 'destroyed') return;
                    (interaction.channel as TextChannel).send({ content: 'Everyone left the channel.', flags: ['SuppressNotifications']});
                } catch (error) {
                    discordLogger.error('Error when handling emptyChannel:', error);
                }
            });

            this.player.events.on('playerError', (queue: GuildQueue, error: Error) => {
                logPlayerEvent('playerError', queue.guild?.id, { error: error.message });
                // No duplicate skip here; unified logic above
            });

            this.player.events.on('emptyQueue', (queue: GuildQueue) => {
                if (queue.connection && queue.connection.state.status !== 'destroyed') {
                    const interaction = queue.metadata as Interaction;
                    if (!interaction?.channel) return;
                    try {
                        (interaction.channel as TextChannel).send({ content: 'The queue is now empty.', flags: ['SuppressNotifications']});
                    } catch (error) {
                        logError(error as Error, 'Queue', { interaction });
                    }
                }
            });

            this.player.events.on('connectionDestroyed', (queue: GuildQueue) => {
                const interaction = queue.metadata as Interaction;
                if (!interaction?.channel) return;
                try {
                    if (queue.connection && queue.connection.state.status !== 'destroyed') {
                        (interaction.channel as TextChannel).send({ content: 'Voice connection destroyed. Queue cleared.', flags: ['SuppressNotifications'] });
                    }
                } catch (error) {
                    logError(error as Error, 'connectionDestroyed', { interaction });
                }
            });
    }
}