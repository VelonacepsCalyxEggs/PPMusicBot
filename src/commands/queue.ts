import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, ChatInputCommandInteraction, Client, ActionRowBuilder, ButtonBuilder, ButtonStyle, Message, ButtonInteraction } from 'discord.js';
import { useQueue, Track } from 'discord-player';
import CommandInterface from '../types/commandInterface';
import formatDuration from '../utils/formatDurationUtil';
import TrackMetadata from '../types/trackMetadata';
import commandPreRunCheckUtil from '../utils/commandPreRunCheckUtil';

export default class QueueCommand extends CommandInterface {
    data = new SlashCommandBuilder()
        .setName('queue')
        .setDescription('show the queue')
        .addNumberOption(option =>
            option.setName('page')
                .setDescription('page number')
                .setRequired(false)
                .setMinValue(1)
        )
    execute = async ({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) => {
        if (!interaction.guild || !interaction.guildId) {
            return interaction.followUp({ content: 'You need to be in a guild.', flags: ['Ephemeral'] });
        }
        const queue = useQueue(interaction.guild);
        if (!commandPreRunCheckUtil(interaction, queue)) return;

        let page: number = interaction.options.getNumber('page') || 1;

        if (page < 1) {
            page = 1;
        }
        
        const multiple = 10;
        const maxPages = Math.ceil(queue!.size / multiple);

        if (page < 1 || page > maxPages) page = 1;

        const end = page * multiple;
        const start = end - multiple;

        const tracks = queue!.tracks.toArray().slice(start, end) as Track<TrackMetadata>[];
        const allTracks = queue!.tracks.toArray() as Track<TrackMetadata>[];
        let totalDurationMs = 0;

        for (const track of allTracks) {
            try {
                const metadata = track.metadata as TrackMetadata;
                const isFromDatabase = !!metadata.scoredTrack;
                let durationMs: number;
                
                if (isFromDatabase) {
                    // Database track - use scoredTrack duration
                    durationMs = metadata.scoredTrack!.duration * 1000;
                } else {
                    // Regular track - parse from track duration string
                    const durationParts = track.duration.split(':').reverse();
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
                    const metadata = track.metadata as TrackMetadata;
                    const isFromDatabase = !!metadata.scoredTrack;
                    
                    // Get track information based on source
                    let title: string;
                    let url: string;
                    let duration: string;
                    
                    if (isFromDatabase) {
                        // Database track - use scoredTrack data
                        const dbTrack = metadata.scoredTrack!;
                        title = dbTrack.title;
                        url = `https://www.funckenobi42.space/music/tracks/${dbTrack.id}`;
                        duration = formatDuration(dbTrack.duration * 1000);
                    } else {
                        // Regular track - use track data
                        title = track.title || 'Unknown Title';
                        url = track.url || '#';
                        duration = track.duration || '??:??';
                    }
                        
                    return `${start + ++i} - [${title}](${url}) ~ [${duration}] \n [${track.requestedBy ? track.requestedBy.toString() : 'Unknown'}]`;
                }
            )
            .join('\n');

        const embed = new EmbedBuilder()
            .setDescription(description || 'No tracks found in the current queue.')
            .setFooter({
                text: `Page ${page} of ${maxPages} | track ${start + 1} to ${
                    end > queue!.size ? `${queue!.size}` : `${end}`
                } of ${queue!.size}. Total Duration: ${totalDurationFormatted}.`,
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

        await interaction.reply({ embeds: [embed], components: [actionRow], flags: ['Ephemeral'] }).catch(console.error);
        const message = await interaction.fetchReply() as Message;

        const filter = (i: ButtonInteraction) => ['prev_page', 'next_page', 'first_page', 'last_page'].includes(i.customId);
        const collector = message.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async (i: ButtonInteraction) => {
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

            const tracks = queue!.tracks.toArray().slice(start, end) as Track<TrackMetadata>[];
            const description = tracks
                .map(
                    (track, i) => {
                        const metadata = track.metadata as TrackMetadata;
                        const isFromDatabase = !!metadata.scoredTrack;
                        
                        // Get track information based on source
                        let title: string;
                        let url: string;
                        let duration: string;
                        
                        if (isFromDatabase) {
                            // Database track - use scoredTrack data
                            const dbTrack = metadata.scoredTrack!;
                            title = dbTrack.title;
                            url = `https://www.funckenobi42.space/music/tracks/${dbTrack.id}`;
                            duration = formatDuration(dbTrack.duration * 1000);
                        } else {
                            // Regular track - use track data
                            title = track.title || 'Unknown Title';
                            url = track.url || '#';
                            duration = track.duration || '??:??';
                        }
                            
                        return `${start + ++i} - [${title}](${url}) ~ [${duration}] \n [${track.requestedBy ? track.requestedBy.toString() : 'Unknown'}]`;
                    }
                )
                .join('\n');

            const updatedEmbed = new EmbedBuilder()
                .setDescription(description || 'No tracks found in the current queue.')
                .setFooter({
                    text: `Page ${page} of ${maxPages} | track ${start + 1} to ${
                        end > queue!.size ? `${queue!.size}` : `${end}`
                    } of ${queue!.size}. Total Duration: ${totalDurationFormatted}.`,
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

        collector.on('end', (collected) => {
            console.log(`Collected ${collected.size} interactions.`);
        });
    }
};
