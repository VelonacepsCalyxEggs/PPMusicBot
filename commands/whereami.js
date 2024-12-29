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
exports.command = {
    data: new builders_1.SlashCommandBuilder()
        .setName('whereami')
        .setDescription('Returns all servers the bot is currently in.'),
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ client, interaction }) {
        yield interaction.deferReply({ ephemeral: true });
        const guildIds = client.guilds.cache.map(guild => guild.id);
        let guildInfoString = '';
        let i = 1;
        for (const guildId of guildIds) {
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                const owner = yield guild.fetchOwner(); // Fetch the owner
                guildInfoString += `${i}. ${guild.name} - Owner: <@${owner.user.id}>\n`; // Use user tag and ID
                i++;
            }
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setDescription(`Guilds I am in:\n${guildInfoString}`)
            .setFooter({
            text: interaction.user.tag,
            iconURL: interaction.user.displayAvatarURL(),
        });
        yield interaction.editReply({ embeds: [embed] });
    }),
};
