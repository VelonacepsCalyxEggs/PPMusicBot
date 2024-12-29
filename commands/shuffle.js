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
const discord_player_1 = require("discord-player");
exports.command = {
    data: new builders_1.SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Shuffles the playlist')
        .addStringOption(option => option.setName('algorithm')
        .setDescription('Shuffle algorithm.')
        .setRequired(false)
        .addChoices({ name: 'Fisher-Yates', value: 'fy' }, { name: 'Durstenfeld', value: 'df' }, { name: 'Sattolo', value: 'st' })),
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ interaction }) {
        var _b;
        if (!interaction.guild || !interaction.guildId)
            return interaction.followUp('You need to be in a guild.');
        const queue = (0, discord_player_1.useQueue)(interaction.guild);
        if (!queue) {
            return interaction.reply('There is no queue to shuffle.');
        }
        if (!queue.size) {
            return interaction.reply('There are no songs in the queue to shuffle.');
        }
        const shuffleAlgorithm = ((_b = interaction.options.get('algorithm')) === null || _b === void 0 ? void 0 : _b.value) || 'fy';
        const tracks = queue.tracks.toArray();
        // Shuffle based on the selected algorithm
        switch (shuffleAlgorithm) {
            case 'fy': // Fisher-Yates (Knuth) shuffle
                for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
                }
                break;
            case 'df': // Durstenfeld shuffle
                for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    const temp = tracks[i];
                    tracks[i] = tracks[j];
                    tracks[j] = temp;
                }
                break;
            case 'st': // Sattolo's algorithm
                for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * i);
                    const temp = tracks[i];
                    tracks[i] = tracks[j];
                    tracks[j] = temp;
                }
                break;
            default:
                for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
                }
        }
        queue.clear();
        tracks.forEach(track => queue.addTrack(track));
        return interaction.reply(`The queue has been shuffled using ${shuffleAlgorithm} algorithm!`);
    })
};
