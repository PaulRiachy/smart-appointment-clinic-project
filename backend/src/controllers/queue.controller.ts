import { Request, Response } from 'express';
import { Types } from 'mongoose';

import {
  ApiResponse,
  AppointmentStatus,
  IAppointment,
  IQueueEntry,
  IService,
  IUser,
} from '@app/shared';

import { Appointment } from '../models/appointment.model';
import { QueueEntry } from '../models/queue.model';
import {
  broadcastQueueCall,
  broadcastQueueCompletion,
  broadcastQueueUpdate,
} from '../sockets/queue.socket';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

interface PopulatedAppointment extends Omit<IAppointment, '_id' | 'customer' | 'service' | 'staff'> {
  _id: Types.ObjectId;
  customer: IUser;
  service: IService;
  staff: IUser;
}

interface PopulatedQueueEntry extends Omit<IQueueEntry, '_id' | 'appointment'> {
  _id: Types.ObjectId;
  appointment: PopulatedAppointment;
}

const BEIRUT_TIMEZONE = 'Asia/Beirut';

function getQueueDateParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BEIRUT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  return { year, month, day };
}

function getBeirutDayStart(date: Date = new Date()): Date {
  const { year, month, day } = getQueueDateParts(date);

  const approximateUtc = new Date(
    Date.UTC(year, month - 1, day, 0, 0, 0, 0),
  );

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: BEIRUT_TIMEZONE,
    timeZoneName: 'shortOffset',
  });

  const parts = formatter.formatToParts(approximateUtc);
  const offsetPart = parts.find(
    (part) => part.type === 'timeZoneName',
  )?.value;

  const match = offsetPart?.match(/GMT([+-])(\d+)(?::(\d+))?/);

  if (!match) {
    return approximateUtc;
  }

  const sign = match[1] === '-' ? -1 : 1;
  const offsetHours = Number(match[2]);
  const offsetMinutes = Number(match[3] ?? 0);
  const offsetMilliseconds =
    sign * ((offsetHours * 60 + offsetMinutes) * 60 * 1000);

  return new Date(approximateUtc.getTime() - offsetMilliseconds);
}

function getNextQueueNumber(lastQueueNumber?: string): string {
  if (!lastQueueNumber) {
    return 'A-001';
  }

  const match = lastQueueNumber.match(/^A-(\d+)$/);

  if (!match) {
    return 'A-001';
  }

  const nextNumber = Number(match[1]) + 1;

  return `A-${String(nextNumber).padStart(3, '0')}`;
}

function getIo(req: Request) {
  const io = req.app.get('io');

  if (!io) {
    throw new Error('Socket.IO server is not initialized');
  }

  return io;
}

function toQueueSocketPayload(
  queueEntry: {
    _id: Types.ObjectId;
    queueNumber: string;
    appointment: {
      _id: Types.ObjectId;
      status: AppointmentStatus;
    };
  },
): {
  queueEntryId: string;
  queueNumber: string;
  appointmentId: string;
  appointmentStatus: AppointmentStatus;
  timestamp: string;
} {
  return {
    queueEntryId: queueEntry._id.toString(),
    queueNumber: queueEntry.queueNumber,
    appointmentId: queueEntry.appointment._id.toString(),
    appointmentStatus: queueEntry.appointment.status,
    timestamp: new Date().toISOString(),
  };
}

async function populateQueueEntry(
  queueEntryId: Types.ObjectId,
): Promise<PopulatedQueueEntry | null> {
  return QueueEntry.findById(queueEntryId)
    .populate({
      path: 'appointment',
      populate: [
        {
          path: 'customer',
          select: '-password',
        },
        {
          path: 'staff',
          select: '-password',
        },
        {
          path: 'service',
        },
      ],
    })
    .lean<PopulatedQueueEntry>()
    .exec();
}

