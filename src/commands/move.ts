import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { QueryType, useQueue } from 'discord-player';
import CommandInterface from '../types/commandInterface';

export default class MoveCommand extends CommandInterface {
    data = new SlashCommandBuilder()
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
        )
    execute = async ({ client, interaction }: { client: Client; interaction: ChatInputCommandInteraction }) => {
        if (!interaction.guild || !interaction.guildId)return interaction.followUp({ content: 'You need to be in a guild.', flags: ['Ephemeral'] });
        const queue = useQueue(interaction.guild);
        if (!queue) {
            return interaction.reply({ content: 'There is no queue!', flags: ['Ephemeral'] });
        }
        if (!queue.size) {
            return interaction.reply({ content: 'There are no tracks in the queue!', flags: ['Ephemeral'] });
        }
        queue.moveTrack(Number(interaction.options.get('index')?.value) - 1, Number(interaction.options.get('position')?.value) - 1);
        return interaction.reply({
            flags: ['SuppressNotifications'], content: 'The track has been moved!',});
    }
};
