import type { Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { UserRole, type IUser } from '@app/shared';
import { User, type UserDocument } from '../models/user.model';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return secret;
}

function createToken(userId: string, role: UserRole): string {
  const expiresIn = (
    process.env.JWT_EXPIRES_IN || '1d'
  ) as SignOptions['expiresIn'];

  return jwt.sign(
    { sub: userId, role },
    getJwtSecret(),
    { expiresIn },
  );
}

function publicUser(user: {
  _id: unknown;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt?: Date;
}): IUser {
  return {
    _id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    ...(user.createdAt
      ? { createdAt: user.createdAt.toISOString() }
      : {}),
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function register(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { fullName, email, phone, password } = req.body ?? {};

    if (
      !isNonEmptyString(fullName) ||
      !isNonEmptyString(email) ||
      !isNonEmptyString(phone) ||
      typeof password !== 'string'
    ) {
      res.status(400).json({
        success: false,
        message: 'Full name, email, phone, and password are required.',
      });
      return;
    }

    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    if (normalizedName.length < 2 || normalizedName.length > 100) {
      res.status(400).json({
        success: false,
        message: 'Full name must be between 2 and 100 characters.',
      });
      return;
    }

    if (
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
      return;
    }

    if (normalizedPhone.length > 30) {
      res.status(400).json({
        success: false,
        message: 'Phone number must not exceed 30 characters.',
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
      return;
    }

    const existingUser = await User.exists({
      email: normalizedEmail,
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
      return;
    }

    const user = await User.create({
      fullName: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      password,
      role: UserRole.CUSTOMER,
    });

    const safeUser = publicUser(user);
    const token = createToken(safeUser._id, safeUser.role);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      data: {
        user: safeUser,
        token,
      },
    });
  } catch (error: unknown) {
    const mongoError = error as {
      code?: number;
      keyPattern?: Record<string, unknown>;
    };

    if (
      mongoError.code === 11000 &&
      mongoError.keyPattern?.email
    ) {
      res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
      return;
    }

    console.error('Registration failed:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to register account.',
    });
  }
}

export async function login(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { email, password } = req.body ?? {};

    if (
      !isNonEmptyString(email) ||
      typeof password !== 'string' ||
      password.length === 0
    ) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select('+password');

    const validPassword = user
      ? await (user as UserDocument).comparePassword(password)
      : false;

    if (!user || !validPassword) {
      res.status(401).json({
        success: false,
        message: 'Incorrect email or password.',
      });
      return;
    }

    const safeUser = publicUser(user);
    const token = createToken(safeUser._id, safeUser.role);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: safeUser,
        token,
      },
    });
  } catch (error: unknown) {
    console.error('Login failed:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to log in.',
    });
  }
}

export async function getMe(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    const user = await User.findById(authReq.user.id)
      .select('_id fullName email phone role createdAt')
      .lean();

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User account is unavailable.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        user: publicUser(user),
      },
    });
  } catch (error: unknown) {
    console.error('Fetching current user failed:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to retrieve the current user.',
    });
  }
}