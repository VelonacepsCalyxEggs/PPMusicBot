import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, CommandInteraction, Client } from 'discord.js';
import { QueryType, useQueue } from 'discord-player';

export const command = {
    data: new SlashCommandBuilder()
        .setName('move')
        .setDescription('moves the track from one index to another index.')
        .addNumberOption(option =>
            option.setName('index')
                .setDescription('index')
                .setRequired(true)
        )
        .addNumberOption(option =>
            option.setName('position')
                .setDescription('index')
                .setRequired(true)
        ),
    execute: async ({ client, interaction }: { client: Client; interaction: CommandInteraction }) => {
        if (!interaction.guild || !interaction.guildId)return interaction.followUp('You need to be in a guild.');
        const queue = useQueue(interaction.guild);
        if (!queue) {
            return interaction.reply('There is no queue to move music.');
        }
        if (!queue.size) {
            return interaction.reply('There are no songs in the queue to move.');
        }
        queue.moveTrack(Number(interaction.options.get('index')?.value) - 1, Number(interaction.options.get('position')?.value) - 1);
        return interaction.reply('The track has been moved!');
    }
};
