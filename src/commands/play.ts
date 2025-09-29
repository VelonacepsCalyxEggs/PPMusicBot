import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, Client, EmbedBuilder, GuildMember, Message, User, VoiceBasedChannel } from 'discord.js';
import { QueryType, useQueue, GuildQueue, Player, useMainPlayer, Track, SearchResult } from 'discord-player';
import https from 'https';
import http from 'http';
import fs, { existsSync } from 'fs';
import path from 'path';
import CommandInterface from '../types/commandInterface';
import { createEmbedUtil } from '../utils/createEmbedUtil';
import axios from 'axios';
import { ScoredAlbum, ScoredTrack, SearchResultsDto } from '../types/searchResultInterface';
import formatDuration from '../utils/formatDurationUtil';
import { commandLogger, logError, playerLogger } from '../utils/loggerUtil';
import { createHash } from 'crypto';
import { NoTrackFoundError, PlaylistTooLargeError, YoutubeDownloadFailedError } from '../types/ytdlServiceTypes';
import playTrack from '../helpers/playHelper';
import ShuffleUtil from '../utils/shuffleUtil';
import { KenobiAPIExtractor } from '../extractors/kenobiAPIExtractor';
import { IcecastExtractor } from '../extractors/icecastExtractor';
import { CallbackEvent, YTDLFallbackCallback, YtdlFallbackService } from 'src/services/YTDLFallbackService';

export default class PlayCommand extends CommandInterface {
    public static readonly commandName = 'play';

    private static readonly CONFIDENCE_THRESHOLDS = {
        LOW_CONFIDENCE: 300,
        VERY_LOW_CONFIDENCE: 25,
        MAX_SUGGESTIONS: 5,
        MAX_TRACKS: 10,
        REQUEST_TIMEOUT: 5000
    } as const;

