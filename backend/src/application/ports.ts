import type { AppointmentStatus, UserRole } from "@app/shared";
import type {
  Appointment,
  EntityId,
  QueueEntry,
  Schedule,
  Service,
  User,
  WorkingInterval,
} from "../domain/entities";
import type { OperationResult } from "./result";

export interface AppointmentRecord extends Appointment {
  view: unknown;
}
export interface UserRecord extends User {
  view: unknown;
}
export interface ServiceRecord extends Service {
  view: unknown;
}
export interface Actor {
  id?: string;
  _id?: string;
  role?: UserRole | string;
}
export interface QueueEvent {
  queueEntryId: string;
  queueNumber: string;
  appointmentId: string;
  appointmentStatus: string;
  timestamp: string;
}
export interface QueuePublisher {
  update(payload: QueueEvent): void;
  call(payload: QueueEvent): void;
  complete(payload: QueueEvent): void;
}
export interface OperationInput {
  body: Record<string, unknown>;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  actor?: Actor;
  queueEvents?: () => QueuePublisher;
}
export type UseCase = (input: OperationInput) => Promise<OperationResult>;
export interface AppointmentEmailDetails {
  to: string;
  customerName: string;
  reference: string;
  serviceName: string;
  staffName: string;
  start: Date;
  end: Date;
}
export interface AppointmentEmailSource {
  reference: string;
  start: Date;
  end: Date;
  customer: {
    fullName?: string;
    email?: string;
  } | null;
  service: {
    name?: string;
  } | null;
  staff: {
    fullName?: string;
  } | null;
}
export interface AppointmentRepository {
  referenceExists(reference: string): Promise<boolean>;
  findById(id: EntityId): Promise<AppointmentRecord | null>;
  findByReference(reference: string): Promise<AppointmentRecord | null>;
  emailSource(id: string): Promise<AppointmentEmailSource | null>;
  create(value: Omit<Appointment, "_id">): Promise<AppointmentRecord>;
  list(scope: {
    customerId?: string;
    statuses?: AppointmentStatus[];
  }): Promise<unknown[]>;
  populateDetails(appointment: AppointmentRecord): Promise<unknown>;
  updateIfUnchanged(
    appointment: Appointment,
    changes: {
      status?: AppointmentStatus;
      start?: Date;
      end?: Date;
    },
  ): Promise<AppointmentRecord | null>;
  copyUpdatedView(
    original: AppointmentRecord,
    updated: AppointmentRecord,
  ): void;
  transition(
    id: EntityId,
    from: AppointmentStatus,
    to: AppointmentStatus,
  ): Promise<AppointmentRecord | null>;
  existingInDay(
    staff: EntityId,
    dayStart: Date,
    dayEnd: Date,
    excludeId?: string,
  ): Promise<
    {
      start: Date;
      end: Date;
      status: AppointmentStatus;
    }[]
  >;
  markNoShows(cutoff: Date): Promise<number>;
}
export interface UserRepository {
  emailExists(email: string): Promise<boolean>;
  findByEmail(
    email: string,
    includePassword?: boolean,
  ): Promise<UserRecord | null>;
  create(value: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    role: UserRole;
  }): Promise<UserRecord>;
  comparePassword(user: UserRecord, password: string): Promise<boolean>;
  currentUser(id: string): Promise<User | null>;
  identity(id: string): Promise<Pick<User, "_id" | "role"> | null>;
  staffDetails(id: unknown): Promise<unknown | null>;
  listStaff(): Promise<unknown[]>;
}
export interface ServiceRepository {
  forBooking(
    id: string,
    purpose: "create" | "reschedule" | "availability",
  ): Promise<Service | null>;
  list(isAdmin: boolean): Promise<unknown[]>;
  duplicateName(name: string, exceptId?: unknown): Promise<unknown | null>;
  create(value: {
    name: string;
    description: string;
    duration: number;
    price: number;
    active: boolean;
  }): Promise<unknown>;
  update(
    id: unknown,
    value: {
      name: string;
      description: string;
      duration: number;
      price: number;
    },
  ): Promise<unknown | null>;
  findById(id: unknown): Promise<ServiceRecord | null>;
  saveActive(service: ServiceRecord, active: boolean): Promise<ServiceRecord>;
  scheduleServices(ids: string[]): Promise<unknown[]>;
}
export interface ScheduleRepository {
  availability(staff: EntityId): Promise<Schedule | null>;
  details(id: unknown): Promise<unknown | null>;
  save(
    id: unknown,
    value: {
      weeklyIntervals: Record<string, WorkingInterval[]>;
      daysOff: string[];
      services: string[];
    },
  ): Promise<unknown>;
}
export interface QueueRepository {
  forAppointment(id: string): Promise<unknown | null>;
  lastNumber(date: Date): Promise<string | undefined>;
  create(value: {
    appointment: string;
    queueDate: Date;
    queueNumber: string;
    checkedInAt: Date;
  }): Promise<QueueEntry>;
  delete(id: EntityId): Promise<void>;
  populate(id: EntityId): Promise<unknown | null>;
  today(date: Date): Promise<unknown[]>;
  findById(id: string): Promise<QueueEntry | null>;
  markCalled(id: EntityId, calledAt: Date): Promise<QueueEntry | null>;
  markCompleted(id: EntityId, completedAt: Date): Promise<QueueEntry | null>;
}
export interface DashboardRows {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  waitingNow: number;
  revenueResult: {
    total?: unknown;
  }[];
  chartAppointments: {
    _id: string;
    total?: unknown;
    completed?: unknown;
  }[];
}
export interface Dependencies {
  appointments: AppointmentRepository;
  users: UserRepository;
  services: ServiceRepository;
  schedules: ScheduleRepository;
  queue: QueueRepository;
  dashboard: {
    load(start: Date, end: Date): Promise<DashboardRows>;
  };
  identifiers: {
    isValid(value: unknown): boolean;
    isStrict(value: unknown): boolean;
  };
  failures: {
    isValidation(error: unknown): boolean;
    isNamedValidation(error: unknown): boolean;
    isDuplicate(error: unknown): boolean;
    isDuplicateEmail(error: unknown): boolean;
  };
  tokens: {
    configured(): boolean;
    sign(id: string, role: UserRole): string;
    verify(token: string, missingSecretMessage?: string): unknown;
    isTokenError(error: unknown): boolean;
  };
  bookingLock: {
    run<T>(
      staff: string,
      start: Date,
      end: Date,
      operation: () => Promise<T>,
    ): Promise<T>;
  };
  mail: {
    confirm(details: AppointmentEmailDetails): Promise<boolean>;
    reschedule(details: AppointmentEmailDetails): Promise<boolean>;
    cancel(details: AppointmentEmailDetails): Promise<boolean>;
  };
}
