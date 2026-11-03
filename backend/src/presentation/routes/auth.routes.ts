import { Router } from 'express';
import type { Controllers } from '../controllers';
import type { AuthMiddleware } from '../middleware/auth.middleware';
export function createAuthRoutes(controllers: Controllers['auth'], auth: AuthMiddleware) {
    const { register, login, getMe } = controllers;
    const { authenticate } = auth;
    const router = Router();
    router.post('/register', register);
    router.post('/login', login);
    router.get('/me', authenticate, getMe);
    return router;
}