    data = new SlashCommandBuilder()
        .setName(PlayCommand.commandName)
        .setDescription('play a song from YouTube.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('song')
                .setDescription('plays a song')
                .addStringOption(option =>
                    option.setName('music').setDescription('url/searchterm').setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('fromdb')
                .setDescription('plays a song from database')
                .addStringOption(option =>
                    option.setName('dbquery').setDescription('name/author/album').setRequired(true)
                )
                .addBooleanOption(option => 
                    option.setName("shuffle")
                    .setDescription("Shuffle the playlist/album order before adding tracks")
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('file')
                .setDescription('plays a file')
                .addAttachmentOption(option =>
                    option.setName('file').setDescription('play\'s the song').setRequired(true)
                )
        )
    execute = async ({ interaction, client }: { interaction: ChatInputCommandInteraction, client: Client }) => {
        await interaction.deferReply();

        if (!(interaction.member as GuildMember).voice.channel) {
            return interaction.followUp({content: 'You need to be in a voice channel to use this command!', flags: ['Ephemeral']});
        }
        const player = useMainPlayer();
        let guildQueue: GuildQueue;
        let voiceChannel: VoiceBasedChannel;

        // GuildQueue initialization.
        try {
            ({ guildQueue, voiceChannel } = await this.getQueue(client, interaction, player));
            await this.checkVoiceConnection(interaction, voiceChannel, guildQueue);
        }
        catch (error) {
            if (error instanceof Error) {
                return interaction.followUp({content: error.message, flags: ['Ephemeral']});
            }
            else throw error;
        }

        const subcommand = interaction.options.getSubcommand();

        commandLogger.info(`Subcommand used: ${subcommand}`)

        switch (subcommand) {
            case 'song':
                await this.handleSongCommand(client, player, interaction, guildQueue);
                break;
            case 'file':
                await this.handleFileCommand(player, interaction, guildQueue);
                break;
            case 'fromdb':
                await this.handleFromDbCommand(client, player, interaction, guildQueue);
                break;
        }
    }

    private handleSongCommand = async (client: Client, player: Player, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue): Promise<Message<boolean>> => {
        commandLogger.debug(`Handling song command with interaction: ${interaction.id}`);
        const argument = interaction.options.getString('music', true);
        try {
            const { result, song, embed } = await this.handleSourceType(argument, player, client, interaction, guildQueue);

            if (result) {
                await playTrack(result, guildQueue, interaction);
            }
            else if (song) {
                await playTrack(song, guildQueue, interaction);
            }
            else {
                throw new Error('Unhandled exception! No track or result was given!')
            }
            if (embed) {
                return await interaction.followUp({ embeds: [embed] });
            } else {
                return await interaction.followUp({ content: 'No track information available.', flags: ['Ephemeral'] });
            }
        }
        catch(error) {
            if (error instanceof NoTrackFoundError) {
                return interaction.followUp({ content: 'No track found for the provided input.', flags: ['Ephemeral'] });
            } else if (error instanceof PlaylistTooLargeError) {
                return interaction.followUp({ content: 'The playlist is too large to process.', flags: ['Ephemeral'] });
            } else if (error instanceof YoutubeDownloadFailedError) {
                return interaction.followUp({ content: 'Failed to download the YouTube video.', flags: ['Ephemeral'] });
            } else {
                logError(error, `Error handling song command: ${interaction.id}`);
                return interaction.followUp({ content: 'An unexpected error occurred while processing your request.', flags: ['Ephemeral'] });
            }
        }
    };

    private async handleSourceType(argument: string, player: Player, client: Client, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue): Promise<{result: SearchResult | null, song: Track<unknown> | null, embed: EmbedBuilder | null}> {
        const sourceType = this.detectSourceType(argument);
        switch (sourceType) {
            case 'spotify':
                return await this.handleSpotifySourceType(argument, player, client, interaction, guildQueue);
            case 'stream':
                return await this.handleStreamSourceType(argument, player, client, interaction, guildQueue);
            case 'external_url':
                return await this.handleExternalUrlSourceType(argument, player, client, interaction, guildQueue);
            case 'search_term':
                return await this.handleSearchTermSourceType(argument, player, client, interaction, guildQueue);
            case 'youtube_video':
                return await this.handleYoutubeVideoSourceType(argument, player, client, interaction, guildQueue);
            case 'youtube_playlist':
                return await this.handleYoutubePlaylistSourceType(argument, player, client, interaction, guildQueue);
            default:
                throw new Error('Unknown source type');
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private async handleSpotifySourceType(argument: string, player: Player, client: Client, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue): Promise<{result: SearchResult | null, song: Track<unknown> | null, embed: EmbedBuilder | null}> {
        // This is a placeholder for future Spotify support.
        throw new Error('Spotify support is not implemented yet.');
    }

    private async handleStreamSourceType(argument: string, player: Player, client: Client, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue): Promise<{result: SearchResult | null, song: Track<unknown> | null, embed: EmbedBuilder | null}> {
        commandLogger.debug(`Stream URL detected: ${argument}`);
        const result = await this.searchTrack(player, argument, interaction.user);
        return { result, song: result.tracks[0], embed: this.createTrackEmbed(result.tracks[0], guildQueue.tracks.size) };
    }

    private async handleExternalUrlSourceType(argument: string, player: Player, client: Client, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue): Promise<{result: SearchResult | null, song: Track<unknown> | null, embed: EmbedBuilder | null}> {
        commandLogger.debug(`External URL detected: ${argument}`);
        const result = await this.searchFile(player, await this.downloadFile(argument.split('?')[0], argument), interaction.user);
        return { result, song: result.tracks[0], embed: this.createTrackEmbed(result.tracks[0], guildQueue.tracks.size) };
    }

    private async handleSearchTermSourceType(argument: string, player: Player, client: Client, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue): Promise<{result: SearchResult | null, song: Track<unknown> | null, embed: EmbedBuilder | null}> {
        commandLogger.debug(`Search term detected: ${argument}`);

        const progressCallback: YTDLFallbackCallback = (event: CallbackEvent) => {
            interaction.editReply(event.message).catch(error => {
                commandLogger.error('Failed to update progress message:', error);
            });
            return event;
        };

        interaction.editReply("Downloading YouTube video, this might take a moment...");
        const ytdlFallbackInstance = client.diContainer.get<YtdlFallbackService>("YTDLFallbackService")
        
        const result = await ytdlFallbackInstance.playVideo(
            player, 
            null,
            argument, 
            interaction.user,
            progressCallback
        );
        return { result, song: result.tracks[0], embed: this.createTrackEmbed(result.tracks[0], guildQueue.tracks.size) };
    }

    private async handleYoutubeVideoSourceType(argument: string, player: Player, client: Client, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue): Promise<{result: SearchResult | null, song: Track<unknown> | null, embed: EmbedBuilder | null}> {
        commandLogger.debug(`YouTube video URL detected: ${argument}`);
        
        // callback function
        const progressCallback: YTDLFallbackCallback = (event: CallbackEvent) => {
            interaction.editReply(event.message).catch(error => {
                commandLogger.error('Failed to update progress message:', error);
            });
            return event;
        };

        await interaction.editReply("Downloading YouTube video, this might take a moment...");
        const ytdlFallbackInstance = client.diContainer.get<YtdlFallbackService>("YTDLFallbackService")
        
        const result = await ytdlFallbackInstance.playVideo(
            player, 
            this.cleanYoutubeUrl(argument), 
            null, 
            interaction.user,
            progressCallback
        );
        
        return { result, song: result.tracks[0], embed: this.createTrackEmbed(result.tracks[0], guildQueue.tracks.size) };
    }

    private async handleYoutubePlaylistSourceType(argument: string, player: Player, client: Client, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue): Promise<{result: SearchResult | null, song: Track<unknown> | null,  embed: EmbedBuilder | null}> {
        commandLogger.debug(`YouTube playlist URL detected: ${argument}`);
        interaction.editReply("Loading playlist, this might take a moment...");
        let embed: EmbedBuilder | null = null;
        const ytdlFallbackInstance = client.diContainer.get<YtdlFallbackService>("YTDLFallbackService")
        const playlistResult = await ytdlFallbackInstance.playPlaylistWithBackground(argument, player, interaction.user, guildQueue);
        // Play the first track immediately if available
        if (playlistResult.firstTrack) {
            embed = createEmbedUtil(
                `**${playlistResult.playlistInfo.title}** - Started playing first track`, 
                playlistResult.playlistInfo.bestThumbnail?.url || '', 
                `Total tracks: ${playlistResult.playlistInfo.items.length} | Downloading remaining tracks in background...`
            );
        } else {
            embed = createEmbedUtil(
                `**${playlistResult.playlistInfo.title}** - Loading playlist...`, 
                playlistResult.playlistInfo.bestThumbnail?.url || '', 
                `Total tracks: ${playlistResult.playlistInfo.items.length} | Processing tracks in background...`
            );
        }
        // Handle the background promise
        playlistResult.backgroundPromise.then(() => {
            playerLogger.debug(`Finished processing all tracks for playlist: ${playlistResult.playlistInfo.title}`);
            interaction.followUp({ content: `Finished loading all tracks from **${playlistResult.playlistInfo.title}**`, flags: ['SuppressNotifications'] });
        }).catch((error) => {
            playerLogger.error(`Error processing background tracks: ${error.message}`);
            interaction.followUp({ content: `Error processing playlist tracks: ${error.message}`, flags: ['Ephemeral'] });
        });
        return { result: null, song: playlistResult.firstTrack, embed };
    }

    // Helper method to detect source type
    private detectSourceType(input: string): 'stream' | 
    'external_url' | 
    'youtube_video' | 
    'youtube_playlist' | 
    'search_term' |
    'spotify' {
        if (input.includes('spotify')) {
            return 'spotify';
        }
        if (input.includes('playlist?list=')) {
            return 'youtube_playlist';
        }
        
        if ((input.includes('watch?v=') || input.includes('youtu.be') || input.includes('youtube.com')) && 
            !input.includes('playlist?list=')) {
            return 'youtube_video';
        }
        if (input.startsWith("icecast://")) {
            return 'stream';
        }
        if ((input.startsWith('http') || input.startsWith('https')) &&
            !(input.includes('watch?v=') || input.includes('youtu.be') || input.includes('youtube.com'))) {
            return 'external_url';
        }
        
        return 'search_term';
    }

    // Helper to clean YouTube URLs
    private cleanYoutubeUrl(url: string): string {
        if (url.includes('si=')) {
            const parts = url.split('si=');
            if (parts.length > 1) {
                return parts[0];
            }
        }
        return url;
    }

    // Helper to search for a stream
    private async searchTrack(player: Player, query: string, requestedBy: User): Promise<SearchResult> {
        return await player.search(query, {
            requestedBy,
            searchEngine: `ext:${IcecastExtractor.identifier}`
        });
    }

    // Helper to search YouTube
    private async searchYoutube(player: Player, query: string, requestedBy: User): Promise<SearchResult> {
        return await player.search(query, {
            requestedBy,
            searchEngine: QueryType.YOUTUBE_SEARCH
        });
    }

    // Helper to search a file
    private async searchFile(player: Player, filePath: string, requestedBy: User): Promise<SearchResult> {
        return await player.search(filePath, {
            requestedBy,
            searchEngine: QueryType.FILE
        });
    }

    // Helper to create a track embed
    private createTrackEmbed(track: Track | undefined, queueSize: number): EmbedBuilder {
        if (!track) {
            throw new Error('No track information available.');
        }
        return createEmbedUtil(
            `**${track.title}** has been added to the queue`, 
            track.thumbnail.length > 0 ? track.thumbnail : 'https://www.funckenobi42.space/images/AlbumCoverArt/DefaultCoverArt.png', 
            `Duration: ${track.duration} Position: ${queueSize}`
        );
    }

    private async handleFileCommand(player: Player, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue) {
        const file = interaction.options.get('file')?.attachment;
        if (!file) {
            return interaction.followUp("No file attachment found");
        }

        const localPath = await this.downloadFile(file.url.split('?')[0], file.url);
        const result = await player.search(localPath, {
            requestedBy: interaction.user,
            searchEngine: QueryType.FILE,
        });

        const song = result.tracks[0];
        if (!song) return interaction.followUp('No results');

        const embed = new EmbedBuilder()
            .setDescription(`**${song.title}** has been added to the queue`)
            .setThumbnail(song.thumbnail)
            .setFooter({
                text: `Duration: ${song.duration} Position: ${guildQueue.tracks.size}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        await playTrack(result, guildQueue, interaction);

        await interaction.followUp({ embeds: [embed] });
    };

    private handleFromDbCommand = async (client: Client, player: Player, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue) => {
        if (!process.env.API_URL) {
            return interaction.followUp('API URL is not set. Please contact the bot owner.');
        }
        try {
            commandLogger.http(`Searching database for query: ${interaction.options.get('dbquery')?.value}`);
            const response = await axios.request<SearchResultsDto>({
                method: 'POST',
                url: `${process.env.API_URL}/music/search`,
                data: { query: interaction.options.get('dbquery')?.value },
                timeout: PlayCommand.CONFIDENCE_THRESHOLDS.REQUEST_TIMEOUT, // Set a timeout of 5 seconds
            });
            commandLogger.debug(`Database response: ${JSON.stringify(response.data)}`);
            
            // First, verify we have any results at all
            if (response.data.tracks.length === 0 && response.data.albums.length === 0) {
                return interaction.followUp({ 
                    flags: ['SuppressNotifications'],
                    embeds: [createEmbedUtil(
                        'No results found.',
                        'https://www.funckenobi42.space/images/', 
                        'Please try a different query.'
                    )]
                });
            }

            // Get the highest score from both tracks and albums (the backend returns sorted lists)
            const highestTrackScore = response.data.tracks.length > 0 ? response.data.tracks[0].score : 0;
            const highestAlbumScore = response.data.albums.length > 0 ? response.data.albums[0].score : 0;
            // If the highest score is below confidence threshold, show combined suggestions
            if (Math.max(highestTrackScore, highestAlbumScore) <= PlayCommand.CONFIDENCE_THRESHOLDS.LOW_CONFIDENCE) {
                commandLogger.debug('Low confidence match found, showing suggestions');
                
                // Create combined suggestions list from tracks and albums
                const combinedSuggestions: Array<{type: 'track' | 'album', name: string, score: number}> = [
                    ...response.data.tracks.slice(0, PlayCommand.CONFIDENCE_THRESHOLDS.MAX_SUGGESTIONS).map(track => ({
                        type: 'track' as const,
                        name: track.title,
                        score: track.score
                    })),
                    ...response.data.albums.slice(0, PlayCommand.CONFIDENCE_THRESHOLDS.MAX_SUGGESTIONS).map(album => ({
                        type: 'album' as const,
                        name: album.name,
                        score: album.score
                    }))
                ];
                // Sort by score descending
                combinedSuggestions.sort((a, b) => b.score - a.score);
                // Format the suggestions
                const suggestions = combinedSuggestions
                    .slice(0, 5)
                    .map(item => `${item.name} (${item.type}, score: ${item.score})`)
                    .join('\n- ');
                    
                return interaction.followUp({ 
                    flags: ['SuppressNotifications'],
                    embeds: [createEmbedUtil(
                        `Low confidence matches found.\n\nDid you mean:\n- ${suggestions}`, 
                        `https://www.funckenobi42.space/images/`, 
                        'Please try a more specific query.'
                    )]
                });
            }

            // Otherwise, proceed with the normal flow - play track or album based on which has higher score
            if (response.data.albums.length === 0 || highestTrackScore > highestAlbumScore) {
                const highestScoringTracks: ScoredTrack[] = []
                response.data.tracks.forEach(track => {
                    if (track.score === highestTrackScore) {
                        highestScoringTracks.push(track);
                    }
                });
                if (highestScoringTracks.length > 1) {
                    commandLogger.debug('Multiple equally high scoring tracks found, making a choice response.');
                    const choiceResponse = "Please be more specific, multiple tracks found with similar confidence:\n- " + highestScoringTracks.map(t => t.title + ' |Score: ' + t.score).join('\n- ');
                    const searchSuggestions = "\nYou may try searching for:\n- " + highestScoringTracks.map(t => `'${t.title}' '${t.artist.name}' '${t.album.name}'`).join('\n- ');

                    return await interaction.followUp({ 
                        flags: ['SuppressNotifications', 'Ephemeral'],
                        embeds: [createEmbedUtil(choiceResponse + searchSuggestions, 'https://www.funckenobi42.space/images/', "Please try a different query.") ]
                    });
                }

                // Play single track
                return await this.handleSingleTrack(player, interaction, guildQueue, response.data.tracks[0], response.data.tracks);
            } else if (response.data.albums.length > 0) {
                const highestScoringAlbums: ScoredAlbum[] = []
                response.data.albums.forEach(album => {
                    if (album.score === highestAlbumScore) {
                        highestScoringAlbums.push(album);
                    }
                });
                if (highestScoringAlbums.length > 1) {
                    commandLogger.debug('Multiple equally high scoring albums found, making a choice response.');
                    const choiceResponse = "Please be more specific, multiple albums found with similar confidence:\n- " + highestScoringAlbums.map(a => a.name).join('\n- ');
                    const searchSuggestions = "\nYou may try searching for:\n- " + highestScoringAlbums.map(a => `'${a.name}' '${a.Artists[0].name}'`).join('\n- ');

                    return await interaction.followUp({ 
                        flags: ['SuppressNotifications', 'Ephemeral'],
                        embeds: [createEmbedUtil(choiceResponse + searchSuggestions, 'https://www.funckenobi42.space/images/', "Please try a different query.") ]
                    });
                }
                // Play album
                return await this.handleAlbum(player, interaction, guildQueue, response.data.albums[0], response.data.albums);
            }
            
        } catch (error) {
            logError(error as Error, 'playCommand.handleFromDbCommand', { interaction });
            return interaction.followUp({ 
                flags: ['SuppressNotifications'],
                embeds: [createEmbedUtil(
                    "An error occurred while playing from database", 
                    'https://www.funckenobi42.space/images/',
                    `Error: ${(error as Error).message}`
                )]
            });
        }
    };    

