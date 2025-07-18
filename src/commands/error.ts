import { SlashCommandBuilder } from '@discordjs/builders';
import CommandInterface from '../types/commandInterface';

export default class ErrorCommand extends CommandInterface {
    data = new SlashCommandBuilder()
        .setName('error')
        .setDescription('A debug command, that throws a fatal error to test the error handling system.');

    execute = async () : Promise<void | import('discord.js').InteractionResponse | import('discord.js').Message> => {
        throw new Error('This is a test error for debugging purposes.');
    }
};
