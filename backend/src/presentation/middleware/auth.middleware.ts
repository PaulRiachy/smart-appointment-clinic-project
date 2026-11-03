import type { NextFunction, Request, Response } from 'express';
import { UserRole } from '@app/shared';
import type { Clinic } from '../../application/clinic';
import { ApplicationError } from '../../application/result';
import { statusCodes, type AuthenticatedRequest } from '../http';
export type { AuthenticatedRequest } from '../http';
export function createAuthMiddleware(authentication: Clinic['authentication']) {
    async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
        const authorization = req.headers.authorization;
        const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
        try {
            (req as AuthenticatedRequest).user = await authentication.authenticate(token);
            next();
        }
        catch (error) {
            if (error instanceof ApplicationError) {
                res.status(statusCodes[error.kind]).json({ success: false, message: error.message });
                return;
            }
            next(error);
        }
    }
    function requireRole(...roles: UserRole[]) {
        return (req: Request, res: Response, next: NextFunction): void => {
            const user = (req as AuthenticatedRequest).user;
            if (!user) {
                res.status(401).json({ success: false, message: 'Authentication required.' });
                return;
            }
            if (!roles.includes(user.role as UserRole)) {
                res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
                return;
            }
            next();
        };
    }
    function optionalAuthenticate(req: Request, res: Response, next: NextFunction): void {
        const authorization = req.headers.authorization;
        const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
        if (!token) {
            next();
            return;
        }
        void authenticate(req, res, next);
    }
    return { authenticate, requireRole, optionalAuthenticate };
}
export type AuthMiddleware = ReturnType<typeof createAuthMiddleware>;
