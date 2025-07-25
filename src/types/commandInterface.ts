import { SlashCommandBuilder, ChatInputCommandInteraction, Message, InteractionResponse, Client } from "discord.js";
import { SlashCommandSubcommandsOnlyBuilder, SlashCommandOptionsOnlyBuilder } from "@discordjs/builders";
import { Player } from "discord-player";

export default abstract class CommandInterface {
    // Outside the uninitialized data field, so we can access it before initialization.
    public static readonly commandName: string;
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder;
    execute: ({ client, player, interaction }: {
        client?: Client;
        player?: Player;
        interaction: ChatInputCommandInteraction;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) => Promise<void | InteractionResponse<boolean> | Message<any>>;
}