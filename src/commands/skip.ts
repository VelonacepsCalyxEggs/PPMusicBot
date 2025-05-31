import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, CommandInteraction } from 'discord.js';
import { useQueue } from 'discord-player';
import commandInterface from '../types/commandInterface';
import { ScoredTrack } from '../types/searchResultInterface';

export default class skipCommand extends commandInterface {
    data = new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the current song')
    execute = async ({ client, interaction }: { client: any; interaction: CommandInteraction }) => {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId)return interaction.followUp('You need to be in a guild.');
        const queue = useQueue(interaction.guild);

        // If there is no queue, return
        if (!queue) {
            await interaction.reply('There is no queue!');
            return;
        } 
        const currentSong = queue.currentTrack;
        if (!currentSong) return interaction.followUp('No song is currently playing.');
        
        // Check if track has metadata
        const hasMetadata = currentSong.metadata && (currentSong.metadata as ScoredTrack);
        const title = hasMetadata ? (currentSong.metadata as ScoredTrack).title || currentSong.title : currentSong.title;
        // For thumbnail, check if there's path to cover art in metadata
        const thumbnail = hasMetadata && (currentSong.metadata as ScoredTrack).album?.pathToCoverArt
            ? `https://www.funckenobi42.space/images/AlbumCoverArt/${(currentSong.metadata as ScoredTrack).album.pathToCoverArt}`
            : currentSong.thumbnail;
        
        // Skip the current song
        queue.node.skip();
        
        // Create an embed to inform the user with metadata-aware properties
        const embed = new EmbedBuilder()
            .setDescription(`${title} has been skipped!`)
            .setThumbnail(thumbnail);

        return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
    }
};
