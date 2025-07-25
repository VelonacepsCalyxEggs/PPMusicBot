import { SlashCommandBuilder } from '@discordjs/builders';
import { Client, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import CommandInterface from '../types/commandInterface';

export default class WhereAmICommand extends CommandInterface {
    public static readonly commandName = 'whereami';
    data = new SlashCommandBuilder()
        .setName(WhereAmICommand.commandName)
        .setDescription('Returns all servers the bot is currently in.')
    execute = async ({ client, interaction }: { client: Client; interaction: ChatInputCommandInteraction }) => {
        await interaction.deferReply({ flags: ['Ephemeral'] });

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
