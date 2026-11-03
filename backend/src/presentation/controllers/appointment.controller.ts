import type { Clinic } from '../../application/clinic';
import { adapt, appointmentError } from '../http';
export function createAppointmentControllers(clinic: Clinic) {
    return {
        getAvailabilityController: adapt(clinic.appointments.checkAvailability, appointmentError),
        createAppointment: adapt(clinic.appointments.createAppointment, appointmentError),
        listAppointments: adapt(clinic.appointments.listAppointments, appointmentError),
        getAppointment: adapt(clinic.appointments.getAppointment, appointmentError),
        cancelAppointment: adapt(clinic.appointments.cancelAppointment, appointmentError),
        rescheduleAppointment: adapt(clinic.appointments.rescheduleAppointment, appointmentError),
        confirmAppointment: adapt(clinic.appointments.confirmAppointment, appointmentError),
    };
}
