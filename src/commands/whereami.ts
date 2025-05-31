import { SlashCommandBuilder } from '@discordjs/builders';
import { Client, CommandInteraction, EmbedBuilder } from 'discord.js';
import commandInterface from 'src/types/commandInterface';

export default class whereAmICommand extends commandInterface {
    data = new SlashCommandBuilder()
        .setName('whereami')
        .setDescription('Returns all servers the bot is currently in.')
    execute = async ({ client, interaction }: { client: Client; interaction: CommandInteraction }) => {
        await interaction.deferReply({ ephemeral: true });

        const guildIds = client.guilds.cache.map(guild => guild.id);
        let guildInfoString = '';
        let i = 1;

        for (const guildId of guildIds) {
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                const owner = await guild.fetchOwner(); // Fetch the owner
                guildInfoString += `${i}. ${guild.name} - Owner: <@${owner.user.id}>\n`; // Use user tag and ID
                i++;
            }
        }

        const embed = new EmbedBuilder()
            .setDescription(`Guilds I am in:\n${guildInfoString}`)
            .setFooter({
                text: interaction.user.tag,
                iconURL: interaction.user.displayAvatarURL(),
            });

        await interaction.editReply({ embeds: [embed] });
    }
};
