import type { Clinic } from '../../application/clinic';
import type { QueuePublisher } from '../../application/ports';
import { createAppointmentControllers } from './appointment.controller';
import { createAuthControllers } from './auth.controller';
import { createDashboardControllers } from './dashboard.controller';
import { createQueueControllers } from './queue.controller';
import { createScheduleControllers } from './schedule.controller';
import { createServiceControllers } from './service.controller';
import { createUserControllers } from './user.controller';
export function createControllers(clinic: Clinic, queuePublisher: (io: unknown) => QueuePublisher) {
    return { appointments: createAppointmentControllers(clinic),
        auth: createAuthControllers(clinic),
        dashboard: createDashboardControllers(clinic),
        queue: createQueueControllers(clinic, queuePublisher),
        schedules: createScheduleControllers(clinic),
        services: createServiceControllers(clinic),
        users: createUserControllers(clinic) };
}
export type Controllers = ReturnType<typeof createControllers>;
