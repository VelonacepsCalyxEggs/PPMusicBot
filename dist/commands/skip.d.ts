import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
export declare const command: {
    data: SlashCommandBuilder;
    execute: ({ client, interaction }: {
        client: any;
        interaction: CommandInteraction;
    }) => Promise<void | import("discord.js").Message<boolean> | import("discord.js").InteractionResponse<boolean>>;
};
