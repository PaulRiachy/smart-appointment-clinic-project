import { Weekday } from '@app/shared';
import { isValidSchedulePayload, type WorkingIntervalInput } from '../../domain/schedules/schedule.rules';
const weekdays = Object.values(Weekday);
import type { Dependencies, OperationInput } from '../ports';
import { result, type OperationResult } from '../result';
export function createScheduleUseCases(deps: Dependencies) {
    async function getStaffSchedule(input: OperationInput): Promise<OperationResult> {
        try {
            const { id } = input.params;
            if (!deps.identifiers.isValid(id)) {
                return result('invalid', {
                    message: 'Invalid staff ID.',
                });
            }
            const staff = await deps.users.staffDetails(id);
            if (!staff) {
                return result('notFound', {
                    message: 'Staff member not found.',
                });
            }
            const schedule = await deps.schedules.details(id);
            if (!schedule) {
                return result('ok', {
                    message: 'Staff schedule has not been configured yet.',
                    data: {
                        staff,
                        schedule: null,
                    },
                });
            }
            return result('ok', {
                data: schedule,
            });
        }
        catch (error) {
            console.error('Failed to get staff schedule:', error);
            return result('failed', {
                message: 'Failed to load staff schedule.',
            });
        }
    }
    async function saveStaffSchedule(input: OperationInput): Promise<OperationResult> {
        try {
            const { id } = input.params;
            if (!deps.identifiers.isValid(id)) {
                return result('invalid', {
                    message: 'Invalid staff ID.',
                });
            }
            if (!isValidSchedulePayload(input.body, deps.identifiers.isValid)) {
                return result('invalid', {
                    message: 'Invalid schedule. Provide all weekdays, valid HH:mm intervals with no overlaps, valid days off, and valid service IDs.',
                });
            }
            const staff = await deps.users.staffDetails(id);
            if (!staff) {
                return result('notFound', {
                    message: 'Staff member not found.',
                });
            }
            const serviceIds = input.body.services;
            const services = await deps.services.scheduleServices(serviceIds);
            if (services.length !== serviceIds.length) {
                return result('invalid', {
                    message: 'One or more selected services do not exist.',
                });
            }
            const weeklyIntervals = {} as Record<Weekday, WorkingIntervalInput[]>;
            for (const day of weekdays) {
                weeklyIntervals[day as Weekday] =
                    input.body.weeklyIntervals[day]!.map((interval) => ({
                        from: interval.from,
                        to: interval.to,
                    }));
            }
            const schedule = await deps.schedules.save(id, { weeklyIntervals, daysOff: input.body.daysOff, services: serviceIds });
            return result('ok', {
                message: 'Staff schedule saved successfully.',
                data: schedule,
            });
        }
        catch (error) {
            console.error('Failed to save staff schedule:', error);
            if (deps.failures.isNamedValidation(error)) {
                return result('invalid', {
                    message: 'Invalid staff schedule data.',
                });
            }
            return result('failed', {
                message: 'Failed to save staff schedule.',
            });
        }
    }
    return { getStaffSchedule, saveStaffSchedule };
}
