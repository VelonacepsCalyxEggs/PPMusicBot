import { CommandInteraction, Message } from 'discord.js';
import { GuildQueue, Player } from 'discord-player';
declare const handleFromDbCommand: (player: Player, interaction: CommandInteraction, guildQueue: GuildQueue) => Promise<Message<boolean>>;
export { handleFromDbCommand };
export declare const command: {
    data: import("discord.js").SlashCommandSubcommandsOnlyBuilder;
    execute: ({ client, interaction }: {
        client: Player;
        interaction: CommandInteraction;
    }) => Promise<Message<boolean> | import("discord.js").InteractionResponse<boolean> | undefined>;
};
