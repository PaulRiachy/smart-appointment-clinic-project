import { AppointmentStatus, UserRole } from '@app/shared';
import { businessDate } from '../time/business-time';
import { RuleViolation } from '../rule-violation';
export const STAFF_VISIBLE_APPOINTMENT_STATUSES: AppointmentStatus[] = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];
export function generateReference(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let index = 0; index < 6; index += 1) {
        suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return `APT-${suffix}`;
}
export function parseStart(value: unknown): Date {
    if (typeof value !== 'string' ||
        value.trim() === '') {
        throw new RuleViolation('invalid', 'start is required.');
    }
    const input = value.trim();
    let date: Date;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) {
        date = businessDate(input.slice(0, 10), `${input.slice(11)}:00`);
    }
    else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(input)) {
        date = businessDate(input.slice(0, 10), input.slice(11));
    }
    else {
        date = new Date(input);
    }
    if (Number.isNaN(date.getTime())) {
        throw new RuleViolation('invalid', 'start must be a valid timestamp.');
    }
    return date;
}
export function ensureStaffCanAccessAppointment(appointment: {
    status: AppointmentStatus;
}, role: string): void {
    if (role === UserRole.STAFF && !STAFF_VISIBLE_APPOINTMENT_STATUSES.includes(appointment.status)) {
        throw new RuleViolation('forbidden', 'Staff can only access pending and confirmed appointments.');
    }
}
export function canManageAppointments(role: string): boolean {
    return (role === UserRole.ADMIN ||
        role === UserRole.STAFF);
}
export function ensureCustomerOwnsAppointment(appointment: {
    customer: unknown;
}, userId: string): void {
    if (String(appointment.customer) !==
        String(userId)) {
        throw new RuleViolation('forbidden', 'You are not allowed to access this appointment.');
    }
}
export function isTerminalStatus(status: AppointmentStatus): boolean {
    return [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW].includes(status);
}
export function canConfirm(status: AppointmentStatus): boolean { return status === AppointmentStatus.PENDING; }
export function canCheckIn(status: AppointmentStatus): boolean { return status === AppointmentStatus.CONFIRMED; }
export function noShowCutoff(now = Date.now()): Date { return new Date(now - 15 * 60 * 1000); }
