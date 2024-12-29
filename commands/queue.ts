import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, CommandInteraction, Client } from 'discord.js';
import { useQueue } from 'discord-player';

function formatDuration(ms: number): string {
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;
    let hours = Math.floor(minutes / 60);
    minutes = minutes % 60;
    let days = Math.floor(hours / 24);
    hours = hours % 24;
    return `${days} days : ${hours} hours : ${minutes} minutes : ${seconds} seconds`;
}

export const command = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('show the queue')
        .addNumberOption(option =>
            option.setName('page')
                .setDescription('page number')
                .setRequired(false)
        ),
    execute: async ({ client, interaction }: { client: Client; interaction: CommandInteraction }) => {
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
                const durationParts = track.duration.split(':').reverse();
                const durationMs = durationParts.reduce((total, part, index) => {
                    return total + parseInt(part, 10) * Math.pow(60, index) * 1000;
                }, 0);
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
                (track, i) =>
                    `${start + ++i} - [${track.title}](${track.url}) ~ [${track.duration}] \n [${track.requestedBy ? track.requestedBy.toString() : 'Unknown'}]`
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

        return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
    },
};
