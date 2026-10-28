
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  IAppointment,
  IQueueEntry,
  IService,
  IUser,
} from '@app/shared';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useQueueSocket } from '../hooks/useQueueSocket';
import './styles/LiveQueueStyle.css';

type PopulatedAppointment = Omit<
  IAppointment,
  'customer' | 'service' | 'staff'
> & {
  customer: string | IUser;
  service: string | IService;
  staff: string | IUser;
};

type QueueRecord = IQueueEntry & {
  appointment: string | PopulatedAppointment;
  status?: string;
};

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}


const ACTIVE_WAITING_STATUSES = new Set([
  'CHECKED_IN',
  'WAITING',
]);

const ACTIVE_SERVING_STATUS = 'IN_SERVICE';

function isPopulatedAppointment(
  appointment: QueueRecord['appointment'],
): appointment is PopulatedAppointment {
  return typeof appointment === 'object' && appointment !== null;
}

function getAppointment(
  entry: QueueRecord,
): PopulatedAppointment | null {
  return isPopulatedAppointment(entry.appointment)
    ? entry.appointment
    : null;
}

function getPersonName(value: string | IUser | IService): string {
  if (typeof value === 'string') return '—';

  if ('fullName' in value) return value.fullName;
  if ('name' in value) return value.name;

  return '—';
}

function getServiceName(
  value: string | IUser | IService,
): string {
  if (typeof value === 'string') return '—';
  return 'name' in value ? value.name : '—';
}

function getQueueStatus(entry: QueueRecord): string {
  if (entry.status) return entry.status;

  const appointment = getAppointment(entry);
  return appointment?.status ?? 'UNKNOWN';
}

function formatBeirutTime(value?: string): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Beirut',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function minutesElapsed(value?: string): number {
  if (!value) return 0;

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 0;

  return Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
}

function getErrorMessage(error: unknown): string {
  const response = (
    error as {
      response?: {
        status?: number;
        data?: {
          message?: string;
          error?: string;
        };
      };
    }
  )?.response;

  if (response?.status === 400) {
    return response.data?.message
      ?? response.data?.error
      ?? 'Invalid booking reference or appointment is not confirmed.';
  }

  if (response?.status === 409) {
    return response.data?.message
      ?? response.data?.error
      ?? 'This appointment has already been checked in or conflicts with the current queue.';
  }

  return response?.data?.message
    ?? response?.data?.error
    ?? 'The request failed. Check your connection and try again.';
}

