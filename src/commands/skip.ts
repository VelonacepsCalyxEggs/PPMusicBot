import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { useQueue, Track } from 'discord-player';
import CommandInterface from '../types/commandInterface';
import TrackMetadata from '../types/trackMetadata';
import { logError } from '../utils/loggerUtil';

export default class SkipCommand extends CommandInterface {
    data = new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the current song')
    execute = async ({ client, interaction }: { client: Client; interaction: ChatInputCommandInteraction }) => {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId) return interaction.reply({ content: 'You need to be in a guild.', flags: ['Ephemeral'] });
        const queue = useQueue(interaction.guild);

        // If there is no queue, return
        if (!queue) {
            await interaction.reply({ content: 'There is no queue!', flags: ['Ephemeral'] });
            return;
        } 
        const currentSong = queue.currentTrack as Track<TrackMetadata>;
        if (!currentSong) return interaction.reply({ content: 'No song is currently playing.', flags: ['Ephemeral'] });
        
        const metadata = currentSong.metadata;
        if (!metadata) {
            throw new Error('Missing track metadata.');
        }

        // Check if this is a database track or a regular track
        const isFromDatabase = !!metadata.scoredTrack;
        
        // Get track information based on source
        let title: string;
        let thumbnail: string;

        if (isFromDatabase) {
            // Database track - use scoredTrack data
            const dbTrack = metadata.scoredTrack!;
            title = dbTrack.title;
            thumbnail = dbTrack.album?.pathToCoverArt 
                ? `https://www.funckenobi42.space/images/AlbumCoverArt/${dbTrack.album.pathToCoverArt}`
                : 'https://upload.wikimedia.org/wikipedia/commons/2/2a/ITunes_12.2_logo.png';
        } else {
            // Regular track - use currentTrack data
            title = currentSong.title;
            thumbnail = currentSong.thumbnail || 'https://upload.wikimedia.org/wikipedia/commons/2/2a/ITunes_12.2_logo.png';
        }
        
        // Skip the current song
        try {
            queue.node.skip();
        } catch (error) {
            logError(error);
            return interaction.reply({ content: 'Failed to skip the current song.', flags: ['Ephemeral'] });
        }
        
        // Create an embed to inform the user with metadata-aware properties
        const embed = new EmbedBuilder()
            .setDescription(`${title} has been skipped!`)
            .setThumbnail(thumbnail);

        return interaction.reply({ flags: ['SuppressNotifications'], embeds: [embed] }).catch(console.error);
    }
};
