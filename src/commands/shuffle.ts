import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import { useQueue } from 'discord-player';
import CommandInterface from '../types/commandInterface';

export default class ShuffleCommand extends CommandInterface {
    data = new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Shuffles the playlist')
        .addStringOption(option =>
            option.setName('algorithm')
                .setDescription('Shuffle algorithm.')
                .setRequired(false)
                .addChoices(
                    { name: 'Fisher-Yates', value: 'fy' },
                    { name: 'Durstenfeld', value: 'df' },
                    { name: 'Sattolo', value: 'st' },
                ))
    execute = async ({ interaction }: { interaction: CommandInteraction }) => {
        if (!interaction.guild || !interaction.guildId)return interaction.followUp({ content: 'You need to be in a guild.', flags: ['Ephemeral'] });
        const queue = useQueue(interaction.guild);
        if (!queue) {
            return interaction.reply({ content: 'There is no queue!', flags: ['Ephemeral'] });
        }
        if (!queue.size) {
            return interaction.reply({ content: 'There are no tracks in the queue to shuffle!', flags: ['Ephemeral'] });
        }

        const shuffleAlgorithm = interaction.options.get('algorithm')?.value || 'fy';
        const tracks = queue.tracks.toArray();

        // Shuffle based on the selected algorithm
        switch (shuffleAlgorithm) {
            case 'fy': // Fisher-Yates (Knuth) shuffle
                for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
                }
                break;
            case 'df': // Durstenfeld shuffle
                for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    const temp = tracks[i];
                    tracks[i] = tracks[j];
                    tracks[j] = temp;
                }
                break;
            case 'st': // Sattolo's algorithm
                for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * i);
                    const temp = tracks[i];
                    tracks[i] = tracks[j];
                    tracks[j] = temp;
                }
                break;
            default:
                for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
                }
        }

        queue.clear();
        tracks.forEach(track => queue.addTrack(track));
        return interaction.reply({
            content: `The queue has been shuffled using ${shuffleAlgorithm} algorithm!`,
            flags: ['SuppressNotifications']
        });
    }
};
