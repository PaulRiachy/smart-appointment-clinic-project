import { Schema, model, type Model } from 'mongoose';
import {
  Weekday,
  type IStaffSchedule,
  type IWorkingInterval,
} from '@app/shared';

type ScheduleRecord = Omit<IStaffSchedule, '_id'> & {
  createdAt?: Date;
  updatedAt?: Date;
};

const workingIntervalSchema = new Schema<IWorkingInterval>(
  {
    from: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    to: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
  },
  { _id: false },
);

const weekdayValues = Object.values(Weekday);

const weeklyIntervalsSchema = new Schema(
  {
    [Weekday.MONDAY]: {
      type: [workingIntervalSchema],
      default: [],
    },
    [Weekday.TUESDAY]: {
      type: [workingIntervalSchema],
      default: [],
    },
    [Weekday.WEDNESDAY]: {
      type: [workingIntervalSchema],
      default: [],
    },
    [Weekday.THURSDAY]: {
      type: [workingIntervalSchema],
      default: [],
    },
    [Weekday.FRIDAY]: {
      type: [workingIntervalSchema],
      default: [],
    },
    [Weekday.SATURDAY]: {
      type: [workingIntervalSchema],
      default: [],
    },
    [Weekday.SUNDAY]: {
      type: [workingIntervalSchema],
      default: [],
    },
  },
  { _id: false },
);

const scheduleSchema = new Schema<ScheduleRecord>(
  {
    staff: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    weeklyIntervals: {
      type: weeklyIntervalsSchema,
      required: true,
      default: () => ({}),
    },
    daysOff: {
      type: [
        {
          type: String,
          enum: weekdayValues,
        },
      ],
      default: [],
    },
    services: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Service',
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

scheduleSchema.index({ staff: 1 }, { unique: true });

export const StaffSchedule: Model<ScheduleRecord> =
  model<ScheduleRecord>('StaffSchedule', scheduleSchema);