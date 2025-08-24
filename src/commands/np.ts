import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { Track, useQueue } from 'discord-player';
import CommandInterface from '../types/commandInterface';
import formatDuration from '../utils/formatDurationUtil';
import TrackMetadata from '../types/trackMetadata';
import commandPreRunCheckUtil from '../utils/commandPreRunCheckUtil';
import { commandLogger } from 'src/utils/loggerUtil';

export default class NowPlayingCommand extends CommandInterface {
    public static readonly commandName = 'np';
    data = new SlashCommandBuilder()
        .setName(NowPlayingCommand.commandName)
        .setDescription('Gets the currently playing song.')

    execute = async ({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) => {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId) return interaction.followUp('You need to be in a guild.');
        const queue = useQueue(interaction.guild);

        if (!commandPreRunCheckUtil(interaction, queue, false)) return;

        const currentTrack = queue!.currentTrack as Track<TrackMetadata>;
        const metadata = currentTrack.metadata;

        if (!metadata) {
            throw new Error('Missing track metadata.');
        }

        // Calculate elapsed time based on when the track started playing
        let elapsedTime = 0;
        if (metadata.startedPlaying instanceof Date) {
            elapsedTime = new Date().getTime() - metadata.startedPlaying.getTime();
        }
        const trackTitle = currentTrack.title;
        const artistName = currentTrack.author;
        const sourceUrl = currentTrack.url;
        const thumbnailUrl = currentTrack.thumbnail || 'https://upload.wikimedia.org/wikipedia/commons/2/2a/ITunes_12.2_logo.png';

        // Calculate the current position (capped at track duration)
        const currentPosition = Math.min(elapsedTime, currentTrack.durationMS || 0);
        const currentPositionFormatted = formatDuration(currentPosition);

        // Format the full duration
        const fullDuration = formatDuration(currentTrack.durationMS || 0);
        commandLogger.debug("Track length (ms): " + currentTrack.durationMS);

        const embed = new EmbedBuilder()
            .setDescription(`Currently playing: **${trackTitle}** by **${artistName}** from [${currentTrack.metadata.fromAlbum || 'Source'}](${sourceUrl})`)
            .setThumbnail(thumbnailUrl)
            .setFooter({
                text: `Elapsed time: ${currentPositionFormatted} / ${fullDuration}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        return interaction.reply({ flags: 'Ephemeral', embeds: [embed] })
    }
};
