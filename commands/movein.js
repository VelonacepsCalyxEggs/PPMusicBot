const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { QueryType, GuildQueue, useQueue } = require("discord-player");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("movein")
        .setDescription("moves the track from one index to another index in a guild.")
        .addNumberOption(option =>
            option.setName("index").setDescription("index").setRequired(true)
        )
        .addNumberOption(option =>
            option.setName('position').setDescription("index").setRequired(true)
        )
        .addStringOption(option =>
            option.setName("guild").setDescription("guildid").setRequired(true)
        ),
    execute: async ({ client, interaction }) => {
        let guildId = interaction.options.getString('guild') 
        let queue = useQueue(guildId);
        if (!queue) {
            return interaction.reply('There is no queue to move music bruv.');
        }
        if (!queue.size) return interaction.reply('There are no songs in the queue to move.');
        queue.moveTrack(interaction.options.getNumber('index') - 1,interaction.options.getNumber('position') - 1);
        return interaction.reply('The track has been moved!')
    }}