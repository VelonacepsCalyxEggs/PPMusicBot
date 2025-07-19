import ytdl from "@distube/ytdl-core";
import { createWriteStream } from "fs";
import { exit } from "process";
import Stream from "stream";
import { workerData, parentPort } from "worker_threads";

interface VideoDownloadWorkerData {
    videoUrl: string;
    filePath: string;
}

async function downloadVideo(url: string, filePath: string) {
    return new Promise<void>((resolve, reject) => {
        let videoStream: Stream.Readable = ytdl(url, {
            quality: 'highest',
            filter: 'audioonly',
            highWaterMark: 1 << 25, // 32MB buffer
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            }
        });
        
        const writeStream = createWriteStream(filePath);
        
        // Pipe the video stream directly to the file
        videoStream.pipe(writeStream);
        
        writeStream.on('finish', () => {
            resolve();
        });
        
        writeStream.on('error', (error) => {
            reject(new Error(`Error saving video to file: ${error.message}`));
        });
        
        videoStream.on('error', (error) => {
            writeStream.destroy();
            reject(new Error(`Error downloading video: ${error.message}`));
        });
    });
}

async function main() {
        const data = workerData as VideoDownloadWorkerData;
        const videoUrl = data.videoUrl;
        const filePath = data.filePath;
        await downloadVideo(videoUrl, filePath);
        
        // Send the file path back to the main thread
        if (parentPort) {
            parentPort.postMessage(filePath);
        }
        
        exit(0); // Exit the worker thread gracefully
}

main()
