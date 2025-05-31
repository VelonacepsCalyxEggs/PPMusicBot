import { EmbedBuilder } from "discord.js";

export const createEmbedUtil = (description: string, thumbnail: string, footer: string | null): EmbedBuilder => {
    const embed = new EmbedBuilder()
        .setDescription(description)
        .setThumbnail(thumbnail);
    if (footer) {
        embed.setFooter({ text: footer });
    }
    return embed;
};