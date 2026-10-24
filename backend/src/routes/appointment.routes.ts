import { Router } from 'express';

import {
  getAvailabilityController,
  createAppointment,
  listAppointments,
  getAppointment,
  cancelAppointment,
  rescheduleAppointment,
  confirmAppointment,
} from '../controllers/appointment.controller';

import {
  authenticate,
  requireRole,
} from '../middleware/auth.middleware';

import { UserRole } from '@app/shared';

const router = Router();

router.get(
  '/availability',
  getAvailabilityController,
);


router.post(
  '/',
  authenticate,
  requireRole(UserRole.CUSTOMER),
  createAppointment,
);


router.get(
  '/',
  authenticate,
  requireRole(
    UserRole.CUSTOMER,
    UserRole.STAFF,
    UserRole.ADMIN,
  ),
  listAppointments,
);


router.get(
  '/:id',
  authenticate,
  requireRole(
    UserRole.CUSTOMER,
    UserRole.STAFF,
    UserRole.ADMIN,
  ),
  getAppointment,
);


router.patch(
  '/:id/cancel',
  authenticate,
  requireRole(
    UserRole.CUSTOMER,
    UserRole.STAFF,
    UserRole.ADMIN,
  ),
  cancelAppointment,
);


router.patch(
  '/:id/reschedule',
  authenticate,
  requireRole(
    UserRole.CUSTOMER,
    UserRole.STAFF,
    UserRole.ADMIN,
  ),
  rescheduleAppointment,
);


router.patch(
  '/:id/confirm',
  authenticate,
  requireRole(
    UserRole.STAFF,
    UserRole.ADMIN,
  ),
  confirmAppointment,
);

export default router;
