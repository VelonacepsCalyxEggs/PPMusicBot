import ytdl from '@distube/ytdl-core';
import { ServiceInterface } from '../types/serviceInterface';
import { writeFile } from 'fs/promises';
export class YtdlFallbackService extends ServiceInterface {

    public async init(): Promise<void> {
        this.serviceName = 'YtdlFallbackService';
        this.serviceDescription = 'Service to handle YouTube video downloads using ytdl-core fallback methods.';
    }

    private async downloadVideo(url: string): Promise<Buffer> {
        try {
            const videoStream = await ytdl(url, {
                quality: 'highest',
                filter: 'audioonly',
                highWaterMark: 1 << 25 // 32MB buffer
            });

            const chunks: Buffer[] = [];
            for await (const chunk of videoStream) {
                chunks.push(chunk);
            }
            return Buffer.concat(chunks);
        } catch (error) {
            throw new Error(`Failed to download video from ${url}: ${error.message}`);
        }
    }

    private async saveVideoToCache(url: string, buffer: Buffer): Promise<string> {
        const fileName = `video-${Date.now()}.mp4`;
        const filePath = `./cache/${fileName}`;
        try {
            await writeFile(filePath, buffer);
            return filePath;
        } catch (error) {
            throw new Error(`Failed to save video to cache: ${error.message}`);
        }
    }

    public async getVideo(url: string): Promise<string> {
        try {
            const videoBuffer = await this.downloadVideo(url);
            const cachedFilePath = await this.saveVideoToCache(url, videoBuffer);
            return cachedFilePath;
        } catch (error) {
            throw new Error(`Error in YtdlFallbackService: ${error.message}`);
        }
    }
}
