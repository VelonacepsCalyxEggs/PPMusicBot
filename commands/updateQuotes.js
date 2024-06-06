const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("updquotes")
        .setDescription("Scans a channel for messages and saves them into a JSON file.")
        .addStringOption(option =>
            option.setName('channel').setDescription("The channel ID").setRequired(true)
        ),
    execute: async ({ client, interaction }) => {
        interaction.deferReply()
        // Retrieve the channel ID as a string
        const channelId = interaction.options.getString('channel');

        // Fetch the channel from the client's channels cache
        const channel = client.channels.cache.get(channelId);
        if (!channel) {
            return interaction.followUp('Channel not found!');
        }

        try {
            let allMessages = [];
            let lastId;

            // Loop to fetch messages in batches of 100
            while (true) {
                const options = { limit: 100 };
                if (lastId) {
                    options.before = lastId;
                }

                const fetchedMessages = await channel.messages.fetch(options);
                allMessages.push(...fetchedMessages.map(message => message.content.split('\n')[0]));

                if (fetchedMessages.size != 100) {
                    break;
                }

                lastId = fetchedMessages.last().id;
            }

            // Filter out messages with more than two lines
            const filteredMessages = allMessages.filter(message => message.split('\n').length <= 1);

            // Create a JSON object with the messages
            const messagesJson = JSON.stringify(filteredMessages);
            dir = 'C:\\Server\\DSMBot\\PP_DMB'
            // Define the JSON file path
            const jsonFilePath = path.join(dir, 'quotes.json');

            // Write the JSON object to the file
            fs.writeFileSync(jsonFilePath, messagesJson);

            // Reply to the interaction to inform the user that the process is done
            await interaction.followUp('The messages have been saved into a JSON file.');

        } catch (error) {
            console.error(error);
            interaction.followUp('An error occurred while fetching messages.');
        }
    }
};
