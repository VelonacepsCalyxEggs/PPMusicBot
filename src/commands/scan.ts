import { SlashCommandBuilder } from '@discordjs/builders';
import { Client, CommandInteraction, EmbedBuilder, TextChannel } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import commandInterface from '../types/commandInterface';

export default class scanCommand extends commandInterface {
    data = new SlashCommandBuilder()
        .setName('scan')
        .setDescription('Extracts messages from a channel and saves them to a file for debugging.')
        .addStringOption(option => 
            option.setName('channelid')
                .setDescription('The ID of the channel to scan')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('limit')
                .setDescription('The number of messages to scan')
                .setRequired(true))
    execute = async ({ client, interaction }: { client: Client; interaction: CommandInteraction }) => {
        await interaction.deferReply({ flags: ['Ephemeral'] });
        
        // Get command options
        const channelId = interaction.options.get('channelid');
        const messageLimit = interaction.options.get('limit');
        
        if (!channelId || !messageLimit) {
            return await interaction.editReply({ content: 'Missing required parameters.' });
        }
        
        try {
            // Fetch the channel
            const channel = await client.channels.fetch(channelId.value as string);
            
            if (!channel || !(channel instanceof TextChannel)) {
                return await interaction.editReply({ content: 'Invalid channel or not a text channel.' });
            }
            
            // Create directory if it doesn't exist
            const dirPath = path.join(process.cwd(), 'resources', 'scanned');
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            
            // Fetch messages
            const messages = await channel.messages.fetch({ limit: messageLimit.value as number });
            
            let output = '';
            messages.forEach(message => {
                const timestamp = message.createdAt.toISOString();
                output += `[${timestamp}] ${message.author.tag}: ${message.content}\n`;
                
                // Handle attachments if any
                if (message.attachments.size > 0) {
                    message.attachments.forEach(attachment => {
                        output += `[Attachment] ${attachment.url}\n`;
                    });
                }
                
                output += '------------------------\n';
            });
            
            // Create file with unique name
            const fileName = `scan_${channel.name}_${Date.now()}.txt`;
            const filePath = path.join(dirPath, fileName);
            
            fs.writeFileSync(filePath, output);
            
            const embed = new EmbedBuilder()
                .setTitle('Channel Scan Complete')
                .setDescription(`Successfully scanned ${messages.size} messages from <#${channelId}>`)
                .addFields(
                    { name: 'File', value: fileName },
                    { name: 'Location', value: `./resources/scanned/${fileName}` }
                )
                .setFooter({
                    text: interaction.user.tag,
                    iconURL: interaction.user.displayAvatarURL(),
                });
                
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error in scan command:', error);
            await interaction.editReply({ 
                content: `An error occurred: ${error instanceof Error ? error.message : String(error)}` 
            });
        }
    }
};