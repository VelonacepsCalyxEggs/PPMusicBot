import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction } from 'discord.js';
import CommandInterface from '../types/commandInterface';

export default class GetQuouteCommand extends CommandInterface {
    public static readonly commandName = 'getquote';
    data = new SlashCommandBuilder()
        .setName(GetQuouteCommand.commandName)
        .setDescription('Retrieve a quote by ID or get a random one')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('Quote ID (leave empty for random)')
                .setRequired(false)
        )
        execute = async ({ interaction }: { interaction: ChatInputCommandInteraction }) => {
            return await interaction.reply({ content: 'Sorry, this route is currently disabled.', flags: ['Ephemeral'] });
        }
    }
