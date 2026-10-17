export enum UserRole {
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  CUSTOMER = 'CUSTOMER',
}

export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  IN_SERVICE = 'IN_SERVICE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum Weekday {
  MONDAY = 'Mon',
  TUESDAY = 'Tue',
  WEDNESDAY = 'Wed',
  THURSDAY = 'Thu',
  FRIDAY = 'Fri',
  SATURDAY = 'Sat',
  SUNDAY = 'Sun',
}

export interface IUser {
  _id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt?: string;
}

export interface IService {
  _id: string;
  name: string;
  description: string;
  duration: number; // in minutes
  price: number;    // in USD
  active: boolean;
  createdAt?: string;
}

export interface IWorkingInterval {
  from: string; // HH:mm
  to: string;   // HH:mm
}

export interface IStaffSchedule {
  _id: string;
  staff: string | IUser;
  weeklyIntervals: Record<Weekday, IWorkingInterval[]>;
  daysOff: Weekday[];
  services: string[] | IService[];
}

export interface IAppointment {
  _id: string;
  reference: string;
  customer: string | IUser;
  service: string | IService;
  staff: string | IUser;
  start: string; // ISO String
  end: string;   // ISO String
  status: AppointmentStatus;
  createdAt?: string;
}

export interface IQueueEntry {
  _id: string;
  appointment: string | IAppointment;
  queueDate: string;
  queueNumber: string;
  checkedInAt: string;
  calledAt?: string;
  completedAt?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}