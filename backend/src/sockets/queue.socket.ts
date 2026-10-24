import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

import { UserRole, ApiResponse } from '@app/shared';

interface JwtPayload {
  sub: string;
  role: UserRole;
}
export interface QueueSocketPayload {
  queueEntryId: string;
  queueNumber: string;
  appointmentId: string;
  appointmentStatus: string;
  timestamp: string;
}

const STAFF_ROOM = 'queue:staff';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return secret;
}

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

function authenticateSocket(socket: Socket): JwtPayload {
  const token = extractToken(socket);

  if (!token) {
    throw new Error('Authentication token is required');
  }

  const decoded = jwt.verify(token, getJwtSecret());

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof decoded.sub !== 'string' ||
    !Object.values(UserRole).includes(decoded.role as UserRole)
  ) {
    throw new Error('Invalid authentication token');
  }

  const payload = decoded as JwtPayload;

  if (
    payload.role !== UserRole.ADMIN &&
    payload.role !== UserRole.STAFF
  ) {
    throw new Error('Queue access is restricted to staff');
  }

  return payload;
}

export function initQueueSocket(io: Server): void {
  io.use((socket, next) => {
    try {
      const user = authenticateSocket(socket);

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