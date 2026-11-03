import { Router } from 'express';
import { UserRole, } from '@app/shared';
import type { Controllers } from '../controllers';
import type { AuthMiddleware } from '../middleware/auth.middleware';
export function createDashboardRoutes(controllers: Controllers['dashboard'], auth: AuthMiddleware) {
    const { getDashboardStats } = controllers;
    const { authenticate, requireRole } = auth;
    const dashboardRouter = Router();
    dashboardRouter.get('/stats', authenticate, requireRole(UserRole.ADMIN), getDashboardStats);
    return dashboardRouter;
}
