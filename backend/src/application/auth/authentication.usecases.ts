import { UserRole } from '@app/shared';
import type { Actor, Dependencies } from '../ports';
import { ApplicationError } from '../result';
export function createAuthenticationUseCases(deps: Dependencies) {
    const validRoles = Object.values(UserRole);
    function claims(value: unknown): value is {
        sub: string;
        role: UserRole;
    } {
        return typeof value === 'object' && value !== null && 'sub' in value &&
            typeof value.sub === 'string' && deps.identifiers.isStrict(value.sub) &&
            'role' in value && validRoles.includes(value.role as UserRole);
    }
    async function authenticate(token: string): Promise<Actor> {
        if (!token)
            throw new ApplicationError('unauthenticated', 'Authentication required.');
        if (!deps.tokens.configured())
            throw new ApplicationError('failed', 'Authentication is not configured.');
        try {
            const decoded = deps.tokens.verify(token);
            if (!claims(decoded))
                throw new ApplicationError('unauthenticated', 'Invalid authentication token.');
            const user = await deps.users.identity(decoded.sub);
            if (!user || !validRoles.includes(user.role))
                throw new ApplicationError('unauthenticated', 'User account is unavailable.');
            return { id: String(user._id), role: user.role };
        }
        catch (error) {
            if (deps.tokens.isTokenError(error))
                throw new ApplicationError('unauthenticated', 'Invalid or expired authentication token.');
            throw error;
        }
    }
    async function authenticateSocket(token: string | null): Promise<{
        sub: string;
        role: UserRole;
    }> {
        if (!token)
            throw new Error('Authentication token is required');
        const decoded = deps.tokens.verify(token, 'JWT_SECRET is not configured');
        if (!claims(decoded))
            throw new Error('Invalid authentication token');
        const account = await deps.users.identity(decoded.sub);
        if (!account)
            throw new Error('User account is unavailable');
        if (account.role !== UserRole.ADMIN && account.role !== UserRole.STAFF) {
            throw new Error('Queue access is restricted to staff');
        }
        return { sub: String(account._id), role: account.role };
    }
    return { authenticate, authenticateSocket };
}
