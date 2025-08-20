import { exit } from "process";
import { workerData, parentPort } from "worker_threads";
import YTDlpWrap from 'yt-dlp-wrap';

interface VideoDownloadWorkerData {
    videoUrl: string;
    filePath: string;
}

async function downloadVideo(url: string, filePath: string) {
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
                .on('progress', (progress) =>
                    console.log(
                        `Progress: ${progress.percent}%`,
                        `Size: ${progress.totalSize}`,
                        `Speed: ${progress.currentSpeed}`,
                        `ETA: ${progress.eta}`
                    )
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
            reject(new Error(`Initialization error: ${error.message}`));
        }
    });
}

async function main() {
    try {
        const data = workerData as VideoDownloadWorkerData;
        const videoUrl = data.videoUrl;
        const filePath = data.filePath;
        
        console.log(`Starting download of: ${videoUrl}`);
        console.log(`Output path: ${filePath}`);
        
        await downloadVideo(videoUrl, filePath);
        
        // Send the file path back to the main thread
        if (parentPort) {
            parentPort.postMessage(filePath);
        }
        
        exit(0); // Exit the worker thread gracefully
    } catch (error) {
        console.error('Worker error:', error);
        exit(1);
    }
}

main();
