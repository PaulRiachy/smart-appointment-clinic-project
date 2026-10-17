import { Schema, model, type Model } from 'mongoose';
import {
  AppointmentStatus,
  type IAppointment,
} from '@app/shared';

type AppointmentRecord = Omit<
  IAppointment,
  '_id' | 'start' | 'end' | 'createdAt'
> & {
  start: Date;
  end: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

const appointmentSchema = new Schema<AppointmentRecord>(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    staff: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    start: {
      type: Date,
      required: true,
    },
    end: {
        type: Date,
        required: true,
        validate: {
            validator(this: any, value: Date) {
            if (!value || !this.start) return false;
            const startDate = new Date(this.start).getTime();
            const endDate = new Date(value).getTime();
            return !isNaN(startDate) && !isNaN(endDate) && endDate > startDate;
            },
            message: 'Appointment end must be after its start.',
        },
        },
    status: {
      type: String,
      enum: Object.values(AppointmentStatus),
      default: AppointmentStatus.PENDING,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

appointmentSchema.index({ staff: 1, start: 1, end: 1 });
appointmentSchema.index({ customer: 1, start: 1 });
appointmentSchema.index({ status: 1, start: 1 });

export const Appointment: Model<AppointmentRecord> =
  model<AppointmentRecord>('Appointment', appointmentSchema);