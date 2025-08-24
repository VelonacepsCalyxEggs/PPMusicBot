import axios from "axios";
import { BaseExtractor, ExtractorInfo, ExtractorSearchContext, Playlist, Track } from "discord-player/dist";
import { kenobiAPIExtractorLogger } from "../utils/loggerUtil";
import { Readable } from "stream";
import { MusicTrack } from "velonaceps-music-shared/dist";
import { createReadStream } from "fs";
import TrackMetadata from "src/types/trackMetadata";
// Placeholder for now.
export interface kenobiAPIExtractorOptions {
    baller: boolean;
}

export class KenobiAPIExtractor extends BaseExtractor<kenobiAPIExtractorOptions> {
    static identifier = "kenobiAPI" as const;
    private readonly baseUrl = process.env.FILEWEBSERVER_URL || 'http://localhost:4000';
    private readonly apiKey = process.env.FILEWEBSERVER_API_KEY || '';
    private readonly useWebserver = process.env.USE_WEBSERVER === 'true';
    private readonly serviceName_auth = 'sharing';
    
    public createBridgeQuery = (track: Track) =>
    `${track.title} by ${track.author} official audio`;
    
    // this method is called when your extractor is loaded into discord-player's registry
    async activate(): Promise<void> {
        // do something here, such as initializing APIs or whatever

        // you can access initialization options using
        const initOptions = this.options;
        if (initOptions.baller == true) {
            kenobiAPIExtractorLogger.silly('Baller mode activated.');
        }
        // in order to access Player instance, use
        //const player = this.context.player;
        if (!await this.testConnection()) {
            kenobiAPIExtractorLogger.warn('KenobiAPIExtractor: Unable to connect to the file server. Extractor will be disabled.');
            throw new Error('KenobiAPIExtractor: Unable to connect to the file server.');
        }
        // to register protocol, use
        this.protocols = ['album', 'track'];
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
        kenobiAPIExtractorLogger.debug(`KenobiAPIExtractor: Validating query "${query}"`);
        if (typeof query !== "string") return false;
        if ((query.length === 42 || query.length === 36) && query.includes('-') || 
            query.includes(this.baseUrl + '/file/createMusicStream/') || 
                query.includes("www.funckenobi42.space/music/track/")) {
            return true;
        }
        return false;
    }
    
