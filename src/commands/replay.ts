import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, CommandInteraction } from 'discord.js';
import { useQueue } from 'discord-player';
import commandInterface from '../types/commandInterface';

export default class replayCommand extends commandInterface {
    data = new SlashCommandBuilder()
        .setName('replay')
        .setDescription('Skips the current song and plays it again.')

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
        if (!currentSong) return interaction.reply('No song is currently playing.');

        // Add the current song and skip the current song.
        queue.addTrack(currentSong);
        queue.moveTrack(queue.size - 1, 0);
        queue.node.skip();
        
        // Create an embed to inform the user
        const embed = new EmbedBuilder()
            .setDescription(`${currentSong.title} has been skipped and replayed!`)
            .setThumbnail(currentSong.thumbnail);

        return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
    }
};
