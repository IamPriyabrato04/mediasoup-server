import { createWorker } from 'mediasoup';
import { Router, RtpCodecCapability, Worker } from 'mediasoup/types';

export let router: Router;

export async function createMediasoupWorker(): Promise<Worker> {
    const worker = await createWorker({
        rtcMinPort: 10000,
        rtcMaxPort: 10100,
    });

    worker.on('died', () => {
        console.error('mediasoup worker died, exiting...');
        process.exit(1);
    });

    const mediaCodecs: RtpCodecCapability[] = [
        {
            kind: 'audio',
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
        },
        {
            kind: 'video',
            mimeType: 'video/VP8',
            clockRate: 90000,
        },
    ];

    router = await worker.createRouter({ mediaCodecs });
    return worker;
}