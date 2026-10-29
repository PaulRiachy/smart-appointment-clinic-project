//run using npx tsx backend/src/scripts/create-admin.ts
import 'dotenv/config';
import mongoose from 'mongoose';

import { connectDB } from '../config/db';
import { User } from '../models/user.model';
import { UserRole } from '@app/shared';

async function createAdmin(): Promise<void> {
  try {
    await connectDB();

    const email = 'admin@test.com';

    const existingAdmin = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingAdmin) {
      console.log(`A user with ${email} already exists.`);
      return;
    }

    const admin = await User.create({
      fullName: 'System Administrator',
      email: email.toLowerCase(),
      phone: '03000000',
      password: 'admin123',
      role: UserRole.ADMIN,
    });

    console.log('Admin created successfully.');
    console.log(`Email: ${admin.email}`);
  } catch (error) {
    console.error('Failed to create admin:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void createAdmin();
