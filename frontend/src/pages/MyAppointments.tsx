
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppointmentStatus,
  type IAppointment,
  type IService,
  type IUser,
} from '@app/shared';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import AP_DatePicker from '../components/AP_DatePicker';
import AP_Modal from '../components/AP_Modal';
import AP_Button from '../components/AP_Button';
import './styles/AppointmentSlots.css';
import './styles/MyAppointments.css';

type AppointmentView = IAppointment & {
  service: string | IService;
  staff: string | IUser;
};

type Slot = {
  start: string;
  end?: string;
  available: boolean;
};

type ModalMode = 'cancel' | 'reschedule' | null;

const statusLabels: Record<AppointmentStatus, string> = {
  [AppointmentStatus.PENDING]: 'PENDING',
  [AppointmentStatus.CONFIRMED]: 'CONFIRMED',
  [AppointmentStatus.CHECKED_IN]: 'CHECKED_IN',
  [AppointmentStatus.IN_SERVICE]: 'IN_SERVICE',
  [AppointmentStatus.COMPLETED]: 'COMPLETED',
  [AppointmentStatus.CANCELLED]: 'CANCELLED',
  [AppointmentStatus.NO_SHOW]: 'NO_SHOW',
};

function getId(value: string | { _id: string } | undefined): string {
  return typeof value === 'string' ? value : value?._id ?? '';
}

function getServiceName(value: string | IService): string {
  return typeof value === 'string' ? value : value.name;
}

function getStaffName(value: string | IUser): string {
  return typeof value === 'string' ? value : value.fullName;
}

function getServiceDuration(value: string | IService): number | null {
  return typeof value === 'string' ? null : value.duration;
}

