import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { useQueue } from 'discord-player';
import CommandInterface from '../types/commandInterface';
import commandPreRunCheckUtil from '../utils/commandPreRunCheckUtil';

export default class ReaddCommand extends CommandInterface {
    data = new SlashCommandBuilder()
        .setName('re-add')
        .setDescription('Adds the current song to the queue.')
        .addBooleanOption(option =>
            option.setName('now')
                .setDescription('add it to the beggining?')
                .setRequired(false)
        )
    execute = async ({ client, interaction }: { client: Client; interaction: ChatInputCommandInteraction }) => {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId)return interaction.followUp({ content: 'You need to be in a guild.', flags: ['Ephemeral'] });
        const queue = useQueue(interaction.guild);

        // If there is no queue, return
        if (!commandPreRunCheckUtil(interaction, queue)) return;
        
        const currentSong = queue!.currentTrack;
        if (!currentSong) return interaction.reply({ content: 'There is no current song to re-add!', flags: ['Ephemeral'] });

        // Add the current song
        queue!.addTrack(currentSong);
        if (Boolean(interaction.options.get('now')?.value)) {
            queue!.moveTrack(queue!.size - 1, 0)
        }

        // Create an embed to inform the user
        const embed = new EmbedBuilder()
            .setDescription(`${currentSong.title} has been re-added!`)
            .setThumbnail(currentSong.thumbnail);

        return interaction.reply({ flags: ['SuppressNotifications'], embeds: [embed] }).catch(console.error);
    }
};
