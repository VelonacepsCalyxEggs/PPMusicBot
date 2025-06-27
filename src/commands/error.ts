import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, CommandInteraction } from 'discord.js';
import { useQueue } from 'discord-player';
import commandInterface from '../types/commandInterface';

export default class errorCommand extends commandInterface {
    data = new SlashCommandBuilder()
        .setName('error')
        .setDescription('A debug command, that throws a fatal error to test the error handling system.');

    execute = async ({ interaction }: { interaction: CommandInteraction }) : Promise<void | import('discord.js').InteractionResponse | import('discord.js').Message> => {
        throw new Error('This is a test error for debugging purposes.');
    }
};
