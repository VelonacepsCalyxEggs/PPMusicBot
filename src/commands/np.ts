import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { Track, useQueue } from 'discord-player';
import CommandInterface from '../types/commandInterface';
import formatDuration from '../utils/formatDurationUtil';
import TrackMetadata from '../types/trackMetadata';
import commandPreRunCheckUtil from '../utils/commandPreRunCheckUtil';

export default class NowPlayingCommand extends CommandInterface {
    data = new SlashCommandBuilder()
        .setName('np')
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
            console.log(`Track started at: ${metadata.startedPlaying.toISOString()}, elapsed: ${elapsedTime}ms`);
        } else {
            // Fallback if startedPlaying is not available
            console.log('No startedPlaying timestamp available');
        }

        // Check if this is a database track or a regular track
        const isFromDatabase = !!metadata.scoredTrack;
        
        // Get track information based on source
        let trackTitle: string;
        let artistName: string;
        let durationMs: number;
        let sourceUrl: string;
        let thumbnailUrl: string;
        let albumName: string | null = null;

        if (isFromDatabase) {
            // Database track - use scoredTrack data
            const dbTrack = metadata.scoredTrack!;
            trackTitle = dbTrack.title;
            artistName = dbTrack.artist?.name || 'Unknown Artist';
            durationMs = dbTrack.duration * 1000; // Convert seconds to milliseconds
            sourceUrl = `https://www.funckenobi42.space/music/tracks/${dbTrack.id}`;
            thumbnailUrl = dbTrack.album?.pathToCoverArt 
                ? `https://www.funckenobi42.space/images/AlbumCoverArt/${dbTrack.album.pathToCoverArt}`
                : 'https://upload.wikimedia.org/wikipedia/commons/2/2a/ITunes_12.2_logo.png';
            albumName = dbTrack.album?.name || null;
        } else {
            // Regular track - use currentTrack data
            trackTitle = currentTrack.title;
            artistName = currentTrack.author;
            durationMs = metadata.duration_ms || 0;
            sourceUrl = currentTrack.url;
            thumbnailUrl = currentTrack.thumbnail || 'https://upload.wikimedia.org/wikipedia/commons/2/2a/ITunes_12.2_logo.png';
        }

        console.log(`Track duration (ms): ${durationMs}`);
        
        // Calculate the current position (capped at track duration)
        const currentPosition = Math.min(elapsedTime, durationMs);
        const currentPositionFormatted = formatDuration(currentPosition);
        console.log(`Current position: ${currentPosition}ms, formatted: ${currentPositionFormatted}`);

        // Format the full duration
        const fullDuration = formatDuration(durationMs);

        // Create the embed
        const embed = new EmbedBuilder()
            .setDescription(`Currently playing: **${trackTitle}** by **${artistName}** from [${albumName || 'Source'}](${sourceUrl})`)
            .setThumbnail(thumbnailUrl)
            .setFooter({
                text: `Elapsed time: ${currentPositionFormatted} / ${fullDuration}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        // Reply with the embed
        return interaction.reply({ flags: 'Ephemeral', embeds: [embed] }).catch(console.error);
    }
};
