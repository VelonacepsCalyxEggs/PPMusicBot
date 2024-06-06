const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { QueryType, GuildQueue, useQueue } = require("discord-player");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shuffle")
        .setDescription("shuffles the playlist"),
    execute: async ({ client, interaction }) => {
        let queue = useQueue(interaction.guildId);
        if (!queue) {
            return interaction.reply('There is no queue to shuffle bruv.');
        }
        if (!queue.size) return interaction.reply('There are no songs in the queue to shuffle.');
        // Fisher-Yates (Knuth) shuffle algorithm
        var tracks = queue.tracks.toArray();
        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
              let j = Math.floor(Math.random() * (i + 1));
              [array[i], array[j]] = [array[j], array[i]];
            }
          }
          shuffleArray(tracks);
          queue.clear();
          for (let i = tracks.length - 1; i >= 0; i--) {
            queue.addTrack(tracks[i]);
          }          
        return interaction.reply('The queue has been shuffled!')
    }}