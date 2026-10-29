import type {
  Request,
  Response,
} from 'express';
import { Types } from 'mongoose';

import {
  AppointmentStatus,
  UserRole,
} from '@app/shared';

import { Appointment } from '../models/appointment.model';
import { Service } from '../models/service.model';
import { User }from '../models/user.model';
import { businessDate } from '../utils/business-time';
import {
  sendBookingConfirmationEmail,
  sendRescheduleEmail,
  sendCancellationEmail,
} from '../services/mail.service';
import {
  getAvailability,
  validateSlot,
  validateAndRunWithStaffLock,
} from '../services/availability.service';

type AuthenticatedRequest = Request & {
  user?: {
    _id?: string;
    id?: string;
    role?: UserRole | string;
  };
};

function getAuthenticatedUser(
  req: AuthenticatedRequest,
): {
  id: string;
  role: string;
} {
  const user = req.user;

  const id = String(
    user?._id ?? user?.id ?? '',
  );

  const role = String(user?.role ?? '');

  if (!id || !role) {
    throw new HttpError(
      401,
      'Authentication required.',
    );
  }

  return {
    id,
    role,
  };
}

class HttpError extends Error {
  statusCode: number;

  constructor(
    statusCode: number,
    message: string,
  ) {
    super(message);
    this.statusCode = statusCode;
  }
}

function isValidObjectId(value: string): boolean {
  return Types.ObjectId.isValid(value);
}

function sendError(
  res: Response,
  error: unknown,
): void {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  const message =
    error instanceof Error
      ? error.message
      : 'Request failed.';

  const statusCode =
    message.includes('no longer available') ||
    message.includes('currently being booked')
      ? 409
      : 400;

  res.status(statusCode).json({
    success: false,
    message,
  });
}

function generateReference(): string {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let suffix = '';

  for (let index = 0; index < 6; index += 1) {
    suffix += alphabet[
      Math.floor(
        Math.random() * alphabet.length,
      )
    ];
  }

  return `APT-${suffix}`;
}

async function createUniqueReference(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const reference = generateReference();

    const exists =
      await Appointment.exists({
        reference,
      });

    if (!exists) {
      return reference;
    }
  }

  throw new HttpError(
    500,
    'Could not generate a unique appointment reference.',
  );
}

function parseStart(value: unknown): Date {
  if (
    typeof value !== 'string' ||
    value.trim() === ''
  ) {
    throw new HttpError(
      400,
      'start is required.',
    );
  }

  const input = value.trim();

  let date: Date;

  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(
      input,
    )
  ) {
    date = businessDate(input.slice(0, 10), `${input.slice(11)}:00`);
  } else if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(
      input,
    )
  ) {
    date = businessDate(input.slice(0, 10), input.slice(11));
  } else {
    date = new Date(input);
  }

  if (Number.isNaN(date.getTime())) {
    throw new HttpError(
      400,
      'start must be a valid timestamp.',
    );
  }

  return date;
}

function canManageAllAppointments(
  role: string,
): boolean {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.STAFF
  );
}

function ensureCustomerOwnsAppointment(
  appointment: {
    customer: unknown;
  },
  userId: string,
): void {
  if (
    String(appointment.customer) !==
    String(userId)
  ) {
    throw new HttpError(
      403,
      'You are not allowed to access this appointment.',
    );
  }
}

async function findAppointmentOrThrow(
  id: string,
) {
  if (!isValidObjectId(id)) {
    throw new HttpError(
      400,
      'Invalid appointment id.',
    );
  }

  const appointment =
    await Appointment.findById(id);

  if (!appointment) {
    throw new HttpError(
      404,
      'Appointment not found.',
    );
  }

  return appointment;
}

async function getAppointmentEmailDetails(appointmentId: string) {
  const appointment = await Appointment.findById(appointmentId)
    .populate('customer', 'fullName email')
    .populate('service', 'name')
    .populate('staff', 'fullName')
    .lean();

  if (!appointment) {
    throw new HttpError(404, 'Appointment not found.');
  }

  const customer = appointment.customer as {
    fullName?: string;
    email?: string;
  } | null;
  const service = appointment.service as {
    name?: string;
  } | null;
  const staff = appointment.staff as {
    fullName?: string;
  } | null;

  if (!customer?.email) {
    console.error(
      `Cannot send appointment email: customer email is missing for ${appointment.reference}.`,
    );
    return null;
  }

  return {
    to: customer.email,
    customerName: customer.fullName || 'Customer',
    reference: appointment.reference,
    serviceName: service?.name || 'Appointment',
    staffName: staff?.fullName || 'Staff member',
    start: new Date(appointment.start),
    end: new Date(appointment.end),
  };
}

