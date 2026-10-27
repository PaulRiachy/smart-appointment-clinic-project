import { Types } from 'mongoose';

import { AppointmentStatus, Weekday } from '@app/shared';

import { Appointment } from '../models/appointment.model';
import { Service } from '../models/service.model';
import { StaffSchedule } from '../models/schedule.model';
import { User } from '../models/user.model';

const BUSINESS_TIMEZONE = 'Asia/Beirut';
const BUSINESS_OFFSET = '+03:00';
const SLOT_STEP_MINUTES = 15;

const BOOKING_STATUSES = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_SERVICE,
];

type WorkingInterval = {
  from: string;
  to: string;
};

type AvailabilitySlot = {
  start: string;
  end: string;
  startTime: string;
  endTime: string;
};

type AvailabilityContext = {
  service: {
    _id: Types.ObjectId;
    duration: number;
    active: boolean;
  };
  staff: {
    _id: Types.ObjectId;
  };
  schedule: {
    weeklyIntervals: Record<string, WorkingInterval[]>;
    daysOff: string[];
    services: Types.ObjectId[];
  };
};

function isObjectId(value: string): boolean {
  return Types.ObjectId.isValid(value);
}


const CALENDAR_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseCalendarDate(date: string): {
  year: number;
  month: number;
  day: number;
} {
  if (!CALENDAR_DATE_REGEX.test(date)) {
    throw new Error(
      'Invalid calendar date. Expected format YYYY-MM-DD.',
    );
  }

  const [yearString, monthString, dayString] = date.split('-');

  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    throw new Error(
      'Invalid calendar date. Expected format YYYY-MM-DD.',
    );
  }

  if (month < 1 || month > 12) {
    throw new Error('Invalid calendar date.');
  }

  const daysInMonth = new Date(
    Date.UTC(year, month, 0),
  ).getUTCDate();

  if (day < 1 || day > daysInMonth) {
    throw new Error('Invalid calendar date.');
  }

  return {
    year,
    month,
    day,
  };
}


function getWeekday(date: string): Weekday {
  const parsed = parseCalendarDate(date);

  const value = new Date(
    `${date}T12:00:00${BUSINESS_OFFSET}`,
  );

  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: BUSINESS_TIMEZONE,
  }).format(value);

  const map: Record<string, Weekday> = {
    Mon: Weekday.MONDAY,
    Tue: Weekday.TUESDAY,
    Wed: Weekday.WEDNESDAY,
    Thu: Weekday.THURSDAY,
    Fri: Weekday.FRIDAY,
    Sat: Weekday.SATURDAY,
    Sun: Weekday.SUNDAY,
  };

  if (!map[weekday]) {
    throw new Error(
      `Could not determine weekday for ${parsed.year}-${parsed.month}-${parsed.day}.`,
    );
  }

  return map[weekday];
}

function minutesFromTime(value: string): number {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error(`Invalid time "${value}". Expected HH:mm.`);
  }

  const [hours, minutes] = value.split(':').map(Number);

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`Invalid time "${value}".`);
  }

  return hours * 60 + minutes;
}

function timeFromMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0',
  )}`;
}

function makeBusinessDate(
  date: string,
  time: string,
): Date {
  parseCalendarDate(date);
  minutesFromTime(time);

  return new Date(
    `${date}T${time}:00${BUSINESS_OFFSET}`,
  );
}

function getBusinessDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getBusinessTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

function normaliseInterval(
  interval: WorkingInterval,
): {
  fromMinutes: number;
  toMinutes: number;
} {
  const fromMinutes = minutesFromTime(interval.from);
  const toMinutes = minutesFromTime(interval.to);

  if (toMinutes <= fromMinutes) {
    throw new Error(
      `Invalid working interval ${interval.from}-${interval.to}.`,
    );
  }

  return {
    fromMinutes,
    toMinutes,
  };
}

function parseRequestedStart(
  value: unknown,
): Date {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('start is required.');
  }

  const trimmed = value.trim();

  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)
  ) {
    return new Date(`${trimmed}:00${BUSINESS_OFFSET}`);
  }

  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)
  ) {
    return new Date(`${trimmed}${BUSINESS_OFFSET}`);
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      'start must be a valid ISO timestamp or YYYY-MM-DDTHH:mm.',
    );
  }

  return parsed;
}

function sameDate(
  first: Date,
  second: Date,
): boolean {
  return (
    getBusinessDateKey(first) ===
    getBusinessDateKey(second)
  );
}

function isSameOrAfter(
  first: Date,
  second: Date,
): boolean {
  return first.getTime() >= second.getTime();
}

function isBefore(
  first: Date,
  second: Date,
): boolean {
  return first.getTime() < second.getTime();
}

function overlaps(
  candidateStart: Date,
  candidateEnd: Date,
  existingStart: Date,
  existingEnd: Date,
): boolean {
  return (
    candidateStart.getTime() < existingEnd.getTime() &&
    candidateEnd.getTime() > existingStart.getTime()
  );
}

async function loadAvailabilityContext(
  serviceId: string,
  staffId: string,
): Promise<AvailabilityContext> {
  if (!isObjectId(serviceId)) {
    throw new Error('Invalid serviceId.');
  }

  if (!isObjectId(staffId)) {
    throw new Error('Invalid staffId.');
  }

  const service = await Service.findById(serviceId)
    .select('_id duration active')
    .lean();

  if (!service) {
    throw new Error('Service not found.');
  }

  if (!service.active) {
    throw new Error('Inactive services cannot be booked.');
  }

  const staff = await User.findById(staffId)
    .select('_id role')
    .lean();

  if (!staff) {
    throw new Error('Staff member not found.');
  }

  const schedule = await StaffSchedule.findOne({
    staff: staff._id,
  })
    .select('weeklyIntervals daysOff services')
    .lean();

  if (!schedule) {
    throw new Error('Staff schedule not found.');
  }

  const qualified = schedule.services.some(
    (assignedService: unknown) =>
      String(assignedService) === String(service._id),
  );

  if (!qualified) {
    throw new Error(
      'Staff member is not qualified to perform this service.',
    );
  }

  return {
    service: {
      _id: service._id as Types.ObjectId,
      duration: Number(service.duration),
      active: Boolean(service.active),
    },
    staff: {
      _id: staff._id as unknown as Types.ObjectId,
    },
    schedule: {
      weeklyIntervals:
        schedule.weeklyIntervals as Record<
          string,
          WorkingInterval[]
        >,
      daysOff: (schedule.daysOff || []) as string[],
      services: schedule.services as unknown as Types.ObjectId[],
    },
  };
}

async function getExistingAppointments(
  staffId: Types.ObjectId,
  date: string,
  excludeAppointmentId?: string,
) {
  const dayStart = makeBusinessDate(date, '00:00');
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const query: Record<string, unknown> = {
    staff: staffId,
    status: {
      $in: BOOKING_STATUSES,
    },
    start: {
      $lt: dayEnd,
    },
    end: {
      $gt: dayStart,
    },
  };

  if (
    excludeAppointmentId &&
    isObjectId(excludeAppointmentId)
  ) {
    query._id = {
      $ne: new Types.ObjectId(excludeAppointmentId),
    };
  }

  return Appointment.find(query)
    .select('start end status')
    .sort({ start: 1 })
    .lean();
}

function isSlotInsideInterval(
  slotStartMinutes: number,
  slotEndMinutes: number,
  interval: WorkingInterval,
): boolean {
  const {
    fromMinutes,
    toMinutes,
  } = normaliseInterval(interval);

  return (
    slotStartMinutes >= fromMinutes &&
    slotEndMinutes <= toMinutes
  );
}

export async function getAvailability(
  serviceId: string,
  staffId: string,
  date: string,
): Promise<{
  timezone: string;
  date: string;
  serviceId: string;
  staffId: string;
  slots: AvailabilitySlot[];
}> {
  const context = await loadAvailabilityContext(
    serviceId,
    staffId,
  );

  const weekday = getWeekday(date);
  const daysOff = context.schedule.daysOff || [];

  if (daysOff.includes(weekday)) {
    return {
      timezone: BUSINESS_TIMEZONE,
      date,
      serviceId,
      staffId,
      slots: [],
    };
  }

  const intervals =
    context.schedule.weeklyIntervals?.[weekday] || [];

  if (intervals.length === 0) {
    return {
      timezone: BUSINESS_TIMEZONE,
      date,
      serviceId,
      staffId,
      slots: [],
    };
  }

  const existingAppointments =
    await getExistingAppointments(
      context.staff._id,
      date,
    );

  const slots: AvailabilitySlot[] = [];

  for (const interval of intervals) {
    const {
      fromMinutes,
      toMinutes,
    } = normaliseInterval(interval);

    // A service must fit completely inside the staff
    // working interval. If it is longer than the interval,
    // there cannot be any valid appointment in this interval.
    if (
      fromMinutes >= toMinutes ||
      context.service.duration <= 0 ||
      context.service.duration > toMinutes - fromMinutes
    ) {
      continue;
    }

    for (
      let startMinutes = fromMinutes;
      startMinutes <=
        toMinutes - context.service.duration;
      startMinutes += SLOT_STEP_MINUTES
    ) {
      const endMinutes =
        startMinutes + context.service.duration;

      // Defensive full-interval validation.
      //
      // The appointment must START at or after the staff's
      // working start AND END at or before the staff's
      // working end.
      if (
        startMinutes < fromMinutes ||
        endMinutes > toMinutes
      ) {
        continue;
      }

      const startTime =
        timeFromMinutes(startMinutes);
      const endTime =
        timeFromMinutes(endMinutes);

      const slotStart = makeBusinessDate(
        date,
        startTime,
      );

      const slotEnd = makeBusinessDate(
        date,
        endTime,
      );

      const blocked = existingAppointments.some(
        (appointment) =>
          overlaps(
            slotStart,
            slotEnd,
            new Date(appointment.start),
            new Date(appointment.end),
          ),
      );

      if (blocked) {
        continue;
      }

      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        startTime,
        endTime,
      });
    }
  }

  return {
    timezone: BUSINESS_TIMEZONE,
    date,
    serviceId,
    staffId,
    slots,
  };
}

export async function validateSlot(
  serviceId: string,
  staffId: string,
  start: Date,
  excludeAppointmentId?: string,
): Promise<{
  serviceId: string;
  staffId: string;
  start: Date;
  end: Date;
  duration: number;
}> {
  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid appointment start time.');
  }

  const context = await loadAvailabilityContext(
    serviceId,
    staffId,
  );

  const end = new Date(
    start.getTime() +
      context.service.duration * 60 * 1000,
  );

  const date = getBusinessDateKey(start);
  const weekday = getWeekday(date);

  if (context.schedule.daysOff.includes(weekday)) {
    throw new Error(
      'The selected staff member is off on this day.',
    );
  }

  const intervals =
    context.schedule.weeklyIntervals?.[weekday] || [];

  if (intervals.length === 0) {
    throw new Error(
      'The selected staff member has no working hours on this day.',
    );
  }

  const startTime = getBusinessTime(start);
  const endTime = getBusinessTime(end);

  const startMinutes = minutesFromTime(startTime);
  const endMinutes = minutesFromTime(endTime);

  const insideWorkingInterval = intervals.some(
    (interval) =>
      isSlotInsideInterval(
        startMinutes,
        endMinutes,
        interval,
      ),
  );

  if (!insideWorkingInterval) {
    throw new Error(
      'The selected appointment is outside the staff member’s working hours.',
    );
  }

  if (!sameDate(start, end)) {
    throw new Error(
      'An appointment cannot cross into another business day.',
    );
  }

  if (startMinutes % SLOT_STEP_MINUTES !== 0) {
    throw new Error(
      'Appointment start time must use 15-minute increments.',
    );
  }

  const existingAppointments =
    await getExistingAppointments(
      context.staff._id,
      date,
      excludeAppointmentId,
    );

  const conflictingAppointment =
    existingAppointments.find((appointment) =>
      overlaps(
        start,
        end,
        new Date(appointment.start),
        new Date(appointment.end),
      ),
    );

  if (conflictingAppointment) {
    throw new Error(
      'The selected appointment slot is no longer available.',
    );
  }

  return {
    serviceId,
    staffId,
    start,
    end,
    duration: context.service.duration,
  };
}

//stops conflicting bookings
async function withStaffBookingLock<T>(
  staffId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const collection =
    Appointment.db.collection(
      'appointment_booking_locks',
    );

  const lockId = new Types.ObjectId(staffId);
  const now = new Date();
  const lockUntil = new Date(
    now.getTime() + 30_000,
  );

  const lock = await collection.findOneAndUpdate(
    {
      _id: lockId,
      $or: [
        {
          lockUntil: {
            $lte: now,
          },
        },
        {
          lockUntil: {
            $exists: false,
          },
        },
      ],
    },
    {
      $set: {
        lockUntil,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
    },
  );

  if (!lock?.value) {
    throw new Error(
      'The selected staff member is currently being booked by another request. Please retry.',
    );
  }

  try {
    return await operation();
  } finally {
    await collection.deleteOne({
      _id: lockId,
    });
  }
}




const BOOKING_LOCK_TTL_MS = 30_000;
const BOOKING_SLOT_MINUTES = 15;
const BOOKING_SLOT_MS =
  BOOKING_SLOT_MINUTES * 60 * 1000;

interface BookingLockRecord {
  _id: string;
  staffId: string;
  slotStart: Date;
  lockUntil: Date;
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

  let cursor = start.getTime();
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

  const lockIds = slotStarts.map((slotStart) =>
    getBookingLockKey(staffId, slotStart),
  );

  const locks: BookingLockRecord[] =
    lockIds.map((lockId, index) => ({
      _id: lockId,
      staffId,
      slotStart: slotStarts[index],
      lockUntil,
    }));

  try {
    await collection.insertMany(
      locks,
      {
        ordered: true,
      },
    );
  } catch (error: any) {
    // A duplicate _id means another request already owns at least one of these 15-minute booking slices.
    if (error?.code === 11000) {
      throw new Error(
        'The selected appointment time is currently being booked by another request. Please choose another time.',
      );
    }

    throw error;
  }

  try {
    return await operation();
  } finally {
    await collection.deleteMany({
      _id: {
        $in: lockIds,
      },
      staffId,
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
