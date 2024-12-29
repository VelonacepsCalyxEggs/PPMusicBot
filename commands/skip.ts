import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, CommandInteraction } from 'discord.js';
import { useQueue } from 'discord-player';

export const command = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the current song'),

    execute: async ({ client, interaction }: { client: any; interaction: CommandInteraction }) => {
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

        // Skip the current song
        queue.node.skip();
        
        // Create an embed to inform the user
        const embed = new EmbedBuilder()
            .setDescription(`${currentSong.title} has been skipped!`)
            .setThumbnail(currentSong.thumbnail);

        return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
    }
};
