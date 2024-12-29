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
        .setName('remove')
        .setDescription('removes the track with an index.')
        .addNumberOption(option => option.setName('position')
        .setDescription('index')
        .setRequired(true))
        .addNumberOption(option => option.setName('position2')
        .setDescription('index 2')
        .setRequired(false)),
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ client, interaction }) {
        var _b, _c;
        if (!interaction.guild || !interaction.guildId)
            return interaction.followUp('You need to be in a guild.');
        const queue = (0, discord_player_1.useQueue)(interaction.guild);
        if (!queue) {
            return interaction.reply('There is no queue to remove music.');
        }
        if (!queue.size) {
            return interaction.reply('There are no songs in the queue to remove.');
        }
        const tracks = queue.tracks.toArray();
        const position = (_b = interaction.options.get('position')) === null || _b === void 0 ? void 0 : _b.value;
        const position2 = (_c = interaction.options.get('position2')) === null || _c === void 0 ? void 0 : _c.value;
        if (position) {
            if (!position2) {
                tracks.splice(Number(position) - 1, 1);
                queue.clear();
                for (let i = 0; i < tracks.length; i++) {
                    queue.addTrack(tracks[i]);
                }
                return interaction.reply('The track has been removed!');
            }
            else {
                tracks.splice(Number(position) - 1, Number(position2));
                queue.clear();
                for (let i = 0; i < tracks.length; i++) {
                    queue.addTrack(tracks[i]);
                }
                return interaction.reply(`The tracks from ${position} to ${position2} have been removed!`);
            }
        }
        return interaction.reply('An error occurred while removing tracks.');
    })
};
