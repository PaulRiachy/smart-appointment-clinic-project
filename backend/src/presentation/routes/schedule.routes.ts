import { Router } from 'express';
import { UserRole } from '@app/shared';
import type { Controllers } from '../controllers';
import type { AuthMiddleware } from '../middleware/auth.middleware';
export function createScheduleRoutes(controllers: Controllers['schedules'], auth: AuthMiddleware) {
    const { getStaffSchedule, saveStaffSchedule } = controllers;
    const { authenticate, requireRole } = auth;
    const router = Router();
    router.get('/:id/schedule', authenticate, getStaffSchedule);
    router.put('/:id/schedule', authenticate, requireRole(UserRole.ADMIN), saveStaffSchedule);
    return router;
}
