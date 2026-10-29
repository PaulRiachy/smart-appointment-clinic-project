
import './styles/Customer.css';
import './styles/BookAppointment.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppointmentStatus,
  type IAppointment,
  type IStaffSchedule,
  type IService,
  type IUser,
} from '@app/shared';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import AP_DatePicker from '../components/AP_DatePicker';
import AP_Button from '../components/AP_Button';
import './styles/AppointmentSlots.css';

type Slot = {
  start: string;
  end?: string;
  available: boolean;
};

type BookingResult = IAppointment & {
  service?: IService | string;
  staff?: IUser | string;
  reference: string;
};

type StaffOption = {
  user: IUser;
  schedule: IStaffSchedule;
};

function getId(value: string | { _id: string } | undefined): string {
  return typeof value === 'string' ? value : value?._id ?? '';
}

function getName(value: string | IUser | undefined): string {
  return typeof value === 'string' || !value
    ? value ?? 'Unknown'
    : value.fullName;
}

function getService(value: string | IService | undefined): string {
  return typeof value === 'string' || !value
    ? value ?? 'Unknown service'
    : value.name;
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

function formatDate(date: string): string {
  const dateOnly = date.includes('T') ? dateInBeirut(new Date(date)) : date.slice(0, 10);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Beirut',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
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

function calculateEnd(start: string, duration: number): string {
  return new Date(new Date(start).getTime() + duration * 60_000).toISOString();
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

export default function BookAppointment() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [services, setServices] = useState<IService[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [selectedDate, setSelectedDate] = useState(dateInBeirut(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedService = useMemo(
    () => services.find((service) => service._id === serviceId),
    [services, serviceId],
  );

  const selectedStaff = useMemo(
    () => staffOptions.find((option) => option.user._id === staffId)?.user,
    [staffOptions, staffId],
  );

  const loadServices = useCallback(async () => {
    setLoadingServices(true);
    setError('');

    try {
      const response = await api.get('/services');
      const data = response.data.data as IService[];
      setServices(data.filter((service) => service.active));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingServices(false);
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  useEffect(() => {
    if (!serviceId) {
      setStaffOptions([]);
      setStaffId('');
      setLoadingStaff(false);
      return;
    }

    let cancelled = false;

    async function loadQualifiedStaff() {
      setLoadingStaff(true);
      setError('');
      setStaffOptions([]);
      setStaffId('');
      setSelectedSlot(null);
      setSlots([]);

      try {
        const response = await api.get('/users/staff');
        const staff = response.data.data as IUser[];

        const schedules = await Promise.all(
          staff.map(async (person) => {
            try {
              const scheduleResponse = await api.get(
                `/staff/${person._id}/schedule`,
              );
              return {
                user: person,
                schedule: scheduleResponse.data.data as IStaffSchedule,
              };
            } catch {
              return null;
            }
          }),
        );

        const qualified = schedules.filter(
          (option): option is StaffOption =>
            option !== null &&
            (option.schedule.services ?? []).some(
              (service) => getId(service) === serviceId,
            ),
        );

        if (!cancelled) {
          setStaffOptions(qualified);
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoadingStaff(false);
      }
    }

    void loadQualifiedStaff();

    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  useEffect(() => {
    if (!serviceId || !staffId || !selectedDate) {
      setSlots([]);
      setSelectedSlot(null);
      setLoadingSlots(false);
      return;
    }

    let cancelled = false;

    async function loadAvailability() {
      setLoadingSlots(true);
      setError('');
      setSelectedSlot(null);
      setSlots([]);

      try {
        const response = await api.get('/appointments/availability', {
          params: { serviceId, staffId, date: selectedDate },
        });

        const data = response.data.data as
          | Slot[]
          | { slots: Slot[] };

        const receivedSlots = Array.isArray(data) ? data : data.slots;

        if (!cancelled) {
          setSlots(
            receivedSlots.map((slot) => ({
              ...slot,
              available: true,
            })),
          );
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }

    void loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [serviceId, staffId, selectedDate]);

  const goToStep = (nextStep: number) => {
    setError('');
    setStep(nextStep);
  };

  const startAnotherBooking = () => {
    setStep(1);
    setServiceId('');
    setStaffId('');
    setSelectedDate(dateInBeirut(new Date()));
    setSelectedSlot(null);
    setSlots([]);
    setBooking(null);
    setError('');
    setSubmitting(false);
  };

  const confirmBooking = async () => {
    if (submitting) return;
    if (!selectedService || !selectedStaff || !selectedSlot?.available || loadingSlots) {
      setError('Please choose a service, practitioner, and available slot.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await api.post('/appointments', {
        service: selectedService._id,
        serviceId: selectedService._id,
        staff: selectedStaff._id,
        staffId: selectedStaff._id,
        start: selectedSlot.start,
      });

      const created = response.data.data as BookingResult;
      setBooking(created);
      setStep(5);
    } catch (err) {
      setError(
        `${getErrorMessage(err)} Please refresh availability and select another slot if necessary.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="customer-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">CUSTOMER PORTAL</p>
          <h1>Book an appointment</h1>
          <p>Choose a service, practitioner, date, and available time.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => navigate('/my-appointments')}
        >
          My appointments
        </button>
      </header>

      {step < 5 && (
        <nav className="booking-steps" aria-label="Booking progress">
          {['Service', 'Practitioner', 'Date & time', 'Confirmation'].map(
            (label, index) => (
              <button
                type="button"
                key={label}
                className={step === index + 1 ? 'step active' : 'step'}
                onClick={() => {
                  if (index + 1 < step) goToStep(index + 1);
                }}
                disabled={index + 1 >= step}
              >
                <span>{index + 1}</span> {label}
              </button>
            ),
          )}
        </nav>
      )}

      {error && (
        <div className="error-message" role="alert">
          {error}
          <button type="button" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}

      {loadingServices && step === 1 && <p role="status">Loading services…</p>}
      {loadingStaff && step === 2 && <p role="status">Loading practitioners…</p>}

      {step === 1 && (
        <section className="panel">
          <h2>1. Choose a service</h2>
          {services.length === 0 ? (
            <p>No active services are currently available.</p>
          ) : (
            <div className="choice-grid">
              {services.map((service) => (
                <button
                  type="button"
                  key={service._id}
                  className={
                    serviceId === service._id
                      ? 'choice-card selected'
                      : 'choice-card'
                  }
                  onClick={() => {
                    setServiceId(service._id);
                    setSelectedSlot(null);
                  }}
                >
                  <strong>{service.name}</strong>
                  <span>{service.description}</span>
                  <span>{service.duration} minutes</span>
                  <strong>${service.price.toFixed(2)}</strong>
                </button>
              ))}
            </div>
          )}
          <div className="form-actions">
            <AP_Button
              onClick={() => goToStep(2)}
              disabled={!serviceId || services.length === 0}
            >
              Continue
            </AP_Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="panel">
          <h2>2. Choose a practitioner</h2>
          {selectedService && (
            <p>
              Selected service: <strong>{selectedService.name}</strong>
            </p>
          )}

          {staffOptions.length === 0 ? (
            <p>No qualified practitioners were found for this service.</p>
          ) : (
            <div className="choice-grid">
              {staffOptions.map(({ user: person }) => (
                <button
                  type="button"
                  key={person._id}
                  className={
                    staffId === person._id
                      ? 'choice-card selected'
                      : 'choice-card'
                  }
                  onClick={() => setStaffId(person._id)}
                >
                  <strong>{person.fullName}</strong>
                  <span>{person.email}</span>
                </button>
              ))}
            </div>
          )}

          <div className="form-actions">
            <button
              className="secondary-button"
              onClick={() => goToStep(1)}
              type="button"
            >
              Back
            </button>
            <AP_Button
              onClick={() => goToStep(3)}
              disabled={!staffId || loadingStaff}
            >
              Continue
            </AP_Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="panel">
          <h2>3. Choose a date and time</h2>
          <p>All appointment times are shown in Asia/Beirut.</p>

          <label className="field-label" htmlFor="booking-date">
            Appointment date
          </label>
          <AP_DatePicker
            value={selectedDate}
            minDate={dateInBeirut(new Date())}
            onChange={(value: string) => {
              setSelectedDate(value);
              setSelectedSlot(null);
            }}
          />

          <p>{formatDate(selectedDate)}</p>

          {loadingSlots && <p role="status">Loading available times…</p>}

          <div className="slot-legend" aria-label="Time slot legend">
            <span className="slot-legend-item"><span className="slot-legend-dot slot-legend-dot-available" aria-hidden="true" /> Available times</span>
          </div>

          {!loadingSlots && slots.length === 0 && (
            <p>No time slots were returned for this date. Try another date. </p>
          )}

          <div className="slot-grid">
            {slots.map((slot) => {
              const end =
                slot.end ??
                (selectedService
                  ? calculateEnd(slot.start, selectedService.duration)
                  : slot.start);

              return (
                <button
                  key={slot.start}
                  type="button"
                  disabled={!slot.available}
                  className={[
                    'slot',
                    slot.available ? 'free' : 'unavailable',
                    selectedSlot?.start === slot.start ? 'selected' : '',
                  ].join(' ')}
                  onClick={() => setSelectedSlot(slot)}
                  aria-pressed={selectedSlot?.start === slot.start}
                >
                  <strong>{formatTime(slot.start)}</strong>
                  <span>– {formatTime(end)}</span>
                  <small>
                    Available
                  </small>
                </button>
              );
            })}
          </div>

          <div className="form-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => goToStep(2)}
            >
              Back
            </button>
            <AP_Button
              onClick={() => goToStep(4)}
              disabled={!selectedSlot?.available || loadingSlots}
            >
              Review booking
            </AP_Button>
          </div>
        </section>
      )}

      {step === 4 && selectedService && selectedStaff && (
        <section className="panel">
          <h2>4. Confirm your booking</h2>
          <div className="summary-card">
            <dl>
              <dt>Service</dt>
              <dd>{selectedService.name}</dd>

              <dt>Duration</dt>
              <dd>{selectedService.duration} minutes</dd>

              <dt>Practitioner</dt>
              <dd>{selectedStaff.fullName}</dd>

              <dt>Date</dt>
              <dd>{formatDate(selectedDate)}</dd>

              <dt>Time</dt>
              <dd>
                {selectedSlot && formatTime(selectedSlot.start)} –{' '}
                {selectedSlot &&
                  formatTime(
                    selectedSlot.end ??
                      calculateEnd(
                        selectedSlot.start,
                        selectedService.duration,
                      ),
                  )}
              </dd>

              <dt>Price</dt>
              <dd>${selectedService.price.toFixed(2)}</dd>
            </dl>
          </div>
          <p>
            Your selected time is checked again by the server when you confirm.
          </p>
          <div className="form-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => goToStep(3)}
            >
              Change time
            </button>
            <AP_Button
              onClick={confirmBooking}
              disabled={submitting}
            >
              {submitting ? 'Booking…' : 'Confirm Booking'}
            </AP_Button>
          </div>
        </section>
      )}

      {step === 5 && booking && selectedService && selectedStaff && (
        <section className="panel success-panel" aria-live="polite">
          <div className="success-icon" aria-hidden="true">
            ✓
          </div>
          <h2>Booking received</h2>
          <p>
            Your appointment request has been submitted. The clinic will
            confirm it according to its booking process.
          </p>

          <div className="reference-card">
            <span>Booking reference </span>
            <strong>{booking.reference}</strong>
            <small> Keep this reference for your visit.</small>
          </div>

          <div className="summary-card">
            <dl>
              <dt>Service</dt>
              <dd>{getService(booking.service) || selectedService.name}</dd>

              <dt>Practitioner</dt>
              <dd>{getName(booking.staff) || selectedStaff.fullName}</dd>

              <dt>Date</dt>
              <dd>{formatDate(dateInBeirut(new Date(booking.start)))}</dd>

              <dt>Time</dt>
              <dd>
                {formatTime(booking.start)} – {formatTime(booking.end)}
              </dd>

              <dt>Status</dt>
              <dd>
                <span className="status-pill pending">
                  {booking.status ?? AppointmentStatus.PENDING}
                </span>
              </dd>

              <dt>Price</dt>
              <dd>${selectedService.price.toFixed(2)}</dd>
            </dl>
          </div>

          <div className="form-actions">
            <AP_Button
              onClick={() => navigate('/my-appointments')}
            >
              View My Appointments
            </AP_Button>
            <button
              type="button"
              className="secondary-button"
              onClick={startAnotherBooking}
            >
              Book another appointment
            </button>
          </div>
        </section>
      )}

      {!user && (
        <p className="muted">
          Sign in with a customer account before confirming your booking.
        </p>
      )}
    </main>
  );
}
