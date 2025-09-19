import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, ChatInputCommandInteraction, InteractionResponse, Message } from 'discord.js';
import { useQueue } from 'discord-player';
import CommandInterface from '../types/commandInterface';
import commandPreRunCheckUtil from '../utils/commandPreRunCheckUtil';

export default class LeaveCommand extends CommandInterface {
    public static readonly commandName = 'leave';
    data = new SlashCommandBuilder()
        .setName(LeaveCommand.commandName)
        .setDescription('Drops the queue and leaves from the channel.')

    execute = async ({ interaction }: { interaction: ChatInputCommandInteraction }) : Promise<void | InteractionResponse | Message> => {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId) {
            return interaction.followUp({content: 'You need to be in a guild.', flags: ['Ephemeral']});
        }
        const queue = useQueue(interaction.guild);

        if (!commandPreRunCheckUtil(interaction, queue, false)) return;

        queue!.delete();
        
        // Create an embed to inform the user
        const embed = new EmbedBuilder()
            .setDescription(`Left the channel!`);

        return interaction.reply({ flags: 'SuppressNotifications', embeds: [embed] })
    }
};
