import { ChatInputCommandInteraction } from "discord.js";

export default interface TrackMetadata {
    interaction?: ChatInputCommandInteraction;
    startedPlaying: Date;
    id?: string;
    fileId?: string;
    uploadedBy?: string;
    fromAlbum?: string;
    albumId?: string;
}