import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, CommandInteraction } from 'discord.js';
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
    execute = async ({ client, interaction }: { client: any; interaction: CommandInteraction }) => {
        if (!interaction.guild || !interaction.guildId)return interaction.followUp('You need to be in a guild.');
        const queue = useQueue(interaction.guild);
        if (!queue) {
            return interaction.reply('There is no queue to remove music.');
        }
        if (!queue.size) {
            return interaction.reply('There are no songs in the queue to remove.');
        }
        
        const tracks = queue.tracks.toArray();
        const position = interaction.options.get('position')?.value;
        const position2 = interaction.options.get('position2')?.value;
        
        if (position) {
            if (!position2) {
                tracks.splice(Number(position) - 1, 1);
                queue.clear();
                for (let i = 0; i < tracks.length; i++) {
                    queue.addTrack(tracks[i]);
                }
                return interaction.reply('The track has been removed!');
            } else {
                tracks.splice(Number(position)- 1, Number(position2));
                queue.clear();
                for (let i = 0; i < tracks.length; i++) {
                    queue.addTrack(tracks[i]);
                }
                return interaction.reply(`The tracks from ${position} to ${position2} have been removed!`);
            }
        }

        return interaction.reply('An error occurred while removing tracks.');
    }
};
