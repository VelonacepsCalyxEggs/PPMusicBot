const { SlashCommandBuilder } = require("@discordjs/builders");
const { useQueue } = require("discord-player");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shuffle")
        .setDescription("Shuffles the playlist")
        .addStringOption(option =>
            option.setName('algorithm')
                .setDescription('Shuffle algorithm.')
                .setRequired(false)
                .addChoices(
                    { name: 'Fisher-Yates', value: 'fy' },
                    { name: 'Durstenfeld', value: 'df' },
                    { name: 'Sattolo', value: 'st' },
                    { name: 'Shuffle By Title', value: 'ti'}
                )),
    execute: async ({ interaction }) => {
        let queue = useQueue(interaction.guildId);
        if (!queue) {
            return interaction.reply('There is no queue to shuffle, bruv.');
        }
        if (!queue.size) return interaction.reply('There are no songs in the queue to shuffle.');

        const shuffleAlgorithm = interaction.options.getString('category') || 'fy';
        var tracks = queue.tracks.toArray();

        // Shuffle based on the selected algorithm
        switch (shuffleAlgorithm) {
            case 'fy': // Fisher-Yates (Knuth) shuffle
                for (let i = tracks.length - 1; i > 0; i--) {
                    let j = Math.floor(Math.random() * (i + 1));
                    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
                }
                break;
            case 'df': // Durstenfeld shuffle
                for (let i = tracks.length - 1; i > 0; i--) {
                    let j = Math.floor(Math.random() * (i + 1));
                    let temp = tracks[i];
                    tracks[i] = tracks[j];
                    tracks[j] = temp;
                }
                break;
            case 'st': // Sattolo's algorithm
                for (let i = tracks.length - 1; i > 0; i--) {
                    let j = Math.floor(Math.random() * i);
                    let temp = tracks[i];
                    tracks[i] = tracks[j];
                    tracks[j] = temp;
                }
                break;  
            default:
                for (let i = tracks.length - 1; i > 0; i--) {
                  let j = Math.floor(Math.random() * (i + 1));
                  [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
                }
        }

        queue.clear();
        tracks.forEach(track => queue.addTrack(track));
        return interaction.reply(`The queue has been shuffled using ${shuffleAlgorithm} algorithm!`);
    }
};
