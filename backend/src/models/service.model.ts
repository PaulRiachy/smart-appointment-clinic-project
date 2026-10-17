import { Schema, model, type Model } from 'mongoose';
import type { IService } from '@app/shared';

type ServiceRecord = Omit<IService, '_id' | 'createdAt'> & {
  createdAt?: Date;
  updatedAt?: Date;
};

const serviceSchema = new Schema<ServiceRecord>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'Duration must be a whole number of minutes.',
      },
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    active: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const Service: Model<ServiceRecord> = model<ServiceRecord>(
  'Service',
  serviceSchema,
);