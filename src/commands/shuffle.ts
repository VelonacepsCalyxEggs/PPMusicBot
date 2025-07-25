import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
import { Track, useQueue } from 'discord-player';
import CommandInterface from '../types/commandInterface';
import commandPreRunCheckUtil from '../utils/commandPreRunCheckUtil';

export default class ShuffleCommand extends CommandInterface {
    public static readonly commandName = 'shuffle';
    data = new SlashCommandBuilder()
        .setName(ShuffleCommand.commandName)
        .setDescription('Shuffles the playlist')
        .addStringOption(option =>
            option.setName('algorithm')
                .setDescription('Shuffle algorithm.')
                .setRequired(false)
                .addChoices(
                    { name: 'Fisher-Yates', value: 'Fisher-Yates' },
                    { name: 'Durstenfeld', value: 'Durstenfeld' },
                    { name: 'Sattolo', value: 'Sattolo' },
                ))
    execute = async ({ interaction }: { interaction: ChatInputCommandInteraction }) => {
        if (!interaction.guild || !interaction.guildId)return interaction.followUp({ content: 'You need to be in a guild.', flags: ['Ephemeral'] });
        const queue = useQueue(interaction.guild);
        if (!commandPreRunCheckUtil(interaction, queue)) return;

        const shuffleAlgorithm = interaction.options.get('algorithm')?.value || 'fy';
        const tracks = queue!.tracks.toArray();

        // Shuffle based on the selected algorithm
        switch (shuffleAlgorithm) {
            case 'Fisher-Yates': // Fisher-Yates (Knuth) shuffle
                this.fisherYatesShuffle(tracks);
                break;
            case 'Durstenfeld': // Durstenfeld shuffle
                this.durstenfeldShuffle(tracks);
                break;
            case 'Sattolo': // Sattolo's algorithm
                this.sattoloShuffle(tracks);
                break;
            default:
                this.fisherYatesShuffle(tracks);
                break;
        }

        

        queue!.clear();
        tracks.forEach(track => queue!.addTrack(track));
        return interaction.reply({
            content: `The queue has been shuffled using ${shuffleAlgorithm} algorithm!`,
            flags: ['SuppressNotifications']
        });
    }

    private fisherYatesShuffle(tracks: Track<unknown>[]) {
            for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
                }
    }

    private durstenfeldShuffle(tracks: Track<unknown>[]) {
            for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    const temp = tracks[i];
                    tracks[i] = tracks[j];
                    tracks[j] = temp;
                }
    }

    private sattoloShuffle(tracks: Track<unknown>[]) {
            for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * i);
                    const temp = tracks[i];
                    tracks[i] = tracks[j];
                    tracks[j] = temp;
                }
    }
};
