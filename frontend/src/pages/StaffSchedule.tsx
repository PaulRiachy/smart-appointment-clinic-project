
import { useCallback, useEffect, useState } from 'react';
import {
  Weekday,
  type IStaffSchedule,
  type IService,
  type IUser,
} from '@app/shared';

import api from '../services/api';
import AP_Modal from '../components/AP_Modal';
import './styles/StaffSchedule.css';

const WEEKDAYS = [
  { value: Weekday.MONDAY, label: 'Monday' },
  { value: Weekday.TUESDAY, label: 'Tuesday' },
  { value: Weekday.WEDNESDAY, label: 'Wednesday' },
  { value: Weekday.THURSDAY, label: 'Thursday' },
  { value: Weekday.FRIDAY, label: 'Friday' },
  { value: Weekday.SATURDAY, label: 'Saturday' },
  { value: Weekday.SUNDAY, label: 'Sunday' },
];

function createEmptySchedule(staffId: string): IStaffSchedule {
  return {
    _id: '',
    staff: staffId,
    weeklyIntervals: {
      [Weekday.MONDAY]: [],
      [Weekday.TUESDAY]: [],
      [Weekday.WEDNESDAY]: [],
      [Weekday.THURSDAY]: [],
      [Weekday.FRIDAY]: [],
      [Weekday.SATURDAY]: [],
      [Weekday.SUNDAY]: [],
    },
    daysOff: [],
    services: [],
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (
      error as {
        response?: { data?: { message?: string; error?: string } };
      }
    ).response;

    return response?.data?.message ?? response?.data?.error ?? fallback;
  }

  return fallback;
}

