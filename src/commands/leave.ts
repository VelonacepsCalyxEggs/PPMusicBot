import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, CommandInteraction } from 'discord.js';
import { useQueue } from 'discord-player';
import commandInterface from 'src/types/commandInterface';

export default class leaveCommand extends commandInterface {
    data = new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Drops the queue and leaves from the channel.')

    execute = async ({ interaction }: { interaction: CommandInteraction }) : Promise<void | import('discord.js').InteractionResponse | import('discord.js').Message> => {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId) {
            return interaction.followUp('You need to be in a guild.');
        }
        const queue = useQueue(interaction.guild);

        // If there is no queue, return
        if (!queue) {
            return interaction.reply('There is no queue!');
        }

        queue.delete();
        console.log('Managed to delete a queue like a normal person.');
        
        // Create an embed to inform the user
        const embed = new EmbedBuilder()
            .setDescription(`Left the channel!`);

        return interaction.reply({ ephemeral: true, embeds: [embed] }).catch(console.error);
    }
};
