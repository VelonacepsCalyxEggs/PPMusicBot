import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, Client } from 'discord.js';
import { useQueue } from 'discord-player';
import CommandInterface from '../types/commandInterface';
import commandPreRunCheckUtil from '../utils/commandPreRunCheckUtil';

export default class MoveCommand extends CommandInterface {
    public static readonly commandName = 'move';
    data = new SlashCommandBuilder()
        .setName(MoveCommand.commandName)
        .setDescription('moves the track from one index to another index.')
        .addNumberOption(option =>
            option.setName('index')
                .setDescription('index')
                .setRequired(true)
        )
        .addNumberOption(option =>
            option.setName('position')
                .setDescription('index')
                .setRequired(true)
        )
    execute = async ({ interaction }: { client: Client; interaction: ChatInputCommandInteraction }) => {
        if (!interaction.guild || !interaction.guildId) return interaction.followUp({ content: 'You need to be in a guild.', flags: ['Ephemeral'] });
        const queue = useQueue(interaction.guild);
        if (!commandPreRunCheckUtil(interaction, queue)) return;
        
        const fromIndex = Number(interaction.options.get('index')?.value) - 1;
        const toIndex = Number(interaction.options.get('position')?.value) - 1;
        
        // Validate indices
        if (fromIndex < 0 || fromIndex >= queue!.size || toIndex < 0 || toIndex >= queue!.size) {
            return interaction.reply({ 
                content: `Invalid position. Queue has ${queue!.size} tracks (1-${queue!.size}).`, 
                flags: ['Ephemeral'] 
            });
        }
        
        const track = queue!.tracks.toArray()[fromIndex];
        queue!.moveTrack(fromIndex, toIndex);
        
        return interaction.reply({
            content: `Moved "${track.title}" from position ${fromIndex + 1} to ${toIndex + 1}.`,
            flags: ['SuppressNotifications']
        });
    }
};