async function updateAppointmentOrThrow(
  appointment: Awaited<ReturnType<typeof findAppointmentOrThrow>>,
  changes: { status?: AppointmentStatus; start?: Date; end?: Date },
) {
  const updated = await Appointment.findOneAndUpdate(
    {
      _id: appointment._id,
      status: appointment.status,
      start: appointment.start,
      end: appointment.end,
      staff: appointment.staff,
      service: appointment.service,
    },
    { $set: changes },
    { new: true },
  );

  if (!updated) {
    throw new HttpError(409, 'This appointment changed during the request. Please refresh and try again.');
  }

  return updated;
}

export async function getAvailabilityController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const {
      serviceId,
      staffId,
      date,
    } = req.query;

    if (
      typeof serviceId !== 'string' ||
      typeof staffId !== 'string' ||
      typeof date !== 'string'
    ) {
      throw new HttpError(
        400,
        'serviceId, staffId and date are required.',
      );
    }

    const availability =
      await getAvailability(
        serviceId,
        staffId,
        date,
      );

    res.status(200).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    sendError(res, error);
  }
}


export async function createAppointment(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      id: customerId,
      role,
    } = getAuthenticatedUser(req);

    if (role !== UserRole.CUSTOMER) {
      throw new HttpError(
        403,
        'Only customers can create appointments.',
      );
    }

    const {
      serviceId,
      staffId,
      start,
    } = req.body as {
      serviceId?: string;
      staffId?: string;
      start?: string;
    };

    if (
      typeof serviceId !== 'string' ||
      typeof staffId !== 'string' ||
      typeof start !== 'string'
    ) {
      throw new HttpError(
        400,
        'serviceId, staffId and start are required.',
      );
    }

    if (
      !isValidObjectId(serviceId) ||
      !isValidObjectId(staffId)
    ) {
      throw new HttpError(
        400,
        'serviceId or staffId is invalid.',
      );
    }

    const customer =
      await User.findById(customerId)
        .select('_id role')
        .lean();

    if (!customer) {
      throw new HttpError(
        401,
        'Customer account was not found.',
      );
    }

    const service =
      await Service.findById(serviceId)
        .select('_id active duration name price')
        .lean();

    if (!service) {
      throw new HttpError(
        404,
        'Service not found.',
      );
    }

    if (!service.active) {
      throw new HttpError(
        400,
        'Inactive services cannot be booked.',
      );
    }

    const requestedStart =
      parseStart(start);

    const requestedEnd =
      new Date(
        requestedStart.getTime() +
          service.duration * 60 * 1000,
      );

    const appointment =
      await validateAndRunWithStaffLock(
        staffId,
        requestedStart,
        requestedEnd,
        async () => {
          const validated =
            await validateSlot(
              serviceId,
              staffId,
              requestedStart,
            );

          const reference =
            await createUniqueReference();

          return Appointment.create({
            reference,
            customer: customerId.toString(),
            service: serviceId.toString(),
            staff: staffId.toString(),
            start: validated.start,
            end: validated.end,
            status:
              AppointmentStatus.PENDING,
          });
        },
      );

    res.status(201).json({
      success: true,
      message:
        'Appointment booked successfully.',
      data: appointment,
    });
  } catch (error) {
    sendError(res, error);
  }
}



export async function listAppointments(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      id: userId,
      role,
    } = getAuthenticatedUser(req);

    const query: Record<string, unknown> = {};

    if (role === UserRole.CUSTOMER) {
      query.customer =
        new Types.ObjectId(userId);
    } else if (
      !canManageAllAppointments(role)
    ) {
      throw new HttpError(
        403,
        'You are not allowed to view appointments.',
      );
    }

    const appointments =
      await Appointment.find(query)
        .populate(
          'customer',
          'fullName email phone',
        )
        .populate(
          'service',
          'name description duration price active',
        )
        .populate(
          'staff',
          'fullName email phone role',
        )
        .sort({ start: 1 });

    res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    sendError(res, error);
  }
}

export async function getAppointment(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      id: userId,
      role,
    } = getAuthenticatedUser(req);


    const appointment = await findAppointmentOrThrow(
      String(req.params.id),
    );

    if (role === UserRole.CUSTOMER) {
      ensureCustomerOwnsAppointment(
        appointment,
        userId,
      );
    } else if (
      !canManageAllAppointments(role)
    ) {
      throw new HttpError(
        403,
        'You are not allowed to view this appointment.',
      );
    }

    await appointment.populate([
      {
        path: 'customer',
        select: 'fullName email phone',
      },
      {
        path: 'service',
        select:
          'name description duration price active',
      },
      {
        path: 'staff',
        select: 'fullName email phone role',
      },
    ]);

    res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    sendError(res, error);
  }
}

