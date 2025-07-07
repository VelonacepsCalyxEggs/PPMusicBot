import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, Client, CommandInteractionOptionResolver, EmbedBuilder, GuildMember, Message, User } from 'discord.js';
import { QueryType, useQueue, GuildQueue, Player, useMainPlayer, Track, SearchResult } from 'discord-player';
import https from 'https';
import http, { RequestOptions } from 'http';
import fs from 'fs';
import path from 'path';
import CommandInterface from '../types/commandInterface';
import { createEmbedUtil } from '../utils/createEmbedUtil';
import axios from 'axios';
import { MusicDto, ScoredAlbum, ScoredTrack, SearchResultsDto } from '../types/searchResultInterface';
import formatDuration from '../utils/formatDurationUtil';
import TrackMetadata from '../types/trackMetadata';
import { commandLogger, logError, playerLogger } from '../utils/loggerUtil';
import { randomUUID, createHash } from 'crypto';
import { YtdlFallbackService } from '../services/ytdlFallback';
import { NoTrackFoundError, PlaylistTooLargeError, YoutubeDownloadFailedError } from '../types/ytdlServiceTypes';
import { NetworkFileService } from '../services/networkFileService';

export default class PlayCommand extends CommandInterface {
    constructor() {
        super();
    }

    data = new SlashCommandBuilder()
        .setName('play')
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
        if (!interaction.guild)return interaction.followUp('You need to be in a guild.');
        const player = useMainPlayer();
        
        let guildQueue = useQueue(interaction.guild);
        if (!guildQueue) {
            guildQueue = player.nodes.create(interaction.guild, {leaveOnEnd: false, leaveOnEmpty: true, leaveOnStop: false, metadata: interaction, noEmitInsert: true});
        } else if (guildQueue.deleted) {
            guildQueue.revive();
        }

        const voiceChannel = (interaction.member as GuildMember).voice.channel;

        if (!voiceChannel) {
          return interaction.reply({ content: "You need to be in a voice channel to use this command!", ephemeral: true });
        }
        if (!guildQueue.connection) {
            if (voiceChannel.joinable === false) {
                return interaction.followUp({content: 'I cannot join your voice channel. Please check my permissions.', flags: ['Ephemeral']});
            }
            if (voiceChannel.full) {
                return interaction.followUp({content: 'Your voice channel is full.', flags: ['Ephemeral']});
            }
            
            await guildQueue.connect(voiceChannel);
            if (!guildQueue.connection) {
                return interaction.followUp({content: 'Failed to connect to the voice channel.', flags: ['SuppressNotifications']});
            }
        }


    
        // Assuming interaction is of type ChatInputCommandInteraction
        const subcommand = (interaction.options as CommandInteractionOptionResolver).getSubcommand();

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
        
        const argument = interaction.options.get('music')?.value;
        if (!(typeof(argument) === 'string')) {
            throw new Error('Invalid argument type. Expected a string.');
        }
    
