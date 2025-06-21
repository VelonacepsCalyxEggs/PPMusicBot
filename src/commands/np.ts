import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, CommandInteraction, Client } from 'discord.js';
import { Track, useQueue } from 'discord-player';
import commandInterface from '../types/commandInterface';
import formatDuration from '../utils/formatDurationUtil';
import TrackMetadata from '../types/trackMetadata';

export default class nowPlayingCommand extends commandInterface {
    data = new SlashCommandBuilder()
        .setName('np')
        .setDescription('Gets the currently playing song.')

    execute = async ({ client, interaction }: { client: Client; interaction: CommandInteraction }) => {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId) return interaction.followUp('You need to be in a guild.');
        const queue = useQueue(interaction.guild);

        // If there is no queue, return
        if (!queue) {
            await interaction.reply('There is no queue.');
            return;
        }

        if (!queue.currentTrack) {
            await interaction.reply('There are no songs playing.');
            return;
        }

        const currentTrack = queue.currentTrack as Track<TrackMetadata>;
        const metadata = currentTrack.metadata;

        if (!metadata) {
            return interaction.reply('Missing track metadata.');
        }

        // Calculate elapsed time based on when the track started playing
        let elapsedTime = 0;
        console.log(`------------------------------------------------------------------------------`);
        if (metadata.startedPlaying instanceof Date) {
            elapsedTime = new Date().getTime() - metadata.startedPlaying.getTime();
            console.log(`Track started at: ${metadata.startedPlaying.toISOString()}, elapsed: ${elapsedTime}ms`);
        } else {
            // Fallback if startedPlaying is not available
            console.log('No startedPlaying timestamp available');
        }
        
        // Get track duration in milliseconds
        let durationMs: number = (metadata.scoredTrack?.duration !== undefined
            ? metadata.scoredTrack.duration * 1000
            : (metadata.duration_ms || 0));
        console.log(`Track duration (ms): ${durationMs}`);
        // Calculate the current position (capped at track duration)
        const currentPosition = Math.min(elapsedTime, durationMs);
        const currentPositionFormatted = formatDuration(currentPosition);
        console.log(`Current position: ${currentPosition}ms, formatted: ${currentPositionFormatted}`);

        // Format the full duration
        const fullDuration = formatDuration(durationMs);

        // Get artist name
        const artistName = metadata.scoredTrack?.artist?.name ?? currentTrack.author;

        // Get track source URL
        const sourceUrl = metadata.scoredTrack?.id
            ? `https://www.funckenobi42.space/music/tracks/${metadata.scoredTrack?.id}`
            : currentTrack.url;

        // Get album cover
        const thumbnailUrl = metadata.scoredTrack?.album?.pathToCoverArt
            ? `https://www.funckenobi42.space/images/AlbumCoverArt/${metadata.scoredTrack?.album.pathToCoverArt}`
            : currentTrack.thumbnail || 'https://upload.wikimedia.org/wikipedia/commons/2/2a/ITunes_12.2_logo.png';

        // Create the embed
        const embed = new EmbedBuilder()
            .setDescription(`Currently playing: **${metadata.scoredTrack?.title ?? currentTrack.title}** by **${artistName}** from [source](${sourceUrl})`)
            .setThumbnail(thumbnailUrl)
            .setFooter({
                text: `Elapsed time: ${currentPositionFormatted} / ${fullDuration}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        // Reply with the embed
        return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
    }
};
