import axios from "axios";
import { BaseExtractor, ExtractorInfo, ExtractorSearchContext, Track } from "discord-player/dist";
import { icecastExtractorLogger } from "../utils/loggerUtil";
import { Readable } from "stream";
import TrackMetadata from "../types/trackMetadata";
// Placeholder for now.
export interface IcecastExtractorOptions {
    baller: boolean;
}
// Only for icecast 2.4.0 and up.
interface StreamInfo {
    icestats: {
        admin: string;
        host: string;
        location: string;
        server_id: string;
        server_start: string;
        server_start_iso8601: string;
        source?: IcecastSource | IcecastSource[];
    }
}
interface IcecastSource {
    audio_info: string;
    bitrate: number;
    genre: string;
    ice_bitrate: number;
    ice_channels: number;
    ice_samplerate: number;
    listener_peak: number;
    listeners: number;
    listenurl: string;
    server_description: string;
    server_name: string;
    server_type: string;
    server_url: string;
    stream_start: string;
    stream_start_iso8601: string;
    title: string;
    dummy: null;
}
export class IcecastExtractor extends BaseExtractor<IcecastExtractorOptions> {
    static identifier = "icecastExtractor" as const;
    
    // this method is called when your extractor is loaded into discord-player's registry
    async activate(): Promise<void> {
        // do something here, such as initializing APIs or whatever

        // you can access initialization options using
        const initOptions = this.options;
        if (initOptions.baller == true) {
            icecastExtractorLogger.silly('Baller mode activated.');
        }
        // in order to access Player instance, use
        //const player = this.context.player;
        // to register protocol, use
        this.protocols = ['icecast'];
    }
    
    // discord-player calls this method when your extractor is removed from its registry
    async deactivate(): Promise<void> {
        // do something here, such as disconnecting from API or cleanup or whatever it is
        // remove protocol for example
        this.protocols = [];
    }
    
    // discord-player calls this method when it wants some metadata from you. When you return true, discord-player will use you for further processing. If you return false here, discord-player will query another extractor from its registry.
    async validate(query: string): Promise<boolean> {
        return this.validateQuery(query);
    }
    private async validateQuery(query: string): Promise<boolean> {
        icecastExtractorLogger.debug(`Validating query "${query}"`);
        if (typeof query !== "string") return false;
        if (query.startsWith(this.protocols[0] + ":")) return true;
        return false;
    }
    
    // discord-player calls this method when it wants a search result. It is called with the search query and a context parameter (options passed to player.search() method)
    async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
        icecastExtractorLogger.debug(`Handling query "${query}"`);
        if (!query.includes("://")) {
            if (query.startsWith('//')) {
                query = 'http:' + query;
            }
            else {
                query = 'http://' + query;
            }
        }
        icecastExtractorLogger.debug(`Processed query to "${query}"`);
        const name = await this.getStreamInfo(query);
        const track = new Track<TrackMetadata>(this.context.player, {
            title: name.serverName || "Unknown Stream",
            url: 'icecast://' + query,
            description: 'Icecast Stream',
            duration: '∞', 
            live: true,
            thumbnail: this.getLinkDomain(query) + '/favicon.ico',
            metadata: {
                startedPlaying: new Date(),
            },
            requestedBy: context.requestedBy,
        },);
        const tracks = [track];

        return this.createResponse(null, tracks);
    }

    private getLinkDomain(url: string) {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.protocol + '//' + parsedUrl.hostname;
        }
        catch (e) {
            throw new Error("Invalid URL", e);
        }
    }

    private async getStreamInfo(url: string) {
        const res = await axios.get<StreamInfo>(this.getLinkDomain(url) + '/status-json.xsl', { timeout: 10000 });
        if (res.status !== 200) {
            throw new Error(`Failed to fetch stream info (${res.status})`);
        }
        const streamInfo = res.data;
        if (!streamInfo.icestats || !streamInfo.icestats.source) {
            // Fallback to legacy method
            return this.getStreamInfoLegacy(url);
        }
        else {
            if (Array.isArray(streamInfo.icestats.source)) {
                // Find the source that matches the URL path
                const urlObj = new URL(url);
                const path = urlObj.pathname;
                const matchedSource = streamInfo.icestats.source.find(source => {
                    const sourceUrlObj = new URL(source.listenurl, this.getLinkDomain(url));
                    return sourceUrlObj.pathname === path;
                });
                if (matchedSource) {
                    return { serverName: matchedSource.server_name };
                }
                else {
                    // If no match, return the first source
                    return { serverName: streamInfo.icestats.source[0].server_name };
                }
            }
            else {
                return { serverName: streamInfo.icestats.source.server_name };
            }
        }
    }

    private async getStreamInfoLegacy(url: string) {
        const res = await axios.get<string>(url + '.vclt', { timeout: 10000 });
        if (res.status !== 200) {
            throw new Error(`Failed to fetch stream info (${res.status})`);
        }
        const vclt = res.data;
        if (!vclt) {
            throw new Error("Invalid stream info");
        }
        const lines = vclt.split('\n');
        if (lines.length < 2) {
            throw new Error("Invalid stream info format");
        }
        if (lines[2].startsWith("SERVER_NAME")) {
            const serverName = lines[2].split('=')[1].trim();
            return { serverName };
        }
        else {
            throw new Error("SERVER_NAME not found in stream info");
        }
    }

    private async fetchRemoteStream(url: string): Promise<Readable> {
        const res = await axios.get(url, {
            responseType: 'stream',
            headers: {
                'Accept': '*/*'
            },
            timeout: 15000
        });
        if (res.status !== 200) {
            throw new Error(`Stream request failed (${res.status})`);
        }
        return res.data as Readable;
    }

    async stream(track: Track<TrackMetadata>): Promise<Readable> {
        if (track.url.startsWith('icecast://') && track.url.includes("http")) {
            track.url = track.url.replace('icecast://', '');
        }
        return this.fetchRemoteStream(track.url);
    }

    // discord-player calls this method when it wants some tracks for autoplay mode.
    // Relate your ass, tf is this supposed to mean.
    async getRelatedTracks(track: Track<TrackMetadata>): Promise<ExtractorInfo> {
        return this.createResponse(null, [track]);
    }
}