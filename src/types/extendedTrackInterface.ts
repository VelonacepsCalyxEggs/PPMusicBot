import { Track } from "discord-player";

export interface ExtendedTrack<T> extends Track<T> { 
    startedPlaying?: Date; 
}