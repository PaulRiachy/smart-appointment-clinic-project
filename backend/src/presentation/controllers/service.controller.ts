import type { Clinic } from '../../application/clinic';
import { adapt } from '../http';
export function createServiceControllers(clinic: Clinic) {
    return {
        listServices: adapt(clinic.services.listServices),
        createService: adapt(clinic.services.createService),
        updateService: adapt(clinic.services.updateService),
        updateServiceStatus: adapt(clinic.services.updateServiceStatus),
    };
}
