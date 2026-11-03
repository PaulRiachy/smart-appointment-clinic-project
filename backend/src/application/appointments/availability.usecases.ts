import type { Dependencies } from '../ports';
import type { AvailabilityContext } from '../../domain/appointments/availability.rules';
import { calculateAvailability, getBusinessDateKey, getWeekday, makeBusinessDate, validateNoOverlap, validateSlotContext, validateStart, } from '../../domain/appointments/availability.rules';
import { businessDayEnd } from '../../domain/time/business-time';
export function createAvailabilityUseCases(deps: Dependencies) {
    async function loadContext(serviceId: string, staffId: string): Promise<AvailabilityContext> {
        if (!deps.identifiers.isStrict(serviceId))
            throw new Error('Invalid serviceId.');
        if (!deps.identifiers.isStrict(staffId))
            throw new Error('Invalid staffId.');
        const service = await deps.services.forBooking(serviceId, 'availability');
        if (!service)
            throw new Error('Service not found.');
        if (!service.active)
            throw new Error('Inactive services cannot be booked.');
        const staff = await deps.users.identity(staffId);
        if (!staff)
            throw new Error('Staff member not found.');
        const schedule = await deps.schedules.availability(staff._id);
        if (!schedule)
            throw new Error('Staff schedule not found.');
        if (!schedule.services.some(id => String(id) === String(service._id))) {
            throw new Error('Staff member is not qualified to perform this service.');
        }
        return {
            service: { _id: service._id, duration: Number(service.duration), active: Boolean(service.active) },
            staff: { _id: staff._id },
            schedule: { weeklyIntervals: schedule.weeklyIntervals, daysOff: schedule.daysOff || [], services: schedule.services },
        };
    }
    async function getAvailability(serviceId: string, staffId: string, date: string) {
        const context = await loadContext(serviceId, staffId);
        const weekday = getWeekday(date);
        // Preserve the early return: days off and absent intervals do not query appointments.
        const needsAppointments = !(context.schedule.daysOff || []).includes(weekday) &&
            (context.schedule.weeklyIntervals?.[weekday] || []).length > 0;
        const existing = needsAppointments
            ? await deps.appointments.existingInDay(context.staff._id, makeBusinessDate(date, '00:00'), businessDayEnd(date)) : [];
        return calculateAvailability(context, existing, serviceId, staffId, date);
    }
    async function validateSlot(serviceId: string, staffId: string, start: Date, excludeId?: string) {
        validateStart(start);
        const context = await loadContext(serviceId, staffId);
        const validated = validateSlotContext(context, serviceId, staffId, start);
        const date = getBusinessDateKey(start);
        const existing = await deps.appointments.existingInDay(context.staff._id, makeBusinessDate(date, '00:00'), businessDayEnd(date), excludeId);
        validateNoOverlap(validated.start, validated.end, existing);
        return validated;
    }
    return { getAvailability, validateSlot };
}
export type AvailabilityUseCases = ReturnType<typeof createAvailabilityUseCases>;
