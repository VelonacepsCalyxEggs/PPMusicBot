import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, CommandInteraction, Client } from 'discord.js';
import { Track, useQueue } from 'discord-player';
import { start } from 'repl';
import commandInterface from '../types/commandInterface';
import { ExtendedTrack } from '../types/extendedTrackInterface';

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
        if (!startedPlaying || !(startedPlaying instanceof Date)) return interaction.followUp('Could not calculate dates.')
        console.log(`[${new Date().toISOString()}] [Started Playing: ${startedPlaying}]`);
        const elapsedTime = new Date().getTime() - startedPlaying.getTime(); // in milliseconds

        // Convert the duration string to milliseconds
        const durationParts = currentSong.duration.split(':').reverse();
        const durationMs = durationParts.reduce((total, part, index) => {
            return total + parseInt(part, 10) * Math.pow(60, index) * 1000;
        }, 0);

        // Calculate the current position
        const currentPosition = Math.min(elapsedTime, durationMs);

        // Format the current position
        const currentPositionFormatted = this.formatDuration(currentPosition);
        // Create the embed
        const embed = new EmbedBuilder()
            .setDescription(`Currently playing: **${currentSong.title}** by **${currentSong.author}** from [source](${currentSong.url})`)
            .setThumbnail(currentSong.thumbnail)
            .setFooter({
                text: `Elapsed time: ${currentPositionFormatted} / ${currentSong.duration}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        // Reply with the embed
        return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
    }
    // Function to format duration to match the song's duration format
    private formatDuration(durationMs: number): string {
        const seconds = Math.floor((durationMs / 1000) % 60);
        const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
        const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24);

        const secondsFormatted = seconds < 10 ? '0' + seconds : seconds;
        const minutesFormatted = minutes < 10 ? '0' + minutes : minutes;

        if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
            return "∞";
        }

        let result = `${minutes}:${secondsFormatted}`;
        if (hours > 0) {
            result = `${hours}:${minutesFormatted}:${secondsFormatted}`;
        }
        return result;
    }
};