    // discord-player calls this method when it wants a search result. It is called with the search query and a context parameter (options passed to player.search() method)
    async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
            let url = '';
            if (context.protocol === 'album') {
                kenobiAPIExtractorLogger.debug(`Album query detected: ${query}`);
                url = `${this.baseUrl}/music?albumId=${query.split(":").pop()}&limit=1000&sortBy=trackNumber&sortOrder=asc`
            }
            else if (context.protocol === 'track') {
                kenobiAPIExtractorLogger.debug(`Track query detected: ${query}`);
                url = `${this.baseUrl}/music?id=${query.split(":").pop()}`
            }
            else if (query.includes(this.baseUrl) && query.includes('createMusicStream')) {
                kenobiAPIExtractorLogger.debug(`Direct track URL detected, how sophisticated: ${query}`);
                url = `${this.baseUrl}/music?id=${query.split("/").pop()}`
            }
            else {
                // Fallback for other queries - treat as direct ID
                kenobiAPIExtractorLogger.debug(`Fallback query detected, treating as direct ID: ${query}`);
                url = `${this.baseUrl}/music?id=${query}`
            }
            kenobiAPIExtractorLogger.debug(`Fetching track data from Kenobi API for URL: ${url}`);
            const response = await axios.request<{ data: MusicTrack[] }>({
                    method: 'GET',
                    url
            })
            if (response.status !== 200) {
                throw new Error(`KenobiAPIExtractor: Failed to fetch album data, status code ${response.status}`);
            }
            kenobiAPIExtractorLogger.debug(`KenobiAPIExtractor: Fetched ${response.data.data.length} tracks from Kenobi API for query "${query}"`);
            if (response.data.data.length > 1) {
                // If it's an album, sort the tracks properly
                response.data.data = this.sortAlbumTracks(response.data.data);
            }
            let playlist: Playlist | null = null;
            const tracks = response.data.data.map(track => 
                new Track<TrackMetadata>(this.context.player, {
                    title: track.title,
                    author: track.artist.name,
                    url:  "https://www.funckenobi42.space/music/track/" + track.id,
                    thumbnail: "https://www.funckenobi42.space/" + response.data.data[0].album.id,
                    duration: String(track.duration * 1000),
                    requestedBy: context.requestedBy,
                    metadata: {
                        startedPlaying: new Date(),
                        id: track.id,
                        fileId: track.MusicFile[0].id,
                        uploadedBy: track.uploader?.username || 'Unknown',
                        fromAlbum: response.data.data[0]?.album?.name || 'Unknown Album',
                        albumId: response.data.data[0]?.album?.id || '',
                    },
                    engine: KenobiAPIExtractor.identifier,
                })
            );
            if (tracks.length > 1) {
                playlist = new Playlist(this.context.player, {
                    title: response.data.data[0].album.name || 'Unknown Album',
                    thumbnail: "https://www.funckenobi42.space/" + response.data.data[0].album.id,
                    type: 'album',
                    tracks,
                    source: 'arbitrary',
                    author: {
                        name: response.data.data[0].album.Artists?.[0]?.name || response.data.data[0].artist?.name || 'Unknown Artist',
                        url: '',
                    },
                    id: response.data.data[0].album.id || '',
                    url: 'album:' + (response.data.data[0].album.id || ''),
                    description: 'Album fetched from Kenobi API',
                });
            }
            return this.createResponse(playlist, tracks);
    }
    private async fetchRemoteStream(fileId: string): Promise<Readable> {
        const url = `${this.baseUrl}/file/createMusicStream/${fileId}`;
        const res = await axios.get(url, {
            responseType: 'stream',
            headers: {
                'x-api-key': this.apiKey,
                'x-service-name': this.serviceName_auth,
                'Accept': '*/*'
            },
            timeout: 15000
        });
        if (res.status !== 200) {
            throw new Error(`Stream request failed (${res.status})`);
        }
        return res.data as Readable;
    }

    private fetchLocalStream(filePath: string): Readable {
        return createReadStream(filePath);
    }

    async stream(track: Track<TrackMetadata>): Promise<Readable> {
        kenobiAPIExtractorLogger.debug(`KenobiAPIExtractor: Preparing to stream track "${track.title}" (${track.url})`);
        // If using the web server, return a live Readable stream
        if (!track.metadata?.fileId)
            throw new Error('KenobiAPIExtractor: Track metadata is missing.');
        if (this.useWebserver) {
            return this.fetchRemoteStream(track.metadata.fileId);
        }
        else {
            return this.fetchLocalStream(track.url);
        }
    }

    // discord-player calls this method when it wants some tracks for autoplay mode.
    // Relate your ass, tf is this supposed to mean.
    async getRelatedTracks(track: Track<TrackMetadata>): Promise<ExtractorInfo> {
        return this.createResponse(null, [track]);
    }

    /**
     * Get the appropriate file URL/path based on configuration
     */
    getFileUrl(fileId: string, localPath?: string): string {
        if (!this.useWebserver) {
            // Use local file path
            return localPath || '';
        }

        return `${this.baseUrl}/file/createMusicStream/${fileId}`;
    }

    /**
     * Test if the file server is accessible
     */
    async testConnection(): Promise<boolean> {
        if (!this.useWebserver) {
            return true; // Local files don't need connection test
        }

        try {
            const response = await axios.get(`${this.baseUrl}/health/temp/OBIWANSERVER`, {
                timeout: 5000,
            });
            return response.status === 200;
        } catch (error) {
            kenobiAPIExtractorLogger.error('NetworkFileService connection test failed:', error);
            return false;
        }
    }

    // Helper method for sorting album tracks
    private sortAlbumTracks(foundAlbum: MusicTrack[]): MusicTrack[] {
        // Skip sorting if there's no data
        if (!foundAlbum || foundAlbum.length === 0) return foundAlbum;
        
        // Group tracks by disc number
        const discGroups = new Map<string | number | undefined, MusicTrack[]>();
        
        // Create groups based on disc number
        for (const track of foundAlbum) {
            let discNumber = track.MusicMetadata?.discNumber;
            if (discNumber === null) discNumber = undefined;
            if (!discGroups.has(discNumber)) {
                discGroups.set(discNumber, []);
            }
            discGroups.get(discNumber)!.push(track);
        }
        
        // Sort disc groups: numbers first (in numerical order), then strings (alphabetically)
        const sortedGroups = Array.from(discGroups.entries()).sort((a, b) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [discA, _] = a;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [discB, __] = b;
            
            // Handle undefined disc numbers
            if (discA === undefined) return -1;
            if (discB === undefined) return 1;
            
            // Check if both values can be treated as numbers
            const numA = typeof discA === 'number' ? discA : Number(discA);
            const numB = typeof discB === 'number' ? discB : Number(discB);
            const aIsNumber = !isNaN(numA);
            const bIsNumber = !isNaN(numB);
            
            // Numbers before strings
            if (aIsNumber && !bIsNumber) return -1;
            if (!aIsNumber && bIsNumber) return 1;
            
            // Both numbers - sort numerically
            if (aIsNumber && bIsNumber) return numA - numB;
            
            // Both strings - sort alphabetically
            return String(discA).localeCompare(String(discB));
        });
        
        // Flatten back into a single array
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return sortedGroups.flatMap(([_, tracks]) => tracks);
    }
}