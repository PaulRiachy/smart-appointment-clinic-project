
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IService } from '@app/shared';

import api from '../services/api';
import './styles/Services.css';

type ServiceForm = {
  name: string;
  description: string;
  duration: string;
  price: string;
};

const EMPTY_FORM: ServiceForm = {
  name: '',
  description: '',
  duration: '30',
  price: '0',
};

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

export default function Services() {
  const [services, setServices] = useState<IService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<IService | null>(null);
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);

  const loadServices = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await api.get('/services');
      const data = response.data.data;

      if (!Array.isArray(data)) {
        throw new Error('The services endpoint did not return a list.');
      }

      setServices(data as IService[]);
    } catch (requestError: unknown) {
      setError(
        getErrorMessage(requestError, 'Unable to load services.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return services.filter((service) => {
      const matchesSearch =
        !query ||
        service.name.toLowerCase().includes(query) ||
        (service.description ?? '').toLowerCase().includes(query);

      const matchesStatus = showInactive || service.active;

      return matchesSearch && matchesStatus;
    });
  }, [services, search, showInactive]);

  function openCreateForm() {
    setEditingService(null);
    setForm(EMPTY_FORM);
    setError('');
    setIsFormOpen(true);
  }

  function openEditForm(service: IService) {
    setEditingService(service);
    setForm({
      name: service.name,
      description: service.description ?? '',
      duration: String(service.duration),
      price: String(service.price),
    });
    setError('');
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSaving) return;

    setIsFormOpen(false);
    setEditingService(null);
    setForm(EMPTY_FORM);
  }

  async function saveService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const duration = Number(form.duration);
    const price = Number(form.price);

    if (!form.name.trim()) {
      setError('Enter a service name.');
      return;
    }

    if (!Number.isFinite(duration) || duration <= 0) {
      setError('Duration must be greater than zero.');
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setError('Price must be zero or greater.');
      return;
    }

    setIsSaving(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      duration,
      price,
    };

    try {
      if (editingService) {
        const response = await api.put(
          `/services/${editingService._id}`,
          payload,
        );

        const updatedService = response.data.data as IService;

        setServices((current) =>
          current.map((service) =>
            service._id === editingService._id
              ? updatedService
              : service,
          ),
        );
      } else {
        const response = await api.post('/services', payload);
        const createdService = response.data.data as IService;

        setServices((current) => [...current, createdService]);
      }

      setIsFormOpen(false);
      setEditingService(null);
      setForm(EMPTY_FORM);
    } catch (requestError: unknown) {
      setError(
        getErrorMessage(requestError, 'Unable to save this service.'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleServiceStatus(service: IService) {
    setError('');

    try {
      const response = await api.patch(
        `/services/${service._id}/status`,
        { active: !service.active },
      );

      const updatedService = response.data.data as
        | IService
        | undefined;

      setServices((current) =>
        current.map((item) =>
          item._id === service._id
            ? updatedService ?? { ...item, active: !item.active }
            : item,
        ),
      );
    } catch (requestError: unknown) {
      setError(
        getErrorMessage(
          requestError,
          'Unable to update the service status.',
        ),
      );
    }
  }

  return (
    <main className="services-page">
      <header className="services-header">
        <div>
          <p className="services-eyebrow">Administration</p>
          <h1>Services</h1>
          <p className="services-description">
            Create services, update prices and durations, and manage availability.
          </p>
        </div>

        <button
          type="button"
          className="services-button services-button--primary"
          onClick={openCreateForm}
        >
          Add service
        </button>
      </header>

      <section className="services-toolbar">
        <label className="services-search">
          <span className="sr-only">Search services</span>
          <input
            type="search"
            placeholder="Search services…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label className="services-toggle">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
          />
          Show inactive services
        </label>

        <button
          type="button"
          className="services-button services-button--secondary"
          onClick={() => void loadServices()}
          disabled={isLoading}
        >
          {isLoading ? 'Loading…' : 'Refresh'}
        </button>
      </section>

      {error && (
        <div className="services-error" role="alert">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="services-state">Loading services…</div>
      ) : filteredServices.length === 0 ? (
        <div className="services-state">
          <h2>No services found</h2>
          <p>Try changing your search or add a new service.</p>
        </div>
      ) : (
        <section className="services-grid">
          {filteredServices.map((service) => (
            <article className="service-card" key={service._id}>
              <div className="service-card__header">
                <div>
                  <h2>{service.name}</h2>
                  <span
                    className={`service-status ${
                      service.active
                        ? 'service-status--active'
                        : 'service-status--inactive'
                    }`}
                  >
                    {service.active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <strong className="service-card__price">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(service.price)}
                </strong>
              </div>

              <p className="service-card__description">
                {service.description || 'No description provided.'}
              </p>

              <p className="service-card__duration">
                Duration: {service.duration} minutes
              </p>

              <div className="service-card__actions">
                <button
                  type="button"
                  className="services-button services-button--secondary"
                  onClick={() => openEditForm(service)}
                >
                  Edit
                </button>

                <button
                  type="button"
                  className={`services-button ${
                    service.active
                      ? 'services-button--danger'
                      : 'services-button--primary'
                  }`}
                  onClick={() => void toggleServiceStatus(service)}
                >
                  {service.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {isFormOpen && (
        <div
          className="services-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !isSaving
            ) {
              closeForm();
            }
          }}
        >
          <section
            className="services-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-form-title"
          >
            <header className="services-modal__header">
              <h2 id="service-form-title">
                {editingService ? 'Edit service' : 'Add service'}
              </h2>

              <button
                type="button"
                onClick={closeForm}
                disabled={isSaving}
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <form onSubmit={saveService}>
              <label>
                Service name
                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Description
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="services-form-row">
                <label>
                  Duration (minutes)
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={form.duration}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        duration: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Price
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        price: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              {error && (
                <div className="services-error" role="alert">
                  {error}
                </div>
              )}

              <footer className="services-modal__actions">
                <button
                  type="button"
                  className="services-button services-button--secondary"
                  onClick={closeForm}
                  disabled={isSaving}
                >
                  Back
                </button>

                <button
                  type="submit"
                  className="services-button services-button--primary"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving…' : 'Save service'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
