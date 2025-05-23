import { SlashCommandBuilder } from '@discordjs/builders';
import { Client, CommandInteraction, CommandInteractionOptionResolver, EmbedBuilder, Guild, GuildMember, GuildVoiceChannelResolvable, Message } from 'discord.js';
import { QueryType, useQueue, GuildQueue, Player, useMainPlayer, Track } from 'discord-player';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
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

    // PostgreSQL client setup using the imported config
    const pgClient = new PgClient(dbConfig);
    await pgClient.connect();

    // Search the database for matches in song name, author, and album
    const searchQuery = `
        SELECT *, 
        CASE 
            WHEN name ILIKE $1 THEN 'name' 
            WHEN author ILIKE $1 THEN 'author' 
            WHEN album ILIKE $1 THEN 'album' 
        END AS match_type
        FROM music 
        WHERE name ILIKE $1 
        OR author ILIKE $1 
        OR album ILIKE $1
    `;

    const searchValues = [`%${argument}%`];
    const searchResult = await pgClient.query(searchQuery, searchValues);
    if (searchResult.rows.length === 0) {
        return interaction.followUp("No results found");
    }

    const playTrack = async (row: DbTrack, interaction: CommandInteraction, player: Player, guildQueue: GuildQueue, isFirst: boolean) => {
        const pathToSong = row.local;
        const result = await player.search(pathToSong, {
            requestedBy: interaction.user,
            searchEngine: QueryType.FILE,
        });
        console.log(row.path_to_cover)
        if (result.tracks[0]) {
            const workingTrack = (result.tracks[0] as ExtendedTrack<unknown>)
            workingTrack.title = row.name;
            workingTrack.author = row.author;
            workingTrack.thumbnail = `https://www.funckenobi42.space${row.path_to_cover}`;
            workingTrack.url = `https://www.funckenobi42.space`;
            if (isFirst) {
                workingTrack.startedPlaying = new Date();
            }

            await guildQueue.play(workingTrack, { nodeOptions: { metadata: interaction, noEmitInsert: true, leaveOnEnd: false, leaveOnEmpty: false, leaveOnStop: false} });
        }
    };

    if (searchResult.rows.length > 1) {
        for (let i = 0; i < searchResult.rows.length; i++) {
            await playTrack(searchResult.rows[i], interaction, player, guildQueue, i === 0);
        }
    } else {
        await playTrack(searchResult.rows[0], interaction, player, guildQueue, true);
    }

    const embed = new EmbedBuilder()
        .setDescription(`**${searchResult.rows.length} songs** found by **${searchResult.rows[0].match_type}** have been added to the queue`)
        .setThumbnail(`https://www.funckenobi42.space${searchResult.rows[0].path_to_cover}`);

    await interaction.editReply({ embeds: [embed] });

    console.log(searchResult.rows[0].path_to_cover);
};

export { handleFromDbCommand };


export const command = {
    data: new SlashCommandBuilder()
        .setName('playin')
        .setDescription('play a song from YouTube.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('song')
                .setDescription('plays a song')
                .addStringOption(option =>
                    option.setName('music').setDescription('url/searchterm').setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('guild').setDescription('guild id').setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('vc').setDescription('vc id').setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('text').setDescription('text id').setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('fromdb')
                .setDescription('plays a song from database')
                .addStringOption(option =>
                    option.setName('dbquery').setDescription('name/author/album').setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('guild').setDescription('guild id').setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('vc').setDescription('vc id').setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('text').setDescription('text id').setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('file')
                .setDescription('plays a file')
                .addAttachmentOption(option =>
                    option.setName('file').setDescription('play\'s the song').setRequired(true)
                )
                .addNumberOption(option =>
                    option.setName('guild').setDescription('guild id').setRequired(true)
                )
                .addNumberOption(option =>
                    option.setName('vc').setDescription('vc id').setRequired(true)
                )
                .addNumberOption(option =>
                    option.setName('text').setDescription('text id').setRequired(true)
                )
        ),
    execute: async ({ player, interaction, client }: { player: Player | null; interaction: CommandInteraction, client: Client }) => {
        await interaction.deferReply();

        if (!interaction.guild)return interaction.followUp('You need to be in a guild.');
        if (!player) player = useMainPlayer();

        const guildId = interaction.options.get('guild')?.value;
        const VcChannelId = interaction.options.get('vc')?.value;
        const TextChannelId = interaction.options.get('text')?.value;
        if (!VcChannelId || !TextChannelId) return interaction.reply({ content: "You need to be in a voice channel to use this command!", ephemeral: true });
        const voiceChannel = client.channels.cache.get(VcChannelId.toString()) as GuildVoiceChannelResolvable;
        const TextChannel = client.channels.cache.get(TextChannelId.toString())
        let guild: Guild | undefined;  
        if (guildId) guild = client.guilds.cache.get(guildId?.toString())
        if (!guild) return interaction.reply({ content: "You need to be in a voice channel to use this command!", ephemeral: true });
        let guildQueue = useQueue(guild);
        if (!guildQueue) {
            guildQueue = player.nodes.create(guild, {leaveOnEnd: false, leaveOnEmpty: true, leaveOnStop: false, metadata: interaction, noEmitInsert: true});
        } else if (guildQueue.deleted) {
            guildQueue.revive();
        }

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
