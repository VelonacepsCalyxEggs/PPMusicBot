import { Client, CommandInteraction, Message } from 'discord.js';
import { GuildQueue, Player } from 'discord-player';
declare const handleFromDbCommand: (player: Player, interaction: CommandInteraction, guildQueue: GuildQueue) => Promise<Message<boolean> | undefined>;
export { handleFromDbCommand };
export declare const command: {
    data: import("discord.js").SlashCommandSubcommandsOnlyBuilder;
    execute: ({ player, interaction, client }: {
        player: Player | null;
        interaction: CommandInteraction;
        client: Client;
    }) => Promise<Message<boolean> | import("discord.js").InteractionResponse<boolean> | undefined>;
};
