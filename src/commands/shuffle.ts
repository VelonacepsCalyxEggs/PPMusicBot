import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
import { useQueue } from 'discord-player';
import CommandInterface from '../types/commandInterface';
import commandPreRunCheckUtil from '../utils/commandPreRunCheckUtil';
import ShuffleUtil from '../utils/shuffleUtil';

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
        let tracks = queue!.tracks.toArray();

        // Shuffle based on the selected algorithm
        switch (shuffleAlgorithm) {
            case 'Fisher-Yates': // Fisher-Yates (Knuth) shuffle
                tracks = ShuffleUtil.fisherYatesShuffle(tracks);
                break;
            case 'Durstenfeld': // Durstenfeld shuffle
                tracks = ShuffleUtil.durstenfeldShuffle(tracks);
                break;
            case 'Sattolo': // Sattolo's algorithm
                tracks = ShuffleUtil.sattoloShuffle(tracks);
                break;
            default:
                tracks = ShuffleUtil.fisherYatesShuffle(tracks);
                break;
        }

        

        queue!.clear();
        tracks.forEach(track => queue!.addTrack(track));
        return interaction.reply({
            content: `The queue has been shuffled using ${shuffleAlgorithm} algorithm!`,
            flags: ['SuppressNotifications']
        });
    }
};
