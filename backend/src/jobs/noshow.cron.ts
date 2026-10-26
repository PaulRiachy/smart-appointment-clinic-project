import cron from 'node-cron';
import {
  AppointmentStatus,
} from '@app/shared';
import { Appointment } from '../models/appointment.model';

const NO_SHOW_GRACE_PERIOD_MS = 15 * 60 * 1000;

export async function runNoShowJob(): Promise<number> {
  const cutoff = new Date(
    Date.now() - NO_SHOW_GRACE_PERIOD_MS,
  );

  const result = await Appointment.updateMany(
    {
      status: AppointmentStatus.CONFIRMED,
      start: {
        $lt: cutoff,
      },
    },
    {
      $set: {
        status: AppointmentStatus.NO_SHOW,
      },
    },
  );

  const modifiedCount =
    typeof result.modifiedCount === 'number'
      ? result.modifiedCount
      : 0;

  if (modifiedCount > 0) {
    console.log(
      `No-show job marked ${modifiedCount} appointment(s) as NO_SHOW.`,
    );
  }

  return modifiedCount;
}

export function startNoShowCron(): void {
  cron.schedule(
    '*/5 * * * *',
    async () => {
      try {
        await runNoShowJob();
      } catch (error) {
        console.error(
          'No-show cron job failed:',
          error,
        );
      }
    },
    {
      timezone: 'Asia/Beirut',
    },
  );

  console.log(
    'No-show cron started. Schedule: every 5 minutes, timezone: Asia/Beirut.',
  );
}