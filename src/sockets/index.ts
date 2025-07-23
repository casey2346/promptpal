// src/sockets/index.ts

import { Server } from 'socket.io';
import { logger } from '../utils/logger';

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId || 'unknown';
    logger.info(`🧠 New socket connection: ${socket.id} (user: ${userId})`);

    socket.on('ping', () => {
      socket.emit('pong');
    });

    socket.on('disconnect', () => {
      logger.info(`💨 Socket disconnected: ${socket.id}`);
    });
  });
}
