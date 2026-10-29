import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import DashboardAppointments, { appointmentDate } from '../components/DashboardAppointments';
import './styles/Dashboard.css';

interface DashboardMetrics {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  waitingNow: number;
  estimatedRevenue: number;
}

interface DashboardChartItem {
  date: string;
  total: number;
  completed: number;
}

interface DashboardResponse {
  dateRange: {
    startDate: string;
    endDate: string;
  };
  metrics: DashboardMetrics;
  chart: DashboardChartItem[];
}

function getErrorMessage(error: unknown): string {
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
          };
        };
      }
    ).response;

    if (response?.data?.message) {
      return response.data.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Unable to load dashboard statistics.';
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDashboardResponse(
  value: unknown,
): DashboardResponse {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    throw new Error(
      'Dashboard returned an invalid response.',
    );
  }

  const data = value as {
    dateRange?: {
      startDate?: unknown;
      endDate?: unknown;
    };
    metrics?: {
      totalAppointments?: unknown;
      completedAppointments?: unknown;
      cancelledAppointments?: unknown;
      noShowAppointments?: unknown;
      waitingNow?: unknown;
      estimatedRevenue?: unknown;
    };
    chart?: unknown;
  };

  const metrics = data.metrics;

  if (!metrics) {
    throw new Error(
      'Dashboard response is missing metrics.',
    );
  }

  const chart = Array.isArray(data.chart)
    ? data.chart
        .filter(
          (item): item is Record<string, unknown> =>
            typeof item === 'object' &&
            item !== null,
        )
        .map((item) => ({
          date:
            typeof item.date === 'string'
              ? item.date
              : '',
          total: toNumber(item.total),
          completed: toNumber(item.completed),
        }))
        .filter((item) => item.date.length > 0)
    : [];

  return {
    dateRange: {
      startDate:
        typeof data.dateRange?.startDate === 'string'
          ? data.dateRange.startDate
          : '',
      endDate:
        typeof data.dateRange?.endDate === 'string'
          ? data.dateRange.endDate
          : '',
    },
    metrics: {
      totalAppointments: toNumber(
        metrics.totalAppointments,
      ),
      completedAppointments: toNumber(
        metrics.completedAppointments,
      ),
      cancelledAppointments: toNumber(
        metrics.cancelledAppointments,
      ),
      noShowAppointments: toNumber(
        metrics.noShowAppointments,
      ),
      waitingNow: toNumber(metrics.waitingNow),
      estimatedRevenue: toNumber(
        metrics.estimatedRevenue,
      ),
    },
    chart,
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function getDateString(date: Date): string {
  return appointmentDate(date.toISOString());
}

function getDefaultRange(): {
  startDate: string;
  endDate: string;
} {
  const end = new Date();
  const start = new Date();

  start.setDate(end.getDate() - 6);

  return {
    startDate: getDateString(start),
    endDate: getDateString(end),
  };
}

function formatChartDate(value: string): string {
  const date = new Date(
    `${value}T12:00:00+03:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Beirut',
    day: '2-digit',
    month: 'short',
  }).format(date);
}

export default function Dashboard() {
  const [dateRange, setDateRange] =
    useState(getDefaultRange);

  const [dashboard, setDashboard] =
    useState<DashboardResponse | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] = useState('');

  const loadStats = useCallback(async (signal?: AbortSignal) => {
    if (!dateRange.startDate || !dateRange.endDate || dateRange.startDate > dateRange.endDate) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const response = await api.get(
        '/dashboard/stats',
        {
          signal,
          params: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            timezone: 'Asia/Beirut',
          },
        },
      );

      const data = normalizeDashboardResponse(
        response.data.data,
      );

      if (!signal?.aborted) setDashboard(data);
    } catch (requestError: unknown) {
      if (signal?.aborted) return;
      console.error(
        'Failed to load dashboard:',
        requestError,
      );

      setError(
        getErrorMessage(requestError),
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    const controller = new AbortController();
    void loadStats(controller.signal);
    return () => controller.abort();
  }, [loadStats]);

  const maxVolume = useMemo(() => {
    if (!dashboard?.chart.length) {
      return 1;
    }

    return Math.max(
      1,
      ...dashboard.chart.map(
        (day) => day.total,
      ),
    );
  }, [dashboard]);

  return (
    <main className="dashboard-page management-page">
      <header className="dashboard-header management-header">
        <div>
          <p className="dashboard-eyebrow management-eyebrow">
            Administration
          </p>

          <h1>Dashboard</h1>

          <p className="dashboard-description management-description">
            Monitor appointment activity and
            business performance.
          </p>
        </div>

        <button
          type="button"
          className="dashboard-refresh management-button"
          onClick={() => void loadStats()}
          disabled={isLoading}
        >
          {isLoading
            ? 'Loading…'
            : 'Refresh statistics'}
        </button>
      </header>

      <section className="dashboard-filters management-panel">
        <label>
          Start date

          <input
            type="date"
            value={dateRange.startDate}
            max={dateRange.endDate}
            onChange={(event) =>
              setDateRange((current) => ({
                ...current,
                startDate:
                  event.target.value,
              }))
            }
          />
        </label>

        <label>
          End date

          <input
            type="date"
            value={dateRange.endDate}
            min={dateRange.startDate}
            onChange={(event) =>
              setDateRange((current) => ({
                ...current,
                endDate:
                  event.target.value,
              }))
            }
          />
        </label>
      </section>

      {error && (
        <div
          className="dashboard-error"
          role="alert"
        >
          <span>{error}</span>

          <button
            type="button"
            onClick={() => void loadStats()}
          >
            Retry
          </button>
        </div>
      )}

      {isLoading && !dashboard ? (
        <div className="dashboard-state">
          Loading dashboard…
        </div>
      ) : dashboard ? (
        <>
          <section className="dashboard-stat-grid">
            <article className="dashboard-stat-card management-panel">
              <span>
                Total appointments
              </span>

              <strong>
                {
                  dashboard.metrics
                    .totalAppointments
                }
              </strong>
            </article>

            <article className="dashboard-stat-card management-panel">
              <span>Completed</span>

              <strong>
                {
                  dashboard.metrics
                    .completedAppointments
                }
              </strong>
            </article>

            <article className="dashboard-stat-card management-panel">
              <span>Cancelled</span>

              <strong>
                {
                  dashboard.metrics
                    .cancelledAppointments
                }
              </strong>
            </article>

            <article className="dashboard-stat-card management-panel">
              <span>Waiting now</span>

              <strong>
                {
                  dashboard.metrics
                    .waitingNow
                }
              </strong>
            </article>

            <article className="dashboard-stat-card management-panel dashboard-stat-card--revenue">
              <span>
                Estimated revenue
              </span>

              <strong>
                {formatCurrency(
                  dashboard.metrics
                    .estimatedRevenue,
                )}
              </strong>
            </article>
          </section>

          <section className="dashboard-chart-card management-panel">
            <div className="dashboard-section-heading">
              <div>
                <h2>
                  Appointment volume
                </h2>

                <p>
                  Daily appointments during
                  the selected date range.
                </p>
              </div>
            </div>

            {dashboard.chart.length ===
            0 ? (
              <div className="dashboard-state">
                No appointment activity
                for this date range.
              </div>
            ) : (
              <div className="dashboard-bar-chart">
                {dashboard.chart.map(
                  (day) => {
                    const height =
                      Math.max(
                        4,
                        (day.total /
                          maxVolume) *
                          100,
                      );

                    return (
                      <div
                        className="dashboard-bar-column"
                        key={day.date}
                        title={`${day.date}: ${day.total} appointments`}
                      >
                        <span className="dashboard-bar-value">
                          {day.total}
                        </span>

                        <div className="dashboard-bar-track">
                          <div
                            className="dashboard-bar"
                            style={{
                              height: `${height}%`,
                            }}
                          />
                        </div>

                        <span className="dashboard-bar-label">
                          {formatChartDate(
                            day.date,
                          )}
                        </span>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </section>
        </>
      ) : (
        !error && (
          <div className="dashboard-state">
            No dashboard statistics
            are available.
          </div>
        )
      )}
      <DashboardAppointments startDate={dateRange.startDate} endDate={dateRange.endDate} />
    </main>
  );
}
