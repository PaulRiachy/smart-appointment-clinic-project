import { Router } from 'express';
import {
  getStaffSchedule,
  saveStaffSchedule,
} from '../controllers/schedule.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '@app/shared';

const router = Router();

router.get(
  '/:id/schedule',
  authenticate,
  getStaffSchedule,
);

router.put(
  '/:id/schedule',
  authenticate,
  requireRole(UserRole.ADMIN),
  saveStaffSchedule,
);

export default router;