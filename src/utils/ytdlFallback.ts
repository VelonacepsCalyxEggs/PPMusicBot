import ytdl, { videoInfo } from '@distube/ytdl-core';
import ytpl from 'ytpl';
import { ServiceInterface } from '../types/serviceInterface';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { PlaylistTooLargeError, videoCache, YoutubeDownloadFailedError, YtdlFallbackResponseInterface } from '../types/ytdlServiceTypes';
import { dirname, join } from 'path';
import { GuildQueue, Player, QueryType, SearchResult, Track } from 'discord-player/dist';
import { User } from 'discord.js';
import { NoTrackFoundError } from '../types/ytdlServiceTypes';
import { playerLogger } from '../utils/loggerUtil';
import { appendFileSync, readdirSync } from 'fs';
import YouTube from 'youtube-sr/dist/mod';
import Stream from 'stream';
import { Worker } from 'worker_threads';

interface cachedVideo {
    metadata: {
        videoDetails: {
            videoId: string;
            title: string;
            author: {
                name: string;
            };
            thumbnails: {
                url: string;
            }[];
            duration: string;
            video_url?: string;
        }
    };
    filePath: string;
}

export class YtdlFallback {

    private static async cleanVideoUrl(url: string): Promise<string> {
        playerLogger.debug(`Cleaning URL: ${url}`);
        const cleanUrl: string = '';
        try {
            const urlSplit = url.split('&');
            return urlSplit[0]
        }
        catch (error) {
            playerLogger.error(`Error cleaning URL: ${error.message}`);
            throw new Error(`Failed to clean URL: ${error.message}`);
        }
    }

