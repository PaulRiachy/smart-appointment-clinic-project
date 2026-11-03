import type { Clinic } from '../../application/clinic';
import { adapt } from '../http';
export function createScheduleControllers(clinic: Clinic) {
    return {
        getStaffSchedule: adapt(clinic.schedules.getStaffSchedule),
        saveStaffSchedule: adapt(clinic.schedules.saveStaffSchedule),
    };
}
