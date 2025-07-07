import axios from 'axios';
import { ServiceInterface } from '../types/serviceInterface';
import { Player, SearchResult, QueryType } from 'discord-player';
import { User } from 'discord.js';
import { createCipheriv, createHash } from 'crypto';

export class NetworkFileService extends ServiceInterface {
    private readonly baseUrl: string;
    private readonly apiKey: string;
    public readonly serviceName: string = "NetworkFileService";
    private readonly useWebserver: boolean;
    private readonly encryptionKey: Buffer;
    private readonly serviceName_auth: string = 'sharing'; // Service name for authentication
    private readonly token: string;

    constructor() {
        super();
        this.baseUrl = process.env.FILEWEBSERVER_URL || 'http://192.168.0.50:4000';
        this.apiKey = process.env.FILEWEBSERVER_API_KEY || '';
        this.useWebserver = process.env.USE_WEBSERVER === 'true';
        
        // Ensure the encryption key matches the server's normalization
        const rawKey = process.env.ENCRYPTION_KEY || '';
        if (this.useWebserver && !rawKey) {
            throw new Error('ENCRYPTION_KEY is required when using webserver');
        }
        
        // Use same key normalization as the server: SHA-256 hash, first 16 bytes
        this.encryptionKey = createHash('sha256').update(rawKey).digest().subarray(0, 16);
        this.token = this.generateToken();
        
        if (this.useWebserver && !this.encryptionKey) {
            throw new Error('ENCRYPTION_KEY is required when using webserver');
        }
    }

    public init(): Promise<void> {
        this.serviceDescription = "Service for handling network file operations, including streaming and downloading music files.";
        return Promise.resolve();
    }

    /**
     * Generate encrypted token for authentication
     * Uses aes-128-ecb which is faster and doesn't require an IV
     */
    private generateToken(): string {
        const payload = `${this.apiKey}:${this.serviceName_auth}`;
        // Use AES-128-ECB mode which is faster and doesn't require IV
        const cipher = createCipheriv('aes-128-ecb', this.encryptionKey, null);
        let encrypted = cipher.update(payload, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    /**
     * Get the appropriate file URL/path based on configuration
     */
    getFileUrl(fileId: string, localPath?: string): string {
        if (!this.useWebserver) {
            // Use local file path
            return localPath || '';
        }

        // Use web server streaming endpoint with token
        return `${this.baseUrl}/createMusicStream/${fileId}?token=${encodeURIComponent(this.token)}`;
    }

    /**
     * Test if the file server is accessible
     */
    async testConnection(): Promise<boolean> {
        if (!this.useWebserver) {
            return true; // Local files don't need connection test
        }

        try {
            const response = await axios.get(`${this.baseUrl}/health/temp?token=${encodeURIComponent(this.token)}`, {
                timeout: 5000,
            });
            return response.status === 200;
        } catch (error) {
            console.error('File server connection test failed:', error);
            return false;
        }
    }

    /**
     * Get an authenticated URL with token
     */
    async getUrl(fileId: string): Promise<string> {
        if (!this.useWebserver) {
            return '';
        }
        
        return `${this.baseUrl}/file/createMusicStream/${fileId}?token=${encodeURIComponent(this.token)}`;
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
                })
        }
        // Use authenticated URL with token
        const streamUrl = await this.getUrl(fileId);
        
        // Create a custom search result for streaming
        return await player.search(streamUrl, {
            requestedBy,
            searchEngine: QueryType.AUTO,
        });
    
    }
}