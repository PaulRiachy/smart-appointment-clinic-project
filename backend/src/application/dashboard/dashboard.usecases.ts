import { businessDate, businessDayEnd } from '../../domain/time/business-time';
import { parseDateOnly, resolveDateRange, getDashboardChartDays } from '../../domain/dashboard/dashboard.rules';
import type { Dependencies, OperationInput } from '../ports';
import { result, type OperationResult } from '../result';
export function createDashboardUseCases(deps: Dependencies) {
    async function getDashboardStats(input: OperationInput): Promise<OperationResult> {
        try {
            const requestedStartDate = typeof input.query.startDate === 'string'
                ? input.query.startDate
                : undefined;
            const requestedEndDate = typeof input.query.endDate === 'string'
                ? input.query.endDate
                : undefined;
            if (requestedStartDate &&
                !parseDateOnly(requestedStartDate)) {
                return result('invalid', {
                    message: 'startDate must be a valid date in YYYY-MM-DD format.',
                });
            }
            if (requestedEndDate &&
                !parseDateOnly(requestedEndDate)) {
                return result('invalid', {
                    message: 'endDate must be a valid date in YYYY-MM-DD format.',
                });
            }
            const dateRange = resolveDateRange(requestedStartDate, requestedEndDate);
            const startDateObject = parseDateOnly(dateRange.startDate);
            const endDateObject = parseDateOnly(dateRange.endDate);
            if (!startDateObject || !endDateObject) {
                return result('invalid', {
                    message: 'Invalid dashboard date range.',
                });
            }
            if (startDateObject > endDateObject) {
                return result('invalid', {
                    message: 'startDate cannot be later than endDate.',
                });
            }
            const rangeStart = businessDate(dateRange.startDate);
            const rangeEnd = new Date(businessDayEnd(dateRange.endDate).getTime() - 1);
            const { totalAppointments, completedAppointments, cancelledAppointments, noShowAppointments, waitingNow, revenueResult, chartAppointments, } = await deps.dashboard.load(rangeStart, rangeEnd);
            const revenue = revenueResult.length > 0
                ? Number(revenueResult[0]!.total || 0)
                : 0;
            const chartDays = getDashboardChartDays(dateRange.startDate, dateRange.endDate);
            const chartAppointmentMap = new Map<string, {
                total: number;
                completed: number;
            }>();
            for (const item of chartAppointments) {
                chartAppointmentMap.set(item._id, {
                    total: Number(item.total || 0),
                    completed: Number(item.completed || 0),
                });
            }
            const chart = chartDays.map((day) => {
                const values = chartAppointmentMap.get(day.date);
                return {
                    date: day.date,
                    total: values?.total || 0,
                    completed: values?.completed || 0,
                };
            });
            return result('ok', {
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
        }
        catch (error) {
            console.error('Failed to load dashboard statistics:', error);
            return result('failed', {
                message: 'Failed to load dashboard statistics.',
            });
        }
    }
    return { getDashboardStats };
}
