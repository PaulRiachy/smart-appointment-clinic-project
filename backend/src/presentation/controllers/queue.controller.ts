import type { Clinic } from '../../application/clinic';
import type { QueuePublisher } from '../../application/ports';
import { adapt } from '../http';
export function createQueueControllers(clinic: Clinic, queuePublisher: (io: unknown) => QueuePublisher) {
    return {
        checkInAppointment: adapt(clinic.queue.checkInAppointment, undefined, queuePublisher),
        getTodayQueue: adapt(clinic.queue.getTodayQueue, undefined, queuePublisher),
        callQueueEntry: adapt(clinic.queue.callQueueEntry, undefined, queuePublisher),
        completeQueueEntry: adapt(clinic.queue.completeQueueEntry, undefined, queuePublisher),
    };
}
