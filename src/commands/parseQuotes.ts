import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, CommandInteraction, TextChannel } from 'discord.js';
import { Pool } from 'pg';
import dbConfig from '../../config/dbCfg';

const pool = new Pool(dbConfig);
const DEBUG_MODE = false;

// I FUCKING HATE REGEX
// NOTHING EVER HAPPENS
// UNTIL SOMETHING HAPPENS AND THE SOLUTION TURNS OUT TO BE
// MORE REGEX
// FUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUCK

export const command = {
    data: new SlashCommandBuilder()
        .setName('scanquotes')
        .setDescription('Scans quotes in a channel and stores them in the database')
        .addStringOption(option =>
            option.setName('channelid')
                .setDescription('Channel ID to scan')
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName('debug')
                .setDescription('Enable debug mode')
                .setRequired(false)
        ),

    execute: async ({ client, interaction }: { client: any; interaction: CommandInteraction }) => {
        await interaction.deferReply({ ephemeral: true });
        const debug = Boolean(interaction.options.get('debug')?.value) || DEBUG_MODE;
        console.log(debug)
        try {
            const channelId = interaction.options.get('channelid', true)?.value;
            const channel = await client.channels.fetch(channelId);
            
            if (!(channel instanceof TextChannel)) {
                return interaction.editReply('Invalid text channel');
            }

            const permissions = channel.permissionsFor(client.user);
            if (!permissions?.has(['ViewChannel', 'ReadMessageHistory'])) {
                return interaction.editReply('Missing permissions to read this channel');
            }

            let messages: any[] = [];
            let lastMessageId: string | undefined;
            let quoteCount = 0;
            let processedMessages = 0;

            while (true) {
                const options: { limit: number; before?: string } = { limit: 100 };
                if (lastMessageId) options.before = lastMessageId;

                const fetched = await channel.messages.fetch(options);
                if (fetched.size === 0) break;

                messages.push(...fetched.values());
                lastMessageId = fetched.last()?.id;
                processedMessages += fetched.size;

                if (debug) {
                    console.log(`[DEBUG] Fetched ${fetched.size} messages (Total: ${processedMessages})`);
                    console.log(`[DEBUG] Last message ID: ${lastMessageId}`);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
                if (fetched.size < 100 || (debug && processedMessages >= 100)) break;
            }

            if (debug) console.log(`[DEBUG] Total messages to process: ${messages.length}`);

            // In the message processing loop:
            for (const message of messages) {
                if (debug) console.log(`\n[DEBUG] Processing message ${message.id}:`);
                const lines = message.content.split('\n').filter((l: string) => l.trim());
                
                let pendingQuote: { 
                    text?: string; 
                    authors: string[]; 
                    source?: string | null 
                } = { 
                    authors: [], 
                    source: null 
                };

                for (const line of lines) {
                    if (debug) console.log(`[DEBUG] Processing line: "${line}"`);
                    
                    const parsed = parseQuoteLine(line, debug);
                    
                    // Always capture source even if no text
                    if (parsed.source) {
                        pendingQuote.source = parsed.source;
                    }
                
                    // Case 1: Line contains authors (with or without text)
                    if (parsed.authors.length > 0) {
                        if (debug) console.log('[PROCESS] Found author(s)', parsed.authors);
                        
                        // Combine text and handle source
                        const fullText = [
                            pendingQuote.text,
                            parsed.quoteText
                        ].filter(Boolean).join('\n');
                
                        if (fullText) {
                            await saveQuote({
                                text: fullText,
                                authors: parsed.authors,
                                source: pendingQuote.source,
                                message,
                                channel
                            }, debug);
                            quoteCount++;
                            pendingQuote = { authors: [], source: null };
                        }
                    }
                    // Case 2: Line contains text (with or without source)
                    else if (parsed.quoteText) {
                        if (debug) console.log('[PROCESS] Accumulating text');
                        pendingQuote.text = [
                            pendingQuote.text,
                            parsed.quoteText
                        ].filter(Boolean).join('\n');
                    }
                }

                // Save any remaining text at end of message
                if (pendingQuote.text) {
                    if (debug) console.log('[PROCESS] Saving final quote from message');
                    await saveQuote({
                        text: pendingQuote.text,
                        authors: pendingQuote.authors,
                        source: pendingQuote.source,
                        message,
                        channel
                    }, debug);
                    quoteCount++;
                }
            }

            const embed = new EmbedBuilder()
            .setDescription(`Successfully processed ${quoteCount} quotes`)
            .setFooter(debug ? { text: 'Debug mode enabled' } : null);
        
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[ERROR] Scan error:', error);
            await interaction.editReply('An error occurred during scanning');
        }
    }
};

async function saveQuote(
    data: {
        text: string;
        authors: string[];
        source?: string | null;
        message: any;
        channel: TextChannel;
    },
    debug = false
) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // First check for existing quote
        const existingQuote = await client.query(
            `SELECT id FROM quotes WHERE message_id = $1`,
            [data.message.id]
        );

        if (existingQuote.rowCount != null && existingQuote.rowCount > 0) {
            if (debug) console.log(`[DB] Quote already exists: ${data.message.id}`);
            await client.query('COMMIT');
            return;
        }

        // Insert quote with conflict handling
        const quoteRes = await client.query(
            `INSERT INTO quotes (quote_text, message_id, channel_id, created_at, source)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (message_id) DO NOTHING
             RETURNING id`,
            [
                data.text,
                data.message.id,
                data.channel.id,
                data.message.createdAt,
                data.source || null
            ]
        );

        // If no rows returned, quote already exists
        if (quoteRes.rowCount === 0) {
            if (debug) console.log(`[DB] Skipped duplicate quote: ${data.message.id}`);
            await client.query('COMMIT');
            return;
        }

        const quoteId = quoteRes.rows[0].id;
        if (debug) console.log(`[DB] Inserted quote ID: ${quoteId}`);
        
        let authorIndex = 0;
        // Process authors
        for (const userId of data.authors) {
            // Get or create author
            const authorRes = await client.query(
                `INSERT INTO authors (user_id) 
                 VALUES ($1) 
                 ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
                 RETURNING id`,
                [userId]
            );

            if (!authorRes.rows[0]) {
                console.error(`[DB ERROR] Failed to get author ID for user ${userId}`);
                continue;
            }

            // Link quote to author
            await client.query(
                `INSERT INTO quote_authors (quote_id, author_id)
                 VALUES ($1, $2) 
                 ON CONFLICT DO NOTHING`,
                [quoteId, authorRes.rows[0].id]
            );

            await client.query(
                `INSERT INTO quote_authors (quote_id, author_id, author_order)
                 VALUES ($1, $2, $3)
                 ON CONFLICT DO NOTHING`,
                [quoteId, authorRes.rows[0].id, authorIndex++]
            );

            if (debug) {
                console.log(`[DB] Linked author ${userId} (ID ${authorRes.rows[0].id}) to quote ${quoteId}`);
            }
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[DB ERROR]', error);
        throw error;
    } finally {
        client.release();
    }
}

