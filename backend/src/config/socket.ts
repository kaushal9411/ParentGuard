import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server;

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket: Socket) => {
    // Parent dashboard joins a room keyed by their user ID to receive child events
    socket.on('join:parent', (userId: string) => {
      socket.join(`parent:${userId}`);
    });

    // Child device joins its own room (for direct commands in the future)
    socket.on('join:device', (deviceId: string) => {
      socket.join(`device:${deviceId}`);
    });

    socket.on('disconnect', () => {
      // rooms are cleaned up automatically
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
