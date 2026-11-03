import type { Clinic } from '../../application/clinic';
import { adapt } from '../http';
export function createDashboardControllers(clinic: Clinic) {
    return {
        getDashboardStats: adapt(clinic.dashboard.getDashboardStats),
    };
}
