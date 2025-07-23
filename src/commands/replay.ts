import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { useQueue } from 'discord-player';
import CommandInterface from '../types/commandInterface';

export default class ReplayCommand extends CommandInterface {
    data = new SlashCommandBuilder()
        .setName('replay')
        .setDescription('Skips the current song and plays it again.')

    execute = async ({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) => {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId)return interaction.followUp({ content: 'You need to be in a guild.', flags: ['Ephemeral'] });
        const queue = useQueue(interaction.guild);

        // If there is no queue, return
        if (!queue) {
            await interaction.reply({ content: 'There is no queue!', flags: ['Ephemeral'] });
            return;
        }
        
        const currentSong = queue.currentTrack;
        if (!currentSong) return interaction.reply({ content: 'No song is currently playing.', flags: ['Ephemeral'] });

        // Add the current song and skip the current song.
        queue.addTrack(currentSong);
        queue.moveTrack(queue.size - 1, 0);
        queue.node.skip();
        
        // Create an embed to inform the user
        const embed = new EmbedBuilder()
            .setDescription(`${currentSong.title} has been skipped and replayed!`)
            .setThumbnail(currentSong.thumbnail);

        return interaction.reply({ flags: ['SuppressNotifications'], embeds: [embed] })
    }
};
