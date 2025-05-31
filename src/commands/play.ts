import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, CommandInteractionOptionResolver, EmbedBuilder, GuildMember, Message } from 'discord.js';
import { QueryType, useQueue, GuildQueue, Player, useMainPlayer, Track } from 'discord-player';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import commandInterface from '../types/commandInterface';
import { createEmbedUtil } from '../utils/createEmbedUtil';
import axios from 'axios';
import { MusicDto, ScoredAlbum, ScoredTrack, SearchResultsDto } from 'src/types/searchResultInterface';
import formatDuration from '../utils/formatDurationUtil';

// Isn't this fila a charm eh?
// I love me when I did shitcode like this.

// This will later be replaced with a proper interface for the database track
interface DbTrack {
    id: number;
    name: string;
    author: string;
    album: string;
    thumbnail: string;
    local: string;
    path_to_cover: string;
}

export default class playCommand extends commandInterface {
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
    execute = async ({ interaction }: { interaction: CommandInteraction }) => {
        await interaction.deferReply();

        if (!(interaction.member as GuildMember).voice.channel) {
            return interaction.followUp('You need to be in a Voice Channel to play a song.');
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
          await guildQueue.connect(voiceChannel);
        }
    
        // Assuming interaction is of type CommandInteraction
        const subcommand = (interaction.options as CommandInteractionOptionResolver).getSubcommand();

        console.log(`Subcommand: ${subcommand}`);

        switch (subcommand) {
            case 'song':
                await this.handleSongCommand(player, interaction, guildQueue);
                break;
            case 'file':
                await this.handleFileCommand(player, interaction, guildQueue);
                break;
            case 'fromdb':
                await this.handleFromDbCommand(player, interaction, guildQueue);
                break;
        }
    }

    private handleSongCommand = async (player: Player, interaction: CommandInteraction, guildQueue: GuildQueue): Promise<Message<boolean>> => {
        console.log('Play song used.');
        let argument = interaction.options.get('music')?.value;
        if (!(typeof(argument) === 'string')) return interaction.followUp('Please provide an argument.');;
        let result;
        let song;
        let embed;

        if ((argument.includes('http') || argument.includes('https')) &&
            !(argument.includes('watch?v=') || argument.includes('youtu.be') || argument.includes('youtube.com'))) {
            console.log('URL detected');
            if(argument.includes('stream') || argument.includes(':')) {
                console.log('live stream detected')
                if (argument.includes('funckenobi42.space')) {
                    argument = 'http://127.0.0.1:55060/stream.mp3'
                }
                console.log(argument)
                result = await player.search(argument, {
                    requestedBy: interaction.user,
                    searchEngine: QueryType.AUTO
                });
                song = result.tracks[0];
                if (!song) return interaction.followUp('No results');
                song.duration = '∞';
                embed = createEmbedUtil(`**${song.title}** has been added to the queue`, song.thumbnail, `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`);
            } else {
                const localPath = await this.downloadFile(argument.split('?')[0], argument);
                result = await player.search(localPath, {
                    requestedBy: interaction.user,
                    searchEngine: QueryType.FILE
                });
                song = result.tracks[0];
                if (!song) return interaction.followUp('No results');
                embed = createEmbedUtil(`**${song.title}** has been added to the queue`, song.thumbnail, `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`);
            }
        } else if ((argument.includes('watch?v=') || argument.includes('youtu.be') || argument.includes('youtube.com')) && !argument.includes('playlist?list=')) {
            console.log('YouTube URL detected');
            if (argument.includes('si=')) {
                const parts = argument.split('si=');
                if (parts.length > 1) {
                    argument = parts[0];
                }
                console.log(argument);
            }
            result = await player.search(argument, {
                requestedBy: interaction.user,
                searchEngine: QueryType.AUTO
            });
            song = result.tracks[0];
            if (!song) {
                return interaction.followUp("No results or couldn't extract the track from YouTube.");
            }
            embed = createEmbedUtil(`**${song.title}** has been added to the queue`, song.thumbnail, `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`);
        } else if (argument.includes('playlist?list=')) {
            console.log('YouTube playlist detected');
            result = await player.search(argument, {
                requestedBy: interaction.user,
                searchEngine: QueryType.YOUTUBE_PLAYLIST
            });
            const playlist = result.playlist;
            if (!playlist) return interaction.followUp('No results');
            await guildQueue.play(result.tracks[0], {
                nodeOptions: {
                    metadata: interaction,
                    noEmitInsert: true,
                    leaveOnEnd: false,
                    leaveOnEmpty: false,
                    leaveOnStop: false,
                }
            });
            embed = createEmbedUtil(`**${result.tracks.length} songs from ${playlist.title}** have been added to the queue`, playlist.thumbnail, null);
        } else {
            console.log('YouTube Search detected');
            result = await player.search(argument, {
                requestedBy: interaction.user,
                searchEngine: QueryType.YOUTUBE_SEARCH
            });
            song = result.tracks[0];
            if (!song) return interaction.followUp("No results or Couldn't extract the track from YouTube.");
            embed = createEmbedUtil(`**${song.title}** has been added to the queue`, song.thumbnail, `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`);
        }

        if (song) {
            await guildQueue.play(song, {
                nodeOptions: {
                    metadata: interaction,
                    noEmitInsert: true,
                    leaveOnEnd: false,
                    leaveOnEmpty: false,
                    leaveOnStop: false,
                }
            });
        }

        return await interaction.editReply({ embeds: [embed] });
    };

