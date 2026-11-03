import { AppointmentStatus } from '@app/shared';
import type { Dependencies } from '../../application/ports';
import { Appointment } from '../models/appointment.model';
import { QueueEntry } from '../models/queue.model';
const BEIRUT_TIMEZONE = 'Asia/Beirut';
export const dashboardRepository: Dependencies['dashboard'] = {
    async load(rangeStart, rangeEnd) {
        const appointmentDateFilter = {
            start: {
                $gte: rangeStart,
                $lte: rangeEnd,
            },
        };
        const [totalAppointments, completedAppointments, cancelledAppointments, noShowAppointments, waitingNow, revenueResult, chartAppointments,] = await Promise.all([
            Appointment.countDocuments(appointmentDateFilter),
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
        return { totalAppointments, completedAppointments, cancelledAppointments, noShowAppointments, waitingNow, revenueResult, chartAppointments };
    },
};
