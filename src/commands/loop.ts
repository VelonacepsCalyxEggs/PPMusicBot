import { SlashCommandBuilder } from '@discordjs/builders';
import { useQueue, QueueRepeatMode } from 'discord-player';
import { CommandInteraction, EmbedBuilder } from 'discord.js';
import commandInterface from 'src/types/commandInterface';

export default class loopCommand extends commandInterface {
    data = new SlashCommandBuilder()
        .setName('loop')
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
    execute = async ({ client, interaction }: { client: any; interaction: CommandInteraction }) => {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId)return interaction.followUp('You need to be in a guild.');
        const queue = useQueue(interaction.guild);
        const repeatDict: { [key: number]: string } = {
            0: 'Off',
            1: 'Track',
            2: 'Queue',
        };
        // If there is no queue, return
        if (!queue) {
            await interaction.reply('There is no queue.');
            return;
        }

        if (!queue.currentTrack) {
            await interaction.reply('There are no songs playing.');
            return;
        }
        let repeatModeString = '';
        const repeatModeUser = interaction.options.get('mode')?.value
        if (repeatModeUser === '1') {
            queue.setRepeatMode(QueueRepeatMode.QUEUE);
            repeatModeString = 'QUEUE';
        } else if (repeatModeUser === '2') {
            queue.setRepeatMode(QueueRepeatMode.TRACK);
            repeatModeString = 'TRACK';
        } else if (repeatModeUser === '3') {
            queue.setRepeatMode(QueueRepeatMode.OFF);
            repeatModeString = 'OFF';
        } else {
            return interaction.reply(`Current looping mode is ${repeatDict[queue.repeatMode]}.`);
        }

        // Create the embed
        const embed = new EmbedBuilder()
            .setDescription(`Current looping mode is now ${repeatModeString}`);

        // Reply with the embed
        return interaction.reply({ ephemeral: false, embeds: [embed] }).catch(console.error);
    }
};
