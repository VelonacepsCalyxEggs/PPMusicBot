import { SlashCommandBuilder, ChatInputCommandInteraction, Message, InteractionResponse, Client } from "discord.js";
import { SlashCommandSubcommandsOnlyBuilder, SlashCommandOptionsOnlyBuilder } from "@discordjs/builders";
import { Player } from "discord-player";

export default abstract class CommandInterface {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder;
    execute: ({ client, player, interaction }: {
        client?: Client;
        player?: Player;
        interaction: ChatInputCommandInteraction;
    }) => Promise<void | InteractionResponse<boolean> | Message<any>>;
}