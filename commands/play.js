const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { QueryType, useQueue, GuildQueue } = require("discord-player");
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Client: PgClient } = require('pg');
const dbConfig = require('../config/dbCfg'); // Make sure the path is correct
const ytdl = require("@distube/ytdl-core");
const { YoutubeiExtractor } = require("discord-player-youtubei");

const downloadFile = (file, url) => {
    return new Promise((resolve, reject) => {
        const fileExtension = path.extname(file);
        const localPath = 'C:/Server/DSMBot/PP_DMB/cache/' + Math.random().toString().slice(2, 11) + fileExtension;
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

const createEmbed = (description, thumbnail, footer) => {
    return new EmbedBuilder()
        .setDescription(description)
        .setThumbnail(thumbnail)
        .setFooter({ text: footer });
};

const handleSongCommand = async (client, interaction, guildQueue) => {
    let argument = interaction.options.getString("music");
    let result, song, embed;

    if (argument.includes('http://www.funckenobi42.space:55060/stream')) {

                console.log('Live stream detected');
                // create a stream using ytdl-core with audioonly filter
                let result = await client.player.search(argument, {
                    requestedBy: interaction.user,
                    searchEngine: ytdl.FILE,

                });
                if (!song) return interaction.followUp("No results");
                song = result.tracks[0];
                song.duration = "∞"
                embed = createEmbed(`**${"Chuvaev FM"}** has been added to the queue`, "https://t4.ftcdn.net/jpg/03/86/82/73/360_F_386827376_uWOOhKGk6A4UVL5imUBt20Bh8cmODqzx.jpg", `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`);
    }
    else if ((argument.includes('http') || argument.includes('https')) && 
    !(argument.includes('watch?v=') || argument.includes('youtu.be') || argument.includes('youtube.com'))) {
        console.log('URL detected');
        const localPath = await downloadFile(argument.split('?')[0], argument);
        result = await client.player.search(localPath, {
            requestedBy: interaction.user,
            searchEngine: QueryType.FILE
        });
        song = result.tracks[0];
        if (!song) return interaction.followUp("No results");
        embed = createEmbed(`**${song.title}** has been added to the queue`, song.thumbnail, `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`);
    }
    else if ((argument.includes('watch?v=') || argument.includes('youtu.be') || argument.includes('youtube.com')) && !argument.includes('playlist?list=')) {
        console.log('Youtube URL detected');
        if (argument.includes('si=')) {
            let parts = argument.split("si=");

            if (parts.length > 1) {
                argument = parts[0];
            }
            console.log(argument);

        }
        result = await client.player.search(argument, {
            requestedBy: interaction.user,
            searchEngine: QueryType.AUTO
        });
        song = result.tracks[0];
        //console.log(result)
        if (!song) {
            return interaction.followUp("No results or couldn't extract the track from YouTube.");
        }

        embed = createEmbed(`**${song.title}** has been added to the queue`, song.thumbnail, `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`);
        //return interaction.followUp("YOUTUBE IS DEAD, MUSIC IS FUEL.");
    } else if (argument.includes('playlist?list=')) {
        console.log('Youtube playlist...')
        result = await client.player.search(argument, {
            requestedBy: interaction.user,
            searchEngine: QueryType.YOUTUBE_PLAYLIST
        });
        const playlist = result.playlist;
        if (!playlist) return interaction.followUp("No results");

        // Honestly, it's probably me being dumb, but I'll still rant about this here...
        // If I do guildQueue.play(playlist.tracks, ...) it adds only the first track from the playlist.
        // but if I do playlist.tracks[1] it adds all the tracks from the playlist. same with [2] [3] ... [n]. Why would that happen...
        // that caused the playlist duplication bug, which was adding playlists in ariphmetic progression... jesus ducking christ...
        await guildQueue.play(result.tracks[0], { 
            nodeOptions: { 
                metadata: interaction, 
                noEmitInsert: true, 
                leaveOnEnd: false, 
                leaveOnEmpty: false, 
                leaveOnStop: false, 
                guild: interaction.guild 
            } 
        });
        
        embed = createEmbed(`**${result.tracks.length} songs from ${playlist.title}** have been added to the queue`, playlist.thumbnail, null);
        //return interaction.followUp("YOUTUBE IS DEAD, MUSIC IS FUEL.");
    }
    else {
        console.log('Youtube Search detected');
        result = await client.player.search(argument, {
            requestedBy: interaction.user,
            searchEngine: QueryType.YOUTUBE_SEARCH
        });
        song = result.tracks[0];
        if (!song) return interaction.followUp("No results or Couldn't extract the track from YouTube.");
        embed = createEmbed(`**${song.title}** has been added to the queue`, song.thumbnail, `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`);
        //return interaction.followUp("GABELLA... url didn't fit the specifications.");
    }
    if (song) {
        await guildQueue.play(song, { nodeOptions: { metadata: interaction, noEmitInsert: true, leaveOnEnd: false, leaveOnEmpty: false, leaveOnStop: false, guild: interaction.guild } });
    }

    await interaction.editReply({ embeds: [embed] });
};

const handleFileCommand = async (client, interaction, guildQueue) => {
    const file = interaction.options.getAttachment("file");
    const localPath = await downloadFile(file.url.split('?')[0], file.url);
    const result = await client.player.search(localPath, {
        requestedBy: interaction.user,
        searchEngine: QueryType.FILE
    });
    const song = result.tracks[0];
    if (!song) return interaction.followUp("No results");
    const embed = createEmbed(`**${song.title}** has been added to the queue`, song.thumbnail, `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`);
    await guildQueue.play(song, { nodeOptions: { metadata: interaction, noEmitInsert: true, leaveOnEnd: false, leaveOnEmpty: false, leaveOnStop: false, guild: interaction.guild } });
    await interaction.editReply({ embeds: [embed] });
};

const handleFromDbCommand = async (client, interaction, guildQueue) => {
    console.log('Play db used.')
            let argument = interaction.options.getString("dbquery");
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

            if (searchResult.rows.length > 1) {
                let i = 0;
                for (const row of searchResult.rows) {
                    console.log(row)
                    if (i == 0) {
                        // Assuming you want to play the first result
                        pathToSong = row.local;
                        let result = await client.player.search(pathToSong, {
                            requestedBy: interaction.user,
                            searchEngine: QueryType.FILE,
                        });
                        result.tracks[0].title = row.name;
                        result.tracks[0].author = row.author;
                        result.tracks[0].thumbnail = `http://www.funckenobi42.space${row.path_to_cover}`
                        result.tracks[0].url = `http://www.funckenobi42.space`
                        result.tracks[0].startedPlaying = new Date()
                        await guildQueue.play(result.tracks[0], { nodeOptions: { metadata: interaction, noEmitInsert: true, leaveOnEnd: false, leaveOnEmpty: false, leaveOnStop: false, guild: interaction.guild } });

                    } else {
                        pathToSong = row.local;
                        let result = await client.player.search(pathToSong, {
                            requestedBy: interaction.user,
                            searchEngine: QueryType.FILE,
                        });
                        if (result.tracks[0]) {
                        result.tracks[0].title = row.name;
                        result.tracks[0].author = row.author;
                        result.tracks[0].thumbnail = `http://www.funckenobi42.space${row.path_to_cover}`
                        result.tracks[0].url = `http://www.funckenobi42.space`
                        await guildQueue.play(result.tracks[0], { nodeOptions: { metadata: interaction, noEmitInsert: true, leaveOnEnd: false, leaveOnEmpty: false, leaveOnStop: false, guild: interaction.guild } });
                        }
                    }
                    i++
                }
            }
            else {
                pathToSong = searchResult.rows[0].local;
                let result = await client.player.search(pathToSong, {
                    requestedBy: interaction.user,
                    searchEngine: QueryType.FILE,
                });
                result.tracks[0].title = searchResult.rows[0].name;
                result.tracks[0].author = searchResult.rows[0].author;
                result.tracks[0].thumbnail = `http://www.funckenobi42.space${searchResult.rows[0].path_to_cover}`
                result.tracks[0].url = `http://www.funckenobi42.space`
                result.tracks[0].startedPlaying = new Date()
                await guildQueue.play(result.tracks[0], { nodeOptions: { metadata: interaction, noEmitInsert: true, leaveOnEnd: false, leaveOnEmpty: false, leaveOnStop: false, guild: interaction.guild } });
            }
            console.log(searchResult.rows[0].path_to_cover)
    const embed = createEmbed(
        `**${searchResult.rows.length} songs** found by **${searchResult.rows[0].match_type}** have been added to the queue`,
        `http://www.funckenobi42.space${searchResult.rows[0].path_to_cover}`,
        null
    );
    await interaction.editReply({ embeds: [embed] });
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("play a song from YouTube.")
        .addSubcommand(subcommand =>
            subcommand
                .setName("song")
                .setDescription("plays a song")
                .addStringOption(option =>
                    option.setName("music").setDescription("url/searchterm").setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("fromdb")
                .setDescription("plays a song from database")
                .addStringOption(option =>
                    option.setName("dbquery").setDescription("name/author/album").setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("file")
                .setDescription("plays a file")
                .addAttachmentOption(option =>
                    option.setName("file").setDescription("play's the song").setRequired(true)
                )
        ),
    execute: async ({ client, interaction }) => {
        
        await interaction.deferReply();
        
        if (!interaction.member.voice.channel) {
            return interaction.followUp("You need to be in a Voice Channel to play a song.");
        }

        const { player } = client;
        let guildQueue = useQueue(interaction.guildId);
        if (!guildQueue) {
            guildQueue = new GuildQueue(player, {
                leaveOnEnd: false,
                leaveOnEmpty: false,
                leaveOnStop: false,
                guild: interaction.guild,
                metadata: interaction,
            });
        } else if (guildQueue.deleted) {
            guildQueue.revive();
        }

        if (!guildQueue.connection) await guildQueue.connect(interaction.member.voice.channel);

        switch (interaction.options.getSubcommand()) {
            case "song":
                await handleSongCommand(client, interaction, guildQueue);
                break;
            case "file":
                await handleFileCommand(client, interaction, guildQueue);
                break;
            case "fromdb":
                await handleFromDbCommand(client, interaction, guildQueue);
                break;
        }
    },
};
