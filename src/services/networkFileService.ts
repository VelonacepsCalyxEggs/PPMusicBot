import axios from 'axios';
import { ServiceInterface } from '../types/serviceInterface';
import { Player, SearchResult, QueryType } from 'discord-player';
import { User } from 'discord.js';

export class NetworkFileService extends ServiceInterface {
    private readonly baseUrl: string;
    private readonly apiKey: string;
    public readonly serviceName: string = "NetworkFileService";
    private readonly useWebserver: boolean;

    constructor() {
        super();
        this.baseUrl = process.env.FILEWEBSERVER_URL || 'http://192.168.0.50:4000';
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

        // Use web server streaming endpoint
        return `${this.baseUrl}/createMusicStream/${fileId}`;
    }

    /**
     * Get headers for authenticated requests
     */
    getStreamHeaders(): Record<string, string> {
        if (!this.useWebserver) {
            return {};
        }

        return {
            'x-api-key': this.apiKey,
            'x-service-name': 'sharing',
        };
    }

    /**
     * Test if the file server is accessible
     */
    async testConnection(): Promise<boolean> {
        if (!this.useWebserver) {
            return true; // Local files don't need connection test
        }

        try {
            const response = await axios.get(`${this.baseUrl}/health/temp`, {
                headers: this.getStreamHeaders(),
                timeout: 5000,
            });
            return response.status === 200;
        } catch (error) {
            console.error('File server connection test failed:', error);
            return false;
        }
    }

    /**
     * Get an authenticated URL with embedded token
     */
    async getAuthenticatedUrl(fileId: string): Promise<string> {
        if (!this.useWebserver) {
            return '';
        }

        // Generate a temporary token or use query parameters
        const token = Buffer.from(`${this.apiKey}:sharing`).toString('base64');
        return `${this.baseUrl}/file/createMusicStream/${fileId}?token=${token}`;
    }

    /**
     * Search for a track using either local file or web stream
     */
    async searchTrack(
        player: Player, 
        fileId: string, 
        localPath: string, 
        requestedBy: User
    ): Promise<SearchResult> {
        if (!this.useWebserver) {
            // Use local file path
            return await player.search(localPath, {
                requestedBy,
                searchEngine: QueryType.FILE,
            });
        }

        // Use authenticated URL
        const streamUrl = await this.getAuthenticatedUrl(fileId);
        
        // Create a custom search result for streaming
        return await player.search(streamUrl, {
            requestedBy,
            searchEngine: QueryType.AUTO,
        });
    }
}