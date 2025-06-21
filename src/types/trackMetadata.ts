import { CommandInteraction } from "discord.js";
import { ScoredTrack } from "./searchResultInterface";

export default interface TrackMetadata {
    interaction: CommandInteraction;
    startedPlaying: Date;
    scoredTrack?: ScoredTrack;
    duration_ms: number;
    live: boolean;
    duration: string;
}