export default function LiveQueue() {
  const { user } = useAuth();

  const [entries, setEntries] = useState<QueueRecord[]>([]);
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const response = await api.get<ApiEnvelope<QueueRecord[]>>(
        '/queue/today',
      );

      const data = response.data.data;

      if (!Array.isArray(data)) {
        throw new Error('Unexpected queue response.');
      }

      const sorted = [...data].sort(
        (a, b) =>
          new Date(a.checkedInAt).getTime()
          - new Date(b.checkedInAt).getTime(),
      );

      setEntries(sorted);
      setLastUpdated(new Date());
      setError('');
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useQueueSocket({
    onQueueUpdate: () => {
        void loadQueue();
    },
});

  const handleQueueChange = useCallback(() => {
    void loadQueue();
  }, [loadQueue]);

  const { isConnected, lastUpdate } = useQueueSocket({
    onQueueUpdate: handleQueueChange,
});
  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const waitingEntries = useMemo(
    () =>
      entries.filter((entry) =>
        ACTIVE_WAITING_STATUSES.has(getQueueStatus(entry)),
      ),
    [entries],
  );

  const servingEntries = useMemo(
    () =>
      entries.filter(
        (entry) => getQueueStatus(entry) === ACTIVE_SERVING_STATUS,
      ),
    [entries],
  );

  const handleCheckIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const value = reference.trim();
    if (!value) {
      setError('Enter a booking reference or QR code payload.');
      return;
    }

    setCheckingIn(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/queue/check-in', {
        reference: reference.trim(),
    });

      const result = response.data.data;
      let queueNumber: string | undefined;

      if ('queueNumber' in result && typeof result.queueNumber === 'string') {
        queueNumber = result.queueNumber;
      } else if ('queueEntry' in result && result.queueEntry) {
        queueNumber = result.queueEntry.queueNumber;
      } else if ('entry' in result && result.entry) {
        queueNumber = result.entry.queueNumber;
      }

      setSuccess(
        queueNumber
          ? `Checked in successfully. Queue number: ${queueNumber}`
          : response.data.message ?? 'Customer checked in successfully.',
      );
      setReference('');
      await loadQueue();
    } catch (checkInError) {
      setError(getErrorMessage(checkInError));
    } finally {
      setCheckingIn(false);
    }
  };

  const handleQueueAction = async (
    entry: QueueRecord,
    action: 'call' | 'complete',
  ) => {
    setActingOnId(entry._id);
    setError('');
    setSuccess('');

    try {
      const response = await api.patch<ApiEnvelope<unknown>>(
        `/queue/${entry._id}/${action}`,
      );

      setSuccess(
        response.data.message
        ?? (action === 'call'
          ? `${entry.queueNumber} is now in service.`
          : `${entry.queueNumber} service completed.`),
      );

      await loadQueue();
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setActingOnId(null);
    }
  };

  const activeUserName = user?.fullName ?? 'Staff member';

  return (
    <main className="live-queue-page mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Staff operations</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Live queue
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Signed in as {activeUserName}. Times shown in Asia/Beirut.
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${
              isConnected
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-800'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {isConnected ? 'Live connection' : 'Reconnecting'}
          </span>

          <button
            type="button"
            onClick={() => void loadQueue()}
            className="rounded-lg border border-slate-300 px-3 py-2 font-medium hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {success}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Check in a customer</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter the booking reference or scan/paste the QR payload.
          </p>
        </div>

        <form
          onSubmit={handleCheckIn}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <label className="sr-only" htmlFor="booking-reference">
            Booking reference or QR payload
          </label>
          <input
            id="booking-reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="e.g. APT-7K3Q9M"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            disabled={checkingIn || !reference.trim()}
            className="rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checkingIn ? 'Checking in…' : 'Check in'}
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Currently serving</h2>
            <p className="text-sm text-slate-500">
              Active services across all practitioners.
            </p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
            {servingEntries.length} in service
          </span>
        </div>

        {servingEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No active services right now.
          </div>
        ) : (
          <div className="serving-table-scroll" tabIndex={0} role="region" aria-label="Currently serving appointments">
            <table className="serving-table">
              <thead>
                <tr>
                  <th scope="col">Queue number</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Service</th>
                  <th scope="col">Practitioner</th>
                  <th scope="col">Started</th>
                  <th scope="col">Time in service</th>
                  <th scope="col">Status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
            {servingEntries.map((entry) => {
              const appointment = getAppointment(entry);
              const service = appointment?.service;
              const staff = appointment?.staff;
              const customer = appointment?.customer;

              return (
                <tr key={entry._id}>
                  <td className="serving-table__number">{entry.queueNumber}</td>
                  <td className="serving-table__customer">{customer ? getPersonName(customer) : 'Customer'}</td>
                  <td>{service ? getServiceName(service) : '—'}</td>
                  <td>{staff ? getPersonName(staff) : '—'}</td>
                  <td className="serving-table__time">{formatBeirutTime(entry.calledAt)}</td>
                  <td className="serving-table__time">{minutesElapsed(entry.calledAt)} min</td>
                  <td><span className="serving-table__status">IN SERVICE</span></td>
                  <td>
                    <button
                      type="button"
                      onClick={() => void handleQueueAction(entry, 'complete')}
                      disabled={actingOnId === entry._id}
                      className="serving-table__complete"
                      aria-label={`Complete service for ${customer ? getPersonName(customer) : 'Customer'}, queue ${entry.queueNumber}`}
                    >
                      {actingOnId === entry._id ? 'Updating…' : 'Complete service'}
                    </button>
                  </td>
                </tr>
              );
            })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Waiting room</h2>
            <p className="mt-1 text-sm text-slate-500">
              Ordered by check-in time, earliest first.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            {waitingEntries.length} waiting
          </span>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Loading today’s queue…
          </p>
        ) : waitingEntries.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            The waiting room is empty. Checked-in customers will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Queue number</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Practitioner</th>
                  <th className="px-5 py-3">Checked in</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {waitingEntries.map((entry) => {
                  const appointment = getAppointment(entry);
                  const customer = appointment?.customer;
                  const service = appointment?.service;
                  const staff = appointment?.staff;

                  return (
                    <tr key={entry._id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 font-semibold text-indigo-700">
                        {entry.queueNumber}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-900">
                        {customer ? getPersonName(customer) : '—'}
                      </td>
                      <td className="px-5 py-4">
                        {service ? getServiceName(service) : '—'}
                      </td>
                      <td className="px-5 py-4">
                        {staff ? getPersonName(staff) : '—'}
                      </td>
                      <td className="px-5 py-4">
                        {formatBeirutTime(entry.checkedInAt)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                          {getQueueStatus(entry).replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => void handleQueueAction(entry, 'call')}
                          disabled={actingOnId === entry._id}
                          className="rounded-lg bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {actingOnId === entry._id ? 'Calling…' : 'Call next'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="flex flex-col gap-1 border-t border-slate-200 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:justify-between">
          <span>
            {lastUpdated
              ? `Last refreshed at ${formatBeirutTime(lastUpdated.toISOString())}`
              : 'Waiting for queue data'}
          </span>
          <span>
            {lastUpdate
              ? `Last event: ${lastUpdate.event}`
              : 'Listening for queue events'}
          </span>
        </footer>
      </section>
    </main>
  );
}