    // Helper method for handling single track
    private async handleSingleTrack(
        player: Player,
        interaction: ChatInputCommandInteraction,
        guildQueue: GuildQueue,
        track: ScoredTrack,
        allTracks: ScoredTrack[]
    ): Promise<Message<boolean>> {
        try {
            commandLogger.debug(`Found track: ${track.title}`);
            
            const result = await player.search(`track:${track.id}`, {
                searchEngine: `ext:${KenobiAPIExtractor.identifier}`,
                requestedBy: interaction.user,
            });

            if (result.tracks.length === 0) {
                // Show suggestions if there are other tracks
                if (track.score <= PlayCommand.CONFIDENCE_THRESHOLDS.VERY_LOW_CONFIDENCE && allTracks.length > 1) {
                    commandLogger.debug('Unconfident track match found, showing suggestions');
                    const suggestions = allTracks
                        .slice(0, 5)
                        .map(t => t.title)
                        .join('\n- ');
                        
                    return interaction.followUp({ 
                        flags: ['SuppressNotifications'],
                        embeds: [createEmbedUtil(
                            `No results found.\n\nMaybe you meant:\n- ${suggestions}`, 
                            `https://www.funckenobi42.space/images/`, // Default thumbnail
                            'Please try a different query.'
                        )]
                    });
                }
                
                return interaction.followUp({ 
                    flags: ['SuppressNotifications'],
                    embeds: [createEmbedUtil(
                        'Track found in database but file is not accessible.',
                        `https://www.funckenobi42.space/images/`, // Default thumbnail
                        'Please try a different query.'
                    )]
                });
            }
            // If we get here, we have a valid track to play
            await playTrack(result, guildQueue, interaction, true);
            return interaction.followUp({ 
                flags: ['SuppressNotifications'],
                embeds: [createEmbedUtil(
                    `**${track.title}** has been added to the queue`, 
                    `https://www.funckenobi42.space/images/AlbumCoverArt/${track.album.coverArt[0]?.filePath?.split('\\').pop() || ''}`, // Use the cover from the first track if available
                    `Duration: ${(formatDuration(result.tracks[0].durationMS || 0))} Position: ${guildQueue.tracks.size}`
                )]
            });
        } catch (error) {
            commandLogger.error(`Error processing single track: ${(error as Error).message}`);
            logError(error as Error, 'playCommand.handleSingleTrack');
            return interaction.followUp({ 
                flags: ['SuppressNotifications'],
                embeds: [createEmbedUtil(
                    'Error processing track.',
                    `https://www.funckenobi42.space/images/`, // Default thumbnail
                    'Please try a different query.'
                )]
            });
        }
    }

