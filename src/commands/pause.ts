import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, CommandInteraction } from 'discord.js';
import { useQueue } from 'discord-player';
import CommandInterface from '../types/commandInterface';
 
export default class PauseCommand extends CommandInterface {
    data = new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pauses the playback. Use again to unpause.')


    execute = async ({ client, interaction }: { client: any; interaction: CommandInteraction }) => {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId)return interaction.followUp({ content: 'You need to be in a guild.', flags: ['Ephemeral'] });
        const queue = useQueue(interaction.guild);

        // If there is no queue, return
        if (!queue) {
            await interaction.reply({ content: 'There is no queue!', flags: ['Ephemeral'] });
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

        return interaction.reply({ flags: 'SuppressNotifications', embeds: [embed] }).catch(console.error);
    }
};
