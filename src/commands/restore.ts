import { SlashCommandBuilder } from '@discordjs/builders';
import { EmbedBuilder, ChatInputCommandInteraction, InteractionResponse, Message, Client, GuildMember } from 'discord.js';
import { GuildQueue, Player, useQueue } from 'discord-player';
import CommandInterface from '../types/commandInterface';
import { commandLogger } from '../utils/loggerUtil';
import playTrackHelper from '../helpers/playHelper';

export default class RestoreCommand extends CommandInterface {
    public static readonly commandName = 'restore';
    data = new SlashCommandBuilder()
        .setName(RestoreCommand.commandName)
        .setDescription('Attempts to restore the queue state from cache if the bot was restarted.');

    execute = async ({ client, player, interaction }: { client: Client, player: Player, interaction: ChatInputCommandInteraction }) : Promise<void | InteractionResponse | Message> => {
        // Get the queue for the server
        if (!interaction.guild || !interaction.guildId) {
            return interaction.followUp({content: 'You need to be in a guild.', flags: ['Ephemeral']});
        }
        let queue: GuildQueue | null
        queue = useQueue(interaction.guild);

        if (!queue) { 
            queue = player.nodes.create(interaction.guild, {leaveOnEnd: false, leaveOnEmpty: true, leaveOnStop: false, metadata: interaction, noEmitInsert: true});   
            const voiceChannel = (interaction.member as GuildMember).voice.channel;
            if (!voiceChannel) {
                return interaction.followUp({ content: 'You need to be in a voice channel to use this command.', flags: ['Ephemeral'] });
            }
            if (!queue.connection) {
                if (voiceChannel.joinable === false) {
                    throw new Error('I cannot join your voice channel. Please check my permissions.');
                }

                if (voiceChannel.full) {
                    throw new Error('Your voice channel is full.');
                }

                await queue.connect(voiceChannel);
                if (!queue.connection) {
                    throw new Error('Failed to connect to the voice channel.');
                }
            }
        }
        let embed: EmbedBuilder
        if (client.cachedQueueStates && client.cachedQueueStates.length > 0) {
            const cachedState = client.cachedQueueStates.find(q => q.guildId === interaction.guild!.id);
            if (cachedState) {
                commandLogger.debug(`Restoring cached state for guild: ${interaction.guild.id}`);
                for (const track of cachedState.tracks) {
                    playTrackHelper(track, queue, interaction);
                }
                commandLogger.info(`Restored ${cachedState.tracks.length} tracks from cache for guild: ${interaction.guild.id}`);
                embed = new EmbedBuilder()
                .setDescription(`Restored ${cachedState.tracks.length} tracks from cache.`);
            }
            else {
                commandLogger.warn(`No cached state found for guild: ${interaction.guild.id}`);
                embed = new EmbedBuilder()
                    .setDescription(`No cached queue states found.`);
            }
        }
        else {
            commandLogger.warn(`No cached queue states found for guild: ${interaction.guild.id}`);
            embed = new EmbedBuilder()
                .setDescription(`No cached queue states found.`);
        }
        
        return interaction.reply({ flags: 'SuppressNotifications', embeds: [embed] })
    }
};
