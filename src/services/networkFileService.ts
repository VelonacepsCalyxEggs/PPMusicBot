import axios from 'axios';
import { ServiceInterface } from '../types/serviceInterface';
import { Player, SearchResult, QueryType } from 'discord-player';
import { User } from 'discord.js';
import { networkFileSerivceLogger } from '../utils/loggerUtil';

export class NetworkFileService extends ServiceInterface {
    private readonly baseUrl: string;
    private readonly apiKey: string;
    public readonly serviceName: string = "NetworkFileService";
    private readonly useWebserver: boolean;
    private readonly serviceName_auth: string = 'sharing'; // Service name for authentication

    constructor() {
        super();
        // Please use http only for local development
        this.baseUrl = process.env.FILEWEBSERVER_URL || 'http://localhost:4000';
        this.apiKey = process.env.FILEWEBSERVER_API_KEY || '';
        this.useWebserver = process.env.USE_WEBSERVER === 'true';
    }

    public init(): Promise<void> {
        this.serviceDescription = "Service for handling network file operations, including streaming and downloading music files.";
        return Promise.resolve();
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
            networkFileSerivceLogger.error('NetworkFileService connection test failed:', error);
            return false;
        }
    }

    /**
     * Search for a track using either local file or web stream
     */
    async searchTrack(
        player: Player, 
        fileId: string, 
        localPath: string, 
        requestedBy: User,
        ignoreUrlFormatting: boolean = false
    ): Promise<SearchResult> {
        if (!this.useWebserver) {
            // Use local file path
            return await player.search(localPath, {
                    requestedBy,
                    searchEngine: QueryType.FILE,
            })
        }
        let streamUrl: string
        if (!ignoreUrlFormatting) streamUrl =  this.getFileUrl(fileId, localPath);
        else streamUrl = localPath; // Use the provided local path directly if ignoreUrlFormatting is true
        // Create a custom search result for streaming
        return await player.search(streamUrl, {
            requestedBy,
            searchEngine: QueryType.AUTO,
            requestOptions: {
                headers: {
                    'User-Agent': 'PPMusicBot',
                    'x-api-key': this.apiKey,
                    'x-service-name': this.serviceName_auth,
                }
            }
        });
    }
}