export async function cancelAppointment(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      id: userId,
      role,
    } = getAuthenticatedUser(req);


    const appointment = await findAppointmentOrThrow(
      String(req.params.id),
    );

    if (role === UserRole.CUSTOMER) {
      ensureCustomerOwnsAppointment(
        appointment,
        userId,
      );
    } else if (
      !canManageAllAppointments(role)
    ) {
      throw new HttpError(
        403,
        'You are not allowed to cancel this appointment.',
      );
    }

    if (
      [
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
      ].includes(appointment.status)
    ) {
      throw new HttpError(
        400,
        'This appointment can no longer be cancelled.',
      );
    }

    const updated = await updateAppointmentOrThrow(appointment, {
      status: AppointmentStatus.CANCELLED,
    });

    const emailDetails =
      await getAppointmentEmailDetails(String(appointment._id));

    if (emailDetails) {
      await sendCancellationEmail(emailDetails);
    }

    res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully.',
      data: updated,
    });
  } catch (error) {
    sendError(res, error);
  }
}


export async function rescheduleAppointment(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      id: userId,
      role,
    } = getAuthenticatedUser(req);

    const appointment =
      await findAppointmentOrThrow(
        String(req.params.id),
      );

    if (role === UserRole.CUSTOMER) {
      ensureCustomerOwnsAppointment(
        appointment,
        userId,
      );
    } else if (
      !canManageAllAppointments(role)
    ) {
      throw new HttpError(
        403,
        'You are not allowed to reschedule this appointment.',
      );
    }

    if (
      [
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
      ].includes(appointment.status)
    ) {
      throw new HttpError(
        400,
        'This appointment cannot be rescheduled.',
      );
    }

    const { start } = req.body as {
      start?: string;
    };

    if (typeof start !== 'string') {
      throw new HttpError(
        400,
        'start is required.',
      );
    }

    const staffId =
      String(appointment.staff);

    const serviceId =
      String(appointment.service);

    const service =
      await Service.findById(serviceId)
        .select('_id active duration')
        .lean();

    if (!service) {
      throw new HttpError(
        404,
        'Service not found.',
      );
    }

    if (!service.active) {
      throw new HttpError(
        400,
        'Inactive services cannot be booked.',
      );
    }

    const requestedStart =
      parseStart(start);

    const requestedEnd =
      new Date(
        requestedStart.getTime() +
          service.duration * 60 * 1000,
      );

    const updated =
      await validateAndRunWithStaffLock(
        staffId,
        requestedStart,
        requestedEnd,
        async () => {
          const validated =
            await validateSlot(
              serviceId,
              staffId,
              requestedStart,
              String(appointment._id),
            );

          return updateAppointmentOrThrow(appointment, {
            start: validated.start,
            end: validated.end,
          });
        },
      );

    const emailDetails =
      await getAppointmentEmailDetails(String(updated._id));

    if (emailDetails) {
      await sendRescheduleEmail(emailDetails);
    }

    res.status(200).json({
      success: true,
      message:
        'Appointment rescheduled successfully.',
      data: updated,
    });
  } catch (error) {
    sendError(res, error);
  }
}




export async function confirmAppointment(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      role,
    } = getAuthenticatedUser(req);

    if (!canManageAllAppointments(role)) {
      throw new HttpError(
        403,
        'Only staff or administrators can confirm appointments.',
      );
    }

    const appointment =
      await findAppointmentOrThrow(
        String(req.params.id),
      );

    if (
      appointment.status !==
      AppointmentStatus.PENDING
    ) {
      throw new HttpError(
        400,
        'Only pending appointments can be confirmed.',
      );
    }

    const staffId =
      String(appointment.staff);

    const serviceId =
      String(appointment.service);

    const appointmentStart =
      new Date(appointment.start);

    const appointmentEnd =
      new Date(appointment.end);

    if (
      Number.isNaN(
        appointmentStart.getTime(),
      ) ||
      Number.isNaN(
        appointmentEnd.getTime(),
      )
    ) {
      throw new HttpError(
        400,
        'Appointment has an invalid time range.',
      );
    }

    await validateAndRunWithStaffLock(
      staffId,
      appointmentStart,
      appointmentEnd,
      async () => {
        // Recalculate availability while holding the booking lock.
        await validateSlot(
          serviceId,
          staffId,
          appointmentStart,
          String(appointment._id),
        );

        const updated = await updateAppointmentOrThrow(appointment, {
          status: AppointmentStatus.CONFIRMED,
        });
        appointment.set(updated.toObject());
      },
    );

    const emailDetails =
      await getAppointmentEmailDetails(String(appointment._id));

    if (emailDetails) {
      await sendBookingConfirmationEmail(emailDetails);
    }

    res.status(200).json({
      success: true,
      message:
        'Appointment confirmed successfully.',
      data: appointment,
    });
  } catch (error) {
    sendError(res, error);
  }
}