export default function StaffSchedule() {
  const [staff, setStaff] = useState<IUser[]>([]);
  const [services, setServices] = useState<IService[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [schedule, setSchedule] = useState<IStaffSchedule | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffFormError, setStaffFormError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [staffForm, setStaffForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
  });

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const [staffResponse, servicesResponse] = await Promise.all([
        api.get('/users/staff'),
        api.get('/services'),
      ]);

      const staffData = staffResponse.data.data;
      const serviceData = servicesResponse.data.data;

      if (!Array.isArray(staffData)) {
        throw new Error('The staff endpoint did not return a list.');
      }

      if (!Array.isArray(serviceData)) {
        throw new Error('The services endpoint did not return a list.');
      }

      setStaff(staffData as IUser[]);
      setServices(serviceData as IService[]);

      if (staffData.length > 0) {
        setSelectedStaffId((current) => current || staffData[0]._id);
      }
    } catch (requestError: unknown) {
      setError(
        getErrorMessage(requestError, 'Unable to load staff and services.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadSchedule = useCallback(async (signal?: AbortSignal) => {
    if (!selectedStaffId) {
      setSchedule(null);
      return;
    }

    setError('');
    setSchedule(null);
    setIsLoadingSchedule(true);

    try {
      const response = await api.get(
        `/staff/${selectedStaffId}/schedule`,
        { signal },
      );

      if (signal?.aborted) return;

      const data = response.data.data as
        | IStaffSchedule
        | { staff: IUser; schedule: null }
        | null;

      setSchedule(
        !data || ('schedule' in data && data.schedule === null)
          ? createEmptySchedule(selectedStaffId)
          : data as IStaffSchedule,
      );
    } catch (requestError: unknown) {
      if (signal?.aborted) return;
      setSchedule(null);
      setError(
        getErrorMessage(requestError, 'Unable to load this staff schedule.'),
      );
    } finally {
      if (!signal?.aborted) setIsLoadingSchedule(false);
    }
  }, [selectedStaffId]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    const controller = new AbortController();
    void loadSchedule(controller.signal);
    return () => controller.abort();
  }, [loadSchedule]);

  function updateInterval(
    weekday: Weekday,
    field: 'from' | 'to',
    value: string,
  ) {
    setSchedule((current) => {
      if (!current) return current;

      const currentIntervals = current.weeklyIntervals[weekday] ?? [];
      const interval = currentIntervals[0] ?? {
        from: '09:00',
        to: '17:00',
      };

      return {
        ...current,
        weeklyIntervals: {
          ...current.weeklyIntervals,
          [weekday]: [{ ...interval, [field]: value }],
        },
      };
    });
  }

  function toggleWorkingDay(weekday: Weekday, isWorking: boolean) {
    setSchedule((current) => {
      if (!current) return current;

      return {
        ...current,
        weeklyIntervals: {
          ...current.weeklyIntervals,
          [weekday]: isWorking
            ? [{ from: '09:00', to: '17:00' }]
            : [],
        },
        daysOff: isWorking
          ? current.daysOff.filter((day) => day !== weekday)
          : current.daysOff,
      };
    });
  }

  function toggleDayOff(weekday: Weekday, checked: boolean) {
    setSchedule((current) => {
      if (!current) return current;

      return {
        ...current,
        daysOff: checked
          ? [...current.daysOff.filter((day) => day !== weekday), weekday]
          : current.daysOff.filter((day) => day !== weekday),
        weeklyIntervals: {
          ...current.weeklyIntervals,
          [weekday]: checked
            ? []
            : current.weeklyIntervals[weekday],
        },
      };
    });
  }

  function toggleService(serviceId: string, checked: boolean) {
    setSchedule((current) => {
      if (!current) return current;

      const currentIds = current.services.map((service) =>
        typeof service === 'string' ? service : service._id,
      );

      return {
        ...current,
        services: checked
          ? [...currentIds, serviceId]
          : currentIds.filter((id) => id !== serviceId),
      };
    });
  }

  async function saveSchedule() {
    if (!selectedStaffId || !schedule || isSaving) return;

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.put(`/staff/${selectedStaffId}/schedule`, {
        weeklyIntervals: schedule.weeklyIntervals,
        daysOff: schedule.daysOff,
        services: schedule.services.map((service) =>
          typeof service === 'string' ? service : service._id,
        ),
      });

      setSuccess('Staff schedule saved successfully.');
      await loadSchedule();
    } catch (requestError: unknown) {
      setError(
        getErrorMessage(requestError, 'Unable to save this schedule.'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function createStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreatingStaff) return;

    setIsCreatingStaff(true);
    setStaffFormError('');
    setSuccess('');

    try {
      const response = await api.post('/users/staff', {
        fullName: staffForm.fullName.trim(),
        email: staffForm.email.trim(),
        phone: staffForm.phone.trim(),
        password: staffForm.password,
      });

      const createdStaff = response.data.data as IUser;

      setStaff((current) => [...current, createdStaff]);
      setSelectedStaffId(createdStaff._id);
      setStaffForm({
        fullName: '',
        email: '',
        phone: '',
        password: '',
      });
      setSuccess('Staff account created successfully.');
      setIsStaffModalOpen(false);
    } catch (requestError: unknown) {
      setStaffFormError(
        getErrorMessage(requestError, 'Unable to create the staff account.'),
      );
    } finally {
      setIsCreatingStaff(false);
    }
  }

  function closeStaffModal() {
    if (isCreatingStaff) return;
    setIsStaffModalOpen(false);
    setStaffFormError('');
    setStaffForm({ fullName: '', email: '', phone: '', password: '' });
  }

  const selectedStaff = staff.find(
    (member) => member._id === selectedStaffId,
  );

  return (
    <main className="staff-schedule-page management-page">
      <header className="staff-schedule-header management-header">
        <div>
          <p className="staff-schedule-eyebrow management-eyebrow">Administration</p>
          <h1>Staff schedules</h1>
          <p className="staff-schedule-description management-description">
            Manage staff accounts, working hours, days off, and service assignments.
          </p>
        </div>
        <button
          type="button"
          className="staff-schedule-button management-button staff-schedule-button--primary management-button--primary"
          onClick={() => {
            setStaffFormError('');
            setIsStaffModalOpen(true);
          }}
        >
          Add staff
        </button>
      </header>

      {error && (
        <div className="staff-schedule-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="staff-schedule-success" role="status">
          {success}
        </div>
      )}

      <section className="staff-schedule-panel management-panel">
        <div className="staff-schedule-section-header">
          <div>
            <h2>Configure working hours</h2>
            <p>Select a staff member to edit their schedule.</p>
          </div>

          <button
            type="button"
            className="staff-schedule-button management-button staff-schedule-button--secondary management-button--secondary"
            onClick={() => void loadInitialData()}
            disabled={isLoading}
          >
            {isLoading ? 'Loading…' : 'Refresh staff'}
          </button>
        </div>

        <label className="staff-select">
          Staff member
          <select
            value={selectedStaffId}
            onChange={(event) => {
              setSchedule(null);
              setSuccess('');
              setSelectedStaffId(event.target.value);
            }}
            disabled={isLoading || isSaving || staff.length === 0}
          >
            {staff.length === 0 && (
              <option value="">No staff accounts available</option>
            )}

            {staff.map((member) => (
              <option key={member._id} value={member._id}>
                {member.fullName} ({member.email})
              </option>
            ))}
          </select>
        </label>

        {isLoading ? (
          <div className="staff-schedule-state">
            Loading staff…
          </div>
        ) : !selectedStaff ? (
          <div className="staff-schedule-state">
            Create or select a staff account to configure its schedule.
          </div>
        ) : isLoadingSchedule ? (
          <div className="staff-schedule-state" role="status">
            Loading schedule…
          </div>
        ) : !schedule ? (
          <div className="staff-schedule-state">
            No schedule data is available for {selectedStaff.fullName}.
            <button
              type="button"
              className="staff-schedule-button management-button staff-schedule-button--secondary management-button--secondary"
              onClick={() => void loadSchedule()}
            >
              Try loading again
            </button>
          </div>
        ) : (
          <>
            {!schedule._id && (
              <div className="staff-schedule-state" role="status">
                No schedule has been configured for {selectedStaff.fullName} yet.
                Set working hours and services below, then save the schedule.
              </div>
            )}
            <div className="staff-weekly-schedule">
              {WEEKDAYS.map(({ value, label }) => {
                const intervals = schedule.weeklyIntervals[value] ?? [];
                const interval = intervals[0];
                const isDayOff = schedule.daysOff.includes(value);
                const isWorking = intervals.length > 0 && !isDayOff;

                return (
                  <article
                    className="staff-day-card"
                    key={value}
                  >
                    <div className="staff-day-card__header">
                      <h3>{label}</h3>

                      <label className="staff-day-toggle">
                        <input
                          type="checkbox"
                          checked={isWorking}
                          onChange={(event) =>
                            toggleWorkingDay(value, event.target.checked)
                          }
                          disabled={isDayOff}
                        />
                        Working
                      </label>
                    </div>

                    <label className="staff-day-off">
                      <input
                        type="checkbox"
                        checked={isDayOff}
                        onChange={(event) =>
                          toggleDayOff(value, event.target.checked)
                        }
                      />
                      Day off
                    </label>

                    {isWorking && interval && (
                      <div className="staff-time-fields">
                        <label>
                          Start
                          <input
                            type="time"
                            value={interval.from}
                            onChange={(event) =>
                              updateInterval(value, 'from', event.target.value)
                            }
                          />
                        </label>

                        <label>
                          End
                          <input
                            type="time"
                            value={interval.to}
                            onChange={(event) =>
                              updateInterval(value, 'to', event.target.value)
                            }
                          />
                        </label>
                      </div>
                    )}

                    {!isWorking && (
                      <p className="staff-day-unavailable">
                        Not available
                      </p>
                    )}
                  </article>
                );
              })}
            </div>

            <section className="staff-services-assignment">
              <h2>Services this staff member can provide</h2>
              <p>
                Select the services that should be available when customers book with this staff member.
              </p>

              {services.filter((service) => service.active).length === 0 ? (
                <p>No active services are available.</p>
              ) : (
                <div className="staff-service-options">
                  {services
                    .filter((service) => service.active)
                    .map((service) => (
                      <label
                        className="staff-service-option"
                        key={service._id}
                      >
                        <input
                          type="checkbox"
                          checked={schedule.services.some(
                            (assigned) =>
                              (typeof assigned === 'string' ? assigned : assigned._id) ===
                              service._id,
                          )}
                          onChange={(event) =>
                            toggleService(
                              service._id,
                              event.target.checked,
                            )
                          }
                        />

                        <span>
                          <strong>{service.name}</strong>
                          <small>
                            {service.duration} minutes ·{' '}
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                            }).format(service.price)}
                          </small>
                        </span>
                      </label>
                    ))}
                </div>
              )}
            </section>

            <footer className="staff-schedule-actions">
              <button
                type="button"
                className="staff-schedule-button management-button staff-schedule-button--primary management-button--primary"
                onClick={() => void saveSchedule()}
                disabled={isSaving}
              >
                {isSaving ? 'Saving schedule…' : 'Save schedule'}
              </button>
            </footer>
          </>
        )}
      </section>
      {isStaffModalOpen && (
        <AP_Modal
          isOpen={isStaffModalOpen}
          title="Create a staff account"
          onClose={closeStaffModal}
          closeOnBackdropClick={!isCreatingStaff}
          className="staff-create-modal"
        >
          <p>Enter the new staff member's contact details and a temporary password.</p>
          {staffFormError && (
            <div className="staff-create-error" role="alert">{staffFormError}</div>
          )}
          <form
            className="staff-create-form"
            onSubmit={createStaff}
          >
            <fieldset className="staff-create-fields" disabled={isCreatingStaff}>
              <label>
                Full name
                <input
                  autoFocus
                  autoComplete="name"
                  required
                  value={staffForm.fullName}
                  onChange={(event) =>
                    setStaffForm((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                  placeholder="Staff member name"
                />
              </label>

              <label>
                Email address
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={staffForm.email}
                  onChange={(event) =>
                    setStaffForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="staff@example.com"
                />
              </label>

              <label>
                Phone number
                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  value={staffForm.phone}
                  onChange={(event) =>
                    setStaffForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="+961 70 123 456"
                />
              </label>

              <label>
                Temporary password
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={staffForm.password}
                  onChange={(event) =>
                    setStaffForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="At least 8 characters"
                />
              </label>

            </fieldset>
            <div className="staff-create-actions">
              <button
                type="button"
                className="staff-schedule-button management-button staff-schedule-button--secondary management-button--secondary"
                onClick={closeStaffModal}
                disabled={isCreatingStaff}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="staff-schedule-button management-button staff-schedule-button--primary management-button--primary"
                disabled={isCreatingStaff}
              >
                {isCreatingStaff ? 'Creating…' : 'Create staff'}
              </button>
            </div>
          </form>
        </AP_Modal>
      )}
    </main>
  );
}
