import { Router } from 'express';
import { UserRole } from '@app/shared';
import type { Controllers } from '../controllers';
import type { AuthMiddleware } from '../middleware/auth.middleware';
export function createQueueRoutes(controllers: Controllers['queue'], auth: AuthMiddleware) {
    const { checkInAppointment, getTodayQueue, callQueueEntry, completeQueueEntry } = controllers;
    const { authenticate, requireRole } = auth;
    const router = Router();
    const queueStaffRoles = requireRole(UserRole.ADMIN, UserRole.STAFF);
    router.post('/check-in', authenticate, queueStaffRoles, checkInAppointment);
    router.get('/today', authenticate, queueStaffRoles, getTodayQueue);
    router.patch('/:id/call', authenticate, queueStaffRoles, callQueueEntry);
    router.patch('/:id/complete', authenticate, queueStaffRoles, completeQueueEntry);
    return router;
}
