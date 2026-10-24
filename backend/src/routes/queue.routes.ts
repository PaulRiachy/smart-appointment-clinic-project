import { Router } from 'express';

import { UserRole } from '@app/shared';

import {
  callQueueEntry,
  checkInAppointment,
  completeQueueEntry,
  getTodayQueue,
} from '../controllers/queue.controller';
import {
  authenticate,
  requireRole,
} from '../middleware/auth.middleware';

const router = Router();

const queueStaffRoles = requireRole(
  UserRole.ADMIN,
  UserRole.STAFF,
);

router.post(
  '/check-in',
  authenticate,
  queueStaffRoles,
  checkInAppointment,
);

router.get(
  '/today',
  authenticate,
  queueStaffRoles,
  getTodayQueue,
);

router.patch(
  '/:id/call',
  authenticate,
  queueStaffRoles,
  callQueueEntry,
);

router.patch(
  '/:id/complete',
  authenticate,
  queueStaffRoles,
  completeQueueEntry,
);

export { router as queueRouter };
