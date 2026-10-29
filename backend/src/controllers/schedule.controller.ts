import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { UserRole, Weekday } from '@app/shared';
import { User } from '../models/user.model';
import { Service } from '../models/service.model';
import { StaffSchedule } from '../models/schedule.model';

type WorkingIntervalInput = {
  from: string;
  to: string;
};

type ScheduleInput = {
  weeklyIntervals: Record<string, WorkingIntervalInput[]>;
  daysOff: string[];
  services: string[];
};

const weekdays = Object.values(Weekday);

function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function timeToMinutes(value: string): number {
  const [hours = NaN, minutes = NaN] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function isValidSchedulePayload(body: unknown): body is ScheduleInput {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const value = body as Record<string, unknown>;

  if (
    !value.weeklyIntervals ||
    typeof value.weeklyIntervals !== 'object' ||
    !Array.isArray(value.daysOff) ||
    !Array.isArray(value.services)
  ) {
    return false;
  }

  const weeklyIntervals = value.weeklyIntervals as Record<
    string,
    unknown
  >;

  const weeklyKeys = Object.keys(weeklyIntervals);

  if (
    weeklyKeys.some((day) => !weekdays.includes(day as Weekday)) ||
    weeklyKeys.length !== weekdays.length
  ) {
    return false;
  }

  for (const day of weekdays) {
    const intervals = weeklyIntervals[day];

    if (!Array.isArray(intervals)) {
      return false;
    }

    for (const interval of intervals) {
      if (!interval || typeof interval !== 'object') {
        return false;
      }

      const item = interval as Record<string, unknown>;

      if (!isValidTime(item.from) || !isValidTime(item.to)) {
        return false;
      }

      if (timeToMinutes(item.from) >= timeToMinutes(item.to)) {
        return false;
      }
    }

    const sorted = [...(intervals as WorkingIntervalInput[])].sort(
      (a, b) => timeToMinutes(a.from) - timeToMinutes(b.from),
    );

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1]!;
      const current = sorted[index]!;

      if (
        timeToMinutes(current.from) < timeToMinutes(previous.to)
      ) {
        return false;
      }
    }
  }

  if (
    value.daysOff.some(
      (day) =>
        typeof day !== 'string' ||
        !weekdays.includes(day as Weekday),
    )
  ) {
    return false;
  }

  const serviceIds = value.services;

  if (
    serviceIds.some(
      (serviceId) =>
        typeof serviceId !== 'string' ||
        !mongoose.isValidObjectId(serviceId),
    )
  ) {
    return false;
  }

  const uniqueServiceIds = new Set(serviceIds);

  if (uniqueServiceIds.size !== serviceIds.length) {
    return false;
  }

  const uniqueDaysOff = new Set(value.daysOff);

  if (uniqueDaysOff.size !== value.daysOff.length) {
    return false;
  }

  return true;
}

export async function getStaffSchedule(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid staff ID.',
      });
      return;
    }

    const staff = await User.findOne({
      _id: id,
      role: UserRole.STAFF,
    })
      .select('_id fullName email phone role createdAt')
      .lean();

    if (!staff) {
      res.status(404).json({
        success: false,
        message: 'Staff member not found.',
      });
      return;
    }

    const schedule = await StaffSchedule.findOne({ staff: id })
      .populate({
        path: 'staff',
        select: '_id fullName email phone role createdAt',
      })
      .populate({
        path: 'services',
        select: '_id name description duration price active createdAt',
      })
      .lean();

    if (!schedule) {
      res.status(200).json({
        success: true,
        message: 'Staff schedule has not been configured yet.',
        data: {
          staff,
          schedule: null,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    console.error('Failed to get staff schedule:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to load staff schedule.',
    });
  }
}

export async function saveStaffSchedule(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid staff ID.',
      });
      return;
    }

    if (!isValidSchedulePayload(req.body)) {
      res.status(400).json({
        success: false,
        message:
          'Invalid schedule. Provide all weekdays, valid HH:mm intervals with no overlaps, valid days off, and valid service IDs.',
      });
      return;
    }

    const staff = await User.findOne({
      _id: id,
      role: UserRole.STAFF,
    })
      .select('_id fullName email phone role createdAt')
      .lean();

    if (!staff) {
      res.status(404).json({
        success: false,
        message: 'Staff member not found.',
      });
      return;
    }

    const serviceIds = req.body.services;

    const services = await Service.find({
      _id: { $in: serviceIds },
    })
      .select('_id name description duration price active createdAt')
      .lean();

    if (services.length !== serviceIds.length) {
      res.status(400).json({
        success: false,
        message: 'One or more selected services do not exist.',
      });
      return;
    }

    const weeklyIntervals = {} as Record<
      Weekday,
      WorkingIntervalInput[]
    >;

    for (const day of weekdays) {
      weeklyIntervals[day as Weekday] =
        req.body.weeklyIntervals[day]!.map((interval) => ({
          from: interval.from,
          to: interval.to,
        }));
    }

    const schedule = await StaffSchedule.findOneAndUpdate(
      { staff: id },
      {
        $set: {
          staff: id,
          weeklyIntervals,
          daysOff: req.body.daysOff,
          services: serviceIds,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    )
      .populate({
        path: 'staff',
        select: '_id fullName email phone role createdAt',
      })
      .populate({
        path: 'services',
        select: '_id name description duration price active createdAt',
      });

    res.status(200).json({
      success: true,
      message: 'Staff schedule saved successfully.',
      data: schedule,
    });
  } catch (error) {
    console.error('Failed to save staff schedule:', error);

    if (
      error instanceof mongoose.Error.ValidationError ||
      (error instanceof Error && error.name === 'ValidationError')
    ) {
      res.status(400).json({
        success: false,
        message: 'Invalid staff schedule data.',
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to save staff schedule.',
    });
  }
}
