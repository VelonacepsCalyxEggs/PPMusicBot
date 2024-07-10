const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { QueryType, GuildQueue, useQueue } = require("discord-player");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("remove")
        .setDescription("removes the track with an index.")
        .addNumberOption(option =>
            option.setName('position').setDescription("index").setRequired(true)
        )
        .addNumberOption(option =>
            option.setName('position2').setDescription("index 2").setRequired(false)
        ),
    execute: async ({ client, interaction }) => {
        let queue = useQueue(interaction.guildId);
        if (!queue) {
            return interaction.reply('There is no queue to remove music bruv.');
        }
        if (!queue.size) return interaction.reply('There are no songs in the queue to remove.');
            var tracks = queue.tracks.toArray();
            
            if (!interaction.options.getNumber('position2')) {
                tracks.splice(interaction.options.getNumber('position') - 1, 1)
                queue.clear();
                for (let i = 0; i < tracks.length; i++) {
                    queue.addTrack(tracks[i]);
                }    
                return interaction.reply('The track has been removed!')
            } else {
                tracks.splice(interaction.options.getNumber('position') - 1, interaction.options.getNumber('position2'))
                queue.clear();
                for (let i = 0; i < tracks.length; i++) {
                    queue.addTrack(tracks[i]);
                }  
                return interaction.reply(`The tracks from ${interaction.options.getNumber('position')} to ${interaction.options.getNumber('position2')} have been removed!`)
            }




    }}