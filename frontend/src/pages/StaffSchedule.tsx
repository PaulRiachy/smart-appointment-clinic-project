
import { useCallback, useEffect, useState } from 'react';
import {
  Weekday,
  type IStaffSchedule,
  type IService,
  type IUser,
} from '@app/shared';

import api from '../services/api';
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
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
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

  const loadSchedule = useCallback(async () => {
    if (!selectedStaffId) {
      setSchedule(null);
      return;
    }

    setError('');
    setSuccess('');

    try {
      const response = await api.get(
        `/staff/${selectedStaffId}/schedule`,
      );

      setSchedule(response.data.data as IStaffSchedule);
    } catch (requestError: unknown) {
      setSchedule(null);
      setError(
        getErrorMessage(requestError, 'Unable to load this staff schedule.'),
      );
    }
  }, [selectedStaffId]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    void loadSchedule();
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
    setError('');
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
    } catch (requestError: unknown) {
      setError(
        getErrorMessage(requestError, 'Unable to create the staff account.'),
      );
    } finally {
      setIsCreatingStaff(false);
    }
  }

  const selectedStaff = staff.find(
    (member) => member._id === selectedStaffId,
  );

  return (
    <main className="staff-schedule-page">
      <header className="staff-schedule-header">
        <div>
          <p className="staff-schedule-eyebrow">Administration</p>
          <h1>Staff schedules</h1>
          <p className="staff-schedule-description">
            Manage staff accounts, working hours, days off, and service assignments.
          </p>
        </div>
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

      <section className="staff-schedule-panel">
        <h2>Create a staff account</h2>

        <form
          className="staff-create-form"
          onSubmit={createStaff}
        >
          <label>
            Full name
            <input
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

          <button
            type="submit"
            className="staff-schedule-button staff-schedule-button--primary"
            disabled={isCreatingStaff}
          >
            {isCreatingStaff ? 'Creating…' : 'Create staff'}
          </button>
        </form>
      </section>

      <section className="staff-schedule-panel">
        <div className="staff-schedule-section-header">
          <div>
            <h2>Configure working hours</h2>
            <p>Select a staff member to edit their schedule.</p>
          </div>

          <button
            type="button"
            className="staff-schedule-button staff-schedule-button--secondary"
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
            onChange={(event) =>
              setSelectedStaffId(event.target.value)
            }
            disabled={isLoading || staff.length === 0}
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
        ) : !schedule ? (
          <div className="staff-schedule-state">
            No schedule data is available for {selectedStaff.fullName}.
            <button
              type="button"
              className="staff-schedule-button staff-schedule-button--secondary"
              onClick={() => void loadSchedule()}
            >
              Try loading again
            </button>
          </div>
        ) : (
          <>
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
                className="staff-schedule-button staff-schedule-button--primary"
                onClick={() => void saveSchedule()}
                disabled={isSaving}
              >
                {isSaving ? 'Saving schedule…' : 'Save schedule'}
              </button>
            </footer>
          </>
        )}
      </section>
    </main>
  );
}
