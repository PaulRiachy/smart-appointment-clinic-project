import { UserRole } from '@app/shared';
import { isValidServicePayload } from '../../domain/services/service.rules';
import type { Dependencies, OperationInput } from '../ports';
import { result, type OperationResult } from '../result';
export function createServiceUseCases(deps: Dependencies) {
    async function listServices(input: OperationInput): Promise<OperationResult> {
        try {
            const isAdmin = input.actor?.role === UserRole.ADMIN;
            const services = await deps.services.list(isAdmin);
            return result('ok', {
                data: services,
            });
        }
        catch (error) {
            console.error('Failed to list services:', error);
            return result('failed', {
                message: 'Failed to load services.',
            });
        }
    }
    async function createService(input: OperationInput): Promise<OperationResult> {
        try {
            if (!isValidServicePayload(input.body)) {
                return result('invalid', {
                    message: 'Name and description are required. Duration must be a positive integer and price must be non-negative.',
                });
            }
            const name = input.body.name.trim();
            const description = input.body.description.trim();
            const existingService = await deps.services.duplicateName(name);
            if (existingService) {
                return result('conflict', {
                    message: 'A service with this name already exists.',
                });
            }
            const service = await deps.services.create({ name, description, duration: input.body.duration, price: input.body.price, active: true, });
            return result('created', {
                message: 'Service created successfully.',
                data: service,
            });
        }
        catch (error) {
            console.error('Failed to create service:', error);
            if (deps.failures.isNamedValidation(error)) {
                return result('invalid', {
                    message: 'Invalid service data.',
                });
            }
            return result('failed', {
                message: 'Failed to create service.',
            });
        }
    }
    async function updateService(input: OperationInput): Promise<OperationResult> {
        try {
            const { id } = input.params;
            if (!deps.identifiers.isValid(id)) {
                return result('invalid', {
                    message: 'Invalid service ID.',
                });
            }
            if (!isValidServicePayload(input.body)) {
                return result('invalid', {
                    message: 'Name and description are required. Duration must be a positive integer and price must be non-negative.',
                });
            }
            const name = input.body.name.trim();
            const description = input.body.description.trim();
            const duplicate = await deps.services.duplicateName(name, id);
            if (duplicate) {
                return result('conflict', {
                    message: 'A service with this name already exists.',
                });
            }
            const service = await deps.services.update(id, { name, description, duration: input.body.duration, price: input.body.price });
            if (!service) {
                return result('notFound', {
                    message: 'Service not found.',
                });
            }
            return result('ok', {
                message: 'Service updated successfully.',
                data: service,
            });
        }
        catch (error) {
            console.error('Failed to update service:', error);
            return result('failed', {
                message: 'Failed to update service.',
            });
        }
    }
    async function updateServiceStatus(input: OperationInput): Promise<OperationResult> {
        try {
            const { id } = input.params;
            if (!deps.identifiers.isValid(id)) {
                return result('invalid', {
                    message: 'Invalid service ID.',
                });
            }
            const service = await deps.services.findById(id);
            if (!service) {
                return result('notFound', {
                    message: 'Service not found.',
                });
            }
            if (input.body.active !== undefined &&
                typeof input.body.active !== 'boolean') {
                return result('invalid', {
                    message: 'The active field must be a boolean.',
                });
            }
            const saved = await deps.services.saveActive(service, typeof input.body.active === 'boolean' ? input.body.active : !service.active);
            return result('ok', {
                message: saved.active
                    ? 'Service activated successfully.'
                    : 'Service deactivated successfully.',
                data: saved.view,
            });
        }
        catch (error) {
            console.error('Failed to update service status:', error);
            return result('failed', {
                message: 'Failed to update service status.',
            });
        }
    }
    return { listServices, createService, updateService, updateServiceStatus };
}