    private async handleFileCommand(player: Player, interaction: CommandInteraction, guildQueue: GuildQueue) {
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
                text: `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        await guildQueue.play(song, {
            nodeOptions: {
                metadata: interaction,
                noEmitInsert: true,
                leaveOnEnd: false,
                leaveOnEmpty: false,
                leaveOnStop: false,
            },
        });

        await interaction.editReply({ embeds: [embed] });
    };

    private handleFromDbCommand = async (player: Player, interaction: CommandInteraction, guildQueue: GuildQueue) => {
        if (!process.env.API_URL) {
            return interaction.followUp('API URL is not set. Please contact the bot owner.');
        }
        
        try {
            const response = await axios.request<SearchResultsDto>({
                method: 'POST',
                url: `${process.env.API_URL}/music/search`,
                data: { query: interaction.options.get('dbquery')?.value }
            });
            console.log(`Search response: tracks=${response.data.tracks.length}, albums=${response.data.albums.length}`);
            
            // First, verify we have any results at all
            if (response.data.tracks.length === 0 && response.data.albums.length === 0) {
                return interaction.editReply({
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
            if (Math.max(highestTrackScore, highestAlbumScore) <= 25) {
                console.log('Low confidence matches found, showing suggestions');
                
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
                    
                return interaction.editReply({
                    embeds: [createEmbedUtil(
                        `Low confidence matches found.\n\nDid you mean:\n- ${suggestions}`, 
                        `https://www.funckenobi42.space/images/`, 
                        'Please try a more specific query.'
                    )]
                });
            }

            // Otherwise, proceed with the normal flow - play track or album based on which has higher score
            if (response.data.albums.length === 0 || highestTrackScore > highestAlbumScore) {
                // Play track logic - unchanged from your existing code
                console.log(`Found track: ${response.data.tracks[0].MusicFile[0].filePath}`);
                
                // Use the file path directly, but convert it to a proper file:// URI
                const filePath = response.data.tracks[0].MusicFile[0].filePath;
                
                console.log(`Using file path: ${filePath}`);
                
                const result = await player.search(filePath, {
                    requestedBy: interaction.user,
                    searchEngine: QueryType.FILE,
                });

                if (!result || !result.tracks || result.tracks.length === 0) {
                    // Show suggestions if there are other tracks
                    if (response.data.tracks[0].score <= 25 && response.data.tracks.length > 1) {
                        console.log('Unconfident match found, showing suggestions');
                        const suggestions = response.data.tracks
                            .slice(0, 5)
                            .map(track => track.title)
                            .join('\n- ');
                            
                        return interaction.editReply({
                            embeds: [createEmbedUtil(
                                `No results found.\n\nMaybe you meant:\n- ${suggestions}`, 
                                `https://www.funckenobi42.space/images/`, // Default thumbnail
                                'Please try a different query.'
                            )]
                        });
                    }
                    
                    return interaction.editReply({
                        embeds: [createEmbedUtil(
                            'No results found.',
                            `https://www.funckenobi42.space/images/`, // Default thumbnail
                            'Please try a different query.'
                        )]
                    });
                }
                
                // If we get here, we have a valid track to play
                const song = result.tracks[0];
                song.setMetadata(response.data.tracks[0]); // Set metadata from the database track
                await guildQueue.play(song, {
                    nodeOptions: {
                        metadata: interaction,
                        noEmitInsert: true,
                        leaveOnEnd: false,
                        leaveOnEmpty: false,
                        leaveOnStop: false,
                    },
                });
                return interaction.editReply({
                    embeds: [createEmbedUtil(
                        `**${(song.metadata as ScoredTrack).title}** has been added to the queue`, 
                        `https://www.funckenobi42.space/images/AlbumCoverArt/${response.data.tracks[0].album.pathToCoverArt}`, // Use the cover from the first track if available
                        `Duration: ${(formatDuration((song.metadata as ScoredTrack).duration * 1000))} Position: ${guildQueue.tracks.size + 1}`
                    )]
                });
            } else if (response.data.albums.length > 0) {
                console.log(`Found album: ${response.data.albums[0].name} with score ${response.data.albums[0].score}`);
                    if (response.data.albums[0].score <= 25 && response.data.albums.length > 1) {
                        console.log('Unconfident match found, showing suggestions');
                        const suggestions = response.data.albums
                            .slice(0, 5)
                            .map(track => track.name)
                            .join('\n- ');
                            
                        return interaction.editReply({
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
                    params: { albumId: response.data.albums[0].id, sortBy:"trackNumber", limit: 512, sortOrder: "asc" }
                });
                //console.log(`Album response: ${JSON.stringify(albumResponse.data)}`);
                const foundAlbum = albumResponse.data.data as MusicDto[];
                if (!foundAlbum || foundAlbum.length === 0) {
                    console.log('No tracks found in the album');
                    return interaction.editReply({
                        embeds: [createEmbedUtil(
                            'No tracks found in the album.',
                            `https://www.funckenobi42.space/images/`, // Default thumbnail
                            'Please try a different query.'
                        )]
                    });
                }


                // Sort tracks by disc number before playing
                const sortedAlbumTracks = (() => {
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
                })();

                // Use sortedAlbumTracks instead of foundAlbum
                for (const track of sortedAlbumTracks) {
                    const result = await player.search(track.MusicFile[0].filePath, {
                        requestedBy: interaction.user,
                        searchEngine: QueryType.FILE,
                    });
                    
                    if (!result || !result.tracks || result.tracks.length === 0) {
                        console.log(`No results found for track: ${track.title}`);
                        return interaction.editReply({
                            embeds: [createEmbedUtil(
                                'No results found for the album.',
                                `https://www.funckenobi42.space/images/`, // Default thumbnail
                                'Please try a different query.'
                            )]
                        });
                    }
                    
                    // If we get here, we have a valid track to play
                    const song = result.tracks[0];
                    song.setMetadata(track);
                    await guildQueue.play(song, {
                        nodeOptions: {
                            metadata: interaction,
                            noEmitInsert: true,
                            leaveOnEnd: false,
                            leaveOnEmpty: false,
                            leaveOnStop: false,
                        },
                    });
                }
                
                return interaction.editReply({
                    embeds: [createEmbedUtil(
                        `**${(response.data.albums[0] as ScoredAlbum).name}** has been added to the queue`, 
                        `https://www.funckenobi42.space/images/AlbumCoverArt/${(response.data.albums[0] as ScoredAlbum).pathToCoverArt}`, // Use the cover from the album
                        `Tracks: ${foundAlbum.length} Starting from position: ${guildQueue.tracks.size + 1}`
                    )]
                });
            }
        } catch (error) {
            console.error('Error in handleFromDbCommand:', error);
            return interaction.editReply({
                embeds: [createEmbedUtil(
                    "An error occurred while playing from database", 
                    'https://www.funckenobi42.space/images/',
                    `Error: ${error.message}`
                )]
            });
        }
    };

    private async downloadFile (file: string, url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const fileExtension = path.extname(file);
            const localPath = 'C:/Server/DSMBot/PP_DMB_TS/cache/' + Math.random().toString().slice(2, 11) + fileExtension;
            const writeStream = fs.createWriteStream(localPath);
            const protocol = url.startsWith('https') ? https : http;

            protocol.get(url, (res) => {
                res.pipe(writeStream);
                writeStream.on('finish', () => {
                    writeStream.close();
                    console.log('Download completed! File saved at:', localPath);
                    resolve(localPath);
                });
            }).on('error', (err) => {
                console.error('Error downloading file:', err.message);
                reject(err);
            });
        });
    };
};
