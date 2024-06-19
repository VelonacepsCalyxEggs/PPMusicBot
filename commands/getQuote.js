const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { Client } = require('pg');
const dbConfig = require('../config/dbCfg'); // Ensure this points to your config file

// PostgreSQL client setup using the imported config
const pgClient = new Client(dbConfig);
pgClient.connect();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("getquote")
        .setDescription("Gets a random quote or a quote by ID.")
        .addNumberOption(option =>
            option.setName("id").setDescription("Get quote by ID").setRequired(false)
        ),
    execute: async ({ client, interaction }) => {
        const quoteId = interaction.options.getNumber("id");
        let quote;
        let authors;

        if (quoteId) {
            // Fetch the quote by ID
            const res = await pgClient.query('SELECT * FROM quotes WHERE id = $1', [quoteId]);
            if (res.rows.length > 0) {
                quote = res.rows[0].quote;
                authors = res.rows[0].authors;
            } else {
                return interaction.reply({ content: "No quote found with the provided ID.", ephemeral: false });
            }
        } else {
            // Fetch a random quote
            const res = await pgClient.query('SELECT * FROM quotes ORDER BY RANDOM() LIMIT 1');
            quote = res.rows[0].quote;
            context = res.rows[0].context;
            authors = res.rows[0].authors;
        }

        let authorsText = 'Unknown';
        if (authors) {
            // Split the authors string into an array of authors
            const authorList = authors.split(',').map(author => author.trim());
            const authorNames = [];
            for (let author of authorList) {
                if (author) {
                    // If the author is a Discord ID, fetch the username
                    author = author.replace(/<@!?|>/g, '').replace('!', '').replace(',', '')
                    try {
                        const user = await client.users.fetch(author.replace(/<@!?|>/g, '').replace('!', '').replace(',', ''));
                        authorNames.push(user.username);
                    } catch (fetchError) {
                        console.error(`Could not fetch user:`, fetchError);
                        authorNames.push(author);
                    }
                } else {
                    // If the author is not a Discord ID, use the name directly
                    authorNames.push('Unknown');
                }
            }
            authorsText = authorNames.join(' & ');
        }

        let embed = new EmbedBuilder();
        embed
            .setDescription(`**Quote:** \n ${quote} \n`)
            .setFooter({
                text: `Quote by: ${authorsText}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
            });

        // Reply with the embed, visible to all users
        return interaction.reply({ embeds: [embed], ephemeral: false }).catch(console.error);
    },
};
