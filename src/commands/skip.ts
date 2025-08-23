import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { useQueue, Track } from 'discord-player';
import CommandInterface from '../types/commandInterface';
import TrackMetadata from '../types/trackMetadata';
import { logError } from '../utils/loggerUtil';
import commandPreRunCheckUtil from '../utils/commandPreRunCheckUtil';

export default class SkipCommand extends CommandInterface {
    public static readonly commandName = 'skip';
    data = new SlashCommandBuilder()
        .setName(SkipCommand.commandName)
        .setDescription('Skips the current song')
        .addNumberOption(option =>
            option.setName('amount')
            .setDescription('Number of songs to skip')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
    execute = async ({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) => {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId) return interaction.reply({ content: 'You need to be in a guild.', flags: ['Ephemeral'] });
        const queue = useQueue(interaction.guild);

        if (!commandPreRunCheckUtil(interaction, queue, false)) return;

        const currentSong = queue!.currentTrack as Track<TrackMetadata>;
        if (!currentSong) return interaction.reply({ content: 'No song is currently playing.', flags: ['Ephemeral'] });
        
        const amountToSkip = interaction.options.getNumber('amount');
        if (amountToSkip) {
            try {
            for (let i = 0; i < amountToSkip - 1; i++) {
                if (queue!.tracks.size > 0) {
                    queue!.node.skip();
                }
            }
            } catch (error) {
                logError(error);
                return interaction.reply({ content: 'Failed to skip multiple songs.', flags: ['Ephemeral'] });
            }
        }
        const metadata = currentSong.metadata;
        if (!metadata) {
            throw new Error('Missing track metadata.');
        }

        const currentTrack = queue!.currentTrack as Track<TrackMetadata>;
        
        // Skip the current song
        try {
            queue!.node.skip();
        } catch (error) {
            logError(error);
            return interaction.reply({ content: 'Failed to skip the current song.', flags: ['Ephemeral'] });
        }
        
        const embed = new EmbedBuilder()
            .setDescription(`${currentTrack.title} has been skipped!`)
            .setThumbnail(currentTrack.thumbnail);

        return interaction.reply({ flags: ['SuppressNotifications'], embeds: [embed] })
    }
};
