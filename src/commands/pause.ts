import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { useQueue } from 'discord-player';
import CommandInterface from '../types/commandInterface';
import commandPreRunCheckUtil from '../utils/commandPreRunCheckUtil';
 
export default class PauseCommand extends CommandInterface {
    data = new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pauses the playback. Use again to unpause.')


    execute = async ({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) => {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId)return interaction.followUp({ content: 'You need to be in a guild.', flags: ['Ephemeral'] });
        const queue = useQueue(interaction.guild);

        if (!commandPreRunCheckUtil(interaction, queue)) return;
        // Create an embed to inform the user
        const embed = new EmbedBuilder()

        // Add the current song
        if (queue!.node.isPaused()) {
            queue!.node.resume();
            embed.setDescription(`You have unpaused the queue!`);
        } else {
            queue!.node.pause();
            embed.setDescription(`You have paused the queue!`);
        }

        return interaction.reply({ flags: 'SuppressNotifications', embeds: [embed] })
    }
};
