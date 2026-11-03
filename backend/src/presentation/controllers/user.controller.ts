import type { Clinic } from '../../application/clinic';
import { adapt } from '../http';
export function createUserControllers(clinic: Clinic) {
    return {
        listStaff: adapt(clinic.users.listStaff),
        createStaff: adapt(clinic.users.createStaff),
    };
}
