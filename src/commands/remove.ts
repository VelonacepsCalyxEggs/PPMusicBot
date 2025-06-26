import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, CommandInteraction, Client } from 'discord.js';
import { useQueue, GuildQueue } from 'discord-player';
import commandInterface from '../types/commandInterface';

export default class removeCommand extends commandInterface {
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
    execute = async ({ client, interaction }: { client: Client; interaction: CommandInteraction }) => {
        if (!interaction.guild || !interaction.guildId)return interaction.followUp({ content: 'You need to be in a guild.', flags: ['Ephemeral'] });
        const queue = useQueue(interaction.guild);
        if (!queue) {
            return interaction.reply({ content: 'There is no queue!', flags: ['Ephemeral'] });
        }
        if (!queue.size) {
            return interaction.reply({ content: 'There are no tracks in the queue!', flags: ['Ephemeral'] });
        }
        
        const tracks = queue.tracks.toArray();
        const position = interaction.options.get('position')?.value;
        const position2 = interaction.options.get('position2')?.value;
        
        if (!position2) {
            tracks.splice(Number(position) - 1, 1);
            queue.clear();
            for (let i = 0; i < tracks.length; i++) {
                queue.addTrack(tracks[i]);
            }
            return interaction.reply({ content: `The track at position ${position} has been removed!`, flags: ['SuppressNotifications'] });
        } else {
            tracks.splice(Number(position)- 1, Number(position2));
            queue.clear();
            for (let i = 0; i < tracks.length; i++) {
                queue.addTrack(tracks[i]);
            }
            return interaction.reply({ content: `The tracks from position ${position} to ${Number(position) + Number(position2) - 1} have been removed!`, flags: ['SuppressNotifications'] });
        }
    }
};
