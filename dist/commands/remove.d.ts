import { CommandInteraction } from 'discord.js';
export declare const command: {
    data: import("discord.js").SlashCommandOptionsOnlyBuilder;
    execute: ({ client, interaction }: {
        client: any;
        interaction: CommandInteraction;
    }) => Promise<import("discord.js").Message<boolean> | import("discord.js").InteractionResponse<boolean>>;
};
