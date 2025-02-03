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

        queue.delete();
        console.log('Managed to delete a queue like a normal person.');
        
        // Create an embed to inform the user
        const embed = new EmbedBuilder()
            .setDescription(`Left the channel!`)

        return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
    }
};
