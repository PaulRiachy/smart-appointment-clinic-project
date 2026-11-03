import { AppointmentStatus, UserRole } from '@app/shared';
import { STAFF_VISIBLE_APPOINTMENT_STATUSES, generateReference, parseStart, ensureStaffCanAccessAppointment, canManageAppointments, ensureCustomerOwnsAppointment, isTerminalStatus, canConfirm } from '../../domain/appointments/appointment.rules';
import type { AvailabilityUseCases } from './availability.usecases';
import type { Dependencies, OperationInput } from '../ports';
import { result, ApplicationError, type OperationResult } from '../result';
export function createAppointmentUseCases(deps: Dependencies, availability: AvailabilityUseCases) {
    const { getAvailability, validateSlot } = availability;
    const validateAndRunWithStaffLock = deps.bookingLock.run;
    const sendBookingConfirmationEmail = deps.mail.confirm;
    const sendRescheduleEmail = deps.mail.reschedule;
    const sendCancellationEmail = deps.mail.cancel;
    function getAuthenticatedUser(input: OperationInput): {
        id: string;
        role: string;
    } {
        const user = input.actor;
        const id = String(user?._id ?? user?.id ?? '');
        const role = String(user?.role ?? '');
        if (!id || !role) {
            throw new ApplicationError('unauthenticated', 'Authentication required.');
        }
        return {
            id,
            role,
        };
    }
    function isValidObjectId(value: string): boolean {
        return deps.identifiers.isStrict(value);
    }
    async function createUniqueReference(): Promise<string> {
        for (let attempt = 0; attempt < 10; attempt += 1) {
            const reference = generateReference();
            const exists = await deps.appointments.referenceExists(reference);
            if (!exists) {
                return reference;
            }
        }
        throw new ApplicationError('failed', 'Could not generate a unique appointment reference.');
    }
    async function findAppointmentOrThrow(id: string) {
        if (!isValidObjectId(id)) {
            throw new ApplicationError('invalid', 'Invalid appointment id.');
        }
        const appointment = await deps.appointments.findById(id);
        if (!appointment) {
            throw new ApplicationError('notFound', 'Appointment not found.');
        }
        return appointment;
    }
    async function getAppointmentEmailDetails(appointmentId: string) {
        const appointment = await deps.appointments.emailSource(appointmentId);
        if (!appointment) {
            throw new ApplicationError('notFound', 'Appointment not found.');
        }
        const customer = appointment.customer as {
            fullName?: string;
            email?: string;
        } | null;
        const service = appointment.service as {
            name?: string;
        } | null;
        const staff = appointment.staff as {
            fullName?: string;
        } | null;
        if (!customer?.email) {
            console.error(`Cannot send appointment email: customer email is missing for ${appointment.reference}.`);
            return null;
        }
        return {
            to: customer.email,
            customerName: customer.fullName || 'Customer',
            reference: appointment.reference,
            serviceName: service?.name || 'Appointment',
            staffName: staff?.fullName || 'Staff member',
            start: new Date(appointment.start),
            end: new Date(appointment.end),
        };
    }
    async function updateAppointmentOrThrow(appointment: Awaited<ReturnType<typeof findAppointmentOrThrow>>, changes: {
        status?: AppointmentStatus;
        start?: Date;
        end?: Date;
    }) {
        const updated = await deps.appointments.updateIfUnchanged(appointment, changes);
        if (!updated) {
            throw new ApplicationError('conflict', 'This appointment changed during the request. Please refresh and try again.');
        }
        return updated;
    }
    async function checkAvailability(input: OperationInput): Promise<OperationResult> {
        const { serviceId, staffId, date, } = input.query;
        if (typeof serviceId !== 'string' ||
            typeof staffId !== 'string' ||
            typeof date !== 'string') {
            throw new ApplicationError('invalid', 'serviceId, staffId and date are required.');
        }
        const availability = await getAvailability(serviceId, staffId, date);
        return result('ok', {
            data: availability,
        });
    }
    async function createAppointment(input: OperationInput): Promise<OperationResult> {
        const { id: customerId, role, } = getAuthenticatedUser(input);
        if (role !== UserRole.CUSTOMER) {
            throw new ApplicationError('forbidden', 'Only customers can create appointments.');
        }
        const { serviceId, staffId, start, } = input.body as {
            serviceId?: string;
            staffId?: string;
            start?: string;
        };
        if (typeof serviceId !== 'string' ||
            typeof staffId !== 'string' ||
            typeof start !== 'string') {
            throw new ApplicationError('invalid', 'serviceId, staffId and start are required.');
        }
        if (!isValidObjectId(serviceId) ||
            !isValidObjectId(staffId)) {
            throw new ApplicationError('invalid', 'serviceId or staffId is invalid.');
        }
        const customer = await deps.users.identity(customerId);
        if (!customer) {
            throw new ApplicationError('unauthenticated', 'Customer account was not found.');
        }
        const service = await deps.services.forBooking(serviceId, 'create');
        if (!service) {
            throw new ApplicationError('notFound', 'Service not found.');
        }
        if (!service.active) {
            throw new ApplicationError('invalid', 'Inactive services cannot be booked.');
        }
        const requestedStart = parseStart(start);
        const requestedEnd = new Date(requestedStart.getTime() +
            service.duration * 60 * 1000);
        const appointment = await validateAndRunWithStaffLock(staffId, requestedStart, requestedEnd, async () => {
            const validated = await validateSlot(serviceId, staffId, requestedStart);
            const reference = await createUniqueReference();
            return deps.appointments.create({
                reference,
                customer: customerId.toString(),
                service: serviceId.toString(),
                staff: staffId.toString(),
                start: validated.start,
                end: validated.end,
                status: AppointmentStatus.PENDING,
            });
        });
        return result('created', {
            message: 'Appointment booked successfully.',
            data: appointment.view,
        });
    }
    async function listAppointments(input: OperationInput): Promise<OperationResult> {
        const { id: userId, role, } = getAuthenticatedUser(input);
        const scope: {
            customerId?: string;
            statuses?: AppointmentStatus[];
        } = {};
        if (role === UserRole.CUSTOMER) {
            scope.customerId = userId;
        }
        else if (role === UserRole.STAFF) {
            scope.statuses = STAFF_VISIBLE_APPOINTMENT_STATUSES;
        }
        else if (!canManageAppointments(role)) {
            throw new ApplicationError('forbidden', 'You are not allowed to view appointments.');
        }
        const appointments = await deps.appointments.list(scope);
        return result('ok', {
            data: appointments,
        });
    }
    async function getAppointment(input: OperationInput): Promise<OperationResult> {
        const { id: userId, role, } = getAuthenticatedUser(input);
        const appointment = await findAppointmentOrThrow(String(input.params.id));
        if (role === UserRole.CUSTOMER) {
            ensureCustomerOwnsAppointment(appointment, userId);
        }
        else if (!canManageAppointments(role)) {
            throw new ApplicationError('forbidden', 'You are not allowed to view this appointment.');
        }
        ensureStaffCanAccessAppointment(appointment, role);
        const populated = await deps.appointments.populateDetails(appointment);
        return result('ok', {
            data: populated,
        });
    }
    async function cancelAppointment(input: OperationInput): Promise<OperationResult> {
        const { id: userId, role, } = getAuthenticatedUser(input);
        const appointment = await findAppointmentOrThrow(String(input.params.id));
        if (role === UserRole.CUSTOMER) {
            ensureCustomerOwnsAppointment(appointment, userId);
        }
        else if (!canManageAppointments(role)) {
            throw new ApplicationError('forbidden', 'You are not allowed to cancel this appointment.');
        }
        ensureStaffCanAccessAppointment(appointment, role);
        if (isTerminalStatus(appointment.status)) {
            throw new ApplicationError('invalid', 'This appointment can no longer be cancelled.');
        }
        const updated = await updateAppointmentOrThrow(appointment, {
            status: AppointmentStatus.CANCELLED,
        });
        const emailDetails = await getAppointmentEmailDetails(String(appointment._id));
        if (emailDetails) {
            await sendCancellationEmail(emailDetails);
        }
        return result('ok', {
            message: 'Appointment cancelled successfully.',
            data: updated.view,
        });
    }
    async function rescheduleAppointment(input: OperationInput): Promise<OperationResult> {
        const { id: userId, role, } = getAuthenticatedUser(input);
        const appointment = await findAppointmentOrThrow(String(input.params.id));
        if (role === UserRole.CUSTOMER) {
            ensureCustomerOwnsAppointment(appointment, userId);
        }
        else if (!canManageAppointments(role)) {
            throw new ApplicationError('forbidden', 'You are not allowed to reschedule this appointment.');
        }
        ensureStaffCanAccessAppointment(appointment, role);
        if (isTerminalStatus(appointment.status)) {
            throw new ApplicationError('invalid', 'This appointment cannot be rescheduled.');
        }
        const { start } = input.body as {
            start?: string;
        };
        if (typeof start !== 'string') {
            throw new ApplicationError('invalid', 'start is required.');
        }
        const staffId = String(appointment.staff);
        const serviceId = String(appointment.service);
        const service = await deps.services.forBooking(serviceId, 'reschedule');
        if (!service) {
            throw new ApplicationError('notFound', 'Service not found.');
        }
        if (!service.active) {
            throw new ApplicationError('invalid', 'Inactive services cannot be booked.');
        }
        const requestedStart = parseStart(start);
        const requestedEnd = new Date(requestedStart.getTime() +
            service.duration * 60 * 1000);
        const updated = await validateAndRunWithStaffLock(staffId, requestedStart, requestedEnd, async () => {
            const validated = await validateSlot(serviceId, staffId, requestedStart, String(appointment._id));
            return updateAppointmentOrThrow(appointment, {
                start: validated.start,
                end: validated.end,
            });
        });
        const emailDetails = await getAppointmentEmailDetails(String(updated._id));
        if (emailDetails) {
            await sendRescheduleEmail(emailDetails);
        }
        return result('ok', {
            message: 'Appointment rescheduled successfully.',
            data: updated.view,
        });
    }
    async function confirmAppointment(input: OperationInput): Promise<OperationResult> {
        const { role, } = getAuthenticatedUser(input);
        if (!canManageAppointments(role)) {
            throw new ApplicationError('forbidden', 'Only staff or administrators can confirm appointments.');
        }
        const appointment = await findAppointmentOrThrow(String(input.params.id));
        ensureStaffCanAccessAppointment(appointment, role);
        if (!canConfirm(appointment.status)) {
            throw new ApplicationError('invalid', 'Only pending appointments can be confirmed.');
        }
        const staffId = String(appointment.staff);
        const serviceId = String(appointment.service);
        const appointmentStart = new Date(appointment.start);
        const appointmentEnd = new Date(appointment.end);
        if (Number.isNaN(appointmentStart.getTime()) ||
            Number.isNaN(appointmentEnd.getTime())) {
            throw new ApplicationError('invalid', 'Appointment has an invalid time range.');
        }
        await validateAndRunWithStaffLock(staffId, appointmentStart, appointmentEnd, async () => {
            // Recalculate availability while holding the booking lock.
            await validateSlot(serviceId, staffId, appointmentStart, String(appointment._id));
            const updated = await updateAppointmentOrThrow(appointment, {
                status: AppointmentStatus.CONFIRMED,
            });
            deps.appointments.copyUpdatedView(appointment, updated);
        });
        const emailDetails = await getAppointmentEmailDetails(String(appointment._id));
        if (emailDetails) {
            await sendBookingConfirmationEmail(emailDetails);
        }
        return result('ok', {
            message: 'Appointment confirmed successfully.',
            data: appointment.view,
        });
    }
    return { checkAvailability, createAppointment, listAppointments, getAppointment, cancelAppointment, rescheduleAppointment, confirmAppointment };
}
