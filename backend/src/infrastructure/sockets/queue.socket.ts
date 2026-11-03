import { Server, Socket } from 'socket.io';
import type { ApiResponse } from '@app/shared';
import type { Clinic } from '../../application/clinic';
import type { QueuePublisher } from '../../application/ports';
export interface QueueSocketPayload {
  queueEntryId: string;
  queueNumber: string;
  appointmentId: string;
  appointmentStatus: string;
  timestamp: string;
}

const STAFF_ROOM = 'queue:staff';


function extractToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;

  if (typeof authToken === 'string' && authToken.length > 0) {
    return authToken.replace(/^Bearer\s+/i, '');
  }

  const authorization = socket.handshake.headers.authorization;

  if (typeof authorization === 'string') {
    return authorization.replace(/^Bearer\s+/i, '');
  }

  return null;
}
export function initQueueSocket(io: Server, authenticate: Clinic['authentication']['authenticateSocket']): void {
  io.use(async (socket, next) => {
    try {
      const user = await authenticate(extractToken(socket));

      socket.data.userId = user.sub;
      socket.data.role = user.role;

      next();
    } catch (error) {
      next(
        new Error(
          error instanceof Error
            ? error.message
            : 'Socket authentication failed',
        ),
      );
    }
  });

  io.on('connection', (socket) => {
    socket.join(STAFF_ROOM);

    socket.emit('queue:connected', {
      success: true,
      message: 'Connected to the live queue',
      data: {
        socketId: socket.id,
        role: socket.data.role,
      },
    } satisfies ApiResponse);

    socket.on('disconnect', () => {
      socket.leave(STAFF_ROOM);
    });
  });
}
export function broadcastQueueUpdate(
  io: Server,
  payload: QueueSocketPayload,
): void {
  io.to(STAFF_ROOM).emit('queue:update', payload);
}

export function broadcastQueueCall(
  io: Server,
  payload: QueueSocketPayload,
): void {
  io.to(STAFF_ROOM).emit('queue:call', payload);
}

export function broadcastQueueCompletion(
  io: Server,
  payload: QueueSocketPayload,
): void {
  io.to(STAFF_ROOM).emit('queue:complete', payload);
}
export function createQueuePublisher(io: unknown): QueuePublisher {
  if (!io) throw new Error('Socket.IO server is not initialized');
  return {
    update: payload => broadcastQueueUpdate(io as Server, payload),
    call: payload => broadcastQueueCall(io as Server, payload),
    complete: payload => broadcastQueueCompletion(io as Server, payload),
  };
}