        const sourceType = this.detectSourceType(argument);
        let result: SearchResult;
        let song: Track<unknown> | null = null;
        let embed: EmbedBuilder | undefined = undefined;
        const ytdlFallback = client.services.get('YtdlFallbackService') as YtdlFallbackService;
        switch (sourceType) {
            case 'spotify':
                commandLogger.debug(`Spotify URL detected: ${argument}`);
                result = await player.search(argument, {
                    requestedBy: interaction.user,
                    searchEngine: QueryType.SPOTIFY_SEARCH
                });
                if (!result.tracks.length) {
                    return interaction.followUp({content: 'No results found for the Spotify URL.', flags: ['Ephemeral']});
                }
                song = result.tracks[0];
                embed = this.createTrackEmbed(song, guildQueue.tracks.size);
                break;
            case 'stream':
                commandLogger.debug(`Stream URL detected: ${argument}`);
                const streamUrl = this.normalizeStreamUrl(argument);
                result = await this.searchTrack(player, streamUrl, interaction.user);
                
                if (!result.tracks.length) return interaction.followUp({content: 'No results found for the stream URL.', flags: ['Ephemeral']});
                song = result.tracks[0];
                song.duration = '∞';
                embed = this.createTrackEmbed(song, guildQueue.tracks.size);
                break;
                
            case 'external_url':
                commandLogger.debug(`External URL detected: ${argument}`);
                const localPath = await this.downloadFile(argument.split('?')[0], argument);
                result = await this.searchFile(player, localPath, interaction.user);
                
                if (!result.tracks.length) return interaction.followUp({content: 'No results found for the external URL.', flags: ['Ephemeral']});
                song = result.tracks[0];
                embed = this.createTrackEmbed(song, guildQueue.tracks.size);
                break;
                
            case 'youtube_video':
                commandLogger.debug(`YouTube video URL detected: ${argument}`);
                //return interaction.followUp('Oops... sorry, the DRM doomsday clock hit midnight and I can no longer play YouTube videos. Please use the fromDB command instead. Contribute music to the database on my website!');
                const cleanYoutubeUrl = this.cleanYoutubeUrl(argument);
                //result = await this.searchTrack(player, cleanYoutubeUrl, interaction.user);
                
                //discordLogger.warn(`No tracks found for YouTube URL using fallback: ${argument}`);
                try {
                    interaction.editReply("Downloading YouTube video, this might take a moment...");
                    song = await ytdlFallback.playVideo(player, cleanYoutubeUrl, null, interaction.user);
                }
                catch (error) {
                    if (error instanceof NoTrackFoundError) {
                        return interaction.followUp({content: error.message, flags: ['Ephemeral']});
                    }
                    else if (error instanceof YoutubeDownloadFailedError) {
                        return interaction.followUp({content: error.message, flags: ['Ephemeral']});
                        
                    }
                }
                //result = await this.searchFile(player, videoData.filePath, interaction.user);

                //if (!result.tracks.length) {
                //    return interaction.followUp({content: 'No results found for the YouTube URL.', flags: ['Ephemeral']});
                //}

                //song = result;
                embed = this.createTrackEmbed(song!, guildQueue.tracks.size);
                break;
                
            case 'youtube_playlist':
                commandLogger.debug(`YouTube playlist URL detected: ${argument}`);
                
                try {
                    interaction.editReply("Loading playlist, this might take a moment...");
                    
                    const playlistResult = await ytdlFallback.playPlaylistWithBackground(argument, player, interaction.user, guildQueue);
                    
                    // Play the first track immediately if available
                    if (playlistResult.firstTrack) {
                        await this.playTrack(playlistResult.firstTrack, guildQueue, interaction);
                        
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
                    
                } catch (error) {
                    if (error instanceof PlaylistTooLargeError) {
                        return interaction.followUp({content: error.message, flags: ['Ephemeral']});
                    }
                    else if (error instanceof NoTrackFoundError) {
                        return interaction.followUp({content: error.message, flags: ['Ephemeral']});
                    }
                    else {
                        logError(error, `Error while processing YouTube playlist: ${argument}`);
                        return interaction.followUp({content: 'An error occurred while processing the YouTube playlist.', flags: ['Ephemeral']});
                    }
                }
                break;
                
            case 'search_term':
            default:
                commandLogger.debug(`Search term detected: ${argument}`);
                //return interaction.followUp('Oops... sorry, the fentanyl bag hit the turboprop and I can no longer play YouTube videos. Please use the fromDB command instead. Contribute music to the database on my website!');
                //result = await this.searchYoutube(player, argument, interaction.user);
                try {
                    interaction.editReply("Downloading YouTube video, this might take a moment...");
                    song = await ytdlFallback.playVideo(player, null, argument, interaction.user);
                    embed = this.createTrackEmbed(song, guildQueue.tracks.size);
                }
                catch (error) {
                    if (error instanceof NoTrackFoundError) {
                        return interaction.followUp({content: error.message, flags: ['Ephemeral']});
                    }
                }
                break;
        }

        if (song) {
            await this.playTrack(song, guildQueue, interaction);
        }

        if (embed) {
            return await interaction.followUp({ embeds: [embed] });
        } else {
            return await interaction.followUp({ content: 'No track information available.', ephemeral: true });
        }
    };

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
            if (input.includes('stream') || input.includes(':')) {
                return 'stream';
            }
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

    // Helper to play a track
    // To optimize, it's probably best to pass a list of tracks.
    private async playTrack(result: SearchResult | Track, queue: GuildQueue, interaction: ChatInputCommandInteraction, scoredTrack?: ScoredTrack ): Promise<void> {
        let metadata: TrackMetadata | undefined;
        if (result instanceof SearchResult) {
            metadata = result.tracks[0].metadata as TrackMetadata
        }
        else if (result instanceof Track) {
            metadata = result.metadata as TrackMetadata;
        }
        else {
            metadata = undefined;
        }
        if (!metadata) {
            throw new Error('Track metadata is missing');
        }
        const newMetadata: TrackMetadata = {
            interaction,
            startedPlaying: new Date(),
            scoredTrack: scoredTrack,
            duration_ms: metadata.duration_ms | 0,
            live: metadata.live || false,
            duration: metadata.duration || '0:00',
        };
        if (result instanceof SearchResult) {
            result.tracks[0].setMetadata(newMetadata);
        } else if (result instanceof Track) {
            result.setMetadata(newMetadata);
        }
        await queue.play(result, {
                nodeOptions: {
                    metadata: interaction,
                    noEmitInsert: true,
                    leaveOnEnd: false,
                    leaveOnEmpty: false,
                    leaveOnStop: false,
                },
            });
    }

