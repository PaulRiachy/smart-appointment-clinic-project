import { Router } from 'express';
import { UserRole } from '@app/shared';
import type { Controllers } from '../controllers';
import type { AuthMiddleware } from '../middleware/auth.middleware';
export function createServiceRoutes(controllers: Controllers['services'], auth: AuthMiddleware) {
    const { listServices, createService, updateService, updateServiceStatus } = controllers;
    const { authenticate, requireRole, optionalAuthenticate } = auth;
    const router = Router();
    router.get('/', optionalAuthenticate, listServices);
    router.post('/', authenticate, requireRole(UserRole.ADMIN), createService);
    router.put('/:id', authenticate, requireRole(UserRole.ADMIN), updateService);
    router.patch('/:id/status', authenticate, requireRole(UserRole.ADMIN), updateServiceStatus);
    return router;
}
