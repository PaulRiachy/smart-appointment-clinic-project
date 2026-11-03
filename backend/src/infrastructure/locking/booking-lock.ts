import { Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Appointment } from '../models/appointment.model';
const BOOKING_LOCK_TTL_MS = 30_000;
const BOOKING_SLOT_MINUTES = 15;
const BOOKING_SLOT_MS =
  BOOKING_SLOT_MINUTES * 60 * 1000;

interface BookingLockRecord {
  _id: string;
  staffId: string;
  slotStart: Date;
  lockUntil: Date;
  owner: string;
}

function getBookingLockKey(
  staffId: string,
  slotStart: Date,
): string {
  return `${staffId}:${slotStart.getTime()}`;
}

function getBookingLockSlots(
  start: Date,
  end: Date,
): Date[] {
  const slots: Date[] = [];

  // Requests for overlapping times must acquire the same slice keys.
  let cursor = Math.floor(start.getTime() / BOOKING_SLOT_MS) * BOOKING_SLOT_MS;
  const endTime = end.getTime();

  while (cursor < endTime) {
    slots.push(new Date(cursor));
    cursor += BOOKING_SLOT_MS;
  }

  return slots;
}

export async function validateAndRunWithStaffLock<T>(
  staffId: string,
  start: Date,
  end: Date,
  operation: () => Promise<T>,
): Promise<T> {
  if (!Types.ObjectId.isValid(staffId)) {
    throw new Error('Invalid staff ID.');
  }

  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end.getTime() <= start.getTime()
  ) {
    throw new Error(
      'Invalid appointment time range.',
    );
  }

  const collection =
    Appointment.db.collection<BookingLockRecord>(
      'appointment_booking_locks',
    );

  const now = new Date();
  const lockUntil = new Date(
    now.getTime() + BOOKING_LOCK_TTL_MS,
  );

  const slotStarts = getBookingLockSlots(
    start,
    end,
  );

  if (slotStarts.length === 0) {
    throw new Error(
      'Appointment must occupy at least one 15-minute slot.',
    );
  }

  // Remove expired locks first.

  await collection.deleteMany({
    lockUntil: {
      $lte: now,
    },
  });

  const owner = randomUUID();
  const normalizedStaffId = new Types.ObjectId(staffId).toHexString();
  const locks: BookingLockRecord[] =
    slotStarts.map((slotStart) => ({
      _id: getBookingLockKey(normalizedStaffId, slotStart),
      staffId: normalizedStaffId,
      slotStart,
      lockUntil,
      owner,
    }));

  try {
    try {
      await collection.insertMany(locks, { ordered: true });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        throw new Error(
          'The selected appointment time is currently being booked by another request. Please choose another time.',
        );
      }

      throw error;
    }

    return await operation();
  } finally {
    await collection.deleteMany({
      _id: {
        $in: locks.map((lock) => lock._id),
      },
      owner,
    });
  }
}

export async function ensureBookingLockIndexes(): Promise<void> {
  const collection =
    Appointment.db.collection<BookingLockRecord>(
      'appointment_booking_locks',
    );

  await collection.createIndex(
    { lockUntil: 1 },
    {
      expireAfterSeconds: 0,
      name: 'appointment_booking_locks_expiry',
    },
  );
}