export async function checkInAppointment(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
): Promise<Response> {
  const { appointmentId } = req.body as {
    appointmentId?: string;
  };

  if (!appointmentId || !Types.ObjectId.isValid(appointmentId)) {
    return res.status(400).json({
      success: false,
      message: 'A valid appointmentId is required',
      error: 'INVALID_APPOINTMENT_ID',
    });
  }

  const appointment = await Appointment.findById(appointmentId);

  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found',
      error: 'APPOINTMENT_NOT_FOUND',
    });
  }

  if (appointment.status === AppointmentStatus.CHECKED_IN) {
    return res.status(409).json({
      success: false,
      message: 'Appointment has already been checked in',
      error: 'ALREADY_CHECKED_IN',
    });
  }

  if (appointment.status !== AppointmentStatus.CONFIRMED) {
    return res.status(400).json({
      success: false,
      message: `Only confirmed appointments can be checked in. Current status: ${appointment.status}`,
      error: 'INVALID_APPOINTMENT_STATUS',
    });
  }

  const existingQueueEntry = await QueueEntry.findOne({
    appointment: appointment._id.toString(),
  });

  if (existingQueueEntry) {
    return res.status(409).json({
      success: false,
      message: 'Appointment already has a queue entry',
      error: 'QUEUE_ENTRY_EXISTS',
    });
  }

  const queueDate = getBeirutDayStart();
  const checkedInAt = new Date();

  let createdQueueEntry: typeof QueueEntry.prototype | null = null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const lastEntry = await QueueEntry.findOne({
      queueDate,
    })
      .sort({ queueNumber: -1 })
      .select('queueNumber')
      .lean();

    const queueNumber = getNextQueueNumber(lastEntry?.queueNumber);

    try {
      createdQueueEntry = await QueueEntry.create({
        appointment: appointment._id.toString(),
        queueDate,
        queueNumber,
        checkedInAt,
      });

      break;
    } catch (error: unknown) {
      const mongoError = error as {
        code?: number;
        keyPattern?: Record<string, unknown>;
      };

      if (mongoError.code !== 11000) {
        throw error;
      }

      if (mongoError.keyPattern?.appointment) {
        return res.status(409).json({
          success: false,
          message: 'Appointment was checked in by another request',
          error: 'ALREADY_CHECKED_IN',
        });
      }
    }
  }

  if (!createdQueueEntry) {
    return res.status(409).json({
      success: false,
      message: 'Unable to allocate a unique daily queue number',
      error: 'QUEUE_NUMBER_CONFLICT',
    });
  }

  const updatedAppointment = await Appointment.findOneAndUpdate(
    {
      _id: appointment._id,
      status: AppointmentStatus.CONFIRMED,
    },
    {
      $set: {
        status: AppointmentStatus.CHECKED_IN,
      },
    },
    {
      new: true,
    },
  );

  if (!updatedAppointment) {
    await QueueEntry.deleteOne({
      _id: createdQueueEntry._id,
    });

    const currentAppointment = await Appointment.findById(appointment._id);

    if (currentAppointment?.status === AppointmentStatus.CHECKED_IN) {
      return res.status(409).json({
        success: false,
        message: 'Appointment was checked in by another request',
        error: 'ALREADY_CHECKED_IN',
      });
    }

    return res.status(400).json({
      success: false,
      message: `Appointment can no longer be checked in. Current status: ${currentAppointment?.status ?? 'UNKNOWN'}`,
      error: 'INVALID_APPOINTMENT_STATUS',
    });
  }

  const populatedQueueEntry = await populateQueueEntry(
    createdQueueEntry._id,
  );

  if (!populatedQueueEntry) {
    return res.status(500).json({
      success: false,
      message: 'Queue entry was created but could not be loaded',
      error: 'QUEUE_ENTRY_LOAD_FAILED',
    });
  }

  const io = getIo(req);

  broadcastQueueUpdate(
    io,
    toQueueSocketPayload({
      _id: createdQueueEntry._id,
      queueNumber: createdQueueEntry.queueNumber,
      appointment: {
        _id: updatedAppointment._id,
        status: updatedAppointment.status,
      },
    }),
  );

  return res.status(201).json({
    success: true,
    message: 'Appointment checked in successfully',
    data: populatedQueueEntry,
  });
}

export async function getTodayQueue(
  _req: AuthenticatedRequest,
  res: Response<ApiResponse>,
): Promise<Response> {
  const queueDate = getBeirutDayStart();

  const queue = await QueueEntry.find({
    queueDate,
    completedAt: { $exists: false },
  })
    .sort({ checkedInAt: 1 })
    .populate({
      path: 'appointment',
      populate: [
        {
          path: 'customer',
          select: '-password',
        },
        {
          path: 'staff',
          select: '-password',
        },
        {
          path: 'service',
        },
      ],
    })
    .lean<PopulatedQueueEntry[]>()
    .exec();

  return res.status(200).json({
    success: true,
    message: "Today's active queue",
    data: queue,
  });
}

