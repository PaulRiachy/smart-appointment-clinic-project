import { Router } from 'express';
import { UserRole } from '@app/shared';

import {
  createStaff,
  listStaff,
} from '../controllers/user.controller';
import {
  authenticate,
  requireRole,
} from '../middleware/auth.middleware';

const router = Router();

router.get(
  '/staff',
  authenticate,
  listStaff,
);

router.post(
  '/staff',
  authenticate,
  requireRole(UserRole.ADMIN),
  createStaff,
);

export default router;