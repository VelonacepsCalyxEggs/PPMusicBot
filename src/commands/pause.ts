import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, CommandInteraction } from 'discord.js';
import { useQueue } from 'discord-player';
import commandInterface from 'src/types/commandInterface';
 
export default class pauseCommand extends commandInterface {
    data = new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pauses the playback. Use again to unpause.')


    execute = async ({ client, interaction }: { client: any; interaction: CommandInteraction }) => {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId)return interaction.followUp('You need to be in a guild.');
        const queue = useQueue(interaction.guild);

        // If there is no queue, return
        if (!queue) {
            await interaction.reply('There is no queue!');
            return;
        }
        // Create an embed to inform the user
        const embed = new EmbedBuilder()

        // Add the current song
        if (queue.node.isPaused()) {
            queue.node.resume();
            embed.setDescription(`You have unpaused the queue!`);
        } else {
            queue.node.pause();
            embed.setDescription(`You have paused the queue!`);
        }

        return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
    }
};
