import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, CommandInteraction } from 'discord.js';
import { useQueue } from 'discord-player';

export const command = {
    data: new SlashCommandBuilder()
        .setName('re-add')
        .setDescription('Adds the current song to the queue.')
        .addBooleanOption(option =>
            option.setName('now')
                .setDescription('add it to the beggining?')
                .setRequired(false)
        ),

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

        // Add the current song
        queue.addTrack(currentSong);
        if (Boolean(interaction.options.get('now')?.value)) {
            queue.moveTrack(queue.size - 1, 0)
        }

        // Create an embed to inform the user
        const embed = new EmbedBuilder()
            .setDescription(`${currentSong.title} has been re-added!`)
            .setThumbnail(currentSong.thumbnail);

        return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
    }
};
