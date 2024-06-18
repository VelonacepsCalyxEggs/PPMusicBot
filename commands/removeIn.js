const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { QueryType, GuildQueue, useQueue } = require("discord-player");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("removein")
        .setDescription("removes the track with an index in a guild.")
        .addNumberOption(option =>
            option.setName('position').setDescription("index").setRequired(true)
        )
        .addStringOption(option =>
            option.setName("guild").setDescription("guildid").setRequired(true)
        ),
    execute: async ({ client, interaction }) => {
        let guildId = interaction.options.getString('guild') 
        console.log(`[${Date.now()}] A /remove command issued: [\n By: ${interaction.user}\n Guild: ${interaction.guild.name}\n Channel: ${interaction.channel.name}\n}`)
        let queue = useQueue(guildId);
        if (!queue) {
            return interaction.reply('There is no queue to remove music bruv.');
        }
        if (!queue.size) return interaction.reply('There are no songs in the queue to remove.');
        try {
            var tracks = queue.tracks.toArray();
            tracks.splice(interaction.options.getNumber('position') - 1, 1)
            queue.clear();
            for (let i = 0; i < tracks.length; i++) {
                queue.addTrack(tracks[i]);
              }       
            }
        catch(e) {
            return interaction.reply(`Either you did something stupid, or I did something stoopid, here's the stoopid: \n \`\`\`${e}\`\`\``)
        }
        return interaction.reply('The track has been removed!')
    }}