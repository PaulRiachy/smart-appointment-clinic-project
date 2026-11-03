import mongoose, { Types } from 'mongoose';
import type { Dependencies } from '../application/ports';
import { appointmentRepository, userRepository, serviceRepository, scheduleRepository, queueRepository } from './persistence/repositories';
import { dashboardRepository } from './persistence/dashboard.repository';
import { validateAndRunWithStaffLock } from './locking/booking-lock';
import { sendBookingConfirmationEmail, sendRescheduleEmail, sendCancellationEmail } from './mail/mail.service';
import { authTokens } from './security/auth-tokens';
export function createDependencies(): Dependencies {
    return {
        appointments: appointmentRepository, users: userRepository,
        services: serviceRepository, schedules: scheduleRepository, queue: queueRepository,
        dashboard: dashboardRepository,
        identifiers: { isValid: mongoose.isValidObjectId, isStrict: Types.ObjectId.isValid },
        failures: {
            isValidation: error => error instanceof mongoose.Error.ValidationError,
            isNamedValidation: error => error instanceof mongoose.Error.ValidationError || (error instanceof Error && error.name === 'ValidationError'),
            isDuplicate: error => error instanceof mongoose.mongo.MongoServerError && error.code === 11000,
            isDuplicateEmail: error => typeof error === 'object' && error !== null && 'code' in error && error.code === 11000 &&
                'keyPattern' in error && typeof error.keyPattern === 'object' && error.keyPattern !== null &&
                'email' in error.keyPattern && Boolean(error.keyPattern.email),
        },
        tokens: authTokens,
        bookingLock: { run: validateAndRunWithStaffLock },
        mail: { confirm: sendBookingConfirmationEmail, reschedule: sendRescheduleEmail, cancel: sendCancellationEmail },
    };
}