function parseQuoteLine(line: string, debug: boolean): {
    quoteText: string;
    authors: string[];
    source: string | null;
} {
    let processed = line.trim();
    const originalLine = processed;
    const authors: string[] = [];
    let source: string | null = null;

    if (debug) console.log(`[PARSE] Starting parse of: "${originalLine}"`);

    // Unified regex pattern to match both <@id> and <@!id> formats
    const mentionPattern = /<@!?(\d+)>/g;

    // 1. First extract source link even with angle brackets
    // i hate myself.
    const linkMatch = processed.match(/\[([^\]]*)\]\(\s*<?(https?:\/\/[^\s>)]*)>?\s*\)/);
    if (linkMatch) {
        source = linkMatch[2]; // Capture URL without <>
        processed = processed.replace(linkMatch[0], '').trim();
        if (debug) console.log(`[PARSE] Found source link: ${source}`);
    }

    // 2. Then extract copyright notation with better boundaries
    const copyrightMatch = processed.match(/\(c\)\s+([^\s\]\)]+)/i);
    if (copyrightMatch) {
        source = copyrightMatch[1];
        processed = processed.replace(copyrightMatch[0], '').trim();
        if (debug) console.log(`[PARSE] Found copyright source: ${source}`);
    }

    // 3. Extract inline author after source removal
    const inlineAuthorMatch = processed.match(/^<@!?(\d+)>:\s*/);
    if (inlineAuthorMatch) {
        authors.push(inlineAuthorMatch[1]);
        processed = processed.slice(inlineAuthorMatch[0].length).trim();
        if (debug) console.log(`[PARSE] Found inline author: ${inlineAuthorMatch[1]}`);
    }

    // 4. Extract trailing authors after source removal
    const trailingAuthorsMatch = processed.match(/(.*?)(<@!?\d+>(?:\s*[&,]\s*<@!?\d+>)*)$/);
    if (trailingAuthorsMatch) {
        processed = trailingAuthorsMatch[1].trim();
        const authorsPart = trailingAuthorsMatch[2];
        const foundAuthors = Array.from(authorsPart.matchAll(mentionPattern)).map(m => m[1]);
        authors.push(...foundAuthors);
        if (debug) console.log(`[PARSE] Found trailing authors: ${foundAuthors.join(', ')}`);
    }

    // 5. Clean remaining mentions after all other processing
    const remainingMentions = processed.match(mentionPattern);
    if (remainingMentions?.length) {
        if (debug) console.log(`[PARSE] Cleaning remaining mentions: ${remainingMentions.join(', ')}`);
        processed = processed.replace(mentionPattern, '').trim();
    }

    if (debug) {
        console.log('[PARSE] Final parsed values:', {
            original: originalLine,
            processed,
            authors,
            source
        });
    }

    return {
        quoteText: processed,
        authors: authors, // Remove deduplication to preserve order
        source
    };
}
