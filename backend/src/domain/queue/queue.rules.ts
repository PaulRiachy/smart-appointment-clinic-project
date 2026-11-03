import { AppointmentStatus } from '@app/shared';
import type { EntityId } from '../entities';
import { businessDate } from '../time/business-time';
const BEIRUT_TIMEZONE = 'Asia/Beirut';
export const queueTransitions = {
    checkIn: [AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN],
    call: [AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_SERVICE],
    rollbackCall: [AppointmentStatus.IN_SERVICE, AppointmentStatus.CHECKED_IN],
    complete: [AppointmentStatus.IN_SERVICE, AppointmentStatus.COMPLETED],
    rollbackComplete: [AppointmentStatus.COMPLETED, AppointmentStatus.IN_SERVICE],
} as const;
export function getQueueDateParts(date: Date): {
    year: number;
    month: number;
    day: number;
} {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: BEIRUT_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const day = Number(parts.find((part) => part.type === 'day')?.value);
    return { year, month, day };
}
export function getBeirutDayStart(date: Date = new Date()): Date {
    const { year, month, day } = getQueueDateParts(date);
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return businessDate(key);
}
export function getNextQueueNumber(lastQueueNumber?: string): string {
    if (!lastQueueNumber) {
        return 'A-001';
    }
    const match = lastQueueNumber.match(/^A-(\d+)$/);
    if (!match) {
        return 'A-001';
    }
    const nextNumber = Number(match[1]) + 1;
    return `A-${String(nextNumber).padStart(3, '0')}`;
}
export function toQueueSocketPayload(queueEntry: {
    _id: EntityId;
    queueNumber: string;
    appointment: {
        _id: EntityId;
        status: AppointmentStatus;
    };
}): {
    queueEntryId: string;
    queueNumber: string;
    appointmentId: string;
    appointmentStatus: AppointmentStatus;
    timestamp: string;
} {
    return {
        queueEntryId: queueEntry._id.toString(),
        queueNumber: queueEntry.queueNumber,
        appointmentId: queueEntry.appointment._id.toString(),
        appointmentStatus: queueEntry.appointment.status,
        timestamp: new Date().toISOString(),
    };
}
