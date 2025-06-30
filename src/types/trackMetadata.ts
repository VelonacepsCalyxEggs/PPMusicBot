import { ChatInputCommandInteraction } from "discord.js";
import { ScoredTrack } from "./searchResultInterface";

export default interface TrackMetadata {
    interaction: ChatInputCommandInteraction;
    startedPlaying: Date;
    scoredTrack?: ScoredTrack;
    duration_ms: number;
    live: boolean;
    duration: string;
}