import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });


import express, {
  type ErrorRequestHandler,
  type Request,
  type Response,
} from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';

import { connectDB } from './config/db';
import authRoutes from './routes/auth.routes';

const app = express();
const httpServer = createServer(app);

const port = Number(process.env.PORT || 5000);
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: clientUrl,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
});

// Middleware
app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Make Socket.IO available 
app.set('io', io);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'API server is running.',
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

// Authentication endpoints
app.use('/api/auth', authRoutes);

// Handle unknown endpoints
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found.',
  });
});

// Centralized error handler
const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  console.error('Unhandled server error:', error);

  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error.',
  });
};

app.use(errorHandler);

// Connect to MongoDB
async function startServer(): Promise<void> {
  try {
    await connectDB();

    httpServer.listen(port, () => {
      console.log(`API server listening on port ${port}`);
      console.log(`Health check: http://localhost:${port}/api/health`);
      console.log(`Auth API: http://localhost:${port}/api/auth`);
    });
  } catch (error) {
    console.error('Failed to start the API server:', error);
    process.exitCode = 1;
  }
}

async function shutdown(): Promise<void> {
  console.log('Shutting down server...');

  io.close();

  if (httpServer.listening) {
    httpServer.close();
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