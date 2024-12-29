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
Object.defineProperty(exports, "__esModule", { value: true });
exports.command = void 0;
const builders_1 = require("@discordjs/builders");
const discord_js_1 = require("discord.js");
const discord_player_1 = require("discord-player");
// Function to format duration to match the song's duration format
function formatDuration(durationMs) {
    const seconds = Math.floor((durationMs / 1000) % 60);
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
    const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24);
    const secondsFormatted = seconds < 10 ? '0' + seconds : seconds;
    const minutesFormatted = minutes < 10 ? '0' + minutes : minutes;
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
        return "∞";
    }
    let result = `${minutes}:${secondsFormatted}`;
    if (hours > 0) {
        result = `${hours}:${minutesFormatted}:${secondsFormatted}`;
    }
    return result;
}
exports.command = {
    data: new builders_1.SlashCommandBuilder()
        .setName('np')
        .setDescription('Gets the currently playing song.'),
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ client, interaction }) {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId)
            return interaction.followUp('You need to be in a guild.');
        const queue = (0, discord_player_1.useQueue)(interaction.guild);
        // If there is no queue, return
        if (!queue) {
            yield interaction.reply('There is no queue.');
            return;
        }
        if (!queue.currentTrack) {
            yield interaction.reply('There are no songs playing.');
            return;
        }
        const currentSong = queue.currentTrack;
        // Calculate the elapsed time
        const startedPlaying = currentSong.startedPlaying;
        if (!startedPlaying || !(startedPlaying instanceof Date))
            return interaction.followUp('Could not calculate dates.');
        console.log(`[${new Date().toISOString()}] [Started Playing: ${startedPlaying}]`);
        const elapsedTime = new Date().getTime() - startedPlaying.getTime(); // in milliseconds
        // Convert the duration string to milliseconds
        const durationParts = currentSong.duration.split(':').reverse();
        const durationMs = durationParts.reduce((total, part, index) => {
            return total + parseInt(part, 10) * Math.pow(60, index) * 1000;
        }, 0);
        // Calculate the current position
        const currentPosition = Math.min(elapsedTime, durationMs);
        // Format the current position
        const currentPositionFormatted = formatDuration(currentPosition);
        // Create the embed
        const embed = new discord_js_1.EmbedBuilder()
            .setDescription(`Currently playing: **${currentSong.title}** by **${currentSong.author}** from [source](${currentSong.url})`)
            .setThumbnail(currentSong.thumbnail)
            .setFooter({
            text: `Elapsed time: ${currentPositionFormatted} / ${currentSong.duration}`,
            iconURL: interaction.user.displayAvatarURL(),
        });
        // Reply with the embed
        return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
    }),
};
