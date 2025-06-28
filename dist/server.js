var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { createMediasoupWorker } from './mediasoup.js';
import { handleSocketConnection } from './socketHandler.js';
dotenv.config();
const app = express();
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    allowedHeaders: ['Content-Type'],
    credentials: true,
}));
const server = createServer(app);
const wss = new WebSocketServer({ server });
(() => __awaiter(void 0, void 0, void 0, function* () {
    const worker = yield createMediasoupWorker();
    wss.on('connection', (socket) => {
        console.log('New WebSocket connection established');
        handleSocketConnection(socket, worker);
    });
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        console.log(`SFU backend running on port ${PORT}`);
    });
}))();
