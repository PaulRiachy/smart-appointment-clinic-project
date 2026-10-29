import dotenv from 'dotenv';
import path from 'path';


dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import cors from 'cors';
import express, {
  type ErrorRequestHandler,
  type Request,
  type Response,
} from 'express';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';

import { connectDB } from './config/db';
import authRoutes from './routes/auth.routes';
import serviceRoutes from './routes/service.routes';
import scheduleRoutes from './routes/schedule.routes';
import userRoutes from './routes/user.routes';
import appointmentRoutes from './routes/appointment.routes';
import { ensureBookingLockIndexes } from './services/availability.service';
import { initQueueSocket } from './sockets/queue.socket';
import { queueRouter } from './routes/queue.routes';
import dashboardRoutes from './routes/dashboard.routes';
import { startNoShowCron } from './jobs/noshow.cron';

const app = express();
const httpServer = createServer(app);

const port = Number(process.env.PORT || 5000);
const clientUrl =
  process.env.CLIENT_URL || 'http://localhost:5173';

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: clientUrl,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
});

app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: '1mb',
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '1mb',
  }),
);

app.set('io', io);

app.get(
  '/api/health',
  (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'API server is running.',
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
      },
    });
  },
);

app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/staff', scheduleRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/queue', queueRouter);
app.use('/api/dashboard', dashboardRoutes);

app.use(
  (_req: Request, res: Response): void => {
    res.status(404).json({
      success: false,
      message: 'API endpoint not found.',
    });
  },
);

const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  next,
): void => {
  console.error('Unhandled server error:', error);

  if (res.headersSent) {
    next(error);
    return;
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error.',
  });
};

app.use(errorHandler);

async function startServer(): Promise<void> {
  try {
    await connectDB();
    await ensureBookingLockIndexes();
    startNoShowCron();
    initQueueSocket(io);

    httpServer.listen(port, () => {
      console.log(`API server running on http://localhost:${port}`);
      console.log(`Socket.IO server running on http://localhost:${port}`);
      console.log(`Client origin: ${clientUrl}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exitCode = 1;
  }
}

async function shutdown(): Promise<void> {
  console.log('Shutting down server...');

  io.close();

  if (httpServer.listening) {
    httpServer.close(() => {
      process.exit(0);
    });
    return;
  }

  process.exit(0);
}

process.once('SIGINT', () => {
  void shutdown();
});

process.once('SIGTERM', () => {
  void shutdown();
});

void startServer();
