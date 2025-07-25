import { SlashCommandBuilder } from '@discordjs/builders';
import CommandInterface from '../types/commandInterface';

export default class ErrorCommand extends CommandInterface {
    public static readonly commandName = 'error';
    data = new SlashCommandBuilder()
        .setName(ErrorCommand.commandName)
        .setDescription('A debug command, that throws a fatal error to test the error handling system.');

    execute = async () : Promise<void> => {
        throw new Error('This is a test error for debugging purposes.');
    }
};
