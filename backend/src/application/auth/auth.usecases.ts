import { UserRole } from '@app/shared';
import { publicUser, isNonEmptyString } from '../../domain/users/user.rules';
import type { Dependencies, OperationInput } from '../ports';
import { result, type OperationResult } from '../result';
export function createAuthUseCases(deps: Dependencies) {
    async function register(input: OperationInput): Promise<OperationResult> {
        try {
            const { fullName, email, phone, password } = input.body ?? {};
            if (!isNonEmptyString(fullName) ||
                !isNonEmptyString(email) ||
                !isNonEmptyString(phone) ||
                typeof password !== 'string') {
                return result('invalid', {
                    message: 'Full name, email, phone, and password are required.',
                });
            }
            const normalizedName = fullName.trim();
            const normalizedEmail = email.trim().toLowerCase();
            const normalizedPhone = phone.trim();
            if (normalizedName.length < 2 || normalizedName.length > 100) {
                return result('invalid', {
                    message: 'Full name must be between 2 and 100 characters.',
                });
            }
            if (normalizedEmail.length > 254 ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
                return result('invalid', {
                    message: 'Please provide a valid email address.',
                });
            }
            if (normalizedPhone.length > 30) {
                return result('invalid', {
                    message: 'Phone number must not exceed 30 characters.',
                });
            }
            if (password.length < 8) {
                return result('invalid', {
                    message: 'Password must be at least 8 characters long.',
                });
            }
            const existingUser = await deps.users.emailExists(normalizedEmail);
            if (existingUser) {
                return result('conflict', {
                    message: 'An account with this email already exists.',
                });
            }
            const user = await deps.users.create({ fullName: normalizedName, email: normalizedEmail, phone: normalizedPhone, password, role: UserRole.CUSTOMER, });
            const safeUser = publicUser(user);
            const token = deps.tokens.sign(safeUser._id, safeUser.role);
            return result('created', {
                message: 'Account registered successfully.',
                data: {
                    user: safeUser,
                    token,
                },
            });
        }
        catch (error: unknown) {
            if (deps.failures.isDuplicateEmail(error)) {
                return result('conflict', {
                    message: 'An account with this email already exists.',
                });
            }
            console.error('Registration failed:', error);
            return result('failed', {
                message: 'Unable to register account.',
            });
        }
    }
    async function login(input: OperationInput): Promise<OperationResult> {
        try {
            const { email, password } = input.body ?? {};
            if (!isNonEmptyString(email) ||
                typeof password !== 'string' ||
                password.length === 0) {
                return result('invalid', {
                    message: 'Email and password are required.',
                });
            }
            const normalizedEmail = email.trim().toLowerCase();
            const user = await deps.users.findByEmail(normalizedEmail, true);
            const validPassword = user
                ? await deps.users.comparePassword(user, password)
                : false;
            if (!user || !validPassword) {
                return result('unauthenticated', {
                    message: 'Incorrect email or password.',
                });
            }
            const safeUser = publicUser(user);
            const token = deps.tokens.sign(safeUser._id, safeUser.role);
            return result('ok', {
                message: 'Login successful.',
                data: {
                    user: safeUser,
                    token,
                },
            });
        }
        catch (error: unknown) {
            console.error('Login failed:', error);
            return result('failed', {
                message: 'Unable to log in.',
            });
        }
    }
    async function getMe(input: OperationInput): Promise<OperationResult> {
        try {
            if (!input.actor) {
                return result('unauthenticated', {
                    message: 'Authentication required.',
                });
            }
            const user = await deps.users.currentUser(input.actor.id!);
            if (!user) {
                return result('unauthenticated', {
                    message: 'User account is unavailable.',
                });
            }
            return result('ok', {
                data: {
                    user: publicUser(user),
                },
            });
        }
        catch (error: unknown) {
            console.error('Fetching current user failed:', error);
            return result('failed', {
                message: 'Unable to retrieve the current user.',
            });
        }
    }
    return { register, login, getMe };
}
