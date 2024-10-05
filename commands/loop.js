const { SlashCommandBuilder } = require("@discordjs/builders");
const { useQueue, GuildQueuePlayerNode, QueueRepeatMode } = require("discord-player");
const { EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("loop")
        .setDescription("Loops with the given mode.")
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Loop mode.')
                .setRequired(false)
                .addChoices(
                    { name: 'Queue', value: '1' },
                    { name: 'Track', value: '2' },
                    { name: 'Off', value: '3' }
                )),
    execute: async ({ client, interaction }) => {
        // Get the queue for the server
        const queue = useQueue(interaction.guildId);

        // If there is no queue, return
        if (!queue) {
            await interaction.reply("There is no queue.");
            return;
        }

        if (!queue.currentTrack) {
            await interaction.reply("There are no songs playing.");
            return;
        }
        let repeatModeString = '';
        const repeatModeUser = interaction.options.getString('mode');
        if (repeatModeUser == '1') {
            queue.setRepeatMode(QueueRepeatMode.QUEUE)
            repeatModeString = 'QUEUE'
        }
        else if (repeatModeUser == '2') {
            queue.setRepeatMode(QueueRepeatMode.TRACK)
            repeatModeString = 'TRACK'
        }
        else if (repeatModeUser == '3') {
            queue.setRepeatMode(QueueRepeatMode.OFF)
            repeatModeString = 'OFF'
        }
        else {
            return interaction.reply('What?')
        }
        // Create the embed
        let embed = new EmbedBuilder();
        embed
            .setDescription(`Current looping mode is now ${repeatModeString}`)

        // Reply with the embed
        return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
    },
};
