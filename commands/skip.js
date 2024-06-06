const { SlashCommandBuilder } = require("@discordjs/builders")
const { useQueue, GuildQueuePlayerNode } = require("discord-player")
const { EmbedBuilder } = require("discord.js");

module.exports = {
	data: new SlashCommandBuilder()
        .setName("skip")
        .setDescription("Skips the current song"),

	execute: async ({ client, interaction }) => {
        // Get the queue for the server
		const queue = useQueue(interaction.guildId);

        // If there is no queue, return
		if (!queue)
        {
            await interaction.reply("There are no songs in the queue");
            return;
        }

        const currentSong = queue.currentTrack
        queuePlayer = new GuildQueuePlayerNode(queue);

        // Skip the current song
		queuePlayer.skip()
        let embed = new EmbedBuilder();
        // Return an embed to the user saying the song has been skipped
        embed
            .setDescription(`${currentSong.title} has been skipped!`)
            .setThumbnail(currentSong.thumbnail)
        return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
	},
}
