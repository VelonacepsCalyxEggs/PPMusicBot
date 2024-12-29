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
const discord_js_1 = require("discord.js");
exports.command = {
    data: new builders_1.SlashCommandBuilder()
        .setName('loop')
        .setDescription('Loops with the given mode.')
        .addStringOption(option => option.setName('mode')
        .setDescription('Loop mode.')
        .setRequired(false)
        .addChoices({ name: 'Queue', value: '1' }, { name: 'Track', value: '2' }, { name: 'Off', value: '3' })),
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ client, interaction }) {
        var _b;
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId)
            return interaction.followUp('You need to be in a guild.');
        const queue = (0, discord_player_1.useQueue)(interaction.guild);
        const repeatDict = {
            0: 'Off',
            1: 'Track',
            2: 'Queue',
        };
        // If there is no queue, return
        if (!queue) {
            yield interaction.reply('There is no queue.');
            return;
        }
        if (!queue.currentTrack) {
            yield interaction.reply('There are no songs playing.');
            return;
        }
        let repeatModeString = '';
        const repeatModeUser = (_b = interaction.options.get('mode')) === null || _b === void 0 ? void 0 : _b.value;
        if (repeatModeUser === '1') {
            queue.setRepeatMode(discord_player_1.QueueRepeatMode.QUEUE);
            repeatModeString = 'QUEUE';
        }
        else if (repeatModeUser === '2') {
            queue.setRepeatMode(discord_player_1.QueueRepeatMode.TRACK);
            repeatModeString = 'TRACK';
        }
        else if (repeatModeUser === '3') {
            queue.setRepeatMode(discord_player_1.QueueRepeatMode.OFF);
            repeatModeString = 'OFF';
        }
        else {
            return interaction.reply(`Current looping mode is ${repeatDict[queue.repeatMode]}.`);
        }
        // Create the embed
        const embed = new discord_js_1.EmbedBuilder()
            .setDescription(`Current looping mode is now ${repeatModeString}`);
        // Reply with the embed
        return interaction.reply({ ephemeral: false, embeds: [embed] }).catch(console.error);
    }),
};
