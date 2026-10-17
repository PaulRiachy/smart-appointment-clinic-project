import bcrypt from 'bcryptjs';
import {
  Schema,
  model,
  type HydratedDocument,
  type Model,
} from 'mongoose';
import { UserRole, type IUser } from '@app/shared';

export type UserRecord = Omit<IUser, 'createdAt'> & {
  password: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type UserDocument = HydratedDocument<UserRecord> & {
  comparePassword(candidate: string): Promise<boolean>;
};

type UserModelType = Model<UserRecord>;

const userSchema = new Schema<UserRecord, UserModelType>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CUSTOMER,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (
  this: UserDocument,
  candidate: string,
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform(_document, result: Record<string, unknown>) {
    delete result.password;
    return result;
  },
});

export const User = model<UserRecord, UserModelType>('User', userSchema);