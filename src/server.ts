import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { createMediasoupWorker } from './mediasoup.js';
import { handleSocketConnection } from './socketHandler.js';
import { Worker } from 'mediasoup/types';

dotenv.config();

const app = express();
app.use(cors(
    {
        origin: process.env.CORS_ORIGIN,
        allowedHeaders: ['Content-Type'],
        credentials: true,
    }
));

const server = createServer(app);
const wss = new WebSocketServer({ server });

(async () => {
    const worker: Worker = await createMediasoupWorker();

    wss.on('connection', (socket) => {
        console.log('New WebSocket connection established');
        handleSocketConnection(socket, worker);

    });

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        console.log(`SFU backend running on port ${PORT}`);
    });
})();