import { SlashCommandBuilder } from '@discordjs/builders';
import { Client, ChatInputCommandInteraction } from 'discord.js';
import { useQueue } from 'discord-player';
import CommandInterface from '../types/commandInterface';
import commandPreRunCheckUtil from '../utils/commandPreRunCheckUtil';

export default class RemoveCommand extends CommandInterface {
    data = new SlashCommandBuilder()
        .setName('remove')
        .setDescription('removes the track with an index.')
        .addNumberOption(option =>
            option.setName('position')
                .setDescription('index')
                .setRequired(true)
        )
        .addNumberOption(option =>
            option.setName('position2')
                .setDescription('index 2')
                .setRequired(false)
        )
    execute = async ({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) => {
        if (!interaction.guild || !interaction.guildId)return interaction.followUp({ content: 'You need to be in a guild.', flags: ['Ephemeral'] });
        const queue = useQueue(interaction.guild);
        if (!commandPreRunCheckUtil(interaction, queue)) return;
        const tracks = queue!.tracks.toArray();
        const position = interaction.options.getNumber('position') as number;
        const position2 = interaction.options.getNumber('position2');
        
        if (!position2) {
            tracks.splice(position, 1);
            queue!.clear();
            for (const track of tracks) {
                queue!.addTrack(track);
            }
            return interaction.reply({ content: `The track at position ${position} has been removed!`, flags: ['SuppressNotifications'] });
        } else {
            tracks.splice(position, position2);
            queue!.clear();
            for (const track of tracks) {
                queue!.addTrack(track);
            }
            return interaction.reply({ content: `The tracks from position ${position} to ${position2} have been removed!`, flags: ['SuppressNotifications'] });
        }
    }
};
