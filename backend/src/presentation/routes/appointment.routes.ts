import { Router } from 'express';
import { UserRole } from '@app/shared';
import type { Controllers } from '../controllers';
import type { AuthMiddleware } from '../middleware/auth.middleware';
export function createAppointmentRoutes(controllers: Controllers['appointments'], auth: AuthMiddleware) {
    const { getAvailabilityController, createAppointment, listAppointments, getAppointment, cancelAppointment, rescheduleAppointment, confirmAppointment } = controllers;
    const { authenticate, requireRole } = auth;
    const router = Router();
    router.get('/availability', getAvailabilityController);
    router.post('/', authenticate, requireRole(UserRole.CUSTOMER), createAppointment);
    router.get('/', authenticate, requireRole(UserRole.CUSTOMER, UserRole.STAFF, UserRole.ADMIN), listAppointments);
    router.get('/:id', authenticate, requireRole(UserRole.CUSTOMER, UserRole.STAFF, UserRole.ADMIN), getAppointment);
    router.patch('/:id/cancel', authenticate, requireRole(UserRole.CUSTOMER, UserRole.STAFF, UserRole.ADMIN), cancelAppointment);
    router.patch('/:id/reschedule', authenticate, requireRole(UserRole.CUSTOMER, UserRole.STAFF, UserRole.ADMIN), rescheduleAppointment);
    router.patch('/:id/confirm', authenticate, requireRole(UserRole.STAFF, UserRole.ADMIN), confirmAppointment);
    return router;
}
