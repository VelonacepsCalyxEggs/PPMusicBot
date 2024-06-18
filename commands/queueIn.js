const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { GuildQueue, useQueue } = require("discord-player");

function formatDuration(ms) {
  let seconds = Math.floor(ms / 1000);
  let minutes = Math.floor(seconds / 60);
  seconds = seconds % 60;
  let hours = Math.floor(minutes / 60);
  minutes = minutes % 60;
  let days = Math.floor(hours / 24);
  hours = hours % 24;
  return `${days} days : ${hours} hours : ${minutes} minutes : ${seconds} seconds`;
}

module.exports = {
    data: new SlashCommandBuilder()
    .setName("queuein")
    .setDescription("show the queue in a guild")
    .addStringOption(option =>
        option.setName("guild").setDescription("guildid").setRequired(true)
    )
    .addNumberOption(option =>
        option.setName("page").setDescription("page number").setRequired(false)
    ),
    
    execute: async ({ client, interaction }) => {
        let guildId = interaction.options.getString('guild') 
        queue = useQueue(guildId);
        if (!queue) {
            return interaction.reply('There is no queue bruv.');
        }
    if (!queue.size) return interaction.reply('There are no songs in the queue.');



    let page = interaction.options.getNumber("page", false) ?? 1;

    const multiple = 10;

    const maxPages = Math.ceil(queue.size / multiple);

    if (page < 1 || page > maxPages) page = 1;

    const end = page * multiple;
    const start = end - multiple;

    const tracks = queue.tracks.toArray().slice(start, end);
    const allTracks = queue.tracks.toArray()
    let totalDurationMs = 0;
    
    for (const track of allTracks) {
      const durationParts = track.duration.split(':').reverse();
      const durationMs = durationParts.reduce((total, part, index) => {
          return total + parseInt(part, 10) * Math.pow(60, index) * 1000;
      }, 0);
      totalDurationMs += durationMs;
    }
    
    let totalDurationFormatted = formatDuration(totalDurationMs);
    if (String(totalDurationFormatted).includes("NaN")) {
      totalDurationFormatted = "∞";
    }
    let embed = new EmbedBuilder();
    embed
    .setDescription(
      `${tracks
        .map(
          (track, i) =>
            `${start + ++i} - [${track.title}](${track.url}) ~ [${track.duration}] \n [${track.requestedBy.toString()}]`
        )
        .join("\n")}`
    )
    .setFooter({
      text: `Page ${page} of ${maxPages} | track ${start + 1} to ${
        end > queue.size ? `${queue.size}` : `${end}`
      } of ${queue.size}. Total Duration: ${totalDurationFormatted}.`,
      iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
    });

    return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
    },
  };