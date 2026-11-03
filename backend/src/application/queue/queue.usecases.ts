import { AppointmentStatus } from '@app/shared';
import type { QueueEntry } from '../../domain/entities';
import { canCheckIn } from '../../domain/appointments/appointment.rules';
import { getBeirutDayStart, getNextQueueNumber, toQueueSocketPayload, queueTransitions } from '../../domain/queue/queue.rules';
import type { Dependencies, OperationInput } from '../ports';
import { result, type OperationResult } from '../result';
export function createQueueUseCases(deps: Dependencies) {
    async function checkInAppointment(input: OperationInput): Promise<OperationResult> {
        const { reference } = input.body as {
            reference?: string;
        };
        const normalizedReference = typeof reference === 'string' ? reference.trim() : '';
        if (!normalizedReference) {
            return result('invalid', {
                message: 'Appointment reference is required',
                error: 'INVALID_APPOINTMENT_REFERENCE',
            });
        }
        const appointment = await deps.appointments.findByReference(normalizedReference);
        if (!appointment) {
            return result('notFound', {
                message: 'Appointment not found for the supplied reference',
                error: 'APPOINTMENT_NOT_FOUND',
            });
        }
        if (appointment.status === AppointmentStatus.CHECKED_IN) {
            return result('conflict', {
                message: 'Appointment has already been checked in',
                error: 'ALREADY_CHECKED_IN',
            });
        }
        if (!canCheckIn(appointment.status)) {
            return result('invalid', {
                message: `Only confirmed appointments can be checked in. Current status: ${appointment.status}`,
                error: 'INVALID_APPOINTMENT_STATUS',
            });
        }
        const existingQueueEntry = await deps.queue.forAppointment(appointment._id.toString());
        if (existingQueueEntry) {
            return result('conflict', {
                message: 'Appointment already has a queue entry',
                error: 'QUEUE_ENTRY_EXISTS',
            });
        }
        const queueDate = getBeirutDayStart();
        const checkedInAt = new Date();
        let createdQueueEntry: QueueEntry | null = null;
        for (let attempt = 0; attempt < 10; attempt += 1) {
            const lastEntry = await deps.queue.lastNumber(queueDate);
            const queueNumber = getNextQueueNumber(lastEntry);
            try {
                createdQueueEntry = await deps.queue.create({ appointment: appointment._id.toString(), queueDate, queueNumber, checkedInAt, });
                break;
            }
            catch (error: unknown) {
                const mongoError = error as {
                    code?: number;
                    keyPattern?: Record<string, unknown>;
                };
                if (mongoError.code !== 11000) {
                    throw error;
                }
                if (mongoError.keyPattern?.appointment) {
                    return result('conflict', {
                        message: 'Appointment was checked in by another request',
                        error: 'ALREADY_CHECKED_IN',
                    });
                }
            }
        }
        if (!createdQueueEntry) {
            return result('conflict', {
                message: 'Unable to allocate a unique daily queue number',
                error: 'QUEUE_NUMBER_CONFLICT',
            });
        }
        const updatedAppointment = await deps.appointments.transition(appointment._id, ...queueTransitions.checkIn);
        if (!updatedAppointment) {
            await deps.queue.delete(createdQueueEntry._id);
            const currentAppointment = await deps.appointments.findById(appointment._id);
            if (currentAppointment?.status === AppointmentStatus.CHECKED_IN) {
                return result('conflict', {
                    message: 'Appointment was checked in by another request',
                    error: 'ALREADY_CHECKED_IN',
                });
            }
            return result('invalid', {
                message: `Appointment can no longer be checked in. Current status: ${currentAppointment?.status ?? 'UNKNOWN'}`,
                error: 'INVALID_APPOINTMENT_STATUS',
            });
        }
        const populatedQueueEntry = await deps.queue.populate(createdQueueEntry._id);
        if (!populatedQueueEntry) {
            return result('failed', {
                message: 'Queue entry was created but could not be loaded',
                error: 'QUEUE_ENTRY_LOAD_FAILED',
            });
        }
        const events = input.queueEvents!();
        events.update(toQueueSocketPayload({
            _id: createdQueueEntry._id,
            queueNumber: createdQueueEntry.queueNumber,
            appointment: {
                _id: updatedAppointment._id,
                status: updatedAppointment.status,
            },
        }));
        return result('created', {
            message: 'Appointment checked in successfully',
            data: populatedQueueEntry,
        });
    }
    async function getTodayQueue(_input: OperationInput): Promise<OperationResult> {
        const queueDate = getBeirutDayStart();
        const queue = await deps.queue.today(queueDate);
        return result('ok', {
            message: "Today's active queue",
            data: queue,
        });
    }
    async function callQueueEntry(input: OperationInput): Promise<OperationResult> {
        const { id } = input.params;
        if (typeof id !== 'string' || !deps.identifiers.isStrict(id)) {
            return result('invalid', {
                message: 'Invalid queue entry id',
                error: 'INVALID_QUEUE_ENTRY_ID',
            });
        }
        const queueEntry = await deps.queue.findById(id);
        if (!queueEntry) {
            return result('notFound', {
                message: 'Queue entry not found',
                error: 'QUEUE_ENTRY_NOT_FOUND',
            });
        }
        if (queueEntry.completedAt) {
            return result('invalid', {
                message: 'Completed queue entries cannot be called',
                error: 'QUEUE_ENTRY_COMPLETED',
            });
        }
        if (queueEntry.calledAt) {
            return result('conflict', {
                message: 'Customer has already been called',
                error: 'CUSTOMER_ALREADY_CALLED',
            });
        }
        const appointment = await deps.appointments.transition(queueEntry.appointment, ...queueTransitions.call);
        if (!appointment) {
            const currentAppointment = await deps.appointments.findById(queueEntry.appointment);
            return result('invalid', {
                message: `Queue entry cannot be called. Appointment status is ${currentAppointment?.status ?? 'UNKNOWN'}`,
                error: 'INVALID_APPOINTMENT_STATUS',
            });
        }
        const calledAt = new Date();
        const updatedQueueEntry = await deps.queue.markCalled(queueEntry._id, calledAt);
        if (!updatedQueueEntry) {
            await deps.appointments.transition(appointment._id, ...queueTransitions.rollbackCall);
            return result('conflict', {
                message: 'Customer was called by another request',
                error: 'CUSTOMER_ALREADY_CALLED',
            });
        }
        const populatedQueueEntry = await deps.queue.populate(updatedQueueEntry._id);
        if (!populatedQueueEntry) {
            return result('failed', {
                message: 'Queue entry could not be loaded after calling',
                error: 'QUEUE_ENTRY_LOAD_FAILED',
            });
        }
        const events = input.queueEvents!();
        events.call(toQueueSocketPayload({
            _id: updatedQueueEntry._id,
            queueNumber: updatedQueueEntry.queueNumber,
            appointment: {
                _id: appointment._id,
                status: appointment.status,
            },
        }));
        return result('ok', {
            message: 'Customer called and service started',
            data: populatedQueueEntry,
        });
    }
    async function completeQueueEntry(input: OperationInput): Promise<OperationResult> {
        const { id } = input.params;
        if (typeof id !== 'string' || !deps.identifiers.isStrict(id)) {
            return result('invalid', {
                message: 'Invalid queue entry id',
                error: 'INVALID_QUEUE_ENTRY_ID',
            });
        }
        const queueEntry = await deps.queue.findById(id);
        if (!queueEntry) {
            return result('notFound', {
                message: 'Queue entry not found',
                error: 'QUEUE_ENTRY_NOT_FOUND',
            });
        }
        if (queueEntry.completedAt) {
            return result('conflict', {
                message: 'Queue entry has already been completed',
                error: 'ALREADY_COMPLETED',
            });
        }
        if (!queueEntry.calledAt) {
            return result('invalid', {
                message: 'A customer must be called before the service can be completed',
                error: 'NOT_IN_SERVICE',
            });
        }
        const appointment = await deps.appointments.transition(queueEntry.appointment, ...queueTransitions.complete);
        if (!appointment) {
            const currentAppointment = await deps.appointments.findById(queueEntry.appointment);
            return result('invalid', {
                message: `Service cannot be completed. Appointment status is ${currentAppointment?.status ?? 'UNKNOWN'}`,
                error: 'INVALID_APPOINTMENT_STATUS',
            });
        }
        const completedAt = new Date();
        const updatedQueueEntry = await deps.queue.markCompleted(queueEntry._id, completedAt);
        if (!updatedQueueEntry) {
            await deps.appointments.transition(appointment._id, ...queueTransitions.rollbackComplete);
            return result('conflict', {
                message: 'Queue entry was completed by another request',
                error: 'ALREADY_COMPLETED',
            });
        }
        const populatedQueueEntry = await deps.queue.populate(updatedQueueEntry._id);
        if (!populatedQueueEntry) {
            return result('failed', {
                message: 'Queue entry could not be loaded after completion',
                error: 'QUEUE_ENTRY_LOAD_FAILED',
            });
        }
        const events = input.queueEvents!();
        events.complete(toQueueSocketPayload({
            _id: updatedQueueEntry._id,
            queueNumber: updatedQueueEntry.queueNumber,
            appointment: {
                _id: appointment._id,
                status: appointment.status,
            },
        }));
        return result('ok', {
            message: 'Service completed successfully',
            data: populatedQueueEntry,
        });
    }
    return { checkInAppointment, getTodayQueue, callQueueEntry, completeQueueEntry };
}
