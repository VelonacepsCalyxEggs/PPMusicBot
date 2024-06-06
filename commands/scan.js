const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("scan")
        .setDescription("Scans a channel for messages and sends all messages in a txt file.")
        .addStringOption(option =>
            option.setName('channel').setDescription("The channel ID").setRequired(true)
        )
        .addStringOption(option =>
            option.setName('guild').setDescription("The guild ID (optional)").setRequired(false)
        ),
    execute: async ({ client, interaction }) => {
        // Retrieve the channel ID and guild ID as strings
        const channelId = interaction.options.getString('channel');
        const guildId = interaction.options.getString('guild');

        // Fetch the guild using the provided guild ID, if given
        const guild = guildId ? client.guilds.cache.get(guildId.toString()) : interaction.guild;
        if (!guild) {
            return interaction.reply('Guild not found!');
        }

        // Fetch the channel from the specified guild
        const channel = guild.channels.cache.get(channelId.toString());
        if (!channel) {
            return interaction.reply('Channel not found!');
        }

        try {
            // Fetch the last 100 messages from the channel
            const messages = await channel.messages.fetch({ limit: 100 });

            // Create a string with each message's author, timestamp, and content
            const messagesContent = messages.map(message => 
                `[${message.createdAt.toLocaleString()}] ${message.author.tag}: ${message.content}`
            ).join('\n');

            // Write the messages to a temporary text file
            const tempFilePath = path.join(__dirname, 'temp.txt');
            fs.writeFileSync(tempFilePath, messagesContent);

            // Create an attachment for the text file using AttachmentBuilder
            const attachment = new AttachmentBuilder(tempFilePath, { name: 'messages.txt' });

            // Reply to the interaction with the text file
            await interaction.reply({ content: 'Here are the last 100 messages:', files: [attachment] });

            // Delete the temporary file after sending it
            fs.unlinkSync(tempFilePath);
        } catch (error) {
            console.error(error);
            interaction.reply('An error occurred while fetching messages.');
        }
    }
};
