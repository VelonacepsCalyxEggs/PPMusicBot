const { SlashCommandBuilder } = require('discord.js');
const { Client } = require('pg');
const dbConfig = require('../config/dbCfg'); // Make sure the path is correct

// PostgreSQL client setup using the imported config
const pgClient = new Client(dbConfig);

pgClient.connect();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("updquotes")
        .setDescription("Scans a channel for messages and saves them into the database.")
        .addStringOption(option =>
            option.setName('channel').setDescription("The channel ID").setRequired(true)
        ),
    execute: async ({ client, interaction }) => {
        await interaction.deferReply();
        const channelId = interaction.options.getString('channel');
        const channel = client.channels.cache.get(channelId);

        if (!channel) {
            return interaction.followUp('Channel not found!');
        }

        try {
            let allMessages = [];
            let lastId;

            while (true) {
                const options = { limit: 100 };
                if (lastId) {
                    options.before = lastId;
                }

                const fetchedMessages = await channel.messages.fetch(options);
                allMessages.push(...fetchedMessages.map(message => {
                    // Extract the content, context, and authors
                    const splitMessage = message.content.split('\n');
                    const contextLineIndex = splitMessage.findIndex(line => /^\*.*\*$/.test(line));
                    const context = contextLineIndex !== -1 ? splitMessage[contextLineIndex].replace(/\*/g, '') : '';
                    const quoteLines = splitMessage.slice(0, -1); // All lines except the last one
                    const authorsLine = splitMessage[splitMessage.length - 1];

                    // Remove the context line if it exists
                    if (contextLineIndex !== -1) {
                        quoteLines.splice(contextLineIndex, 1);
                    }
                    const quote = quoteLines.join('\n').trim();

                    // Process the authors line (Step 1 & 2)
                    let authors;
                    if(authorsLine && authorsLine.includes('(c)') || authorsLine.includes('(с)') || authorsLine.includes('©')) {
                        // Correctly identify and process the author line
                        authors = authorsLine.replace(/\(c\)/ig, '').trim(); // Remove the (c) and trim
                        authors = [authors]; // Ensure authors is an array (Step 3)
                    } else if (authorsLine && authorsLine.includes('<@')) {
                        authors = authorsLine.replace(/<@/g, '').replace(/>/g, '').split(' ');
                    } else {
                        authors = ['Unknown'];
                    }

                    // Trim whitespace from each author's name and remove any remaining unwanted symbols
                    authors = authors.map(author => author.trim().replace(/[&]/g, '')).filter(author => author !== '');



                    return { context, quote, authors };
                }));
                

                if (fetchedMessages.size != 100) {
                    break;
                }

                lastId = fetchedMessages.last().id;
            }

            // Insert each message into the database
            for (const message of allMessages) {
                // Serialize the authors array as a string
                const authorsStr = message.authors.length > 0 ? message.authors.join(', ') : null;
                
                // Check if the quote already exists in the database before inserting
                const res = await pgClient.query('SELECT * FROM quotes WHERE quote = $1', [message.quote]);
                if (res.rows.length === 0) {
                    // If the quote does not exist, insert it into the database
                    await pgClient.query('INSERT INTO quotes(context, quote, authors) VALUES($1, $2, $3)', 
                    [message.context, message.quote, authorsStr]);
                }
            }
            
            await interaction.followUp('The messages have been saved into the database.');

        } catch (error) {
            console.error(error);
            interaction.followUp('An error occurred while fetching messages.');
        }
    }
};
