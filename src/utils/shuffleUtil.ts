import { Track } from "discord-player/dist";

export default class TrackShuffleUtil {
    public static fisherYatesShuffle(tracks: Track<unknown>[]) {
            for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
            }
            return tracks;
    }

    public static durstenfeldShuffle(tracks: Track<unknown>[]) {
            for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    const temp = tracks[i];
                    tracks[i] = tracks[j];
                    tracks[j] = temp;
            }
            return tracks;
    }

    public static sattoloShuffle(tracks: Track<unknown>[]) {
            for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * i);
                    const temp = tracks[i];
                    tracks[i] = tracks[j];
                    tracks[j] = temp;
            }
            return tracks;
    }
}