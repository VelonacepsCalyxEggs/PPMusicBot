import { SearchResult, Track, GuildQueue } from "discord-player/dist";
import { ChatInputCommandInteraction } from "discord.js";

    // To optimize, it's probably best to pass a list of tracks.
    /**
     * 
     * @param result 
     * @param queue 
     * @param interaction 
     * @param scoredTrack 
     * Plays a track in the specified queue, setting metadata for the track.
     * If the result is a SearchResult, it plays the first track in the result.
     * If the result is a Track, it plays that track directly.
     * 
     * @throws Error if track metadata is missing.
     */
export default async function playTrackHelper(result: SearchResult | Track, queue: GuildQueue, interaction: ChatInputCommandInteraction, useKenobiAPI: boolean = false): Promise<void> {
        await queue.play(result, {
                nodeOptions: {
                    metadata: interaction,
                    noEmitInsert: true,
                    leaveOnEnd: false,
                    leaveOnEmpty: false,
                    leaveOnStop: false,
                },
                searchEngine: useKenobiAPI ? `ext:KenobiAPIExtractor` : undefined,
            });
    }