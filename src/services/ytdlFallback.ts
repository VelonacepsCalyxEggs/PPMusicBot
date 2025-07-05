import ytdl, { videoInfo } from '@distube/ytdl-core';
import ytpl from 'ytpl';
import { ServiceInterface } from '../types/serviceInterface';
import { readFile, writeFile } from 'fs/promises';
import { PlaylistTooLargeError, videoCache, YtdlFallbackResponseInterface } from '../types/ytdlServiceTypes';
import { join } from 'path';
import { Player, QueryType, SearchResult, Track } from 'discord-player/dist';
import { User } from 'discord.js';
import { NoTrackFoundError } from '../types/ytdlServiceTypes';
import { playerLogger } from '../utils/loggerUtil';
import { readdirSync } from 'fs';
export class YtdlFallbackService extends ServiceInterface {

    public async init(): Promise<void> {
        this.serviceName = 'YtdlFallbackService';
        this.serviceDescription = 'Service to handle YouTube video downloads using ytdl-core methods.';
    }

    private async downloadVideo(url: string): Promise<Buffer> {
        playerLogger.debug(`Downloading video from URL: ${url}`);
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

    private async extractMetadata(url: string): Promise<ytdl.videoInfo> {
        try {
            return await ytdl.getInfo(url);
        } catch (error) {
            throw new Error(`Failed to extract metadata from ${url}: ${error.message}`);
        }
    }

    private async getCachedVideo(videoId: string): Promise<YtdlFallbackResponseInterface | null> {
        playerLogger.debug(`Checking cache for video ID: ${videoId}`);
        try {
            const files = JSON.parse(await readFile(join(process.env.CACHE_DIR || './cache', 'cachedVideos.json'), 'utf-8')) as videoCache;
            if (files[videoId]) {
                playerLogger.debug(`Found cached video: ${files[videoId].filePath}`);
                return files[videoId];
            } else {
                playerLogger.debug(`No cached video found for ID: ${videoId}`);
                return null;
            }
        }
        catch (error) {
            playerLogger.error(`Error reading cache file: ${error.message}`);
            return null;
        }
    }

    private getCachedPlaylist(playlistId: string): string | null {
        const files = readdirSync(process.env.CACHE_DIR || './cache');
        for (const file of files) {
            if (file === `${playlistId}.json`) {
                const filePath = join(process.env.CACHE_DIR || './cache', file);
                playerLogger.debug(`Found cached playlist: ${filePath}`);
                return filePath;
            }
        }
        return null;
    }

    private async saveVideoToCache(videoData: videoInfo, buffer: Buffer): Promise<string> {
        const fileName = `${videoData.videoDetails.videoId}.mp3`;
        const filePath = join(process.env.CACHE_DIR || './cache', fileName);
        try {
            await this.cacheVideoAsJson(videoData);
            await writeFile(filePath, buffer);
            return filePath;
        } catch (error) {
            throw new Error(`Failed to save video to cache: ${error.message}`);
        }
    }

    private async cacheVideoAsJson(videoData: videoInfo): Promise<void> {
        const filePath = join(process.env.CACHE_DIR || './cache', `cachedVideos.json`);
        try {
            let cachedVideos: videoCache = {};
            try {
                const data = await readFile(filePath, 'utf-8');
                cachedVideos = JSON.parse(data);
            } catch (error) {
                playerLogger.debug(`No existing cache file found, creating new one.`);
            }
            cachedVideos[videoData.videoDetails.videoId] = { filePath: join(process.env.CACHE_DIR || './cache', videoData.videoDetails.videoId + '.mp3'), metadata: videoData };
            await writeFile(filePath, JSON.stringify(cachedVideos, null, 2));
            playerLogger.debug(`Video metadata cached successfully for video ID: ${videoData.videoDetails.videoId}`);
        } catch (error) {
            throw new Error(`Error caching video metadata: ${error.message}`);
        }
    }

    public async getVideo(url: string): Promise<YtdlFallbackResponseInterface> {
        try {
            playerLogger.debug(`Getting video from URL: ${url}`);
            const videoId = ytdl.getURLVideoID(url);
            const cachedVideo = await this.getCachedVideo(videoId)
            if (cachedVideo) {
                playerLogger.debug(`Using cached video: ${cachedVideo.filePath}`);
                return { filePath: cachedVideo.filePath, metadata: cachedVideo.metadata };
            }
            const videoBuffer = await this.downloadVideo(url);
            const videoMetadata = await this.extractMetadata(url);
            const filePath = await this.saveVideoToCache(videoMetadata, videoBuffer);
            return { filePath: filePath, metadata: videoMetadata };
        } catch (error) {
            throw new Error(`Error in YtdlFallbackService: ${error.message}`);
        }
    }

    public async getPlaylist(url: string): Promise<YtdlFallbackResponseInterface[]> {
        try {
            let playlist: ytpl.Result;
            const playlistItems: YtdlFallbackResponseInterface[] = [];
            const cachedPlaylist = this.getCachedPlaylist(await ytpl.getPlaylistID(url));
            if (cachedPlaylist) {
                playerLogger.debug(`Using cached playlist: ${cachedPlaylist}`);
                const cachedData: ytpl.Result = JSON.parse(await readFile(cachedPlaylist, 'utf-8'));
                playlist = cachedData;
            }
            else {
                playlist = await ytpl(url);
                await this.cachePlaylistAsJson(playlist);
            }

            if (playlist.items.length > 32) {
                throw new PlaylistTooLargeError('Playlist contains more than 32 items, which is currently not supported for my sanity...');
            }
            playerLogger.debug(`Processing playlist: ${playlist.title} with ${playlist.items.length} items`);
            playerLogger.debug(playlist.items.map(item => `Item: ${item.title}, URL: ${item.url}`).join('\n'));
            for (const item of playlist.items) {
                try {
                const video = await this.getVideo(item.url)
                
                playlistItems.push({
                    filePath: video.filePath,
                    metadata: video.metadata,
                    playlistMetadata: {
                        title: playlist.title,
                        author: playlist.author?.name || '',
                        thumbnail: playlist.bestThumbnail.url || ''
                    }
                });
                } catch (error) {
                console.error(`Skipping ${item.title}: ${error.message}`);
                }
            }

            return playlistItems;
        } catch (error) {
        throw new Error(`Failed to process playlist: ${error.message}`);
        }
    }

    public async playVideo(url: string, player: Player, user?: User): Promise<Track<unknown>> {
        try {
            const videoData = await this.getVideo(url);
            const searchResult = await this.searchFile(player, videoData.filePath, user);
            if (!searchResult.tracks.length) {
                throw new NoTrackFoundError('No tracks found for the downloaded video.',);
            }
            searchResult.tracks[0].title = videoData.metadata.videoDetails.title;
            searchResult.tracks[0].author = videoData.metadata.videoDetails.author.name;
            searchResult.tracks[0].thumbnail = videoData.metadata.videoDetails.thumbnails[0].url;
            searchResult.tracks[0].url = videoData.metadata.videoDetails.video_url || '#';
            return searchResult.tracks[0];
        } catch (error) {
            throw new Error(`Failed to play video: ${error.message}`);
        }
    }
    
    
    public async playPlaylist(url: string, player: Player, user?: User): Promise<SearchResult> {
        try {
        const playlistData = await this.getPlaylist(url);
        const tracks: Track<unknown>[] = [];

        for (const item of playlistData) {
            const searchResult = await this.searchFile(player, item.filePath, user);
            if (searchResult.tracks.length) {
            const track = searchResult.tracks[0];
            track.title = item.metadata.videoDetails.title;
            track.author = item.metadata.videoDetails.author.name;
            track.thumbnail = item.metadata.videoDetails.thumbnails[0]?.url;
            track.url = item.metadata.videoDetails.video_url || '#';
            tracks.push(track);
            }
        }
        return {
            tracks,
            playlist: {
                title: playlistData[0]?.playlistMetadata?.title || 'YouTube Playlist',
                tracks: tracks,
                type: 'playlist',
                source: url,
                thumbnail: playlistData[0]?.playlistMetadata?.thumbnail || '',
            }
        } as SearchResult;
        } catch (error) {
        throw new Error(`Failed to play playlist: ${error.message}`);
        }
    }

    private async searchFile(player: Player, filePath: string, requestedBy?: User): Promise<SearchResult> {
        return await player.search(filePath, {
            requestedBy,
            searchEngine: QueryType.FILE
        });
    }

    public async cachePlaylistAsJson(playlist: ytpl.Result): Promise<void> {
        JSON.stringify(playlist, null, 2);
        const fileName = `${playlist.id.trim()}.json`;
        const filePath = join(process.env.CACHE_DIR || './cache', fileName);
        try {
            await writeFile(filePath, JSON.stringify(playlist, null, 2));
            playerLogger.debug(`Playlist cached successfully at ${filePath}`);
        } catch (error) {
            throw new Error(`Error caching playlist: ${error.message}`);
        }
    }

    private async delay(ms: number) {
        return new Promise( resolve => setTimeout(resolve, ms) );
    }
}
