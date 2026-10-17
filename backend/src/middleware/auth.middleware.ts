import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { UserRole } from '@app/shared';
import { User } from '../models/user.model';

export interface AuthUser {
  id: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: UserRole;
}

const validRoles = Object.values(UserRole);

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
    return;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({
      success: false,
      message: 'Authentication is not configured.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (
      typeof decoded === 'string' ||
      typeof decoded.sub !== 'string' ||
      !validRoles.includes(decoded.role as UserRole)
    ) {
      res.status(401).json({
        success: false,
        message: 'Invalid authentication token.',
      });
      return;
    }

    const payload = decoded as AccessTokenPayload;

    const user = await User.findById(payload.sub)
      .select('_id role')
      .lean();

    if (!user || !validRoles.includes(user.role)) {
      res.status(401).json({
        success: false,
        message: 'User account is unavailable.',
      });
      return;
    }

    authReq.user = {
      id: String(user._id),
      role: user.role,
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.',
    });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    if (!roles.includes(authReq.user.role)) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      });
      return;
    }

    next();
  };
}