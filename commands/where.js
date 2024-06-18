const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("whereami")
        .setDescription("Returns all servers the bot is currently in."),
    execute: async ({ client, interaction }) => {
        await interaction.deferReply({ ephemeral: true });

        const guild_ids = client.guilds.cache.map(guild => guild.id);
        let guildInfoString = ''
        let i = 1
        for (const guildId of guild_ids) {
            let guild = client.guilds.cache.get(guildId)
            let owner = await guild.fetchOwner(); // Fetch the owner
            guildInfoString += `${i}. ${guild.name} - Owner: <@${owner.user.id}>\n`; // Use user tag and ID
            i++;
        }

        const embed = new EmbedBuilder()
            .setDescription(`Guilds I am in:\n${guildInfoString}`)
            .setFooter({
                text: interaction.user.tag,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
            });

        await interaction.editReply({ embeds: [embed] });
    },
};
