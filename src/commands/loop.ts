import { SlashCommandBuilder } from '@discordjs/builders';
import { useQueue, QueueRepeatMode } from 'discord-player';
import { Client, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import CommandInterface from '../types/commandInterface';
import commandPreRunCheckUtil from '../utils/commandPreRunCheckUtil';

export default class LoopCommand extends CommandInterface {
    public static readonly commandName = 'loop';
    data = new SlashCommandBuilder()
        .setName(LoopCommand.commandName)
        .setDescription('Loops with the given mode.')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Loop mode.')
                .setRequired(false)
                .addChoices(
                    { name: 'Queue', value: '1' },
                    { name: 'Track', value: '2' },
                    { name: 'Off', value: '3' }
                ))
    execute = async ({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) => {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId) return interaction.followUp({ content: 'You need to be in a guild.', flags: ['Ephemeral'] });
        const queue = useQueue(interaction.guild);
        if (!commandPreRunCheckUtil(interaction, queue, false)) return;
        
        const repeatDict: { [key: number]: string } = { 0: 'Off', 1: 'Track', 2: 'Queue' };
        const repeatModeUser = interaction.options.get('mode')?.value;
        
        if (!repeatModeUser) {
            // Show current status with quick action buttons
            const embed = new EmbedBuilder()
                .setDescription(`Current looping mode: **${repeatDict[queue!.repeatMode]}**`)
                .addFields([
                    { name: 'Available Modes', value: 'Queue Loop\nTrack Repeat\nNo Loop', inline: true }
                ]);
                
            const actionRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder().setCustomId('loop_queue').setLabel('Queue').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('loop_track').setLabel('Track').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('loop_off').setLabel('Off').setStyle(ButtonStyle.Secondary)
                );
                
            return interaction.reply({ embeds: [embed], components: [actionRow], flags: ['Ephemeral'] });
        }
        
        let repeatModeString = '';
        if (repeatModeUser === '1') {
            queue!.setRepeatMode(QueueRepeatMode.QUEUE);
            repeatModeString = 'QUEUE';
        } else if (repeatModeUser === '2') {
            queue!.setRepeatMode(QueueRepeatMode.TRACK);
            repeatModeString = 'TRACK';
        } else if (repeatModeUser === '3') {
            queue!.setRepeatMode(QueueRepeatMode.OFF);
            repeatModeString = 'OFF';
        } else {
            return interaction.reply({ content: `Current looping mode is ${repeatDict[queue!.repeatMode]}.`, flags: ['Ephemeral'] });
        }

        // Create the embed
        const embed = new EmbedBuilder()
            .setDescription(`Current looping mode is now ${repeatModeString}`);

        // Reply with the embed
        return interaction.reply({ flags: ['SuppressNotifications'], embeds: [embed] });
    }
};
