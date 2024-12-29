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
function formatDuration(ms) {
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;
    let hours = Math.floor(minutes / 60);
    minutes = minutes % 60;
    let days = Math.floor(hours / 24);
    hours = hours % 24;
    return `${days} days : ${hours} hours : ${minutes} minutes : ${seconds} seconds`;
}
exports.command = {
    data: new builders_1.SlashCommandBuilder()
        .setName('queue')
        .setDescription('show the queue')
        .addNumberOption(option => option.setName('page')
        .setDescription('page number')
        .setRequired(false)),
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ client, interaction }) {
        var _b, _c;
        if (!interaction.guild || !interaction.guildId) {
            return interaction.followUp('You need to be in a guild.');
        }
        const queue = (0, discord_player_1.useQueue)(interaction.guild);
        if (!queue) {
            return interaction.reply('There is no queue.');
        }
        if (queue.size === 0) {
            return interaction.reply('There are no songs in the queue.');
        }
        let page = (_c = Number((_b = interaction.options.get('page', false)) === null || _b === void 0 ? void 0 : _b.value)) !== null && _c !== void 0 ? _c : 1;
        if (isNaN(page)) {
            page = 1;
        }
        const multiple = 10;
        const maxPages = Math.ceil(queue.size / multiple);
        if (page < 1 || page > maxPages)
            page = 1;
        const end = page * multiple;
        const start = end - multiple;
        const tracks = queue.tracks.toArray().slice(start, end);
        const allTracks = queue.tracks.toArray();
        let totalDurationMs = 0;
        for (const track of allTracks) {
            try {
                const durationParts = track.duration.split(':').reverse();
                const durationMs = durationParts.reduce((total, part, index) => {
                    return total + parseInt(part, 10) * Math.pow(60, index) * 1000;
                }, 0);
                totalDurationMs += durationMs;
            }
            catch (_d) {
                continue;
            }
        }
        let totalDurationFormatted = formatDuration(totalDurationMs);
        if (String(totalDurationFormatted).includes('NaN')) {
            totalDurationFormatted = '∞';
        }
        const description = tracks
            .map((track, i) => `${start + ++i} - [${track.title}](${track.url}) ~ [${track.duration}] \n [${track.requestedBy ? track.requestedBy.toString() : 'Unknown'}]`)
            .join('\n');
        const embed = new discord_js_1.EmbedBuilder()
            .setDescription(description || 'No tracks found in the current queue.')
            .setFooter({
            text: `Page ${page} of ${maxPages} | track ${start + 1} to ${end > queue.size ? `${queue.size}` : `${end}`} of ${queue.size}. Total Duration: ${totalDurationFormatted}.`,
            iconURL: interaction.user.displayAvatarURL(),
        });
        return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
    }),
};
