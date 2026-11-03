import { businessDate, businessDayEnd } from '../time/business-time';
export const BEIRUT_TIMEZONE = 'Asia/Beirut';
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
export function getBeirutDateParts(date: Date): DateParts {
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
    return {
        year,
        month,
        day,
    };
}
export function formatDateParts(parts: DateParts): string {
    return [
        parts.year,
        String(parts.month).padStart(2, '0'),
        String(parts.day).padStart(2, '0'),
    ].join('-');
}
export function parseDateOnly(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }
    const [year = NaN, month = NaN, day = NaN] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day) {
        return null;
    }
    return date;
}
export function addCalendarDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}
export function createBeirutDay(year: number, month: number, day: number): DashboardDay {
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
export function createDayFromUtcDate(utcDate: Date): DashboardDay {
    return createBeirutDay(utcDate.getUTCFullYear(), utcDate.getUTCMonth() + 1, utcDate.getUTCDate());
}
export function getLastSevenBeirutDays(): DashboardDay[] {
    const todayParts = getBeirutDateParts(new Date());
    const todayUtc = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day));
    const days: DashboardDay[] = [];
    for (let offset = DEFAULT_CHART_DAYS - 1; offset >= 0; offset -= 1) {
        const calendarDate = addCalendarDays(todayUtc, -offset);
        days.push(createDayFromUtcDate(calendarDate));
    }
    return days;
}
export function getDaysBetween(startDate: string, endDate: string): DashboardDay[] {
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
export function getDashboardChartDays(startDate: string, endDate: string): DashboardDay[] {
    return getDaysBetween(startDate, endDate);
}
export function resolveDateRange(requestedStartDate?: string, requestedEndDate?: string): {
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
    if (requestedStartDate &&
        requestedEndDate) {
        return {
            startDate: requestedStartDate,
            endDate: requestedEndDate,
        };
    }
    if (requestedStartDate) {
        const today = formatDateParts(getBeirutDateParts(new Date()));
        return {
            startDate: requestedStartDate,
            endDate: today,
        };
    }
    const endDate = parseDateOnly(requestedEndDate!);
    if (!endDate) {
        return {
            startDate: requestedEndDate!,
            endDate: requestedEndDate!,
        };
    }
    const startDate = addCalendarDays(endDate, -(DEFAULT_CHART_DAYS - 1));
    return {
        startDate: formatDateParts({
            year: startDate.getUTCFullYear(),
            month: startDate.getUTCMonth() + 1,
            day: startDate.getUTCDate(),
        }),
        endDate: requestedEndDate!,
    };
}
