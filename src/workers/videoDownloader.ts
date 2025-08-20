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
            const ytDlpWrap = new YTDlpWrap();
            
            ytDlpWrap
                .exec([
                    url,
                    '-f',
                    'bestaudio[ext=m4a]/bestaudio/best',
                    '-o',
                    filePath,
                    '--extract-audio',
                    '--audio-format', 'mp3'
                ])
                .on('progress', (progress) =>
                    console.log(
                        `Progress: ${progress.percent}%`,
                        `Size: ${progress.totalSize}`,
                        `Speed: ${progress.currentSpeed}`,
                        `ETA: ${progress.eta}`
                    )
                )
                .on('ytDlpEvent', (eventType, eventData) =>
                    console.log(eventType, eventData)
                )
                .on('error', (error) => {
                    console.error('yt-dlp error:', error);
                    reject(error);
                })
                .on('close', (code) => {
                    if (code === 0) {
                        console.log('Download completed successfully');
                        resolve();
                    } else {
                        reject(new Error(`yt-dlp exited with code ${code}`));
                    }
                });
        } catch (error) {
            reject(error);
        }
    });
}

async function main() {
    try {
        const data = workerData as VideoDownloadWorkerData;
        const videoUrl = data.videoUrl;
        const filePath = data.filePath;
        
        await downloadVideo(videoUrl, filePath);
        
        // Send the file path back to the main thread
        if (parentPort) {
            parentPort.postMessage(filePath);
        }
        
        exit(0); // Exit the worker thread gracefully
    } catch (error) {
        console.error('Worker error:', error);
        if (parentPort) {
            parentPort.postMessage({ error: error.message });
        }
        exit(1);
    }
}

main();
