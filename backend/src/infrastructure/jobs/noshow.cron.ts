import cron from 'node-cron';
export function startNoShowCron(runNoShowJob: () => Promise<number>): void {
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
