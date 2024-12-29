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
exports.command = {
    data: new builders_1.SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the current song'),
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ client, interaction }) {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId)
            return interaction.followUp('You need to be in a guild.');
        const queue = (0, discord_player_1.useQueue)(interaction.guild);
        // If there is no queue, return
        if (!queue) {
            yield interaction.reply('There is no queue!');
            return;
        }
        const currentSong = queue.currentTrack;
        if (!currentSong)
            return interaction.followUp('No song is currently playing.');
        // Skip the current song
        queue.node.skip();
        // Create an embed to inform the user
        const embed = new discord_js_1.EmbedBuilder()
            .setDescription(`${currentSong.title} has been skipped!`)
            .setThumbnail(currentSong.thumbnail);
        return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
    })
};
