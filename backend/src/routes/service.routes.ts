import { Router } from 'express';
import {
  createService,
  listServices,
  updateService,
  updateServiceStatus,
} from '../controllers/service.controller';
import {
  authenticate,
  optionalAuthenticate,
  requireRole,
} from '../middleware/auth.middleware';
import { UserRole } from '@app/shared';

const router = Router();

router.get('/', optionalAuthenticate, listServices);

router.post(
  '/',
  authenticate,
  requireRole(UserRole.ADMIN),
  createService,
);

router.put(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN),
  updateService,
);

router.patch(
  '/:id/status',
  authenticate,
  requireRole(UserRole.ADMIN),
  updateServiceStatus,
);

export default router;