import { Router } from 'express';
import { UserRole } from '@app/shared';
import type { Controllers } from '../controllers';
import type { AuthMiddleware } from '../middleware/auth.middleware';
export function createUserRoutes(controllers: Controllers['users'], auth: AuthMiddleware) {
    const { listStaff, createStaff } = controllers;
    const { authenticate, requireRole } = auth;
    const router = Router();
    router.get('/staff', authenticate, listStaff);
    router.post('/staff', authenticate, requireRole(UserRole.ADMIN), createStaff);
    return router;
}
