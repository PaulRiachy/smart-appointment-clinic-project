
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppointmentStatus,
  type IAppointment,
  type IService,
  type IUser,
} from '@app/shared';

import api from '../services/api';
import AP_Modal from '../components/AP_Modal';
import AP_DatePicker from '../components/AP_DatePicker';
import './styles/Appointments.css';

type SortOrder = 'earliest' | 'latest';
type AppointmentAction = 'confirm' | 'cancel' | 'reschedule';

type AvailableSlot = { start: string; end: string };

function dateInBeirut(value: string | number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Beirut',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function getId(value: string | { _id: string }): string {
  return typeof value === 'string' ? value : value._id;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Beirut', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(value));
}

function getPersonName(value: string | IUser | undefined): string {
  if (!value) return '—';

  return typeof value === 'string' ? value : value.fullName;
}

function getServiceName(value: string | IService | undefined): string {
  if (!value) return '—';

  return typeof value === 'string' ? value : value.name;
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Beirut',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const response = (
      error as {
        response?: {
          data?: {
            message?: string;
            error?: string;
          };
        };
      }
    ).response;

    return (
      response?.data?.message ??
      response?.data?.error ??
      fallback
    );
  }

  return fallback;
}

export default function Appointments() {
  const [appointments, setAppointments] = useState<IAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [pageError, setPageError] = useState('');
  const [actionError, setActionError] = useState('');

  const [sortOrder, setSortOrder] = useState<SortOrder>('earliest');
  const [selectedAppointment, setSelectedAppointment] =
    useState<IAppointment | null>(null);
  const [pendingAction, setPendingAction] =
    useState<AppointmentAction | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState('');

  const loadAppointments = useCallback(async () => {
    setIsLoading(true);
    setPageError('');

    try {
      const response = await api.get('/appointments');
      const data = response.data.data;

      if (!Array.isArray(data)) {
        throw new Error(
          'The appointments endpoint did not return an array.',
        );
      }

      setAppointments(data as IAppointment[]);
    } catch (error: unknown) {
      setPageError(
        getErrorMessage(error, 'Unable to load appointments.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    if (pendingAction !== 'reschedule' || !selectedAppointment) return;

    const appointment = selectedAppointment;
    let cancelled = false;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot(null);
    setSlotsError('');

    async function loadSlots() {
      try {
        const response = await api.get('/appointments/availability', {
          params: {
            serviceId: getId(appointment.service),
            staffId: getId(appointment.staff),
            date: rescheduleDate,
          },
        });
        const data = response.data.data as { slots: AvailableSlot[] };
        if (!cancelled) {
          setSlots(data.slots.filter((slot) =>
            new Date(slot.start).getTime() > Date.now() &&
            new Date(slot.start).getTime() !== new Date(appointment.start).getTime(),
          ));
        }
      } catch (error: unknown) {
        if (!cancelled) setSlotsError(getErrorMessage(error, 'Unable to load available times.'));
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }

    void loadSlots();
    return () => { cancelled = true; };
  }, [pendingAction, selectedAppointment, rescheduleDate]);

  const pendingAppointments = useMemo(() => {
    return appointments
      .filter(
        (appointment) =>
          appointment.status === AppointmentStatus.PENDING,
      )
      .sort((first, second) => {
        const firstTime = new Date(first.start).getTime();
        const secondTime = new Date(second.start).getTime();

        return sortOrder === 'earliest'
          ? firstTime - secondTime
          : secondTime - firstTime;
      });
  }, [appointments, sortOrder]);

  function openAction(
    appointment: IAppointment,
    action: AppointmentAction,
  ) {
    setSelectedAppointment(appointment);
    setPendingAction(action);
    setActionError('');
    setRescheduleDate(
      dateInBeirut(Math.max(new Date(appointment.start).getTime(), Date.now())),
    );
    setSlots([]);
    setSelectedSlot(null);
    setSlotsError('');
    setLoadingSlots(action === 'reschedule');
  }

  function closeAction() {
    if (isSaving) return;

    setSelectedAppointment(null);
    setPendingAction(null);
    setActionError('');
  }

  async function submitAction() {
    if (!selectedAppointment || !pendingAction || isSaving) {
      return;
    }
    if (pendingAction === 'reschedule' && (!selectedSlot || loadingSlots || slotsError)) return;

    setIsSaving(true);
    setActionError('');

    try {
      const endpoint = `/appointments/${selectedAppointment._id}/${pendingAction}`;

      const response = await api.patch(
        endpoint,
        pendingAction === 'reschedule' ? { start: selectedSlot!.start } : undefined,
      );
      const updatedAppointment = response.data.data as
        | IAppointment
        | undefined;

      setAppointments((currentAppointments) =>
        currentAppointments.map((appointment) => {
          if (appointment._id !== selectedAppointment._id) {
            return appointment;
          }

          if (
            updatedAppointment &&
            updatedAppointment._id === selectedAppointment._id
          ) {
            return {
              ...appointment,
              ...updatedAppointment,
              customer: appointment.customer,
              service: appointment.service,
              staff: appointment.staff,
            };
          }

          return {
            ...appointment,
            ...(pendingAction === 'reschedule' && selectedSlot
              ? { start: selectedSlot.start, end: selectedSlot.end }
              : {}),
            status:
              pendingAction === 'confirm'
                ? AppointmentStatus.CONFIRMED
                : pendingAction === 'cancel'
                  ? AppointmentStatus.CANCELLED
                  : appointment.status,
          };
        }),
      );

      setSelectedAppointment(null);
      setPendingAction(null);
    } catch (error: unknown) {
      setActionError(
        getErrorMessage(
          error,
          'Unable to update this appointment. Please try again.',
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  const modalTitle =
    pendingAction === 'reschedule'
      ? 'Reschedule appointment'
      : pendingAction === 'confirm'
      ? 'Confirm appointment'
      : 'Cancel appointment';

  const modalActionLabel =
    pendingAction === 'reschedule'
      ? 'Confirm new time'
      : pendingAction === 'confirm'
      ? 'Confirm booking'
      : 'Cancel booking';

  return (
    <main className="appointments-page management-page">
      <header className="appointments-page__header management-header">
        <div>
          <p className="appointments-page__eyebrow management-eyebrow">
            Appointment management
          </p>

          <h1>Pending appointments</h1>

          <p className="appointments-page__description management-description">
            Review booking requests, sort them by appointment time,
            and confirm, reschedule or cancel each request.
          </p>
        </div>

        <button
          className="appointments-button management-button appointments-button--secondary management-button--secondary"
          type="button"
          onClick={() => void loadAppointments()}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <section
        className="appointments-toolbar management-panel"
        aria-label="Appointment list controls"
      >
        <div>
          <span className="appointments-toolbar__count">
            {pendingAppointments.length}
          </span>

          <span className="appointments-toolbar__label">
            {pendingAppointments.length === 1
              ? 'pending request'
              : 'pending requests'}
          </span>
        </div>

        <label className="appointments-sort">
          <span>Sort by appointment time</span>

          <select
            value={sortOrder}
            onChange={(event) =>
              setSortOrder(event.target.value as SortOrder)
            }
          >
            <option value="earliest">Earliest first</option>
            <option value="latest">Latest first</option>
          </select>
        </label>
      </section>

      {pageError && (
        <div className="appointments-alert" role="alert">
          <span>{pageError}</span>

          <button
            type="button"
            onClick={() => void loadAppointments()}
          >
            Try again
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="appointments-state">
          Loading appointments…
        </div>
      ) : !pageError && pendingAppointments.length === 0 ? (
        <div className="appointments-state appointments-state--empty">
          <span
            className="appointments-state__icon"
            aria-hidden="true"
          >
            ✓
          </span>

          <h2>All caught up</h2>

          <p>There are no pending appointment requests right now.</p>
        </div>
      ) : !pageError ? (
        <div className="appointments-list">
          {pendingAppointments.map((appointment) => (
            <article
              className="appointment-card management-panel"
              key={appointment._id}
            >
              <div className="appointment-card__main">
                <div className="appointment-card__time">
                  <span className="appointment-card__date">
                    {formatDateTime(appointment.start)}
                  </span>

                  <span className="appointment-card__duration">
                    Ends {formatDateTime(appointment.end)}
                  </span>
                </div>

                <div className="appointment-card__details">
                  <h2>
                    {getPersonName(appointment.customer)}
                  </h2>

                  <p>
                    {getServiceName(appointment.service)}
                  </p>

                  <div className="appointment-card__meta">
                    <span>
                      Ref: {appointment.reference || appointment._id}
                    </span>

                    <span>
                      Staff: {getPersonName(appointment.staff)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="appointment-card__actions">
                <button
                  type="button"
                  className="appointments-button management-button appointments-button--secondary management-button--secondary"
                  onClick={() => openAction(appointment, 'reschedule')}
                >
                  Reschedule
                </button>
                <button
                  type="button"
                  className="appointments-button management-button appointments-button--primary management-button--primary"
                  onClick={() =>
                    openAction(appointment, 'confirm')
                  }
                >
                  Confirm
                </button>

                <button
                  type="button"
                  className="appointments-button management-button appointments-button--danger management-button--danger"
                  onClick={() =>
                    openAction(appointment, 'cancel')
                  }
                >
                  Cancel
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <AP_Modal
        isOpen={Boolean(selectedAppointment && pendingAction)}
        onClose={closeAction}
        title={modalTitle}
        closeOnBackdropClick={!isSaving}
        actions={[
          {
            label: 'Back',
            variant: 'secondary',
            onClick: closeAction,
            disabled: isSaving,
          },
          {
            label: modalActionLabel,
            variant:
              pendingAction === 'cancel' ? 'danger' : 'primary',
            onClick: submitAction,
            isLoading: isSaving,
            disabled: !selectedAppointment || !pendingAction ||
              (pendingAction === 'reschedule' && (!selectedSlot || loadingSlots || Boolean(slotsError))),
          },
        ]}
      >
        <div className="appointment-confirmation">
          <p>
            {pendingAction === 'reschedule'
              ? `Choose an available time with ${getPersonName(selectedAppointment?.staff)}.`
              : pendingAction === 'confirm'
              ? 'Confirm this booking? The appointment will be marked as confirmed.'
              : 'Cancel this booking? The pending appointment will be marked as cancelled.'}
          </p>

          {selectedAppointment && (
            <dl>
              <div>
                <dt>Customer</dt>
                <dd>
                  {getPersonName(selectedAppointment.customer)}
                </dd>
              </div>

              <div>
                <dt>Service</dt>
                <dd>
                  {getServiceName(selectedAppointment.service)}
                </dd>
              </div>

              <div>
                <dt>Appointment time</dt>
                <dd>
                  {formatDateTime(selectedAppointment.start)}
                </dd>
              </div>

              <div>
                <dt>Reference</dt>
                <dd>
                  {selectedAppointment.reference ||
                    selectedAppointment._id}
                </dd>
              </div>
            </dl>
          )}

          {pendingAction === 'reschedule' && (
            <div className="appointment-reschedule">
              <AP_DatePicker
                label="New appointment date"
                value={rescheduleDate}
                minDate={dateInBeirut(Date.now())}
                disabled={isSaving}
                onChange={(date) => {
                  if (date === rescheduleDate) return;
                  setRescheduleDate(date);
                  setSelectedSlot(null);
                  setSlots([]);
                  setLoadingSlots(true);
                  setActionError('');
                }}
              />
              <p>All times are shown in Asia/Beirut.</p>
              {loadingSlots ? (
                <p role="status">Loading available times…</p>
              ) : slotsError ? (
                <p className="appointments-alert appointments-alert--modal" role="alert">{slotsError}</p>
              ) : slots.length === 0 ? (
                <p>No available times for this date. Try another date.</p>
              ) : (
                <div className="appointment-reschedule__slots" aria-label="Available times">
                  {slots.map((slot) => (
                    <button
                      key={slot.start}
                      type="button"
                      className={`appointments-button appointments-button--${selectedSlot?.start === slot.start ? 'primary' : 'secondary'}`}
                      disabled={isSaving}
                      aria-pressed={selectedSlot?.start === slot.start}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {formatTime(slot.start)} – {formatTime(slot.end)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {actionError && (
            <p
              className="appointments-alert appointments-alert--modal"
              role="alert"
            >
              {actionError}
            </p>
          )}
        </div>
      </AP_Modal>
    </main>
  );
}
