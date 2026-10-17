import { Schema, model, type Model } from 'mongoose';
import type { IQueueEntry } from '@app/shared';

type QueueRecord = Omit<
  IQueueEntry,
  '_id' | 'queueDate' | 'checkedInAt' | 'calledAt' | 'completedAt'
> & {
  queueDate: Date;
  checkedInAt: Date;
  calledAt?: Date;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

const queueSchema = new Schema<QueueRecord>(
  {
    appointment: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      unique: true,
    },
    queueDate: {
      type: Date,
      required: true,
    },
    queueNumber: {
      type: String,
      required: true,
      trim: true,
    },
    checkedInAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    calledAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

queueSchema.index(
  { queueDate: 1, queueNumber: 1 },
  { unique: true },
);

queueSchema.index({ queueDate: 1, checkedInAt: 1 });

export const QueueEntry: Model<QueueRecord> =
  model<QueueRecord>('QueueEntry', queueSchema);