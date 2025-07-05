import { GuildQueue } from "discord-player/dist";
import { ChatInputCommandInteraction } from "discord.js";

export default function commandPreRunCheckUtil(interaction: ChatInputCommandInteraction, queue?: GuildQueue | null): boolean {

    // Check if the user is in a guild
    if (!interaction.guild) {
        interaction.reply({ content: 'You need to be in a guild to use this command.', flags: ['Ephemeral'] });
        return false;
    }

    if (queue && queue.size === 0) {
        interaction.reply({ content: 'The queue is empty.', flags: ['Ephemeral'] });
        return false;
    }

    return true;
}