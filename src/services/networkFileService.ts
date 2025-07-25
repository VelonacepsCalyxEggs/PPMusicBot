import axios from 'axios';
import { ServiceInterface } from '../types/serviceInterface';
import { Player, SearchResult, QueryType } from 'discord-player';
import { User } from 'discord.js';
import { createCipheriv, createHash } from 'crypto';
import { networkFileSerivceLogger } from '../utils/loggerUtil';

export class NetworkFileService extends ServiceInterface {
    private readonly baseUrl: string;
    private readonly apiKey: string;
    public readonly serviceName: string = "NetworkFileService";
    private readonly useWebserver: boolean;
    private readonly encryptionKey: Buffer;
    private readonly cipherAlgorithm: string;
    private readonly serviceName_auth: string = 'sharing'; // Service name for authentication
    private readonly token: string;

    // Encryption here is dumb, anyone still can get the encrypted token, and it will work, 
    // since all the server does is decrypt it and check if it's valid, I need token rotation, 
    // and this system that I for some reason thought was a good idea needs to go.
    // But for now, this is what I have, and it works...

    constructor() {
        super();
        this.baseUrl = process.env.FILEWEBSERVER_URL || 'http://localhost:4000';
        this.apiKey = process.env.FILEWEBSERVER_API_KEY || '';
        this.useWebserver = process.env.USE_WEBSERVER === 'true';
        
        // Ensure the encryption key matches the server's normalization
        const rawKey = process.env.ENCRYPTION_KEY || '';
        if (this.useWebserver && !rawKey) {
            throw new Error('ENCRYPTION_KEY is required when using webserver');
        }
        if (!process.env.ENCRYPTION_ALGORITHM) {
            this.cipherAlgorithm = 'aes-256-cbc'; // Default to AES-256-CBC
        }
        else {
            this.cipherAlgorithm = process.env.ENCRYPTION_ALGORITHM;
        }
        
        if (this.cipherAlgorithm.includes('aes-256')) {
            // Use AES-256-CBC which requires a 32-byte key
            if (rawKey.length < 32) {
                throw new Error('ENCRYPTION_KEY must be at least 32 characters for AES-256');
            }
            this.encryptionKey = createHash('sha256').update(rawKey).digest().subarray(0, 32);
        } else if (this.cipherAlgorithm.includes('aes-128')) {
            // Use AES-128-ECB which requires a 16-byte key
            if (rawKey.length < 16) {
                throw new Error('ENCRYPTION_KEY must be at least 16 characters for AES-128');
            }
            this.encryptionKey = createHash('sha256').update(rawKey).digest().subarray(0, 16);
        } else {
            throw new Error(`Unsupported encryption algorithm: ${this.cipherAlgorithm}`);
        }

        this.token = this.generateToken();
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
        const cipher = createCipheriv(this.cipherAlgorithm, this.encryptionKey, null);
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