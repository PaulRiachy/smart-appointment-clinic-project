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


import { connectDB } from './infrastructure/config/db';
import { createDependencies } from './infrastructure/dependencies';
import { createClinic } from './application/clinic';
import { createControllers } from './presentation/controllers';
import { createAuthMiddleware } from './presentation/middleware/auth.middleware';
import { ensureBookingLockIndexes } from './infrastructure/locking/booking-lock';
import { initQueueSocket, createQueuePublisher } from './infrastructure/sockets/queue.socket';
import { startNoShowCron } from './infrastructure/jobs/noshow.cron';
import { createAppointmentRoutes } from './presentation/routes/appointment.routes';
import { createAuthRoutes } from './presentation/routes/auth.routes';
import { createDashboardRoutes } from './presentation/routes/dashboard.routes';
import { createQueueRoutes } from './presentation/routes/queue.routes';
import { createScheduleRoutes } from './presentation/routes/schedule.routes';
import { createServiceRoutes } from './presentation/routes/service.routes';
import { createUserRoutes } from './presentation/routes/user.routes';


const clinic = createClinic(createDependencies());
const controllers = createControllers(clinic, createQueuePublisher);
const auth = createAuthMiddleware(clinic.authentication);
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

app.use('/api/auth', createAuthRoutes(controllers.auth, auth));
app.use('/api/services', createServiceRoutes(controllers.services, auth));
app.use('/api/users', createUserRoutes(controllers.users, auth));
app.use('/api/staff', createScheduleRoutes(controllers.schedules, auth));
app.use('/api/appointments', createAppointmentRoutes(controllers.appointments, auth));
app.use('/api/queue', createQueueRoutes(controllers.queue, auth));
app.use('/api/dashboard', createDashboardRoutes(controllers.dashboard, auth));

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
    startNoShowCron(clinic.runNoShowJob);
    initQueueSocket(io, clinic.authentication.authenticateSocket);

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
