import type { IUser } from '@app/shared';
import { UserRole } from '@app/shared';
export function publicUser(user: {
    _id: unknown;
    fullName: string;
    email: string;
    phone: string;
    role: UserRole;
    createdAt?: Date;
}): IUser {
    return {
        _id: String(user._id),
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        ...(user.createdAt
            ? { createdAt: user.createdAt.toISOString() }
            : {}),
    };
}
export function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}
export function isValidCreateStaffBody(body: CreateStaffBody): boolean {
    return (typeof body.fullName === 'string' &&
        body.fullName.trim().length >= 2 &&
        typeof body.email === 'string' &&
        body.email.trim().length > 0 &&
        typeof body.phone === 'string' &&
        body.phone.trim().length > 0 &&
        typeof body.password === 'string' &&
        body.password.length >= 8);
}
export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}
export interface CreateStaffBody {
    fullName?: unknown;
    email?: unknown;
    phone?: unknown;
    password?: unknown;
}
