export const BUSINESS_TIMEZONE = 'Asia/Beirut';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function wallTime(date: Date): number {
  const parts = formatter.formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(value('year'), value('month') - 1, value('day'),
    value('hour'), value('minute'), value('second'));
}

/** Interpret a clinic wall-clock time using the timezone's date-specific offset. */
export function businessDate(date: string, time = '00:00:00'): Date {
  const input = `${date}T${time}`;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(input)) {
    throw new Error('Invalid business date or time.');
  }
  const local = new Date(`${input}Z`);
  const target = local.getTime();
  if (!Number.isFinite(target) || local.toISOString().slice(0, 19) !== input) {
    throw new Error('Invalid business date or time.');
  }

  // Sample both sides of a possible DST transition. Prefer the earlier instant
  // in a repeated hour; move forward through a missing hour at spring changeover.
  const offsets = new Set([-36, 0, 36].map((hours) => {
    const sample = new Date(target + hours * 3_600_000);
    return wallTime(sample) - sample.getTime();
  }));
  const candidates = [...offsets].map((offset) => target - offset);
  const exact = candidates.filter((candidate) => wallTime(new Date(candidate)) === target);
  return new Date(exact.length ? Math.min(...exact) : Math.max(...candidates));
}

/** Exclusive end uses the next calendar day, since DST days need not last 24 hours. */
export function businessDayEnd(date: string): Date {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return businessDate(next.toISOString().slice(0, 10));
}
