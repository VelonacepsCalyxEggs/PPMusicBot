import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Pool } from 'pg';
import CommandInterface from '../types/commandInterface';

export default class GetQuouteCommand extends CommandInterface {
    private pool: Pool;
    data = new SlashCommandBuilder()
        .setName('getquote')
        .setDescription('Retrieve a quote by ID or get a random one')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('Quote ID (leave empty for random)')
                .setRequired(false)
        )
    execute = async ({ interaction }: { interaction: ChatInputCommandInteraction }) => {
        await interaction.deferReply({ flags: ['Ephemeral'] });
        const pool = new Pool({connectionString: process.env.DATABASE_URL});
        try {
            const quoteId = interaction.options.get('id')?.value?.toString();
            const client = await pool.connect();

            const buildQuery = (quoteId?: string) => {
                const baseQuery = `
                    SELECT 
                        q.id,
                        q.quote_text,
                        q.created_at,
                        q.source,
                        ARRAY_AGG(a.user_id ORDER BY qa.author_order ASC) as author_ids
                    FROM quotes q
                    LEFT JOIN quote_authors qa ON q.id = qa.quote_id
                    LEFT JOIN authors a ON qa.author_id = a.id
                `;
                
                const whereClause = quoteId ? 'WHERE q.id = $1' : '';
                const orderClause = quoteId ? '' : 'ORDER BY RANDOM()';
                
                return `
                    ${baseQuery}
                    ${whereClause}
                    GROUP BY q.id
                    ${orderClause}
                    LIMIT 1
                `;
            };
            
            const query = buildQuery(quoteId);
            const values = quoteId ? [quoteId] : [];
            const result = await client.query(query, values);
            
            client.release();            

            if (result.rowCount === 0) {
                return interaction.editReply(quoteId ? 'Quote not found' : 'No quotes available');
            }

            const quote = result.rows[0];
            const authors = quote.author_ids?.filter((id: string) => id)?.map((id: string) => `<@${id}>`) || [];

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setDescription(`${quote.quote_text}`)
                .addFields({
                    name: 'Authors',
                    value: authors.join(', ') || 'Unknown',
                    inline: true
                })
                .setTimestamp(quote.created_at);

            if (quote.source) {
                embed.addFields({ name: 'Source Or Context', value: quote.source, inline: true });
            }

            embed.setFooter({ text: `Quote ID: ${quote.id}` });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Quote retrieval error:', error);
            await interaction.editReply('Failed to retrieve quote');
        }
    }
    }
