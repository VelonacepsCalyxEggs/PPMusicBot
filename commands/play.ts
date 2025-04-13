import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, CommandInteractionOptionResolver, EmbedBuilder, GuildMember, Message } from 'discord.js';
import { QueryType, useQueue, GuildQueue, Player, useMainPlayer, Track } from 'discord-player';
import https from 'https';
import http from 'http';
import fs from 'fs';
import fs_promises from 'fs/promises';
import path, { resolve } from 'path';
import { Client as PgClient } from 'pg';
import dbConfig from '../config/dbCfg'; // Make sure the path is correct

const pgClient = new PgClient(dbConfig);
pgClient.connect();

const downloadFile = (file: string, url: string): Promise<string> => {
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

const createEmbed = (description: string, thumbnail: string, footer: string | null): EmbedBuilder => {
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setThumbnail(thumbnail);
    if (footer) {
        embed.setFooter({ text: footer });
    }
    return embed;
};

const handleSongCommand = async (player: Player, interaction: CommandInteraction, guildQueue: GuildQueue): Promise<Message<boolean>> => {
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
            embed = createEmbed(`**${song.title}** has been added to the queue`, song.thumbnail, `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`);
        } else {
            const localPath = await downloadFile(argument.split('?')[0], argument);
            result = await player.search(localPath, {
                requestedBy: interaction.user,
                searchEngine: QueryType.FILE
            });
            song = result.tracks[0];
            if (!song) return interaction.followUp('No results');
            embed = createEmbed(`**${song.title}** has been added to the queue`, song.thumbnail, `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`);
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
        embed = createEmbed(`**${song.title}** has been added to the queue`, song.thumbnail, `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`);
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
        embed = createEmbed(`**${result.tracks.length} songs from ${playlist.title}** have been added to the queue`, playlist.thumbnail, null);
    } else {
        console.log('YouTube Search detected');
        result = await player.search(argument, {
            requestedBy: interaction.user,
            searchEngine: QueryType.YOUTUBE_SEARCH
        });
        song = result.tracks[0];
        if (!song) return interaction.followUp("No results or Couldn't extract the track from YouTube.");
        embed = createEmbed(`**${song.title}** has been added to the queue`, song.thumbnail, `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`);
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

interface DbTrack {
    id: number;
    name: string;
    author: string;
    album: string;
    thumbnail: string;
    local: string;
    path_to_cover: string;
}

// Define the extended Track type with an optional property 
interface ExtendedTrack<T> extends Track<T> { 
    startedPlaying?: Date; 
}

const handleFileCommand = async (player: Player, interaction: CommandInteraction, guildQueue: GuildQueue) => {
    const file = interaction.options.get('file')?.attachment;
    if (!file) {
        return interaction.followUp("No file attachment found");
    }

    const localPath = await downloadFile(file.url.split('?')[0], file.url);
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

const handleFromDbCommand = async (player: Player, interaction: CommandInteraction, guildQueue: GuildQueue) => {
    console.log('Play db used.');
    
    const argument = interaction.options.get('dbquery')?.value;
    if (!argument || !(typeof(argument) === 'string')) {
        return interaction.followUp("No search argument provided.");
    }

    const pgClient = new PgClient(dbConfig);
    await pgClient.connect();

    try {
        // Parse special search filters
        const albumMatch = argument.match(/album:"([^"]+)"/i);
        const artistMatch = argument.match(/artist:"([^"]+)"/i);
        const authorMatch = argument.match(/author:"([^"]+)"/i);

        let searchResult: any;
        let resultDescription: string;
        let isExactMatch = false;

        const getSuggestions = async (column: string, term: string) => {
            try {
                const result = await pgClient.query(
                    `SELECT DISTINCT ${column} FROM music 
                     WHERE ${column} ILIKE $1 
                     ORDER BY ${column} LIMIT 5`,
                    [`%${term}%`]
                );
                return result.rows.map(r => r[column]);
            } catch (error) {
                return [];
            }
        };

        if (albumMatch) {
            const albumName = albumMatch[1];
            // First try exact match
            let exactResult = await pgClient.query(
                `SELECT * FROM music 
                 WHERE album ILIKE $1 
                 ORDER BY "order", name`,
                [albumName]
            );
            
            if (exactResult.rows.length > 0) {
                isExactMatch = true;
                searchResult = exactResult;
                resultDescription = `album "${albumName}"`;
            } else {
                // Try partial match
                searchResult = await pgClient.query(
                    `SELECT * FROM music 
                     WHERE album ILIKE $1 
                     ORDER BY "order", name 
                     LIMIT 300`,
                    [`%${albumName}%`]
                );
                
                const suggestions = await getSuggestions('album', albumName);
                resultDescription = `albums containing "${albumName}"`;
                if (suggestions.length > 0) {
                    resultDescription += `\nDid you mean:\n${suggestions.map(s => `• [${s}](https://www.funckenobi42.space/music/album/${Buffer.from(s).toString('base64')})`).join('\n')}`;
                }
                if (suggestions.length > 1) {
                    const embed = new EmbedBuilder()
                    .setDescription(
                        resultDescription
                    )
                    embed.setFooter({ text: 'Addition of tracks was aborted, due to multiple matches.' });
        
                    return interaction.followUp({ embeds: [embed] });
                }
            }
        } else if (artistMatch || authorMatch) {
            const artistName = (artistMatch || authorMatch)?.[1] || '';
            // Try exact match first
            let exactResult = await pgClient.query(
                `SELECT * FROM music 
                 WHERE author ILIKE $1 
                 ORDER BY album, "order"`,
                [artistName]
            );

            if (exactResult.rows.length > 0) {
                isExactMatch = true;
                searchResult = exactResult;
                resultDescription = `artist "${artistName}"`;
            } else {
                // Fallback to partial match
                searchResult = await pgClient.query(
                    `SELECT * FROM music 
                     WHERE author ILIKE $1 
                     ORDER BY album, "order" 
                     LIMIT 300`,
                    [`%${artistName}%`]
                );
                const suggestions = await getSuggestions('author', artistName);
                resultDescription = `artists containing "${artistName}"`;
                if (suggestions.length > 0) {
                    resultDescription += `\nDid you mean:\n${suggestions.map(s => `• ${s}`).join('\n')}`;
                }
                if (suggestions.length > 1) {
                    const embed = new EmbedBuilder()
                    .setDescription(
                        resultDescription
                    )
                    embed.setFooter({ text: 'Addition of tracks was aborted, due to multiple matches.' });
        
                    return interaction.followUp({ embeds: [embed] });
                }

            }
        } else {
            // General search with smart matching

            // In the general search block:
            const tokens = argument.trim().split(/\s+/).filter(t => t.length > 0);
            if (tokens.length === 0) {
                return interaction.followUp("Please provide valid search terms.");
            }
            const searchValues = tokens.map(t => `%${t}%`);

            // Fixed relevance calculation
            const relevanceExpression = tokens.map((_, i) => 
            `(CASE WHEN name ILIKE $${i+1} THEN 3 ELSE 0 END) + 
            (CASE WHEN author ILIKE $${i+1} THEN 2 ELSE 0 END) + 
            (CASE WHEN album ILIKE $${i+1} THEN 1 ELSE 0 END)`
            ).join(' + ');

            const conditions = tokens.map((_, i) => 
            `(name ILIKE $${i+1} OR author ILIKE $${i+1} OR album ILIKE $${i+1})`
            ).join(' AND ');

            const searchQuery = `
            SELECT *, 
                (${relevanceExpression}) AS relevance
            FROM music
            WHERE ${conditions}
            ORDER BY relevance DESC
            LIMIT 300;
            `;
            

            searchResult = await pgClient.query(searchQuery, searchValues);

            if (searchResult.rows.length === 0) {
                const suggestions = await getSuggestions('name', tokens.join(' '));
                let reply = `No results found for "${argument}"`;
                if (suggestions.length > 0) {
                    reply += `\nDid you mean:\n${suggestions.map(s => `• ${s}`).join('\n')}`;
                }
                return interaction.followUp(reply);
            }
            resultDescription = `search for "${argument}"`;
        }

        const getCoverPath = (addedTracks: any[]) => {
        if (!addedTracks || addedTracks.length === 0) {
            return null; // Handle empty or undefined addedTracks array
        }

        const track = addedTracks[0];

        if (track?.path_to_disk_cover && fs.existsSync('C:/Server/nodeTSWebNest/www.funckenobi42.space/public' + track.path_to_disk_cover)) {
            return `https://www.funckenobi42.space${track.path_to_disk_cover}`;
        } else if (track?.path_to_cover) {
            return `https://www.funckenobi42.space${track.path_to_cover}`;
        }
        else {
            return null; // Handle cases where neither path is valid
        }
        };
        let currentDisk: any = null
        const trackDisk = (track: any) => {

            if (currentDisk == track?.path_to_disk_cover) return currentDisk
            if (track?.path_to_disk_cover && fs.existsSync('C:/Server/nodeTSWebNest/www.funckenobi42.space/public' + track.path_to_disk_cover)) {
                currentDisk = `https://www.funckenobi42.space${track.path_to_disk_cover}`;
                return `https://www.funckenobi42.space${track.path_to_disk_cover}`;
            } else if (track?.path_to_cover) {
                currentDisk = `https://www.funckenobi42.space${track.path_to_cover}`;
                return `https://www.funckenobi42.space${track.path_to_cover}`;
            }
            else {
                currentDisk = null;
                return null; // Handle cases where neither path is valid
            }
            };



        // Track addition logic
        const addedTracks = [];
        for (const track of searchResult.rows) {
            const pathToSong = track.local;
            const result = await player.search(pathToSong, {
                requestedBy: interaction.user,
                searchEngine: QueryType.FILE,
            });

            if (result.tracks[0]) {
                const workingTrack = result.tracks[0] as ExtendedTrack<unknown>;
                workingTrack.title = track.name;
                workingTrack.author = track.author;
                workingTrack.thumbnail = trackDisk(track);
                workingTrack.url = `https://www.funckenobi42.space/music/track/${track.id}`;

                await guildQueue.play(workingTrack, { 
                    nodeOptions: { 
                        metadata: interaction, 
                        noEmitInsert: true,
                        leaveOnEnd: false,
                        leaveOnEmpty: false,
                        leaveOnStop: false
                    } 
                });
                addedTracks.push(track);
            }
        }

        const coverPath = getCoverPath(addedTracks);
        console.log(coverPath);
        let embedDescription = '';
        // Build response
        if (addedTracks.length > 1) {
            embedDescription = `${isExactMatch ? 'Added' : 'Found'} **${addedTracks.length} tracks** from ${resultDescription}`
        } else if (addedTracks.length != 0){
            embedDescription = `Added [**${addedTracks[0].name}**](https://www.funckenobi42.space/music/track/${addedTracks[0]?.id}) by **${addedTracks[0].author}** from [**${addedTracks[0].album}**](https://www.funckenobi42.space/music/album/${Buffer.from(addedTracks[0]?.album).toString('base64')}).`
            isExactMatch = true;
        }
        else{
            embedDescription = `${isExactMatch ? 'Added' : 'Found'} **${addedTracks.length} tracks** from ${resultDescription}`
        }
        const embed = new EmbedBuilder()
            .setDescription(
                embedDescription
            )
            .setThumbnail(coverPath);

        if (!isExactMatch) {
            embed.setFooter({ text: 'Showing partial matches' });
        } 

        await interaction.followUp({ embeds: [embed] });

    } catch (error) {
        console.error('Database search error:', error);
        return interaction.followUp("An error occurred while processing your request.");
    } finally {
        await pgClient.end();
    }
};

export { handleFromDbCommand };


export const command = {
    data: new SlashCommandBuilder()
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
        ),
    execute: async ({ client, interaction }: { client: Player; interaction: CommandInteraction }) => {
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
                await handleSongCommand(player, interaction, guildQueue);
                break;
            case 'file':
                await handleFileCommand(player, interaction, guildQueue);
                break;
            case 'fromdb':
                await handleFromDbCommand(player, interaction, guildQueue);
                break;
        }
    },
};
