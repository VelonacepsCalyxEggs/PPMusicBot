import { Client, CommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
export interface Command {
    data: SlashCommandBuilder;
    execute: ({ client, interaction }: {
        client: Client;
        interaction: CommandInteraction;
    }) => Promise<void>;
}
