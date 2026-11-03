import type { Dependencies } from './ports';
import { createAppointmentUseCases } from './appointments/appointment.usecases';
import { createAvailabilityUseCases } from './appointments/availability.usecases';
import { createNoShowUseCase } from './appointments/no-show.usecase';
import { createAuthUseCases } from './auth/auth.usecases';
import { createAuthenticationUseCases } from './auth/authentication.usecases';
import { createDashboardUseCases } from './dashboard/dashboard.usecases';
import { createQueueUseCases } from './queue/queue.usecases';
import { createScheduleUseCases } from './schedules/schedule.usecases';
import { createServiceUseCases } from './services/service.usecases';
import { createUserUseCases } from './users/user.usecases';
export function createClinic(deps: Dependencies) {
    const availability = createAvailabilityUseCases(deps);
    return {
        availability,
        appointments: createAppointmentUseCases(deps, availability),
        auth: createAuthUseCases(deps),
        authentication: createAuthenticationUseCases(deps),
        dashboard: createDashboardUseCases(deps),
        queue: createQueueUseCases(deps),
        schedules: createScheduleUseCases(deps),
        services: createServiceUseCases(deps),
        users: createUserUseCases(deps),
        runNoShowJob: createNoShowUseCase(deps),
    };
}
export type Clinic = ReturnType<typeof createClinic>;
