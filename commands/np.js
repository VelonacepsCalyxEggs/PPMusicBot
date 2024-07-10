const { SlashCommandBuilder } = require("@discordjs/builders");
const { useQueue, GuildQueuePlayerNode } = require("discord-player");
const { EmbedBuilder } = require("discord.js");

// Function to format duration to match the song's duration format
function formatDuration(durationMs) {
    const seconds = Math.floor((durationMs / 1000) % 60);
    const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
    const hours = Math.floor((durationMs / (1000 * 60 * 60)) % 24);

    const secondsFormatted = seconds < 10 ? '0' + seconds : seconds;
    const minutesFormatted = minutes < 10 ? '0' + minutes : minutes;
    if (hours == NaN || minutes == NaN || seconds == NaN) {
        return "∞"
    }
    let result = `${minutes}:${secondsFormatted}`;
    if (hours > 0) {
        result = `${hours}:${minutesFormatted}:${secondsFormatted}`;
    }
    return result;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("np")
        .setDescription("Gets the currently playing song."),

    execute: async ({ client, interaction }) => {
        // Get the queue for the server
        const queue = useQueue(interaction.guildId);

        // If there is no queue, return
        if (!queue) {
            await interaction.reply("There is no queue.");
            return;
        }

        if (!queue.currentTrack) {
            await interaction.reply("There are no songs playing.");
            return;
        }
        
        const currentSong = queue.currentTrack;

        // Calculate the elapsed time
        const startedPlaying = currentSong.startedPlaying;
        console.log(`[${new Date().toISOString()}] [Started Playing: ${startedPlaying}]`);
        const elapsedTime = new Date() - startedPlaying; // in milliseconds

        // Convert the duration string to milliseconds
        const durationParts = currentSong.duration.split(':').reverse();
        const durationMs = durationParts.reduce((total, part, index) => {
            return total + parseInt(part, 10) * Math.pow(60, index) * 1000;
        }, 0);

        // Calculate the current position
        const currentPosition = Math.min(elapsedTime, durationMs);

        // Format the current position
        const currentPositionFormatted = formatDuration(currentPosition);

        // Create the embed
        let embed = new EmbedBuilder();
        embed
            .setDescription(`Currently playing: **${currentSong.title}** by **${currentSong.author}** from [source](${currentSong.url})`)
            .setThumbnail(currentSong.thumbnail)
            .setFooter({
                text: `Elapsed time: ${currentPositionFormatted} / ${currentSong.duration}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
            });

        // Reply with the embed
        return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
    },
};
