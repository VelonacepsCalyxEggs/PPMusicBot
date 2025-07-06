import ytdl from "@distube/ytdl-core";

export interface YtdlFallbackResponseInterface {
    filePath: string;
    metadata: ytdl.videoInfo;
    playlistMetadata?: {
        title: string;
        author: string;
        thumbnail: string;
    };
}

export interface videoCache {
    [videoId: string]: {
        filePath: string;
        metadata: ytdl.videoInfo;
    };
}

export class NoTrackFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NoTrackFoundError";
    }
}

export class PlaylistTooLargeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PlaylistTooLargeError";
    }
}

export class YoutubeDownloadFailedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "YoutubeDownloadFailedError";
    }
}