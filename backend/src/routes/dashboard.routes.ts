import { Router } from 'express';
import {
  UserRole,
} from '@app/shared';
import {
  authenticate,
  requireRole,
} from '../middleware/auth.middleware';
import {
  getDashboardStats,
} from '../controllers/dashboard.controller';

const dashboardRouter = Router();

dashboardRouter.get(
  '/stats',
  authenticate,
  requireRole(UserRole.ADMIN),
  getDashboardStats,
);

export default dashboardRouter;