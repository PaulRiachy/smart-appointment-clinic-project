import type { Clinic } from '../../application/clinic';
import { adapt } from '../http';
export function createAuthControllers(clinic: Clinic) {
    return {
        register: adapt(clinic.auth.register),
        login: adapt(clinic.auth.login),
        getMe: adapt(clinic.auth.getMe),
    };
}