    // Helper method for handling album
    private async handleAlbum(
        player: Player,
        interaction: ChatInputCommandInteraction,
        guildQueue: GuildQueue,
        album: ScoredAlbum,
        allAlbums: ScoredAlbum[]
    ): Promise<Message<boolean>> {
        try {
            commandLogger.debug(`Found album: ${album.name}`);

            if (album.score <= PlayCommand.CONFIDENCE_THRESHOLDS.LOW_CONFIDENCE && allAlbums.length > 1) {
                commandLogger.debug('Unconfident album match found, showing suggestions');
                const suggestions = allAlbums
                    .slice(0, 5)
                    .map(a => a.name)
                    .join('\n- ');
                    
                return interaction.followUp({ 
                    flags: ['SuppressNotifications'],
                    embeds: [createEmbedUtil(
                        `No results found.\n\nMaybe you meant:\n- ${suggestions}`, 
                        `https://www.funckenobi42.space/images/`, // Default thumbnail
                        'Please try a different query.'
                    )]
                });
            }
            
            const result = await player.search(`album:${album.id}`, {
                searchEngine: `ext:${KenobiAPIExtractor.identifier}`,
                requestedBy: interaction.user,
            });

            if (result.tracks.length === 0) {
                return interaction.followUp({ 
                    flags: ['SuppressNotifications'],
                    embeds: [createEmbedUtil(
                        'Album found in database but no tracks are accessible.',
                        `https://www.funckenobi42.space/images/`, // Default thumbnail
                        'Please try a different query.'
                    )]
                });
            }


            if (interaction.options.getBoolean('shuffle', false)) {
                commandLogger.debug('Shuffling album tracks');
                ShuffleUtil.fisherYatesShuffle(result.tracks);
            }
            
            playTrack(result, guildQueue, interaction, true);
            return interaction.followUp({ 
                flags: ['SuppressNotifications'],
                embeds: [createEmbedUtil(
                    `**${album.name}** has been added to the queue`, 
                    `https://www.funckenobi42.space/images/AlbumCoverArt/${album.coverArt[0]?.filePath?.split('\\').pop() || ''}`, // Use the cover from the album
                    `Tracks: ${result.tracks.length} | Starting from position: ${(guildQueue.tracks.size)}`
                )]
            });
        } catch (error) {
            commandLogger.error(`Error processing album: ${(error as Error).message}`);
            return interaction.followUp({ 
                flags: ['SuppressNotifications'],
                embeds: [createEmbedUtil(
                    'Error processing album.',
                    `https://www.funckenobi42.space/images/`, // Default thumbnail
                    'Please try a different query.'
                )]
            });
        }
    }
    
