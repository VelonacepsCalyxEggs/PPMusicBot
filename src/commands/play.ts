import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, Client, EmbedBuilder, GuildMember, Message, User, VoiceBasedChannel } from 'discord.js';
import { QueryType, useQueue, GuildQueue, Player, useMainPlayer, Track, SearchResult } from 'discord-player';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import CommandInterface from '../types/commandInterface';
import { createEmbedUtil } from '../utils/createEmbedUtil';
import axios from 'axios';
import { ScoredAlbum, ScoredTrack, SearchResultsDto } from '../types/searchResultInterface';
import formatDuration from '../utils/formatDurationUtil';
import { commandLogger, logError, playerLogger } from '../utils/loggerUtil';
import { randomUUID, createHash } from 'crypto';
import { YtdlFallback } from '../utils/ytdlFallback';
import { NoTrackFoundError, PlaylistTooLargeError, YoutubeDownloadFailedError } from '../types/ytdlServiceTypes';
import { NetworkFileService } from '../services/networkFileService';
import playTrack from '../helpers/playHelper';
import ShuffleUtil from '../utils/shuffleUtil';
import { MusicTrack } from 'velonaceps-music-shared/dist';

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
            const { result, song, embed } = await this.handleSourceType(argument, player, interaction, guildQueue);

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

    private async handleSourceType(argument: string, player: Player, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue): Promise<{result: SearchResult | null, song: Track<unknown> | null, embed: EmbedBuilder | null}> {
        const sourceType = this.detectSourceType(argument);
        switch (sourceType) {
            case 'spotify':
                return await this.handleSpotifySourceType(argument, player, interaction, guildQueue);
            case 'stream':
                return await this.handleStreamSourceType(argument, player, interaction, guildQueue);
            case 'external_url':
                return await this.handleExternalUrlSourceType(argument, player, interaction, guildQueue);
            case 'search_term':
                return await this.handleSearchTermSourceType(argument, player, interaction, guildQueue);
            case 'youtube_video':
                return await this.handleYoutubeVideoSourceType(argument, player, interaction, guildQueue);
            case 'youtube_playlist':
                return await this.handleYoutubePlaylistSourceType(argument, player, interaction, guildQueue);
            default:
                throw new Error('Unknown source type');
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private async handleSpotifySourceType(argument: string, player: Player, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue): Promise<{result: SearchResult | null, song: Track<unknown> | null, embed: EmbedBuilder | null}> {
        // This is a placeholder for future Spotify support.
        throw new Error('Spotify support is not implemented yet.');
    }

    private async handleStreamSourceType(argument: string, player: Player, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue): Promise<{result: SearchResult | null, song: Track<unknown> | null, embed: EmbedBuilder | null}> {
        commandLogger.debug(`Stream URL detected: ${argument}`);
        const result = await this.searchTrack(player, this.normalizeStreamUrl(argument), interaction.user);
        return { result, song: result.tracks[0], embed: this.createTrackEmbed(result.tracks[0], guildQueue.tracks.size) };
    }

    private async handleExternalUrlSourceType(argument: string, player: Player, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue): Promise<{result: SearchResult | null, song: Track<unknown> | null, embed: EmbedBuilder | null}> {
        commandLogger.debug(`External URL detected: ${argument}`);
        const result = await this.searchFile(player, await this.downloadFile(argument.split('?')[0], argument), interaction.user);
        return { result, song: result.tracks[0], embed: this.createTrackEmbed(result.tracks[0], guildQueue.tracks.size) };
    }

    private async handleSearchTermSourceType(argument: string, player: Player, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue): Promise<{result: SearchResult | null, song: Track<unknown> | null, embed: EmbedBuilder | null}> {
        commandLogger.debug(`Search term detected: ${argument}`);
        interaction.editReply("Downloading YouTube video, this might take a moment...");
        const result = await YtdlFallback.playVideo(player, null, argument, interaction.user);
        return { result, song: result.tracks[0], embed: this.createTrackEmbed(result.tracks[0], guildQueue.tracks.size) };
    }

    private async handleYoutubeVideoSourceType(argument: string, player: Player, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue): Promise<{result: SearchResult | null, song: Track<unknown> | null, embed: EmbedBuilder | null}> {
        commandLogger.debug(`YouTube video URL detected: ${argument}`);
        interaction.editReply("Downloading YouTube video, this might take a moment...");
        const result = await YtdlFallback.playVideo(player, this.cleanYoutubeUrl(argument), null, interaction.user);
        return { result, song: result.tracks[0], embed: this.createTrackEmbed(result.tracks[0], guildQueue.tracks.size) };
    }

    private async handleYoutubePlaylistSourceType(argument: string, player: Player, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue): Promise<{result: SearchResult | null, song: Track<unknown> | null,  embed: EmbedBuilder | null}> {
        commandLogger.debug(`YouTube playlist URL detected: ${argument}`);
        interaction.editReply("Loading playlist, this might take a moment...");
        let embed: EmbedBuilder | null = null;
        const playlistResult = await YtdlFallback.playPlaylistWithBackground(argument, player, interaction.user, guildQueue);
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
        
        if ((input.includes('http') || input.includes('https')) &&
            !(input.includes('watch?v=') || input.includes('youtu.be') || input.includes('youtube.com'))) {
            //if (input.includes('stream') || input.includes(':')) {
            //    return 'stream';
            //}
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

    // This is a hardcoded thing, which will be replaced with a proper implementation later...
    private normalizeStreamUrl(url: string): string {
        if (url.includes('funckenobi42.space')) {
            return 'http://127.0.0.1:55060/stream.mp3';
        }
        return url;
    }

    // Helper to search for a track
    private async searchTrack(player: Player, query: string, requestedBy: User): Promise<SearchResult> {
        return await player.search(query, {
            requestedBy,
            searchEngine: QueryType.AUTO
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
        const networkFileService = client.diContainer.get<NetworkFileService>('NetworkFileService');
        // Test connection if using webserver
        if (process.env.USE_WEBSERVER === 'true') {
            try {
                const isConnected = await networkFileService.testConnection();
                if (!isConnected) {
                    return interaction.followUp({
                        content: 'Music server is not accessible. Please try again later.',
                        flags: ['Ephemeral']
                    });
                }
            } catch (error) {
                commandLogger.error(`Error testing network connection: ${error.message}`);
                return interaction.followUp({
                    content: 'Error connecting to music server. Please try again later.',
                    flags: ['Ephemeral']
                });
            }
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

            // Get the highest score from both tracks and albums
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
                // Play single track
                return await this.handleSingleTrack(networkFileService, player, interaction, guildQueue, response.data.tracks[0], response.data.tracks);
            } else if (response.data.albums.length > 0) {
                // Play album
                return await this.handleAlbum(networkFileService, player, interaction, guildQueue, response.data.albums[0], response.data.albums);
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
        networkFileService: NetworkFileService,
        player: Player,
        interaction: ChatInputCommandInteraction,
        guildQueue: GuildQueue,
        track: ScoredTrack,
        allTracks: ScoredTrack[]
    ): Promise<Message<boolean>> {
        try {
            commandLogger.debug(`Found track: ${track.title}`);
            
            // Use NetworkFileService to get the appropriate file URL/path
            const result = await networkFileService.searchTrack(
                player,
                track.MusicFile[0].id, // File ID from database
                track.MusicFile[0].filePath, // Local path as fallback
                interaction.user
            );

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
            result.tracks[0].title = track.title; // Ensure title is set correctly
            result.tracks[0].author = track.artist?.name || 'Unknown Artist'; // Ensure author is set correctly
            result.tracks[0].duration = (track.duration * 1000).toString(); // Convert seconds to milliseconds
            // If we get here, we have a valid track to play
            await playTrack(result, guildQueue, interaction, track);
            return interaction.followUp({ 
                flags: ['SuppressNotifications'],
                embeds: [createEmbedUtil(
                    `**${track.title}** has been added to the queue`, 
                    `https://www.funckenobi42.space/images/AlbumCoverArt/${track.album.coverArt[0]?.filePath?.split('\\').pop() || ''}`, // Use the cover from the first track if available
                    `Duration: ${(formatDuration(track.duration * 1000))} Position: ${guildQueue.tracks.size}`
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
        networkFileService: NetworkFileService,
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
            
            const albumResponse = await axios.request<{ data: MusicTrack[] }>({
                method: 'GET',
                url: `${process.env.API_URL}/music`,
                params: { albumId: album.id, sortBy:"trackNumber", limit: 512, sortOrder: "asc" }
            });
            
            const foundAlbum = albumResponse.data.data;
            if (!foundAlbum || foundAlbum.length === 0) {
                commandLogger.debug('No tracks found in the album');
                return interaction.followUp({ 
                    flags: ['SuppressNotifications'],
                    embeds: [createEmbedUtil(
                        'No tracks found in the album.',
                        `https://www.funckenobi42.space/images/`, // Default thumbnail
                        'Please try a different query.'
                    )]
                });
            }

            // Sort tracks by disc number before playing
            const sortedAlbumTracks = this.sortAlbumTracks(foundAlbum);

            if (interaction.options.getBoolean('shuffle', false)) {
                commandLogger.debug('Shuffling album tracks');
                ShuffleUtil.fisherYatesShuffle(sortedAlbumTracks);
            }

            // Process each track in the album using NetworkFileService
            let successfulTracks = 0;
            for (const track of sortedAlbumTracks) {
                try {
                    const result = await networkFileService.searchTrack(
                        player,
                        track.MusicFile[0].id, // File ID from database
                        track.MusicFile[0].filePath, // Local path as fallback
                        interaction.user
                    );
                    
                    if (result.tracks.length === 0) {
                        commandLogger.debug(`No results found for track: ${track.title}`);
                        continue; // Skip this track and continue with the album
                    }
                    
                    result.tracks[0].title = track.title // Ensure title is set correctly
                    result.tracks[0].author = track.artist.name
                    result.tracks[0].duration = (track.duration * 1000).toString(); // Convert seconds to milliseconds
                    // If we get here, we have a valid track to play
                    await playTrack(result, guildQueue, interaction, track as ScoredTrack);
                    successfulTracks++;
                } catch (error) {
                    commandLogger.error(`Error processing track ${track.title}: ${(error as Error).message}`);
                    continue; // Skip this track and continue with the album
                }
            }
            
            if (successfulTracks === 0) {
                return interaction.followUp({ 
                    flags: ['SuppressNotifications'],
                    embeds: [createEmbedUtil(
                        'No tracks from the album could be loaded.',
                        `https://www.funckenobi42.space/images/`, // Default thumbnail
                        'The files may not be accessible on the server.'
                    )]
                });
            }
            
            return interaction.followUp({ 
                flags: ['SuppressNotifications'],
                embeds: [createEmbedUtil(
                    `**${album.name}** has been added to the queue`, 
                    `https://www.funckenobi42.space/images/AlbumCoverArt/${album.coverArt[0]?.filePath?.split('\\').pop() || ''}`, // Use the cover from the album
                    `Tracks: ${successfulTracks}/${foundAlbum.length} loaded | Starting from position: ${(guildQueue.tracks.size - successfulTracks) + 1}`
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

    // Helper method for sorting album tracks
    private sortAlbumTracks(foundAlbum: MusicTrack[]): MusicTrack[] {
        // Skip sorting if there's no data
        if (!foundAlbum || foundAlbum.length === 0) return foundAlbum;
        
        // Group tracks by disc number
        const discGroups = new Map<string | number | undefined, MusicTrack[]>();
        
        // Create groups based on disc number
        for (const track of foundAlbum) {
            let discNumber = track.MusicMetadata?.discNumber;
            if (discNumber === null) discNumber = undefined;
            if (!discGroups.has(discNumber)) {
                discGroups.set(discNumber, []);
            }
            discGroups.get(discNumber)!.push(track);
        }
        
        // Sort disc groups: numbers first (in numerical order), then strings (alphabetically)
        const sortedGroups = Array.from(discGroups.entries()).sort((a, b) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [discA, _] = a;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [discB, __] = b;
            
            // Handle undefined disc numbers
            if (discA === undefined) return -1;
            if (discB === undefined) return 1;
            
            // Check if both values can be treated as numbers
            const numA = typeof discA === 'number' ? discA : Number(discA);
            const numB = typeof discB === 'number' ? discB : Number(discB);
            const aIsNumber = !isNaN(numA);
            const bIsNumber = !isNaN(numB);
            
            // Numbers before strings
            if (aIsNumber && !bIsNumber) return -1;
            if (!aIsNumber && bIsNumber) return 1;
            
            // Both numbers - sort numerically
            if (aIsNumber && bIsNumber) return numA - numB;
            
            // Both strings - sort alphabetically
            return String(discA).localeCompare(String(discB));
        });
        
        // Flatten back into a single array
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return sortedGroups.flatMap(([_, tracks]) => tracks);
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

                // First, download to a temporary file to get MD5
                const tempPath = path.join(cacheDir, `temp_${randomUUID().slice(0, 8)}${fileExtension}`);
                const tempWriteStream = fs.createWriteStream(tempPath);
                const protocol = url.startsWith('https') ? https : http;

                protocol.get(url, async (res) => {
                    res.pipe(tempWriteStream);
                    
                    tempWriteStream.on('finish', async () => {
                        tempWriteStream.close();
                        
                        try {
                            // Get MD5 of the downloaded file
                            const newFileMD5 = await this.getfileMD5(tempPath);
                            
                            // Check if a file with the same MD5 already exists
                            const existingFiles = fs.readdirSync(cacheDir).filter(f => 
                                f.endsWith(fileExtension) && f !== path.basename(tempPath)
                            );
                            
                            // This is infefficient, but I am too lazy to make a database, so I'll wait till I get this to use Prisma.
                            for (const existingFile of existingFiles) {
                                const existingPath = path.join(cacheDir, existingFile);
                                try {
                                    const existingMD5 = await this.getfileMD5(existingPath);
                                    if (existingMD5 === newFileMD5) {
                                        // File already exists, delete temp file and return existing
                                        fs.unlinkSync(tempPath);
                                        commandLogger.info(`File already exists in cache: ${existingPath}`);
                                        resolve(existingPath);
                                        return;
                                    }
                                } catch (error) {
                                    // If we can't read an existing file, skip it
                                    commandLogger.warn(`Could not read existing file ${existingPath}: ${error}`);
                                    continue;
                                }
                            }
                            
                            // No matching file found, move temp file to final location with UUID
                            const finalPath = path.join(
                                cacheDir,
                                `${baseFilename}___${randomUUID().slice(0, 6)}${fileExtension}`
                            );
                            fs.renameSync(tempPath, finalPath);
                            commandLogger.info(`Download completed! New file saved at: ${finalPath}`);
                            resolve(finalPath);
                            
                        } catch (error) {
                            // Clean up temp file on error
                            if (fs.existsSync(tempPath)) {
                                fs.unlinkSync(tempPath);
                            }
                            reject(error);
                        }
                    });
                    
                    tempWriteStream.on('error', (err) => {
                        // Clean up temp file on error
                        if (fs.existsSync(tempPath)) {
                            fs.unlinkSync(tempPath);
                        }
                        reject(err);
                    });
                }).on('error', (err) => {
                    logError(err as Error, 'Download Error', { url, tempPath });
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
