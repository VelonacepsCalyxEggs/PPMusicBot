import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, Client } from 'discord.js';
import CommandInterface from '../types/commandInterface';
import { Player, Track } from 'discord-player';
import { commandLogger, logError } from '../utils/loggerUtil';

export default class RecoverCommand implements CommandInterface {
    data = new SlashCommandBuilder()
        .setName('recover')
        .setDescription('Force recovery from stuck playback state');

    async execute({ client, player, interaction }: { client: Client, player: Player, interaction: ChatInputCommandInteraction }) {
        if (!interaction.guild) {
            return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        }

        await interaction.deferReply();

        const queue = player.nodes.get(interaction.guild.id);
        if (!queue) {
            return interaction.editReply('No active queue found.');
        }

        try {
            const currentTrack = queue.currentTrack?.title || 'Unknown';
            
            // Force stop everything
            commandLogger.debug(`Recovering stuck playback for guild: ${interaction.guild.id}, current track: ${currentTrack}`);
            commandLogger.debug(`Queue track size before recovery: ${queue.tracks.size}`);

            if (queue.tracks.size > 0) {
               const tracks: Track<unknown>[] = queue.tracks.toArray();
               await interaction.editReply(`Starting recovery... this might take a moment...`);
                commandLogger.debug(`Tracks to recover: ${tracks.length}`);

                // Clear the current track and add all tracks back to the queue
                queue.tracks.clear();
                for (const track of tracks) {
                    queue.addTrack(track);
                }

                // Restart playback
                await queue.node.play();
                commandLogger.debug(`Recovery complete.`);
                
                await interaction.editReply(`Recovery complete.`);
            } else {
                // No tracks left, clear everything
                queue.clear();
                queue.connection?.destroy();
                player.queues.cache.delete(interaction.guild.id);
                await interaction.editReply(`Recovery complete. Queue was empty and has been reset.`);
            }
        } catch (error) {
            logError(error, `Error during recovery for guild: ${interaction.guild.id}`);
            
            // Nuclear option: completely reset
            try {
                player.queues.cache.delete(interaction.guild.id);
                await interaction.editReply('Recovery failed. Queue has been forcibly reset. Please rejoin the voice channel and try again.');
            } catch (editError) {
                logError(editError, 'Could not edit reply');
            }
        }
    }
}