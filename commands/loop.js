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
        const repeatDict = {
            0: 'Off',
            1: 'Track',
            2: 'Queue',
        }
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

            return interaction.reply(`Current looping mode is ${repeatDict[queue.repeatMode]}.`)
        }

        // Create the embed
        let embed = new EmbedBuilder();
        embed
            .setDescription(`Current looping mode is now ${repeatModeString}`)

        // Reply with the embed
        return interaction.reply({ ephemeral: false, embeds: [embed] }).catch(console.error);
    },
};
