import type { Request, Response } from 'express';
import { AppointmentStatus } from '@app/shared';
import { Appointment } from '../models/appointment.model';
import { QueueEntry } from '../models/queue.model';
import { businessDate, businessDayEnd } from '../utils/business-time';


const BEIRUT_TIMEZONE = 'Asia/Beirut';
const DEFAULT_CHART_DAYS = 7;

interface DashboardDay {
  date: string;
  start: Date;
  end: Date;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function getBeirutDateParts(date: Date): DateParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BEIRUT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);

  const year = Number(
    parts.find((part) => part.type === 'year')?.value,
  );
  const month = Number(
    parts.find((part) => part.type === 'month')?.value,
  );
  const day = Number(
    parts.find((part) => part.type === 'day')?.value,
  );

  return {
    year,
    month,
    day,
  };
}

function formatDateParts(parts: DateParts): string {
  return [
    parts.year,
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year = NaN, month = NaN, day = NaN] = value.split('-').map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function addCalendarDays(
  date: Date,
  days: number,
): Date {
  const result = new Date(date);

  result.setUTCDate(
    result.getUTCDate() + days,
  );

  return result;
}

function createBeirutDay(
  year: number,
  month: number,
  day: number,
): DashboardDay {
  const date = formatDateParts({
    year,
    month,
    day,
  });


  const start = businessDate(date);
  const end = new Date(businessDayEnd(date).getTime() - 1);

  return {
    date,
    start,
    end,
  };
}

function createDayFromUtcDate(
  utcDate: Date,
): DashboardDay {
  return createBeirutDay(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth() + 1,
    utcDate.getUTCDate(),
  );
}

function getLastSevenBeirutDays(): DashboardDay[] {
  const todayParts = getBeirutDateParts(new Date());

  const todayUtc = new Date(
    Date.UTC(
      todayParts.year,
      todayParts.month - 1,
      todayParts.day,
    ),
  );

  const days: DashboardDay[] = [];

  for (
    let offset = DEFAULT_CHART_DAYS - 1;
    offset >= 0;
    offset -= 1
  ) {
    const calendarDate = addCalendarDays(
      todayUtc,
      -offset,
    );

    days.push(
      createDayFromUtcDate(calendarDate),
    );
  }

  return days;
}

function getDaysBetween(
  startDate: string,
  endDate: string,
): DashboardDay[] {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (!start || !end) {
    return [];
  }

  const days: DashboardDay[] = [];

  let current = new Date(start);

  while (current <= end) {
    days.push(createDayFromUtcDate(current));

    current = addCalendarDays(current, 1);
  }

  return days;
}

function getDashboardChartDays(
  startDate: string,
  endDate: string,
): DashboardDay[] {
  return getDaysBetween(
    startDate,
    endDate,
  );
}

function resolveDateRange(
  requestedStartDate?: string,
  requestedEndDate?: string,
): {
  startDate: string;
  endDate: string;
} {
  if (!requestedStartDate && !requestedEndDate) {
    const days = getLastSevenBeirutDays();

    return {
      startDate: days[0]!.date,
      endDate: days[days.length - 1]!.date,
    };
  }

  if (
    requestedStartDate &&
    requestedEndDate
  ) {
    return {
      startDate: requestedStartDate,
      endDate: requestedEndDate,
    };
  }

  if (requestedStartDate) {
    const today = formatDateParts(
      getBeirutDateParts(new Date()),
    );

    return {
      startDate: requestedStartDate,
      endDate: today,
    };
  }
  const endDate = parseDateOnly(
    requestedEndDate!,
  );

  if (!endDate) {
    return {
      startDate: requestedEndDate!,
      endDate: requestedEndDate!,
    };
  }

  const startDate = addCalendarDays(
    endDate,
    -(DEFAULT_CHART_DAYS - 1),
  );

  return {
    startDate: formatDateParts({
      year: startDate.getUTCFullYear(),
      month: startDate.getUTCMonth() + 1,
      day: startDate.getUTCDate(),
    }),
    endDate: requestedEndDate!,
  };
}

export async function getDashboardStats(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const requestedStartDate =
      typeof req.query.startDate === 'string'
        ? req.query.startDate
        : undefined;

    const requestedEndDate =
      typeof req.query.endDate === 'string'
        ? req.query.endDate
        : undefined;

    if (
      requestedStartDate &&
      !parseDateOnly(requestedStartDate)
    ) {
      res.status(400).json({
        success: false,
        message:
          'startDate must be a valid date in YYYY-MM-DD format.',
      });
      return;
    }

    if (
      requestedEndDate &&
      !parseDateOnly(requestedEndDate)
    ) {
      res.status(400).json({
        success: false,
        message:
          'endDate must be a valid date in YYYY-MM-DD format.',
      });
      return;
    }

    const dateRange = resolveDateRange(
      requestedStartDate,
      requestedEndDate,
    );

    const startDateObject = parseDateOnly(
      dateRange.startDate,
    );

    const endDateObject = parseDateOnly(
      dateRange.endDate,
    );

    if (!startDateObject || !endDateObject) {
      res.status(400).json({
        success: false,
        message:
          'Invalid dashboard date range.',
      });
      return;
    }

    if (startDateObject > endDateObject) {
      res.status(400).json({
        success: false,
        message:
          'startDate cannot be later than endDate.',
      });
      return;
    }

    const rangeStart = businessDate(dateRange.startDate);
    const rangeEnd = new Date(businessDayEnd(dateRange.endDate).getTime() - 1);

    const appointmentDateFilter = {
      start: {
        $gte: rangeStart,
        $lte: rangeEnd,
      },
    };

    const [
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      waitingNow,
      revenueResult,
      chartAppointments,
    ] = await Promise.all([
      Appointment.countDocuments(
        appointmentDateFilter,
      ),

      Appointment.countDocuments({
        ...appointmentDateFilter,
        status: AppointmentStatus.COMPLETED,
      }),

      Appointment.countDocuments({
        ...appointmentDateFilter,
        status: AppointmentStatus.CANCELLED,
      }),

      Appointment.countDocuments({
        ...appointmentDateFilter,
        status: AppointmentStatus.NO_SHOW,
      }),

      QueueEntry.countDocuments({
        completedAt: {
          $exists: false,
        },
        checkedInAt: {
          $exists: true,
        },
      }),

      Appointment.aggregate([
        {
          $match: {
            ...appointmentDateFilter,
            status: AppointmentStatus.COMPLETED,
          },
        },
        {
          $lookup: {
            from: 'services',
            localField: 'service',
            foreignField: '_id',
            as: 'service',
          },
        },
        {
          $unwind: {
            path: '$service',
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: '$service.price',
            },
          },
        },
      ]),

      Appointment.aggregate([
        {
          $match: appointmentDateFilter,
        },
        {
          $project: {
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$start',
                timezone: BEIRUT_TIMEZONE,
              },
            },
            status: 1,
          },
        },
        {
          $group: {
            _id: '$date',
            total: {
              $sum: 1,
            },
            completed: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      '$status',
                      AppointmentStatus.COMPLETED,
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const revenue =
      revenueResult.length > 0
        ? Number(revenueResult[0].total || 0)
        : 0;

    const chartDays = getDashboardChartDays(
      dateRange.startDate,
      dateRange.endDate,
    );

    const chartAppointmentMap = new Map<
      string,
      {
        total: number;
        completed: number;
      }
    >();

    for (const item of chartAppointments) {
      chartAppointmentMap.set(
        item._id,
        {
          total: Number(item.total || 0),
          completed: Number(item.completed || 0),
        },
      );
    }

    const chart = chartDays.map((day) => {
      const values =
        chartAppointmentMap.get(day.date);

      return {
        date: day.date,
        total: values?.total || 0,
        completed: values?.completed || 0,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        dateRange,
        metrics: {
          totalAppointments,
          completedAppointments,
          cancelledAppointments,
          noShowAppointments,
          waitingNow,
          estimatedRevenue: revenue,
        },
        chart,
      },
    });
  } catch (error) {
    console.error(
      'Failed to load dashboard statistics:',
      error,
    );

    res.status(500).json({
      success: false,
      message:
        'Failed to load dashboard statistics.',
    });
  }
}
