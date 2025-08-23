import axios from "axios";
import { BaseExtractor, ExtractorInfo, ExtractorSearchContext, Track } from "discord-player/dist";
import { kenobiAPIExtractorLogger } from "src/utils/loggerUtil";
import { Readable } from "stream";
import { MusicTrack } from "velonaceps-music-shared/dist";
import { createReadStream } from "fs";
export interface KenobiAPITrackMetadata {
    id: string;
    uploadedBy: string;
    fromAlbum: string;
    albumId: string;
}
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
        this.protocols = ['album:', 'track:'];
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
        if (typeof query !== "string") return false;
        if (query.length === 42 && query.includes('-')) {
            return true;
        }
        return false;
    }
    
    // discord-player calls this method when it wants a search result. It is called with the search query and a context parameter (options passed to player.search() method)
    async handle(query: string, context: ExtractorSearchContext): Promise<ExtractorInfo> {
            let url = '';
            if (query.startsWith("album:")) {
                url = `${this.baseUrl}/music?albumId=${query.split(":").pop()}&limit=1000&sortBy=trackNumber&sortOrder=asc`
            }
            else {
                url = `${this.baseUrl}/music?id=${query.split(":").pop()}`
            }
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
            const tracks = response.data.data.map(track => 
                new Track(this.context.player, {
                    title: track.title,
                    author: track.artist.name,
                    url: this.getFileUrl(track.id, track.MusicFile[0].filePath),
                    thumbnail: (track.MusicMetadata?.coverArt?.filePath || response.data[0].album.coverArt[0]?.filePath)?.replace("C://xampp/htdocs//", "https://www.funckenobi42.space/") || '',
                    duration: String(track.duration * 1000),
                    requestedBy: context.requestedBy,
                    metadata: {
                        id: track.id,
                        uploadedBy: track.uploader?.username || 'Unknown',
                        fromAlbum: response.data[0]?.album?.name || 'Unknown Album',
                        albumId: response.data[0]?.album?.id || '',
                    },
                    engine: KenobiAPIExtractor.identifier,
                })
            );
            return this.createResponse(null, tracks);
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

    async stream(track: Track<KenobiAPITrackMetadata>): Promise<Readable> {
        // If using the web server, return a live Readable stream
        if (!track.metadata)
            throw new Error('KenobiAPIExtractor: Track metadata is missing.');
        if (this.useWebserver) {
            return this.fetchRemoteStream(track.metadata.id);
        }
        else {
            return this.fetchLocalStream(track.url);
        }
    }

    // discord-player calls this method when it wants some tracks for autoplay mode.
    // Relate your ass, tf is this supposed to mean.
    async getRelatedTracks(track: Track<KenobiAPITrackMetadata>): Promise<ExtractorInfo> {
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