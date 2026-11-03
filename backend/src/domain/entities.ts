import type { AppointmentStatus, UserRole } from "@app/shared";

export type EntityId =
  | string
  | {
      toString(): string;
    };
export interface Appointment {
  _id: EntityId;
  reference: string;
  customer: EntityId;
  service: EntityId;
  staff: EntityId;
  start: Date;
  end: Date;
  status: AppointmentStatus;
}
export interface User {
  _id: EntityId;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt?: Date;
}
export interface Service {
  _id: EntityId;
  name: string;
  description: string;
  duration: number;
  price: number;
  active: boolean;
}
export interface WorkingInterval {
  from: string;
  to: string;
}
export interface Schedule {
  weeklyIntervals: Record<string, WorkingInterval[]>;
  daysOff: string[];
  services: EntityId[];
}
export interface QueueEntry {
  _id: EntityId;
  appointment: EntityId;
  queueNumber: string;
  queueDate: Date;
  checkedInAt: Date;
  calledAt?: Date;
  completedAt?: Date;
}
