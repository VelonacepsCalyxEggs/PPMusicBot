import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, CommandInteraction, Client, ActionRowBuilder, ButtonBuilder, ButtonStyle, Message } from 'discord.js';
import { useQueue } from 'discord-player';
import commandInterface from '../types/commandInterface';
import { ScoredTrack } from '../types/searchResultInterface';
import formatDuration from '../utils/formatDurationUtil';

export default class queueCommand extends commandInterface {
    data = new SlashCommandBuilder()
        .setName('queue')
        .setDescription('show the queue')
        .addNumberOption(option =>
            option.setName('page')
                .setDescription('page number')
                .setRequired(false)
        )
    execute = async ({ client, interaction }: { client: Client; interaction: CommandInteraction }) => {
        if (!interaction.guild || !interaction.guildId) {
            return interaction.followUp('You need to be in a guild.');
        }
        const queue = useQueue(interaction.guild);
        if (!queue) {
            return interaction.reply('There is no queue.');
        }
        if (queue.size === 0) {
            return interaction.reply('There are no songs in the queue.');
        }

        let page = Number(interaction.options.get('page', false)?.value) ?? 1;
        if (isNaN(page)) {
            page = 1;
        }
        const multiple = 10;
        const maxPages = Math.ceil(queue.size / multiple);

        if (page < 1 || page > maxPages) page = 1;

        const end = page * multiple;
        const start = end - multiple;

        const tracks = queue.tracks.toArray().slice(start, end);
        const allTracks = queue.tracks.toArray();
        let totalDurationMs = 0;

        for (const track of allTracks) {
            try {
                let durationMs: number;
                let durationParts: string[] = [];
                // Convert the duration string to milliseconds
                if (track.metadata && typeof (track.metadata as ScoredTrack).duration !== 'undefined') {
                durationMs = (track.metadata as ScoredTrack).duration * 1000;
                }
                else {
                    durationParts = track.duration.split(':').reverse();
                    durationMs = durationParts.reduce((total, part, index) => {
                        return total + parseInt(part, 10) * Math.pow(60, index) * 1000;
                    }, 0);
                }
                totalDurationMs += durationMs;
            } catch {
                continue;
            }
        }

        let totalDurationFormatted = formatDuration(totalDurationMs);
        if (String(totalDurationFormatted).includes('NaN')) {
            totalDurationFormatted = '∞';
        }
        const description = tracks
            .map(
                (track, i) => {
                    // Check if track has metadata we can use
                    const hasMetadata = track.metadata && (track.metadata as ScoredTrack);
                    const title = hasMetadata ? (track.metadata as ScoredTrack).title || track.title : track.title;
                    const url = hasMetadata && (track.metadata as ScoredTrack).id 
                        ? `https://www.funckenobi42.space/music/tracks/${(track.metadata as ScoredTrack).id}`
                        : track.url;
                    const duration = hasMetadata
                        ? formatDuration((track.metadata as ScoredTrack).duration * 1000)
                        : track.duration;
                        
                    return `${start + ++i} - [${title || 'Unknown Title'}](${url || '#'}) ~ [${duration || '??:??'}] \n [${track.requestedBy ? track.requestedBy.toString() : 'Unknown'}]`;
                }
            )
            .join('\n');

        const embed = new EmbedBuilder()
            .setDescription(description || 'No tracks found in the current queue.')
            .setFooter({
                text: `Page ${page} of ${maxPages} | track ${start + 1} to ${
                    end > queue.size ? `${queue.size}` : `${end}`
                } of ${queue.size}. Total Duration: ${totalDurationFormatted}.`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('first_page')
                    .setLabel('First')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 1),
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 1),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === maxPages),
                new ButtonBuilder()
                    .setCustomId('last_page')
                    .setLabel('Last')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === maxPages)
            );

        await interaction.reply({ ephemeral: true, embeds: [embed], components: [actionRow] }).catch(console.error);
        const message = await interaction.fetchReply() as Message;

        const filter = (i: any) => ['prev_page', 'next_page', 'first_page', 'last_page'].includes(i.customId);
        const collector = message.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async (i: any) => {
            if (i.customId === 'prev_page') {
                page--;
            } else if (i.customId === 'next_page') {
                page++;
            } else if (i.customId === 'last_page') {
                page = maxPages;
            } else if (i.customId === 'first_page') {
                page = 1;
            }
            if (page < 1) page = 1;
            if (page > maxPages) page = maxPages;

            const end = page * multiple;
            const start = end - multiple;

            const tracks = queue.tracks.toArray().slice(start, end);
            const description = tracks
                .map(
                    (track, i) => {
                        // Check if track has metadata we can use
                        const hasMetadata = track.metadata && (track.metadata as ScoredTrack);
                        const title = hasMetadata ? (track.metadata as ScoredTrack).title || track.title : track.title;
                        const url = hasMetadata && (track.metadata as ScoredTrack).id 
                            ? `https://www.funckenobi42.space/music/tracks/${(track.metadata as ScoredTrack).id}`
                            : track.url;
                        // FIX: Format duration consistently with the initial page
                        const duration = hasMetadata
                            ? formatDuration((track.metadata as ScoredTrack).duration * 1000)
                            : track.duration;
                            
                        return `${start + ++i} - [${title || 'Unknown Title'}](${url || '#'}) ~ [${duration || '??:??'}] \n [${track.requestedBy ? track.requestedBy.toString() : 'Unknown'}]`;
                    }
                )
                .join('\n');

            const updatedEmbed = new EmbedBuilder()
                .setDescription(description || 'No tracks found in the current queue.')
                .setFooter({
                    text: `Page ${page} of ${maxPages} | track ${start + 1} to ${
                        end > queue.size ? `${queue.size}` : `${end}`
                    } of ${queue.size}. Total Duration: ${totalDurationFormatted}.`,
                    iconURL: interaction.user.displayAvatarURL(),
                });

            const updatedActionRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('first_page')
                        .setLabel('First')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 1),
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 1),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === maxPages),
                    new ButtonBuilder()
                        .setCustomId('last_page')
                        .setLabel('Last')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === maxPages)
                );

            await i.update({ embeds: [updatedEmbed], components: [updatedActionRow] });
        });

        collector.on('end', collected => {
            console.log(`Collected ${collected.size} interactions.`);
        });
    }
};
