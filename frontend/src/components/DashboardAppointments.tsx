import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppointmentStatus, type IAppointment, type IUser, type IService } from '@app/shared';
import api from '../services/api';
import AP_Table, { type APTableColumn } from './AP_Table';

interface Props {
  startDate: string;
  endDate: string;
}

const PAGE_SIZE = 10;

function getId(value: string | IUser | IService | null): string {
  return typeof value === 'string' ? value : value?._id ?? '';
}

function getName(value: string | IUser | IService | null): string {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  return 'fullName' in value ? value.fullName : value.name;
}

function statusLabel(status: string): string {
  return status.toLowerCase().replaceAll('_', ' ');
}

export function appointmentDate(value: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Beirut', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Beirut', dateStyle: 'medium', timeStyle: 'short',
});
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Beirut', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

const columns: APTableColumn<IAppointment>[] = [
  { key: 'reference', header: 'Reference', render: (row) => row.reference || row._id },
  { key: 'customer', header: 'Patient', render: (row) => getName(row.customer) },
  { key: 'service', header: 'Service', render: (row) => getName(row.service) },
  { key: 'staff', header: 'Doctor', render: (row) => getName(row.staff) },
  {
    key: 'time', header: 'Appointment time',
    render: (row) => (
      <div className="dashboard-appointment-time">
        <strong>{dateTimeFormatter.format(new Date(row.start))}</strong>
        <span>Ends {timeFormatter.format(new Date(row.end))}</span>
      </div>
    ),
  },
  {
    key: 'status', header: 'Status',
    render: (row) => (
      <span className={`dashboard-status dashboard-status--${row.status.toLowerCase()}`}>
        {statusLabel(row.status)}
      </span>
    ),
  },
];

export default function DashboardAppointments({ startDate, endDate }: Props) {
  const [appointments, setAppointments] = useState<IAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [staffId, setStaffId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [sort, setSort] = useState('earliest');
  const [page, setPage] = useState(1);

  const loadAppointments = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await api.get('/appointments', { signal });
      if (signal?.aborted) return;
      if (!Array.isArray(response.data.data)) throw new Error('Invalid appointment list.');
      setAppointments(response.data.data as IAppointment[]);
    } catch (err) {
      if (signal?.aborted) return;
      const requestError = err as { response?: { data?: { message?: string } } };
      setError(requestError.response?.data?.message ?? 'Unable to load appointments. Please try again.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadAppointments(controller.signal);
    return () => controller.abort();
  }, [loadAppointments]);

  const validRange = Boolean(startDate && endDate && startDate <= endDate);
  const periodAppointments = useMemo(() => {
    if (!validRange) return [];
    return appointments.filter((appointment) => {
      const date = appointmentDate(appointment.start);
      return date >= startDate && date <= endDate;
    });
  }, [appointments, startDate, endDate, validRange]);

  const options = useMemo(() => {
    const staff = new Map<string, string>();
    const services = new Map<string, string>();
    for (const appointment of appointments) {
      if (getId(appointment.staff)) staff.set(getId(appointment.staff), getName(appointment.staff));
      if (getId(appointment.service)) services.set(getId(appointment.service), getName(appointment.service));
    }
    const byName = (a: [string, string], b: [string, string]) => a[1].localeCompare(b[1]);
    return { staff: [...staff].sort(byName), services: [...services].sort(byName) };
  }, [appointments]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return periodAppointments.filter((appointment) =>
      (!status || appointment.status === status) &&
      (!staffId || getId(appointment.staff) === staffId) &&
      (!serviceId || getId(appointment.service) === serviceId) &&
      (!query || [appointment.reference, getName(appointment.customer),
        getName(appointment.staff), getName(appointment.service)]
        .some((value) => value?.toLowerCase().includes(query))),
    ).sort((a, b) => sort === 'earliest'
      ? new Date(a.start).getTime() - new Date(b.start).getTime()
      : new Date(b.start).getTime() - new Date(a.start).getTime());
  }, [periodAppointments, search, status, staffId, serviceId, sort]);

  useEffect(() => { setPage(1); }, [startDate, endDate, search, status, staffId, serviceId, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const first = (currentPage - 1) * PAGE_SIZE;

  return (
    <section className="dashboard-chart-card dashboard-appointments management-panel" aria-labelledby="dashboard-appointments-title">
      <div className="dashboard-section-heading">
        <div>
          <h2 id="dashboard-appointments-title">Appointments</h2>
          <p>All bookings in the date range above, including cancelled and completed appointments. Times are shown in Asia/Beirut.</p>
        </div>
        <button className="dashboard-refresh" type="button" disabled={isLoading} onClick={() => void loadAppointments()}>
          {isLoading ? 'Loading…' : 'Refresh appointments'}
        </button>
      </div>

      <div className="dashboard-filters dashboard-appointment-filters" role="group" aria-label="Filter appointments">
        <label className="dashboard-appointment-search">Search
          <input type="search" placeholder="Patient, reference, doctor or service" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {Object.values(AppointmentStatus).map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
          </select>
        </label>
        <label>Doctor
          <select value={staffId} onChange={(event) => setStaffId(event.target.value)}>
            <option value="">All doctors</option>
            {options.staff.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label>Service
          <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
            <option value="">All services</option>
            {options.services.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label>Sort by time
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="earliest">Earliest first</option>
            <option value="latest">Latest first</option>
          </select>
        </label>
        <button className="dashboard-table-button management-button" type="button" onClick={() => {
          setSearch(''); setStatus(''); setStaffId(''); setServiceId(''); setSort('earliest'); setPage(1);
        }}>Clear filters</button>
      </div>

      {!validRange ? (
        <div className="dashboard-error" role="alert">Select a start and end date, with the end on or after the start.</div>
      ) : (
        <>
          {!isLoading && !error && <p className="dashboard-result-count" role="status">{filtered.length} of {periodAppointments.length} appointments match the filters.</p>}
          <AP_Table
            columns={columns}
            data={filtered.slice(first, first + PAGE_SIZE)}
            rowKey={(row) => row._id}
            isLoading={isLoading}
            error={error}
            onRetry={() => void loadAppointments()}
            emptyMessage="No appointments match this date range and filters."
            className="dashboard-appointments-table"
          />
          {!isLoading && !error && filtered.length > 0 && (
            <nav className="dashboard-pagination" aria-label="Appointment pages">
              <span>Showing {first + 1}–{Math.min(first + PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div>
                <button className="dashboard-table-button management-button" type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
                <span>Page {currentPage} of {pageCount}</span>
                <button className="dashboard-table-button management-button" type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
              </div>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