export async function callQueueEntry(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
): Promise<Response> {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id.toString())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid queue entry id',
      error: 'INVALID_QUEUE_ENTRY_ID',
    });
  }

  const queueEntry = await QueueEntry.findById(id);

  if (!queueEntry) {
    return res.status(404).json({
      success: false,
      message: 'Queue entry not found',
      error: 'QUEUE_ENTRY_NOT_FOUND',
    });
  }

  if (queueEntry.completedAt) {
    return res.status(400).json({
      success: false,
      message: 'Completed queue entries cannot be called',
      error: 'QUEUE_ENTRY_COMPLETED',
    });
  }

  if (queueEntry.calledAt) {
    return res.status(409).json({
      success: false,
      message: 'Customer has already been called',
      error: 'CUSTOMER_ALREADY_CALLED',
    });
  }

  const appointment = await Appointment.findOneAndUpdate(
    {
      _id: queueEntry.appointment,
      status: AppointmentStatus.CHECKED_IN,
    },
    {
      $set: {
        status: AppointmentStatus.IN_SERVICE,
      },
    },
    {
      new: true,
    },
  );

  if (!appointment) {
    const currentAppointment = await Appointment.findById(
      queueEntry.appointment,
    );

    return res.status(400).json({
      success: false,
      message: `Queue entry cannot be called. Appointment status is ${currentAppointment?.status ?? 'UNKNOWN'}`,
      error: 'INVALID_APPOINTMENT_STATUS',
    });
  }

  const calledAt = new Date();

  const updatedQueueEntry = await QueueEntry.findOneAndUpdate(
    {
      _id: queueEntry._id,
      calledAt: { $exists: false },
      completedAt: { $exists: false },
    },
    {
      $set: {
        calledAt,
      },
    },
    {
      new: true,
    },
  );

  if (!updatedQueueEntry) {
    await Appointment.findOneAndUpdate(
      {
        _id: appointment._id,
        status: AppointmentStatus.IN_SERVICE,
      },
      {
        $set: {
          status: AppointmentStatus.CHECKED_IN,
        },
      },
    );

    return res.status(409).json({
      success: false,
      message: 'Customer was called by another request',
      error: 'CUSTOMER_ALREADY_CALLED',
    });
  }

  const populatedQueueEntry = await populateQueueEntry(
    updatedQueueEntry._id,
  );

  if (!populatedQueueEntry) {
    return res.status(500).json({
      success: false,
      message: 'Queue entry could not be loaded after calling',
      error: 'QUEUE_ENTRY_LOAD_FAILED',
    });
  }

  const io = getIo(req);

  broadcastQueueCall(
    io,
    toQueueSocketPayload({
      _id: updatedQueueEntry._id,
      queueNumber: updatedQueueEntry.queueNumber,
      appointment: {
        _id: appointment._id,
        status: appointment.status,
      },
    }),
  );

  return res.status(200).json({
    success: true,
    message: 'Customer called and service started',
    data: populatedQueueEntry,
  });
}

export async function completeQueueEntry(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
): Promise<Response> {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id.toString())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid queue entry id',
      error: 'INVALID_QUEUE_ENTRY_ID',
    });
  }

  const queueEntry = await QueueEntry.findById(id);

  if (!queueEntry) {
    return res.status(404).json({
      success: false,
      message: 'Queue entry not found',
      error: 'QUEUE_ENTRY_NOT_FOUND',
    });
  }

  if (queueEntry.completedAt) {
    return res.status(409).json({
      success: false,
      message: 'Queue entry has already been completed',
      error: 'ALREADY_COMPLETED',
    });
  }

  if (!queueEntry.calledAt) {
    return res.status(400).json({
      success: false,
      message: 'A customer must be called before the service can be completed',
      error: 'NOT_IN_SERVICE',
    });
  }

  const appointment = await Appointment.findOneAndUpdate(
    {
      _id: queueEntry.appointment,
      status: AppointmentStatus.IN_SERVICE,
    },
    {
      $set: {
        status: AppointmentStatus.COMPLETED,
      },
    },
    {
      new: true,
    },
  );

  if (!appointment) {
    const currentAppointment = await Appointment.findById(
      queueEntry.appointment,
    );

    return res.status(400).json({
      success: false,
      message: `Service cannot be completed. Appointment status is ${currentAppointment?.status ?? 'UNKNOWN'}`,
      error: 'INVALID_APPOINTMENT_STATUS',
    });
  }

  const completedAt = new Date();

  const updatedQueueEntry = await QueueEntry.findOneAndUpdate(
    {
      _id: queueEntry._id,
      completedAt: { $exists: false },
    },
    {
      $set: {
        completedAt,
      },
    },
    {
      new: true,
    },
  );

  if (!updatedQueueEntry) {
    await Appointment.findOneAndUpdate(
      {
        _id: appointment._id,
        status: AppointmentStatus.COMPLETED,
      },
      {
        $set: {
          status: AppointmentStatus.IN_SERVICE,
        },
      },
    );

    return res.status(409).json({
      success: false,
      message: 'Queue entry was completed by another request',
      error: 'ALREADY_COMPLETED',
    });
  }

  const populatedQueueEntry = await populateQueueEntry(
    updatedQueueEntry._id,
  );

  if (!populatedQueueEntry) {
    return res.status(500).json({
      success: false,
      message: 'Queue entry could not be loaded after completion',
      error: 'QUEUE_ENTRY_LOAD_FAILED',
    });
  }

  const io = getIo(req);

  broadcastQueueCompletion(
    io,
    toQueueSocketPayload({
      _id: updatedQueueEntry._id,
      queueNumber: updatedQueueEntry.queueNumber,
      appointment: {
        _id: appointment._id,
        status: appointment.status,
      },
    }),
  );

  return res.status(200).json({
    success: true,
    message: 'Service completed successfully',
    data: populatedQueueEntry,
  });
}