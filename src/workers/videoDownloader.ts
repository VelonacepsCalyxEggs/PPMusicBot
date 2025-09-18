import { existsSync } from "fs";
import { exit } from "process";
import { CallbackEvent } from "src/services/YTDLFallbackService";
import { workerData, parentPort, MessagePort } from "worker_threads";
import YTDlpWrap from 'yt-dlp-wrap';

interface VideoDownloadWorkerData {
    videoUrl: string;
    filePath: string;
}

async function downloadVideo(url: string, filePath: string, parentPort: MessagePort) {
    return new Promise<void>((resolve, reject) => {
        try {
            const ytDlpWrap = new YTDlpWrap(process.env.YTDLP_PATH || 'yt-dlp');
            
            ytDlpWrap
                .exec([
                    url,
                    '-f',
                    'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best[height<=720]',
                    '-o',
                    filePath,
                    '--extract-audio',
                    '--audio-format', 'mp3',
                    '--no-playlist',
                    '--ignore-errors',
                    '--no-warnings',
                    '--embed-metadata',
                    '--retries', '3',
                    '--socket-timeout', '30'
                ])
                .on('progress', (progress) => {
                        console.log(
                            `Progress: ${progress.percent}%`,
                            `Size: ${progress.totalSize}`,
                            `Speed: ${progress.currentSpeed}`,
                            `ETA: ${progress.eta}`
                        )
                        if (progress.percent && progress.percent % 25 === 1) {
                            parentPort.postMessage({
                                videoUrl: url,
                                message: `Progress: ${progress.percent}%`,
                            } as CallbackEvent)
                        } 
                    }
                )
                .on('ytDlpEvent', (eventType, eventData) => {
                    console.log(`yt-dlp event: ${eventType}`, eventData);
                })
                .on('error', (error) => {
                    console.error('yt-dlp error:', error);
                    reject(new Error(`yt-dlp process error: ${error.message}`));
                })
                .on('close', (code) => {
                    console.log(`yt-dlp process exited with code: ${code}`);
                    if (code === 0) {
                        console.log('Download completed successfully');
                        resolve();
                    } else {
                        reject(new Error(`yt-dlp failed with exit code ${code}. Check if the video is available and not geo-blocked.`));
                    }
                });
        } catch (error) {
            console.error('Failed to initialize yt-dlp:', error);
            reject(error);
        }
    });
}

async function main() {
    const data = workerData as VideoDownloadWorkerData;
    const videoUrl = data.videoUrl;
    const filePath = data.filePath;
    try {
        if (!parentPort) throw new Error("Parent port is not available in this worker thread.");
        if (existsSync(filePath)) {
            parentPort.postMessage(filePath);
            exit(0);
        }
        console.log(`Starting download of: ${videoUrl}`);
        console.log(`Output path: ${filePath}`);
        
        await downloadVideo(videoUrl, filePath, parentPort);
        
        // Send the file path back to the main thread
        parentPort.postMessage({
                videoUrl: videoUrl,
                message: `Download finished succsessfully.`,
                filePath: filePath  
            } as CallbackEvent)
        
        exit(0); // Exit the worker thread gracefully
    } catch (error) {
        console.error('Worker error:', error);
        if (parentPort)
            parentPort.postMessage({
                videoUrl: videoUrl,
                message: `Download failed with error: ${(error as Error).message}`,
                error: (error as Error).message,   
            } as CallbackEvent)
        exit(1);
    }
}

main();