    private static async downloadVideo(url: string, videoId: string): Promise<string> {
        playerLogger.debug(`Downloading video from URL: ${url}`);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                downloadWorker.terminate();
                reject(new YoutubeDownloadFailedError(`Download timeout after 60 seconds for ${url}`));
            }, 60000); // 60 second timeout

            const downloadWorker = new Worker('./dist/workers/videoDownloader.js', {
                workerData: { videoUrl: url, filePath: join(process.env.CACHE_DIR || './cache', `${videoId}.mp3`) },
            });

            downloadWorker.on('message', (filePath: string) => {
                clearTimeout(timeout);
                playerLogger.info(`Video downloaded successfully to ${filePath}`);
                resolve(filePath);
            });

            downloadWorker.on('error', (error) => {
                clearTimeout(timeout);
                playerLogger.error(`Error downloading video: ${error.message}`);
                reject(new YoutubeDownloadFailedError(`Error downloading video: ${error.message}`));
            });

            downloadWorker.on('exit', (code) => {
                if (code !== 0) {
                    playerLogger.error(`Video download worker exited with code ${code}`);
                    reject(new YoutubeDownloadFailedError(`Video download worker exited with code ${code}`));
                }
            });
        });
    }   

    private static async extractMetadata(url: string): Promise<ytdl.videoInfo> {
        try {
            playerLogger.debug(`Extracting metadata from URL: ${url}`);
            return await ytdl.getInfo(url);
        } catch (error) {
            throw new Error(`Failed to extract metadata from ${url}: ${error.message}`);
        }
    }

    private static getCachedPlaylist(playlistId: string): string | null {
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

    private static async saveVideoToCache(videoData: videoInfo, filePath: string): Promise<string> {
        try {
            await this.cacheVideoAsJson({
                filePath: filePath,
                metadata: {
                    videoDetails: {
                        videoId: videoData.videoDetails.videoId,
                        title: videoData.videoDetails.title,
                        duration: videoData.videoDetails.lengthSeconds,
                        thumbnails: videoData.videoDetails.thumbnails.map(thumbnail => ({ url: thumbnail.url })),
                        author: {
                            name: videoData.videoDetails.author.name
                        }
                    }
                },
            });
            return filePath;
        } catch (error) {
            throw new Error(`Failed to save video to cache: ${error.message}`);
        }
    }

    private static async cacheVideoAsJson(videoData: cachedVideo): Promise<void> {
        const fileName = `${videoData.metadata.videoDetails.videoId}.json`;
        const filePath = join(process.env.CACHE_DIR || './cache', 'metadata', fileName);
        
        try {
            // Ensure metadata directory exists
            const metadataDir = join(process.env.CACHE_DIR || './cache', 'metadata');
            await mkdir(metadataDir, { recursive: true });
            
            await writeFile(filePath, JSON.stringify(videoData, null, 2));
            playerLogger.debug(`Video metadata cached successfully for video ID: ${videoData.metadata.videoDetails.videoId}`);
        } catch (error) {
            throw new Error(`Error caching video metadata: ${error.message}`);
        }
    }

    private static async getCachedVideo(videoId: string): Promise<cachedVideo | null> {
        playerLogger.debug(`Checking cache for video ID: ${videoId}`);
        try {
            const fileName = `${videoId}.json`;
            const filePath = join(process.env.CACHE_DIR || './cache', 'metadata', fileName);
            
            const data = await readFile(filePath, 'utf-8');
            const cachedVideo = JSON.parse(data) as cachedVideo;
            
            playerLogger.debug(`Found cached video: ${cachedVideo.filePath}`);
            return cachedVideo;
        } catch (error) {
            if (error.code === 'ENOENT') {
                playerLogger.debug(`No cached video found for ID: ${videoId}`);
            } else {
                playerLogger.error(`Error reading cache file: ${error.message}`);
            }
            return null;
        }
    }

    public static async getVideo(url: string): Promise<YtdlFallbackResponseInterface | cachedVideo> {
        playerLogger.debug(`Getting video from URL: ${url}`);
        const videoId = ytdl.getURLVideoID(url);
        const cachedVideo = await this.getCachedVideo(videoId)
        if (cachedVideo) {
            playerLogger.debug(`Using cached video: ${cachedVideo.filePath}`);
            return cachedVideo;
        }
        const cleanedUrl = await this.cleanVideoUrl(url);
        const videoFilePath = await this.downloadVideo(cleanedUrl, videoId);
        const videoMetadata = await this.extractMetadata(cleanedUrl);
        // So... If I want to make it a separate worker process, I need save the buffer first, and then save the metadata...
        // Which will require some refactoring.
        await this.saveVideoToCache(videoMetadata, videoFilePath);
        return { filePath: videoFilePath, metadata: videoMetadata };
    }

    public static async getPlaylist(url: string) {
        try {
            let playlist: ytpl.Result;
            const playlistItems: YtdlFallbackResponseInterface[] | cachedVideo[] = [];
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
                const video = await this.getVideo(item.url);

                // Normalize metadata to ensure duration is present
                let normalizedMetadata: any = video.metadata;
                if ('videoDetails' in normalizedMetadata) {
                    if (!('duration' in normalizedMetadata.videoDetails)) {
                        normalizedMetadata = {
                            ...normalizedMetadata,
                            videoDetails: {
                                ...normalizedMetadata.videoDetails,
                                duration: (normalizedMetadata.videoDetails.lengthSeconds || normalizedMetadata.videoDetails.duration || "0")
                            }
                        };
                    }
                }

                playlistItems.push({
                    filePath: video.filePath,
                    metadata: normalizedMetadata,
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

            return {playlistItems, playlistMetadata: {
                title: playlist.title,
                author: playlist.author?.name || '',
                thumbnail: playlist.bestThumbnail.url || ''
            }};
        } catch (error) {
        throw new Error(`Failed to process playlist: ${error.message}`);
        }
    }

    private static async getVideoBySearch(query: string): Promise<string> {
        try {
            playerLogger.debug(`Searching YouTube for: ${query}`);
            const results = await YouTube.search(query, { limit: 1, type: 'video' });
            
            if (results.length === 0) {
                throw new Error('No search results found');
            }
            
            const firstResult = results[0];
            playerLogger.debug(`Found video: ${firstResult.title} by ${firstResult.channel?.name}`);
            return firstResult.url;
        } catch (error) {
            throw new Error(`YouTube search failed: ${error.message}`);
        }
    }

    public static async playVideo(player: Player, url?: string | null, query?: string | null, user?: User): Promise<SearchResult> {
        let searchResult: SearchResult; 
        let videoData: YtdlFallbackResponseInterface | cachedVideo;
        if (url) {
            videoData = await this.getVideo(url);
            searchResult = await this.searchFile(player, videoData.filePath, user);
            if (!searchResult.tracks.length) {
                throw new NoTrackFoundError('No tracks found for the downloaded video.',);
            }
        }
        else {
            if (!query) {
                throw new Error('No URL or query provided for video playback.');
            }
            const videoUrl = await this.getVideoBySearch(query);
            videoData = await this.getVideo(videoUrl);
            searchResult = await this.searchFile(player, videoData.filePath, user);
            if (!searchResult.tracks.length) {
                throw new NoTrackFoundError('No tracks found for the searched video.',);
            }
        }
        searchResult.tracks[0].title = videoData.metadata.videoDetails.title;
        searchResult.tracks[0].author = videoData.metadata.videoDetails.author.name;
        searchResult.tracks[0].thumbnail = videoData.metadata.videoDetails.thumbnails[0].url;
        searchResult.tracks[0].url = videoData.metadata.videoDetails.video_url || '#';
        return searchResult;
    }
    
    
    public static async playPlaylist(url: string, player: Player, user?: User): Promise<SearchResult> {
        try {
        const {playlistItems, playlistMetadata} = await this.getPlaylist(url);
        const tracks: Track<unknown>[] = [];

        for (const item of playlistItems) {
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
                title: playlistMetadata.title || 'YouTube Playlist',
                tracks: tracks,
                type: 'playlist',
                source: url,
                thumbnail: playlistMetadata.thumbnail,
            }
        } as SearchResult;
        } catch (error) {
        throw new Error(`Failed to play playlist: ${error.message}`);
        }
    }

    public static async playPlaylistWithBackground(url: string, player: Player, user?: User, guildQueue?: GuildQueue): Promise<{
        firstTrack: Track<unknown> | null,
        playlistInfo: ytpl.Result,
        backgroundPromise: Promise<void>
    }> {
        let playlist: ytpl.Result;
        const cachedPlaylist = this.getCachedPlaylist(await ytpl.getPlaylistID(url));
        
        if (cachedPlaylist) {
            playerLogger.debug(`Using cached playlist: ${cachedPlaylist}`);
            const cachedData: ytpl.Result = JSON.parse(await readFile(cachedPlaylist, 'utf-8'));
            playlist = cachedData;
        } else {
            playlist = await ytpl(url);
            await this.cachePlaylistAsJson(playlist);
        }

        if (playlist.items.length > 32) {
            throw new PlaylistTooLargeError('Playlist contains more than 32 items, which is currently not supported for my sanity...');
        }

        let firstTrack: Track<unknown> | null = null;
        
        // Process first track immediately
        if (playlist.items.length > 0) {
            const firstItem = playlist.items[0];
                const video = await this.getVideo(firstItem.url);
                const searchResult = await this.searchFile(player, video.filePath, user);
                if (searchResult.tracks.length) {
                    const track = searchResult.tracks[0];
                    track.title = video.metadata.videoDetails.title;
                    track.author = video.metadata.videoDetails.author.name;
                    track.thumbnail = video.metadata.videoDetails.thumbnails[0]?.url;
                    track.url = video.metadata.videoDetails.video_url || '#';
                    firstTrack = track;
                }
        }
        playerLogger.info(`Processing playlist: ${playlist.title} with ${playlist.items.length} items asynchronously.`);
        // Create background promise for remaining tracks
        const backgroundPromise = this.processRemainingTracksAsync(
            playlist.items.slice(1), 
            player, 
            user, 
            guildQueue, 
            playlist
        );

        return {
            firstTrack,
            playlistInfo: playlist,
            backgroundPromise
        };
    }

    private static async processRemainingTracksAsync(
        items: ytpl.Item[], 
        player: Player, 
        user: User | undefined, 
        guildQueue: GuildQueue | undefined, 
        playlist: ytpl.Result
    ): Promise<void> {
        if (!guildQueue) return;
        
        playerLogger.debug(`Processing ${items.length} remaining tracks in background`);
        
        for (const item of items) {
            try {
                const video = await this.getVideo(item.url);
                const searchResult = await this.searchFile(player, video.filePath, user);
                
                if (searchResult.tracks.length) {
                    const track = searchResult.tracks[0];
                    track.title = video.metadata.videoDetails.title;
                    track.author = video.metadata.videoDetails.author.name;
                    track.thumbnail = video.metadata.videoDetails.thumbnails[0]?.url;
                    track.url = video.metadata.videoDetails.video_url || '#';
                    
                    guildQueue.addTrack(track);
                    playerLogger.debug(`Added ${track.title} to queue`);
                }
            } catch (error) {
                playerLogger.error(`Skipping ${item.title}: ${error.message}`);
                throw new YoutubeDownloadFailedError(`Failed to process playlist item ${item.title}: ${error.message}, aborting download.`);
            }
        }
        
        playerLogger.debug(`Finished processing remaining tracks for playlist: ${playlist.title}`);
    }

    private static async searchFile(player: Player, filePath: string, requestedBy?: User): Promise<SearchResult> {
        return await player.search(filePath, {
            requestedBy,
            searchEngine: QueryType.FILE
        });
    }

    public static async cachePlaylistAsJson(playlist: ytpl.Result): Promise<void> {
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
