import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, CommandInteraction, Client } from 'discord.js';
import { Track, useQueue } from 'discord-player';
import { start } from 'repl';
import commandInterface from '../types/commandInterface';
import { ExtendedTrack } from '../types/extendedTrackInterface';
import { ScoredTrack } from '../types/searchResultInterface';
import formatDuration from '../utils/formatDurationUtil';

export default class nowPlayingCommand extends commandInterface {
    data = new SlashCommandBuilder()
        .setName('np')
        .setDescription('Gets the currently playing song.')

    execute = async ({ client, interaction }: { client: Client; interaction: CommandInteraction }) => {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId)return interaction.followUp('You need to be in a guild.');
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

        const currentSong = (queue.currentTrack as ExtendedTrack<unknown>);

        // Calculate the elapsed time
        const startedPlaying = currentSong.startedPlaying;
        if (!startedPlaying || !(startedPlaying instanceof Date)) return interaction.reply('Could not calculate dates.')
        console.log(`[${new Date().toISOString()}] [Started Playing: ${startedPlaying}]`);
        const elapsedTime = new Date().getTime() - startedPlaying.getTime(); // in milliseconds
        let durationMs;
        let durationParts: string[] = [];
        // Convert the duration string to milliseconds
        if (currentSong.metadata && typeof (currentSong.metadata as ScoredTrack).duration !== 'undefined') {
           durationMs = (currentSong.metadata as ScoredTrack).duration * 1000;
        }
        else {
            durationParts = currentSong.duration.split(':').reverse();
            durationMs = durationParts.reduce((total, part, index) => {
                return total + parseInt(part, 10) * Math.pow(60, index) * 1000;
            }, 0);
        }

        // Calculate the current position
        const currentPosition = Math.min(elapsedTime, durationMs);

        // Format the current position
        const currentPositionFormatted = formatDuration(currentPosition);
        // Create the embed
        const embed = new EmbedBuilder()
            .setDescription(`Currently playing: **${(currentSong.metadata as ScoredTrack).title ?? currentSong.title}** by **${(currentSong.metadata as ScoredTrack).artist.name ?? currentSong.author}** from [source](${
                currentSong.metadata && (currentSong.metadata as ScoredTrack).id
                    ? 'https://www.funckenobi42.space/music/tracks/' + (currentSong.metadata as ScoredTrack).id
                    : currentSong.url
            })`)
            .setThumbnail(
                currentSong.metadata && 
                (currentSong.metadata as ScoredTrack).album && 
                (currentSong.metadata as ScoredTrack).album.pathToCoverArt
                    ? 'https://www.funckenobi42.space/images/AlbumCoverArt/' + (currentSong.metadata as ScoredTrack).album.pathToCoverArt
                    : currentSong.thumbnail || 'https://upload.wikimedia.org/wikipedia/commons/2/2a/ITunes_12.2_logo.png'
            )
            .setFooter({
                text: `Elapsed time: ${currentPositionFormatted} / ${
                    currentSong.metadata && 
                    typeof (currentSong.metadata as ScoredTrack).duration !== 'undefined' 
                        ? formatDuration((currentSong.metadata as ScoredTrack).duration * 1000) 
                        : currentSong.duration
                }`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        // Reply with the embed
        return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
    }
};
