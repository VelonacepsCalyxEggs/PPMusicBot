import ytdl from "@distube/ytdl-core";
import { createWriteStream } from "fs";
import { exit } from "process";
import { YoutubeDownloadFailedError } from "src/types/ytdlServiceTypes";
import Stream from "stream";
import { workerData } from "worker_threads";

interface VideoDownloadWorkerData {
    videoUrl: string;
    filePath: string;
}

async function downloadVideo(url: string, filePath: string) {
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
    
    const chunks: Buffer[] = [];
    
    videoStream.on('data', (chunk) => {
        if (Buffer.isBuffer(chunk)) {
            chunks.push(chunk);
        } else {
            chunks.push(Buffer.from(chunk));
        }
    });
    videoStream.on('end', async () => {
        const videoBuffer = Buffer.concat(chunks);
        await saveVideoToFile(videoBuffer, filePath);
    });
    videoStream.on('error', (error) => {
        throw new YoutubeDownloadFailedError(`Error downloading video: ${error.message}`);
    });
}

async function saveVideoToFile(videoBuffer: Buffer, filePath: string) {
    return new Promise<void>((resolve, reject) => {
        const writeStream = createWriteStream(filePath);
        writeStream.on('finish', () => resolve());
        writeStream.on('error', (error) => reject(new YoutubeDownloadFailedError(`Error saving video to file: ${error.message}`)));
        writeStream.write(videoBuffer);
        writeStream.end();
    });

}

async function main() {
    const data = workerData as VideoDownloadWorkerData;
    const videoUrl = data.videoUrl;
    const filePath = data.filePath;
    await downloadVideo(videoUrl, filePath);
    postMessage(filePath); // Send the file path back to the main thread
    exit(0); // Exit the worker thread gracefully
}

main()
