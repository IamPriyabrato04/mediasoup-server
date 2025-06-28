var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { verifyToken } from './lib/auth.js';
const rooms = new Map();
export function handleSocketConnection(socket, worker) {
    let peerId = null;
    let roomId = null;
    socket.on('message', (data) => __awaiter(this, void 0, void 0, function* () {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'join' && msg.token && msg.roomId) {
            const user = verifyToken(msg.token);
            console.log("Received message:", msg.type, msg.token, msg.roomId);
            if (!user) {
                console.log(`Invalid token for user: ${msg.token}`);
                return socket.close();
            }
            peerId = user.userId;
            roomId = msg.roomId;
            if (roomId === null) {
                socket.close();
                return;
            }
            let room = rooms.get(roomId);
            if (!room) {
                const router = yield worker.createRouter({
                    mediaCodecs: [
                        { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
                        { kind: 'video', mimeType: 'video/VP8', clockRate: 90000 },
                    ]
                });
                room = { router, peers: new Map() };
                rooms.set(roomId, room);
            }
            room.peers.set(peerId, {
                socket,
                producers: new Map(),
                consumers: new Map()
            });
            socket.send(JSON.stringify({
                type: 'joined',
                data: { peerId, routerRtpCapabilities: room.router.rtpCapabilities }
            }));
            return;
        }
        if (!peerId || !roomId || !rooms.has(roomId)) {
            console.log(`Peer ${peerId} tried to send a message without joining a room or after being disconnected.`);
            return;
        }
        const room = rooms.get(roomId);
        const peer = room.peers.get(peerId);
        console.log(`Received message from peer ${peerId} in room ${roomId}:`, msg);
        switch (msg.type) {
            case 'getRouterRtpCapabilities': {
                socket.send(JSON.stringify({
                    type: 'routerRtpCapabilities',
                    data: room.router.rtpCapabilities
                }));
                console.log(`Sent router RTP capabilities to peer ${peerId}`);
                break;
            }
            case 'createWebRtcTransport': {
                const { direction } = msg.data;
                const transportOptions = {
                    listenIps: [
                        {
                            ip: '0.0.0.0',
                            announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1',
                        },
                    ],
                    enableUdp: true,
                    enableTcp: true,
                    preferUdp: true,
                };
                const transport = yield room.router.createWebRtcTransport(transportOptions);
                if (direction === 'send') {
                    peer.sendTransport = transport;
                }
                else if (direction === 'recv') {
                    peer.recvTransport = transport;
                }
                socket.send(JSON.stringify({
                    type: 'transportCreated',
                    data: {
                        id: transport.id,
                        iceParameters: transport.iceParameters,
                        iceCandidates: transport.iceCandidates,
                        dtlsParameters: transport.dtlsParameters,
                    },
                }));
                console.log(`Creating ${direction} transport for peer ${peerId}`);
                break;
            }
            case 'connectTransport': {
                const { dtlsParameters, direction } = msg.data;
                let transport;
                if (direction === 'send') {
                    transport = peer.sendTransport;
                }
                else if (direction === 'recv') {
                    transport = peer.recvTransport;
                }
                else {
                    console.log(`Unknown transport direction: ${direction}`);
                    return;
                }
                yield transport.connect({ dtlsParameters });
                socket.send(JSON.stringify({ type: 'transportConnected', data: { direction } }));
                console.log(`Connecting ${direction} transport for peer ${peerId}`);
                break;
            }
            case 'produce': {
                const { kind, rtpParameters } = msg.data;
                const producer = yield peer.sendTransport.produce({ kind, rtpParameters });
                peer.producers.set(producer.id, producer);
                socket.send(JSON.stringify({ type: 'produced', data: { id: producer.id } }));
                for (const [id, p] of room.peers.entries()) {
                    if (id !== peerId) {
                        p.socket.send(JSON.stringify({
                            type: 'newProducer',
                            data: { producerId: producer.id, kind }
                        }));
                    }
                }
                console.log("Producing media");
                break;
            }
            case 'consume': {
                const { producerId, rtpCapabilities } = msg.data;
                if (!room.router.canConsume({ producerId, rtpCapabilities })) {
                    socket.send(JSON.stringify({ type: 'consumeFailed' }));
                    return;
                }
                const consumer = yield peer.recvTransport.consume({
                    producerId,
                    rtpCapabilities,
                    paused: false
                });
                peer.consumers.set(consumer.id, consumer);
                socket.send(JSON.stringify({
                    type: 'consumed',
                    data: {
                        id: consumer.id,
                        producerId,
                        kind: consumer.kind,
                        rtpParameters: consumer.rtpParameters,
                    },
                }));
                console.log(`Consuming from producer ${producerId}`);
                break;
            }
            default:
                console.log('Unknown message type', msg.type);
        }
    }));
    socket.on('close', () => {
        var _a, _b;
        if (!peerId || !roomId)
            return;
        const room = rooms.get(roomId);
        if (!room)
            return;
        const peer = room.peers.get(peerId);
        (_a = peer === null || peer === void 0 ? void 0 : peer.sendTransport) === null || _a === void 0 ? void 0 : _a.close();
        (_b = peer === null || peer === void 0 ? void 0 : peer.recvTransport) === null || _b === void 0 ? void 0 : _b.close();
        peer === null || peer === void 0 ? void 0 : peer.producers.forEach((p) => p.close());
        peer === null || peer === void 0 ? void 0 : peer.consumers.forEach((c) => c.close());
        room.peers.delete(peerId);
        if (room.peers.size === 0)
            rooms.delete(roomId);
    });
}
