"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.command = exports.handleFromDbCommand = void 0;
const builders_1 = require("@discordjs/builders");
const discord_js_1 = require("discord.js");
const discord_player_1 = require("discord-player");
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pg_1 = require("pg");
const dbCfg_1 = __importDefault(require("../config/dbCfg")); // Make sure the path is correct
const pgClient = new pg_1.Client(dbCfg_1.default);
pgClient.connect();
const downloadFile = (file, url) => {
    return new Promise((resolve, reject) => {
        console.log(`download file excecuted with ${url}`);
        const fileExtension = path_1.default.extname(file);
        const localPath = 'C:/Server/DSMBot/PP_DMB_TS/cache/' + Math.random().toString().slice(2, 11) + fileExtension;
        const writeStream = fs_1.default.createWriteStream(localPath);
        const protocol = url.startsWith('https') ? https_1.default : http_1.default;
        console.log(localPath);
        console.log(protocol);
        console.log(`Trying to start download.`);
        protocol.get(url, (res) => {
            console.log(`Starting download.`);
            res.pipe(writeStream);
            writeStream.on('finish', () => {
                writeStream.close();
                console.log('Download completed! File saved at:', localPath);
                resolve(localPath);
            });
            writeStream.on('error', (error) => {
                console.log(error);
            });
        }).on('error', (err) => {
            console.error('Error downloading file:', err.message);
            reject(err);
        });
    });
};
const createEmbed = (description, thumbnail, footer) => {
    const embed = new discord_js_1.EmbedBuilder()
        .setDescription(description)
        .setThumbnail(thumbnail);
    if (footer) {
        embed.setFooter({ text: footer });
    }
    return embed;
};
const handleSongCommand = (player, interaction, guildQueue) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    let argument = (_a = interaction.options.get('music')) === null || _a === void 0 ? void 0 : _a.value;
    if (!(typeof (argument) === 'string'))
        return interaction.followUp('Please provide an argument.');
    ;
    let result;
    let song;
    let embed;
    if ((argument.includes('http') || argument.includes('https')) &&
        !(argument.includes('watch?v=') || argument.includes('youtu.be') || argument.includes('youtube.com'))) {
        console.log('URL detected');
        const localPath = yield downloadFile(argument.split('?')[0], argument);
        result = yield player.search(localPath, {
            requestedBy: interaction.user,
            searchEngine: discord_player_1.QueryType.FILE
        });
        song = result.tracks[0];
        if (!song)
            return interaction.followUp('No results');
        embed = createEmbed(`**${song.title}** has been added to the queue`, song.thumbnail, `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`);
    }
    else if ((argument.includes('watch?v=') || argument.includes('youtu.be') || argument.includes('youtube.com')) && !argument.includes('playlist?list=')) {
        console.log('YouTube URL detected');
        if (argument.includes('si=')) {
            const parts = argument.split('si=');
            if (parts.length > 1) {
                argument = parts[0];
            }
            console.log(argument);
        }
        result = yield player.search(argument, {
            requestedBy: interaction.user,
            searchEngine: discord_player_1.QueryType.AUTO
        });
        song = result.tracks[0];
        if (!song) {
            return interaction.followUp("No results or couldn't extract the track from YouTube.");
        }
        embed = createEmbed(`**${song.title}** has been added to the queue`, song.thumbnail, `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`);
    }
    else if (argument.includes('playlist?list=')) {
        console.log('YouTube playlist detected');
        result = yield player.search(argument, {
            requestedBy: interaction.user,
            searchEngine: discord_player_1.QueryType.YOUTUBE_PLAYLIST
        });
        const playlist = result.playlist;
        if (!playlist)
            return interaction.followUp('No results');
        yield guildQueue.play(result.tracks[0], {
            nodeOptions: {
                metadata: interaction,
                noEmitInsert: true,
                leaveOnEnd: false,
                leaveOnEmpty: false,
                leaveOnStop: false,
            }
        });
        embed = createEmbed(`**${result.tracks.length} songs from ${playlist.title}** have been added to the queue`, playlist.thumbnail, null);
    }
    else {
        console.log('YouTube Search detected');
        result = yield player.search(argument, {
            requestedBy: interaction.user,
            searchEngine: discord_player_1.QueryType.YOUTUBE_SEARCH
        });
        song = result.tracks[0];
        if (!song)
            return interaction.followUp("No results or Couldn't extract the track from YouTube.");
        embed = createEmbed(`**${song.title}** has been added to the queue`, song.thumbnail, `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`);
    }
    if (song) {
        yield guildQueue.play(song, {
            nodeOptions: {
                metadata: interaction,
                noEmitInsert: true,
                leaveOnEnd: false,
                leaveOnEmpty: false,
                leaveOnStop: false,
            }
        });
    }
    return yield interaction.editReply({ embeds: [embed] });
});
const handleFileCommand = (player, interaction, guildQueue) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log('File handler');
    const file = (_a = interaction.options.get('file')) === null || _a === void 0 ? void 0 : _a.attachment;
    if (!file) {
        return interaction.followUp("No file attachment found");
    }
    const localPath = yield downloadFile(file.url.split('?')[0], file.url);
    const result = yield player.search(localPath, {
        requestedBy: interaction.user,
        searchEngine: discord_player_1.QueryType.FILE,
    });
    const song = result.tracks[0];
    if (!song)
        return interaction.followUp('No results');
    const embed = new discord_js_1.EmbedBuilder()
        .setDescription(`**${song.title}** has been added to the queue`)
        .setThumbnail(song.thumbnail)
        .setFooter({
        text: `Duration: ${song.duration} Position: ${guildQueue.tracks.size + 1}`,
        iconURL: interaction.user.displayAvatarURL(),
    });
    yield guildQueue.play(song, {
        nodeOptions: {
            metadata: interaction,
            noEmitInsert: true,
            leaveOnEnd: false,
            leaveOnEmpty: false,
            leaveOnStop: false,
        },
    });
    yield interaction.editReply({ embeds: [embed] });
});
const handleFromDbCommand = (player, interaction, guildQueue) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log('Play db used.');
    const argument = (_a = interaction.options.get('dbquery')) === null || _a === void 0 ? void 0 : _a.value;
    if (!argument || !(typeof (argument) === 'string')) {
        return interaction.followUp("No search argument provided.");
    }
    // PostgreSQL client setup using the imported config
    const pgClient = new pg_1.Client(dbCfg_1.default);
    yield pgClient.connect();
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
    const searchResult = yield pgClient.query(searchQuery, searchValues);
    if (searchResult.rows.length === 0) {
        return interaction.followUp("No results found");
    }
    const playTrack = (row, interaction, player, guildQueue, isFirst) => __awaiter(void 0, void 0, void 0, function* () {
        const pathToSong = row.local;
        const result = yield player.search(pathToSong, {
            requestedBy: interaction.user,
            searchEngine: discord_player_1.QueryType.FILE,
        });
        console.log(row.path_to_cover);
        if (result.tracks[0]) {
            const workingTrack = result.tracks[0];
            workingTrack.title = row.name;
            workingTrack.author = row.author;
            workingTrack.thumbnail = `https://www.funckenobi42.space${row.path_to_cover}`;
            workingTrack.url = `https://www.funckenobi42.space`;
            if (isFirst) {
                workingTrack.startedPlaying = new Date();
            }
            yield guildQueue.play(workingTrack, { nodeOptions: { metadata: interaction, noEmitInsert: true, leaveOnEnd: false, leaveOnEmpty: false, leaveOnStop: false } });
        }
    });
    if (searchResult.rows.length > 1) {
        for (let i = 0; i < searchResult.rows.length; i++) {
            yield playTrack(searchResult.rows[i], interaction, player, guildQueue, i === 0);
        }
    }
    else {
        yield playTrack(searchResult.rows[0], interaction, player, guildQueue, true);
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setDescription(`**${searchResult.rows.length} songs** found by **${searchResult.rows[0].match_type}** have been added to the queue`)
        .setThumbnail(`https://www.funckenobi42.space${searchResult.rows[0].path_to_cover}`);
    yield interaction.editReply({ embeds: [embed] });
    console.log(searchResult.rows[0].path_to_cover);
});
exports.handleFromDbCommand = handleFromDbCommand;
exports.command = {
    data: new builders_1.SlashCommandBuilder()
        .setName('play')
        .setDescription('play a song from YouTube.')
        .addSubcommand(subcommand => subcommand
        .setName('song')
        .setDescription('plays a song')
        .addStringOption(option => option.setName('music').setDescription('url/searchterm').setRequired(true)))
        .addSubcommand(subcommand => subcommand
        .setName('fromdb')
        .setDescription('plays a song from database')
        .addStringOption(option => option.setName('dbquery').setDescription('name/author/album').setRequired(true)))
        .addSubcommand(subcommand => subcommand
        .setName('file')
        .setDescription('plays a file')
        .addAttachmentOption(option => option.setName('file').setDescription('play\'s the song').setRequired(true))),
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ client, interaction }) {
        yield interaction.deferReply();
        if (!interaction.member.voice.channel) {
            return interaction.followUp('You need to be in a Voice Channel to play a song.');
        }
        if (!interaction.guild)
            return interaction.followUp('You need to be in a guild.');
        const player = (0, discord_player_1.useMainPlayer)();
        let guildQueue = (0, discord_player_1.useQueue)(interaction.guild);
        if (!guildQueue) {
            guildQueue = player.nodes.create(interaction.guild, { leaveOnEnd: false, leaveOnEmpty: true, leaveOnStop: false, metadata: interaction, noEmitInsert: true });
        }
        else if (guildQueue.deleted) {
            guildQueue.revive();
        }
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: "You need to be in a voice channel to use this command!", ephemeral: true });
        }
        if (!guildQueue.connection) {
            yield guildQueue.connect(voiceChannel);
        }
        // Assuming interaction is of type CommandInteraction
        const subcommand = interaction.options.getSubcommand();
        console.log(`Subcommand: ${subcommand}`);
        switch (subcommand) {
            case 'song':
                yield handleSongCommand(player, interaction, guildQueue);
                break;
            case 'file':
                yield handleFileCommand(player, interaction, guildQueue);
                break;
            case 'fromdb':
                yield handleFromDbCommand(player, interaction, guildQueue);
                break;
        }
    }),
};
