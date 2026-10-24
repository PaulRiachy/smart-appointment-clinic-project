import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { UserRole } from '@app/shared';

import { User } from '../models/user.model';

interface CreateStaffBody {
  fullName?: unknown;
  email?: unknown;
  phone?: unknown;
  password?: unknown;
}

function isValidCreateStaffBody(body: CreateStaffBody): boolean {
  return (
    typeof body.fullName === 'string' &&
    body.fullName.trim().length >= 2 &&
    typeof body.email === 'string' &&
    body.email.trim().length > 0 &&
    typeof body.phone === 'string' &&
    body.phone.trim().length > 0 &&
    typeof body.password === 'string' &&
    body.password.length >= 8
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function listStaff(
  _req: Request,
  res: Response,
): Promise<Response> {
  try {
    const staff = await User.find({
      role: UserRole.STAFF,
    })
      .select('-password')
      .sort({ fullName: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: staff,
    });
  } catch (error) {
    console.error('Failed to list staff:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve staff members.',
    });
  }
}

export async function createStaff(
  req: Request<unknown, unknown, CreateStaffBody>,
  res: Response,
): Promise<Response> {
  try {
    if (!isValidCreateStaffBody(req.body)) {
      return res.status(400).json({
        success: false,
        message:
          'Full name, email, phone and a password of at least 8 characters are required.',
      });
    }

    const fullName = (req.body.fullName as string).trim();
    const email = normalizeEmail(req.body.email as string);
    const phone = (req.body.phone as string).trim();
    const password = req.body.password as string;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const staff = await User.create({
      fullName,
      email,
      phone,
      password,
      role: UserRole.STAFF,
    });

    return res.status(201).json({
      success: true,
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
  } catch (error) {
    if (
      error instanceof mongoose.Error.ValidationError
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff account data.',
      });
    }

    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    console.error('Failed to create staff:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to create staff account.',
    });
  }
}