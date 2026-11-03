import { AppointmentStatus, Weekday } from '@app/shared';
import type { EntityId } from '../entities';
import { BUSINESS_TIMEZONE, businessDate } from '../time/business-time';
const SLOT_STEP_MINUTES = 15;
const CALENDAR_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const BOOKING_STATUSES = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_SERVICE];
export type ExistingAppointment = {
    start: Date;
    end: Date;
    status: AppointmentStatus;
};
export type WorkingInterval = {
    from: string;
    to: string;
};
export type AvailabilitySlot = {
    start: string;
    end: string;
    startTime: string;
    endTime: string;
};
export type AvailabilityContext = {
    service: {
        _id: EntityId;
        duration: number;
        active: boolean;
    };
    staff: {
        _id: EntityId;
    };
    schedule: {
        weeklyIntervals: Record<string, WorkingInterval[]>;
        daysOff: string[];
        services: EntityId[];
    };
};
export function parseCalendarDate(date: string): {
    year: number;
    month: number;
    day: number;
} {
    if (!CALENDAR_DATE_REGEX.test(date)) {
        throw new Error('Invalid calendar date. Expected format YYYY-MM-DD.');
    }
    const [yearString, monthString, dayString] = date.split('-');
    const year = Number(yearString);
    const month = Number(monthString);
    const day = Number(dayString);
    if (!Number.isInteger(year) ||
        !Number.isInteger(month) ||
        !Number.isInteger(day)) {
        throw new Error('Invalid calendar date. Expected format YYYY-MM-DD.');
    }
    if (month < 1 || month > 12) {
        throw new Error('Invalid calendar date.');
    }
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day < 1 || day > daysInMonth) {
        throw new Error('Invalid calendar date.');
    }
    return {
        year,
        month,
        day,
    };
}
export function getWeekday(date: string): Weekday {
    const parsed = parseCalendarDate(date);
    const value = new Date(`${date}T12:00:00Z`);
    const weekday = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        timeZone: BUSINESS_TIMEZONE,
    }).format(value);
    const map: Record<string, Weekday> = {
        Mon: Weekday.MONDAY,
        Tue: Weekday.TUESDAY,
        Wed: Weekday.WEDNESDAY,
        Thu: Weekday.THURSDAY,
        Fri: Weekday.FRIDAY,
        Sat: Weekday.SATURDAY,
        Sun: Weekday.SUNDAY,
    };
    if (!map[weekday]) {
        throw new Error(`Could not determine weekday for ${parsed.year}-${parsed.month}-${parsed.day}.`);
    }
    return map[weekday];
}
export function minutesFromTime(value: string): number {
    if (!/^\d{2}:\d{2}$/.test(value)) {
        throw new Error(`Invalid time "${value}". Expected HH:mm.`);
    }
    const [hours = NaN, minutes = NaN] = value.split(':').map(Number);
    if (hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59) {
        throw new Error(`Invalid time "${value}".`);
    }
    return hours * 60 + minutes;
}
export function timeFromMinutes(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
export function makeBusinessDate(date: string, time: string): Date {
    parseCalendarDate(date);
    minutesFromTime(time);
    return businessDate(date, `${time}:00`);
}
export function getBusinessDateKey(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: BUSINESS_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}
export function getBusinessTime(date: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: BUSINESS_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).format(date);
}
export function normaliseInterval(interval: WorkingInterval): {
    fromMinutes: number;
    toMinutes: number;
} {
    const fromMinutes = minutesFromTime(interval.from);
    const toMinutes = minutesFromTime(interval.to);
    if (toMinutes <= fromMinutes) {
        throw new Error(`Invalid working interval ${interval.from}-${interval.to}.`);
    }
    return {
        fromMinutes,
        toMinutes,
    };
}
export function sameDate(first: Date, second: Date): boolean {
    return (getBusinessDateKey(first) ===
        getBusinessDateKey(second));
}
export function overlaps(candidateStart: Date, candidateEnd: Date, existingStart: Date, existingEnd: Date): boolean {
    return (candidateStart.getTime() < existingEnd.getTime() &&
        candidateEnd.getTime() > existingStart.getTime());
}
export function isSlotInsideInterval(slotStartMinutes: number, slotEndMinutes: number, interval: WorkingInterval): boolean {
    const { fromMinutes, toMinutes, } = normaliseInterval(interval);
    return (slotStartMinutes >= fromMinutes &&
        slotEndMinutes <= toMinutes);
}
export function calculateAvailability(context: AvailabilityContext, existingAppointments: ExistingAppointment[], serviceId: string, staffId: string, date: string): {
    timezone: string;
    date: string;
    serviceId: string;
    staffId: string;
    slots: AvailabilitySlot[];
} {
    const weekday = getWeekday(date);
    const daysOff = context.schedule.daysOff || [];
    if (daysOff.includes(weekday)) {
        return {
            timezone: BUSINESS_TIMEZONE,
            date,
            serviceId,
            staffId,
            slots: [],
        };
    }
    const intervals = context.schedule.weeklyIntervals?.[weekday] || [];
    if (intervals.length === 0) {
        return {
            timezone: BUSINESS_TIMEZONE,
            date,
            serviceId,
            staffId,
            slots: [],
        };
    }
    const slots: AvailabilitySlot[] = [];
    for (const interval of intervals) {
        const { fromMinutes, toMinutes, } = normaliseInterval(interval);
        // A service must fit completely inside the staff
        // working interval. If it is longer than the interval,
        // there cannot be any valid appointment in this interval.
        if (fromMinutes >= toMinutes ||
            context.service.duration <= 0 ||
            context.service.duration > toMinutes - fromMinutes) {
            continue;
        }
        for (let startMinutes = Math.ceil(fromMinutes / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES; startMinutes <=
            toMinutes - context.service.duration; startMinutes += SLOT_STEP_MINUTES) {
            const endMinutes = startMinutes + context.service.duration;
            if (startMinutes < fromMinutes ||
                endMinutes > toMinutes) {
                continue;
            }
            const startTime = timeFromMinutes(startMinutes);
            const endTime = timeFromMinutes(endMinutes);
            const slotStart = makeBusinessDate(date, startTime);
            const slotEnd = makeBusinessDate(date, endTime);
            const blocked = existingAppointments.some((appointment) => overlaps(slotStart, slotEnd, new Date(appointment.start), new Date(appointment.end)));
            if (blocked) {
                continue;
            }
            slots.push({
                start: slotStart.toISOString(),
                end: slotEnd.toISOString(),
                startTime,
                endTime,
            });
        }
    }
    return {
        timezone: BUSINESS_TIMEZONE,
        date,
        serviceId,
        staffId,
        slots,
    };
}
export function validateStart(start: Date): void {
    if (Number.isNaN(start.getTime())) {
        throw new Error('Invalid appointment start time.');
    }
    if (start.getUTCSeconds() !== 0 || start.getUTCMilliseconds() !== 0) {
        throw new Error('Appointment start time must use whole 15-minute increments.');
    }
}
export function validateSlotContext(context: AvailabilityContext, serviceId: string, staffId: string, start: Date): {
    serviceId: string;
    staffId: string;
    start: Date;
    end: Date;
    duration: number;
} {
    const end = new Date(start.getTime() +
        context.service.duration * 60 * 1000);
    const date = getBusinessDateKey(start);
    const weekday = getWeekday(date);
    if (context.schedule.daysOff.includes(weekday)) {
        throw new Error('The selected staff member is off on this day.');
    }
    const intervals = context.schedule.weeklyIntervals?.[weekday] || [];
    if (intervals.length === 0) {
        throw new Error('The selected staff member has no working hours on this day.');
    }
    const startTime = getBusinessTime(start);
    const endTime = getBusinessTime(end);
    const startMinutes = minutesFromTime(startTime);
    const endMinutes = minutesFromTime(endTime);
    const insideWorkingInterval = intervals.some((interval) => isSlotInsideInterval(startMinutes, endMinutes, interval));
    if (!insideWorkingInterval) {
        throw new Error('The selected appointment is outside the staff member’s working hours.');
    }
    if (!sameDate(start, end)) {
        throw new Error('An appointment cannot cross into another business day.');
    }
    if (startMinutes % SLOT_STEP_MINUTES !== 0) {
        throw new Error('Appointment start time must use 15-minute increments.');
    }
    return {
        serviceId,
        staffId,
        start,
        end,
        duration: context.service.duration,
    };
}
export function validateNoOverlap(start: Date, end: Date, existingAppointments: ExistingAppointment[]): void {
    const conflictingAppointment = existingAppointments.find((appointment) => overlaps(start, end, new Date(appointment.start), new Date(appointment.end)));
    if (conflictingAppointment) {
        throw new Error('The selected appointment slot is no longer available.');
    }
}
