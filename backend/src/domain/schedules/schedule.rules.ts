import { Weekday } from '@app/shared';
export type WorkingIntervalInput = {
    from: string;
    to: string;
};
export type ScheduleInput = {
    weeklyIntervals: Record<string, WorkingIntervalInput[]>;
    daysOff: string[];
    services: string[];
};
const weekdays = Object.values(Weekday);
function isValidTime(value: unknown): value is string {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
function timeToMinutes(value: string): number {
    const [hours = NaN, minutes = NaN] = value.split(':').map(Number);
    return hours * 60 + minutes;
}
export function isValidSchedulePayload(body: unknown, isValidId: (value: unknown) => boolean): body is ScheduleInput {
    if (!body || typeof body !== 'object') {
        return false;
    }
    const value = body as Record<string, unknown>;
    if (!value.weeklyIntervals ||
        typeof value.weeklyIntervals !== 'object' ||
        !Array.isArray(value.daysOff) ||
        !Array.isArray(value.services)) {
        return false;
    }
    const weeklyIntervals = value.weeklyIntervals as Record<string, unknown>;
    const weeklyKeys = Object.keys(weeklyIntervals);
    if (weeklyKeys.some((day) => !weekdays.includes(day as Weekday)) ||
        weeklyKeys.length !== weekdays.length) {
        return false;
    }
    for (const day of weekdays) {
        const intervals = weeklyIntervals[day];
        if (!Array.isArray(intervals)) {
            return false;
        }
        for (const interval of intervals) {
            if (!interval || typeof interval !== 'object') {
                return false;
            }
            const item = interval as Record<string, unknown>;
            if (!isValidTime(item.from) || !isValidTime(item.to)) {
                return false;
            }
            if (timeToMinutes(item.from) >= timeToMinutes(item.to)) {
                return false;
            }
        }
        const sorted = [...(intervals as WorkingIntervalInput[])].sort((a, b) => timeToMinutes(a.from) - timeToMinutes(b.from));
        for (let index = 1; index < sorted.length; index += 1) {
            const previous = sorted[index - 1]!;
            const current = sorted[index]!;
            if (timeToMinutes(current.from) < timeToMinutes(previous.to)) {
                return false;
            }
        }
    }
    if (value.daysOff.some((day) => typeof day !== 'string' ||
        !weekdays.includes(day as Weekday))) {
        return false;
    }
    const serviceIds = value.services;
    if (serviceIds.some((serviceId) => typeof serviceId !== 'string' ||
        !isValidId(serviceId))) {
        return false;
    }
    const uniqueServiceIds = new Set(serviceIds);
    if (uniqueServiceIds.size !== serviceIds.length) {
        return false;
    }
    const uniqueDaysOff = new Set(value.daysOff);
    if (uniqueDaysOff.size !== value.daysOff.length) {
        return false;
    }
    return true;
}
