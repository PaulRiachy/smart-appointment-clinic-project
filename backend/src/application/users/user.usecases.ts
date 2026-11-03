import { UserRole } from '@app/shared';
import { isValidCreateStaffBody, normalizeEmail } from '../../domain/users/user.rules';
import type { Dependencies, OperationInput } from '../ports';
import { result, type OperationResult } from '../result';
export function createUserUseCases(deps: Dependencies) {
    async function listStaff(_input: OperationInput): Promise<OperationResult> {
        try {
            const staff = await deps.users.listStaff();
            return result('ok', {
                data: staff,
            });
        }
        catch (error) {
            console.error('Failed to list staff:', error);
            return result('failed', {
                message: 'Failed to retrieve staff members.',
            });
        }
    }
    async function createStaff(input: OperationInput): Promise<OperationResult> {
        try {
            if (!isValidCreateStaffBody(input.body)) {
                return result('invalid', {
                    message: 'Full name, email, phone and a password of at least 8 characters are required.',
                });
            }
            const fullName = (input.body.fullName as string).trim();
            const email = normalizeEmail(input.body.email as string);
            const phone = (input.body.phone as string).trim();
            const password = input.body.password as string;
            const existingUser = await deps.users.findByEmail(email);
            if (existingUser) {
                return result('conflict', {
                    message: 'An account with this email already exists.',
                });
            }
            const staff = await deps.users.create({ fullName, email, phone, password, role: UserRole.STAFF, });
            return result('created', {
                message: 'Staff account created successfully.',
                data: {
                    _id: staff._id,
                    fullName: staff.fullName,
                    email: staff.email,
                    phone: staff.phone,
                    role: staff.role,
                    createdAt: staff.createdAt,
                },
            });
        }
        catch (error) {
            if (deps.failures.isValidation(error)) {
                return result('invalid', {
                    message: 'Invalid staff account data.',
                });
            }
            if (deps.failures.isDuplicate(error)) {
                return result('conflict', {
                    message: 'An account with this email already exists.',
                });
            }
            console.error('Failed to create staff:', error);
            return result('failed', {
                message: 'Failed to create staff account.',
            });
        }
    }
    return { listStaff, createStaff };
}
