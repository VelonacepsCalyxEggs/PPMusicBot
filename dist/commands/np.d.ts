import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, Client } from 'discord.js';
export declare const command: {
    data: SlashCommandBuilder;
    execute: ({ client, interaction }: {
        client: Client;
        interaction: CommandInteraction;
    }) => Promise<void | import("discord.js").Message<boolean> | import("discord.js").InteractionResponse<boolean>>;
};