    // Helper to create a track embed
    private createTrackEmbed(track: Track, queueSize: number): EmbedBuilder {
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

        await this.playTrack(result, guildQueue, interaction);

        await interaction.followUp({ embeds: [embed] });
    };

    private handleFromDbCommand = async (client: Client, player: Player, interaction: ChatInputCommandInteraction, guildQueue: GuildQueue) => {
        if (!process.env.API_URL) {
            return interaction.followUp('API URL is not set. Please contact the bot owner.');
        }

        const networkFileService = client.services.get('NetworkFileService') as NetworkFileService;
        
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
                timeout: 5000, // Set a timeout of 5 seconds
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
            if (Math.max(highestTrackScore, highestAlbumScore) <= 300) {
                commandLogger.debug('Low confidence match found, showing suggestions');
                
                // Create combined suggestions list from tracks and albums
                const combinedSuggestions: Array<{type: 'track' | 'album', name: string, score: number}> = [
                    ...response.data.tracks.slice(0, 10).map(track => ({
                        type: 'track' as const,
                        name: track.title,
                        score: track.score
                    })),
                    ...response.data.albums.slice(0, 10).map(album => ({
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

            if (!result || !result.tracks || result.tracks.length === 0) {
                // Show suggestions if there are other tracks
                if (track.score <= 25 && allTracks.length > 1) {
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
            const song = result.tracks[0];
            // If we get here, we have a valid track to play
            await this.playTrack(result, guildQueue, interaction, track);
            return interaction.followUp({ 
                flags: ['SuppressNotifications'],
                embeds: [createEmbedUtil(
                    `**${(song.metadata as TrackMetadata).scoredTrack!.title}** has been added to the queue`, 
                    `https://www.funckenobi42.space/images/AlbumCoverArt/${track.album.pathToCoverArt}`, // Use the cover from the first track if available
                    `Duration: ${(formatDuration((song.metadata as TrackMetadata).scoredTrack!.duration * 1000))} Position: ${guildQueue.tracks.size}`
                )]
            });
        } catch (error) {
            commandLogger.error(`Error processing single track: ${(error as Error).message}`);
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
            
            if (album.score <= 300 && allAlbums.length > 1) {
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
            
            const albumResponse = await axios.request<any>({
                method: 'GET',
                url: `${process.env.API_URL}/music`,
                params: { albumId: album.id, sortBy:"trackNumber", limit: 512, sortOrder: "asc" }
            });
            
            const foundAlbum = albumResponse.data.data as MusicDto[];
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
                    
                    if (!result || !result.tracks || result.tracks.length === 0) {
                        commandLogger.debug(`No results found for track: ${track.title}`);
                        continue; // Skip this track and continue with the album
                    }
                    
                    // If we get here, we have a valid track to play
                    await this.playTrack(result, guildQueue, interaction, track as ScoredTrack);
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
                    `https://www.funckenobi42.space/images/AlbumCoverArt/${album.pathToCoverArt}`, // Use the cover from the album
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
    private sortAlbumTracks(foundAlbum: MusicDto[]): MusicDto[] {
        // Skip sorting if there's no data
        if (!foundAlbum || foundAlbum.length === 0) return foundAlbum;
        
        // Group tracks by disc number
        const discGroups = new Map<string | number | undefined, MusicDto[]>();
        
        // Create groups based on disc number
        for (const track of foundAlbum) {
            const discNumber = track.MusicMetadata?.discNumber;
            if (!discGroups.has(discNumber)) {
                discGroups.set(discNumber, []);
            }
            discGroups.get(discNumber)!.push(track);
        }
        
        // Sort disc groups: numbers first (in numerical order), then strings (alphabetically)
        const sortedGroups = Array.from(discGroups.entries()).sort((a, b) => {
            const [discA, _] = a;
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
        return new Promise(async (resolve, reject) => {
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
};
