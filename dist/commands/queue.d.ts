import { CommandInteraction, Client, Message } from 'discord.js';
export declare const command: {
    data: import("discord.js").SlashCommandOptionsOnlyBuilder;
    execute: ({ client, interaction }: {
        client: Client;
        interaction: CommandInteraction;
    }) => Promise<Message<boolean> | import("discord.js").InteractionResponse<boolean> | undefined>;
};