function dateInBeirut(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Beirut',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

function formatDate(value: string): string {
  const dateOnly = value.includes('T') ? dateInBeirut(new Date(value)) : value.slice(0, 10);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Beirut',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dateOnly}T12:00:00Z`));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Beirut',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

function getErrorMessage(error: unknown): string {
  const candidate = error as {
    response?: { data?: { message?: string; error?: string } };
    message?: string;
  };

  return (
    candidate.response?.data?.message ??
    candidate.response?.data?.error ??
    candidate.message ??
    'Something went wrong. Please try again.'
  );
}

function canCancel(appointment: AppointmentView): boolean {
  return (
    appointment.status === AppointmentStatus.PENDING ||
    appointment.status === AppointmentStatus.CONFIRMED
  );
}

function canReschedule(appointment: AppointmentView): boolean {
  return (
    appointment.status === AppointmentStatus.PENDING ||
    appointment.status === AppointmentStatus.CONFIRMED
  );
}

export default function MyAppointments() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [appointments, setAppointments] = useState<AppointmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [target, setTarget] = useState<AppointmentView | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(dateInBeirut(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState('');

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/appointments');
      setAppointments(response.data.data as AppointmentView[]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();

    const future = appointments
      .filter(
        (appointment) =>
          new Date(appointment.end).getTime() >= now &&
          appointment.status !== AppointmentStatus.CANCELLED &&
          appointment.status !== AppointmentStatus.COMPLETED &&
          appointment.status !== AppointmentStatus.NO_SHOW,
      )
      .sort(
        (a, b) =>
          new Date(a.start).getTime() - new Date(b.start).getTime(),
      );

    const history = appointments
      .filter(
        (appointment) =>
          !future.some((item) => item._id === appointment._id),
      )
      .sort(
        (a, b) =>
          new Date(b.start).getTime() - new Date(a.start).getTime(),
      );

    return { upcoming: future, past: history };
  }, [appointments]);

  const closeModal = () => {
    if (saving) return;
    setModalMode(null);
    setTarget(null);
    setSlots([]);
    setSelectedSlot(null);
    setError('');
    setSlotsError('');
  };

  const openCancelModal = (appointment: AppointmentView) => {
    setTarget(appointment);
    setModalMode('cancel');
    setError('');
  };

  const openRescheduleModal = (appointment: AppointmentView) => {
    setTarget(appointment);
    setModalMode('reschedule');
    setRescheduleDate(dateInBeirut(new Date()));
    setSlots([]);
    setSelectedSlot(null);
    setError('');
    setSlotsError('');
  };

  useEffect(() => {
    if (modalMode !== 'reschedule' || !target) return;

    const serviceId = getId(target.service);
    const staffId = getId(target.staff);
    const targetStart = target.start;

    if (!serviceId || !staffId || !rescheduleDate) return;

    let cancelled = false;

    async function loadSlots() {
      setLoadingSlots(true);
      setSlotsError('');
      setSlots([]);
      setSelectedSlot(null);

      try {
        const response = await api.get('/appointments/availability', {
          params: {
            serviceId,
            staffId,
            date: rescheduleDate,
          },
        });

        const data = response.data.data as
          | Slot[]
          | { slots: Slot[] };

        const received = Array.isArray(data) ? data : data.slots;

        if (!cancelled) {
          setSlots(
            received
              .filter((slot) => slot.start !== targetStart)
              .map((slot) => ({
                ...slot,
                available: true,
              })),
          );
        }
      } catch (err) {
        if (!cancelled) setSlotsError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }

    void loadSlots();

    return () => {
      cancelled = true;
    };
  }, [modalMode, target, rescheduleDate]);

  const cancelAppointment = async () => {
    if (!target) return;

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await api.patch(
        `/appointments/${target._id}/cancel`,
      );

      const updated = response.data.data as AppointmentView;

      setAppointments((current) =>
        current.map((appointment) =>
          appointment._id === target._id
            ? { ...appointment, ...updated }
            : appointment,
        ),
      );

      setNotice(`Appointment ${target.reference} was cancelled.`);
      closeModal();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const rescheduleAppointment = async () => {
    if (!target || !selectedSlot?.available) return;

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await api.patch(
        `/appointments/${target._id}/reschedule`,
        { start: selectedSlot.start },
      );

      const updated = response.data.data as AppointmentView;

      setAppointments((current) =>
        current.map((appointment) =>
          appointment._id === target._id
            ? { ...appointment, ...updated }
            : appointment,
        ),
      );

      setNotice(`Appointment ${target.reference} was rescheduled.`);
      closeModal();
    } catch (err) {
      setError(
        `${getErrorMessage(err)} Your original appointment has not been changed unless the server confirms otherwise.`,
      );
      await loadAppointments();
    } finally {
      setSaving(false);
    }
  };

  const renderAppointment = (appointment: AppointmentView) => {
    const statusClass = appointment.status.toLowerCase();

    return (
      <article className="appointment-card" key={appointment._id}>
        <div className="appointment-card-header">
          <div>
            <p className="eyebrow">{formatDate(appointment.start)}</p>
            <h3>{getServiceName(appointment.service)}</h3>
          </div>
          <span className={`status-pill ${statusClass}`}>
            {statusLabels[appointment.status]}
          </span>
        </div>

        <p className="appointment-time">
          {formatTime(appointment.start)} – {formatTime(appointment.end)}
          {getServiceDuration(appointment.service) !== null && (
            <> · {getServiceDuration(appointment.service)} minutes</>
          )}
        </p>

        <p>
          <strong>Practitioner:</strong> {getStaffName(appointment.staff)}
        </p>
        <p className="appointment-reference">
          <strong>Reference:</strong> {appointment.reference}
        </p>

        {(canCancel(appointment) || canReschedule(appointment)) && (
          <div className="form-actions">
            {canReschedule(appointment) && (
              <button
                className="secondary-button"
                type="button"
                onClick={() => openRescheduleModal(appointment)}
              >
                Reschedule
              </button>
            )}
            {canCancel(appointment) && (
              <button
                className="danger-button"
                type="button"
                onClick={() => openCancelModal(appointment)}
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </article>
    );
  };

  return (
    <main className="customer-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">CUSTOMER PORTAL</p>
          <h1>My appointments</h1>
          <p>
            {user?.fullName
              ? `Bookings for ${user.fullName}`
              : 'View and manage your bookings'}
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => navigate('/book')}
        >
          Book appointment
        </button>
      </header>

      {error && (
        <div className="error-message" role="alert">
          {error}
          <button type="button" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <div className="success-message" role="status">
          {notice}
          <button type="button" onClick={() => setNotice('')}>
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <p role="status">Loading your appointments…</p>
      ) : appointments.length === 0 ? (
        <section className="panel empty-state">
          <h2>No appointments yet</h2>
          <p>Book an appointment to see your reservation details here.</p>
          <button
          className="primary-button"
          type="button"
          onClick={() => navigate('/book')}
          >
          Book appointment
        </button>
        </section>
      ) : (
        <>
          <section className="appointment-section">
            <h2>Upcoming <span>({upcoming.length})</span></h2>
            {upcoming.length === 0 ? (
              <div className="panel">
                <p>You have no upcoming appointments.</p>
              </div>
            ) : (
              <div className="appointment-list">
                {upcoming.map(renderAppointment)}
              </div>
            )}
          </section>

          <section className="appointment-section">
            <h2>Past <span>({past.length})</span></h2>
            {past.length === 0 ? (
              <div className="panel">
                <p>Your appointment history will appear here.</p>
              </div>
            ) : (
              <div className="appointment-list">
                {past.map(renderAppointment)}
              </div>
            )}
          </section>
        </>
      )}

      <AP_Modal
        isOpen={modalMode === 'cancel'}
        title="Cancel this appointment?"
        onClose={closeModal}
        closeOnBackdropClick={!saving}
      >
        {target && modalMode === 'cancel' && (
          <div>
            <p>
              Cancel <strong>{getServiceName(target.service)}</strong> with{' '}
              <strong>{getStaffName(target.staff)}</strong>?
            </p>
            <p>
              {formatDate(target.start)} at {formatTime(target.start)}.
            </p>
            <p>The clinic may send you a cancellation notification.</p>

            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={closeModal}
                disabled={saving}
              >
                Keep appointment
              </button>
              <AP_Button
                onClick={cancelAppointment}
                disabled={saving}
              >
                {saving ? 'Cancelling…' : 'Cancel appointment'}
              </AP_Button>
            </div>
          </div>
        )}
      </AP_Modal>

      <AP_Modal
        isOpen={modalMode === 'reschedule'}
        title="Choose a new time"
        onClose={closeModal}
        closeOnBackdropClick={!saving}
      >
        {target && modalMode === 'reschedule' && (
          <div>
            <p>
              Reschedule <strong>{getServiceName(target.service)}</strong> with{' '}
              <strong>{getStaffName(target.staff)}</strong>.
            </p>
            <p>
              Your current appointment remains in place until the server
              accepts the new time.
            </p>

            <label className="field-label" htmlFor="reschedule-date">
              New appointment date
            </label>
            <AP_DatePicker
              value={rescheduleDate}
              minDate={dateInBeirut(new Date())}
              onChange={(value: string) => {
                if (value === rescheduleDate) return;
                setRescheduleDate(value);
                setSelectedSlot(null);
                setSlots([]);
                setSlotsError('');
              }}
            />
            <p className="reschedule-selected-date">{formatDate(rescheduleDate)}</p>
            <p className="muted">All appointment times are shown in Asia/Beirut.</p>
            <div className="slot-legend" aria-label="Time slot legend">
              <span className="slot-legend-item"><span className="slot-legend-dot slot-legend-dot-available" aria-hidden="true" /> Available times</span>
            </div>

            {loadingSlots && <p role="status">Loading available times…</p>}
            {slotsError && <div className="error-message" role="alert">{slotsError}</div>}
            {!loadingSlots && !slotsError && slots.length === 0 && (
              <p>No available times were returned for this date. Try another date.</p>
            )}
            {!loadingSlots && (
              <div className="slot-grid">
                {slots.map((slot) => (
                  <button
                    type="button"
                    key={slot.start}
                    disabled={!slot.available || saving}
                    className={[
                      'slot',
                      slot.available ? 'free' : 'unavailable',
                      selectedSlot?.start === slot.start ? 'selected' : '',
                    ].join(' ')}
                    onClick={() => setSelectedSlot(slot)}
                    aria-pressed={selectedSlot?.start === slot.start}
                  >
                    <strong>{formatTime(slot.start)}</strong>
                    <span>– {formatTime(slot.end ?? new Date(new Date(slot.start).getTime() + (getServiceDuration(target.service) ?? 0) * 60_000).toISOString())}</span>
                    <small>
                      Available
                    </small>
                  </button>
                ))}
              </div>
            )}

            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={closeModal}
                disabled={saving}
              >
                Keep current time
              </button>
              <AP_Button
                onClick={rescheduleAppointment}
                disabled={!selectedSlot?.available || saving || loadingSlots}
              >
                {saving ? 'Saving…' : 'Confirm new time'}
              </AP_Button>
            </div>
          </div>
        )}
      </AP_Modal>
    </main>
  );
}
