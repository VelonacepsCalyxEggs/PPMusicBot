import { SlashCommandBuilder } from '@discordjs/builders';
import { Client, CommandInteraction } from 'discord.js';
export declare const command: {
    data: SlashCommandBuilder;
    execute: ({ client, interaction }: {
        client: Client;
        interaction: CommandInteraction;
    }) => Promise<void>;
};
