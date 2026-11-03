import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Dependencies } from '../../application/ports';
export const authTokens: Dependencies['tokens'] = {
    configured: () => Boolean(process.env.JWT_SECRET),
    sign(id, role) {
        const secret = process.env.JWT_SECRET;
        if (!secret)
            throw new Error('JWT_SECRET is not configured.');
        const expiresIn = (process.env.JWT_EXPIRES_IN || '1d') as SignOptions['expiresIn'];
        return jwt.sign({ sub: id, role }, secret, { expiresIn });
    },
    verify(token, missingSecretMessage = 'JWT_SECRET is not configured.') {
        const secret = process.env.JWT_SECRET;
        if (!secret)
            throw new Error(missingSecretMessage);
        return jwt.verify(token, secret);
    },
    isTokenError: error => error instanceof jwt.JsonWebTokenError,
};
