import { SearchResult, Track, GuildQueue } from "discord-player/dist";
import { ChatInputCommandInteraction } from "discord.js";
import { ScoredTrack } from "../types/searchResultInterface";
import TrackMetadata from "../types/trackMetadata";

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
export default async function playTrackHelper(result: SearchResult | Track, queue: GuildQueue, interaction: ChatInputCommandInteraction, scoredTrack?: ScoredTrack ): Promise<void> {
        let metadata: TrackMetadata | undefined;
        try {
            if (result instanceof SearchResult) {
                metadata = result.tracks[0].metadata as TrackMetadata
            }
            else if (result instanceof Track) {
                metadata = result.metadata as TrackMetadata;
            }
            else {
                metadata = {
                    interaction,
                    startedPlaying: new Date(),
                    scoredTrack: undefined,
                    duration_ms: (result as SearchResult).tracks[0].durationMS || 0 || (result as Track).durationMS,
                    live: false,
                    duration: (result as SearchResult).tracks[0].duration || (result as Track).duration || '0:00',
                };
            }
        } catch {
            if (result instanceof SearchResult) {
                metadata = {
                    interaction,
                    startedPlaying: new Date(),
                    scoredTrack: undefined,
                    duration_ms: result.tracks[0].durationMS,
                    live: false,
                    duration: result.tracks[0].duration || '0:00',
                };
            }
            else if (result instanceof Track) {
                metadata = {
                    interaction,
                    startedPlaying: new Date(),
                    scoredTrack: undefined,
                    duration_ms: result.durationMS,
                    live: false,
                    duration: result.duration || '0:00',
                };
            }
            else {
                metadata = {
                    interaction,
                    startedPlaying: new Date(),
                    scoredTrack: undefined,
                    duration_ms: (result as SearchResult).tracks[0].durationMS || 0 || (result as Track).durationMS,
                    live: false,
                    duration: (result as SearchResult).tracks[0].duration || (result as Track).duration || '0:00',
                };
            }
        }
        const newMetadata: TrackMetadata = {
            interaction,
            startedPlaying: new Date(),
            scoredTrack: scoredTrack,
            duration_ms: metadata.duration_ms | 0,
            live: metadata.live || false,
            duration: metadata.duration || '0:00',
        };
        if (result instanceof SearchResult) {
            result.tracks[0].setMetadata(newMetadata);
        } else if (result instanceof Track) {
            result.setMetadata(newMetadata);
        }
        await queue.play(result, {
                nodeOptions: {
                    metadata: interaction,
                    noEmitInsert: true,
                    leaveOnEnd: false,
                    leaveOnEmpty: false,
                    leaveOnStop: false,
                }
            });
    }