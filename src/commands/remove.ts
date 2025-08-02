import { SlashCommandBuilder } from '@discordjs/builders';
import { Client, ChatInputCommandInteraction } from 'discord.js';
import { useQueue } from 'discord-player';
import CommandInterface from '../types/commandInterface';
import commandPreRunCheckUtil from '../utils/commandPreRunCheckUtil';

export default class RemoveCommand extends CommandInterface {
    public static readonly commandName = 'remove';
    data = new SlashCommandBuilder()
        .setName(RemoveCommand.commandName)
        .setDescription('Removes a track on a position or within a range.')
        .addNumberOption(option =>
            option.setName('position')
                .setDescription('Position from where to start removing tracks')
                .setRequired(true)
        )
        .addNumberOption(option =>
            option.setName('position2')
                .setDescription('Position from where to stop removing tracks')
                .setRequired(false)
        )
    execute = async ({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) => {
        if (!interaction.guild || !interaction.guildId)return interaction.followUp({ content: 'You need to be in a guild.', flags: ['Ephemeral'] });
        const queue = useQueue(interaction.guild);
        if (!commandPreRunCheckUtil(interaction, queue)) return;
        // Test with queue.tracks later
        const tracks = queue!.tracks.toArray();
        const position = interaction.options.getNumber('position') as number;
        const position2 = interaction.options.getNumber('position2');
        if (!position2) {
            queue!.removeTrack(tracks[position])
            return interaction.reply({ content: `The track at position ${position} has been removed!`, flags: ['SuppressNotifications'] });
        } else {
            tracks.slice(position, position2).forEach(track => {
                queue!.removeTrack(track);
            });
            return interaction.reply({ content: `The tracks from position ${position} to ${position2} have been removed!`, flags: ['SuppressNotifications'] });
        }
    }
};