    private async getfileMD5(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = createHash('md5');
            if (!fs.existsSync(filePath)) {
                reject(new Error(`File does not exist: ${filePath}`));
                return;
            }
            const stream = fs.createReadStream(filePath);
            
            stream.on('error', (err) => {
                reject(err);
            });
            
            stream.on('data', (chunk) => {
                hash.update(chunk);
            });
            
            stream.on('end', () => {
                const md5Hash = hash.digest('hex');
                resolve(md5Hash);
            });
        });
    };

    private async downloadFile (file: string, url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                // Extract the original filename from the URL
                const originalFilename = path.basename(file);
                const fileExtension = path.extname(originalFilename);
                const baseFilename = path.basename(originalFilename, fileExtension);
                const cacheDir = process.env.CACHE_DIR || path.join(process.cwd(), 'cache');
                
                if (!fs.existsSync(cacheDir)) {
                    fs.mkdirSync(cacheDir, { recursive: true });
                }

                const filePath = path.join(cacheDir, `${baseFilename}${fileExtension}`);
                if (existsSync(filePath)) {
                    return resolve(filePath);
                }
                const writeStream = fs.createWriteStream(filePath);
                const protocol = url.startsWith('https') ? https : http;

                protocol.get(url, async (res) => {
                    res.pipe(writeStream);
                    
                    writeStream.on('finish', async () => {
                        writeStream.close();
                        resolve(filePath);
                    });
                    
                    writeStream.on('error', (err) => {
                        // Clean up temp file on error
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                        }
                        reject(err);
                    });
                }).on('error', (err) => {
                    logError(err as Error, 'Download Error', { url, filePath });
                    reject(err);
                });
                
            } catch (error) {
                logError(error as Error, 'downloadFile', { file, url });
                reject(error);
            }
        });
    };

    private async getQueue(client: Client, interaction: ChatInputCommandInteraction, player: Player): Promise<{ guildQueue: GuildQueue, voiceChannel: VoiceBasedChannel }> {
        if (!interaction.guild) {
            throw new Error('This command can only be used in a server.');
        }

        let guildQueue = useQueue(interaction.guild);

        if (!guildQueue) {
            commandLogger.debug(`Creating new queue for guild: ${interaction.guild.id}`);
            guildQueue = player.nodes.create(interaction.guild, {leaveOnEnd: false, leaveOnEmpty: true, leaveOnStop: false, metadata: interaction, noEmitInsert: true});   
        } else if (guildQueue.deleted) {
            guildQueue.revive();
        }
        const voiceChannel = (interaction.member as GuildMember).voice.channel;
        if (!voiceChannel) {
            throw new Error('You must be in a voice channel to use this command.');
        }
        return { guildQueue, voiceChannel };
    }

    private async checkVoiceConnection(interaction: ChatInputCommandInteraction, voiceChannel: VoiceBasedChannel, guildQueue: GuildQueue): Promise<void> {
        if (!guildQueue.connection) {
            if (voiceChannel.joinable === false) {
                throw new Error('I cannot join your voice channel. Please check my permissions.');
            }

            if (voiceChannel.full) {
                throw new Error('Your voice channel is full.');
            }

            await guildQueue.connect(voiceChannel);
            if (!guildQueue.connection) {
                throw new Error('Failed to connect to the voice channel.');
            }
        }
    }
};
