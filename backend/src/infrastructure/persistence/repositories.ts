import { Types } from "mongoose";
import type { HydratedDocument } from "mongoose";
import { AppointmentStatus, UserRole } from "@app/shared";
import type { Schedule } from "../../domain/entities";
import { BOOKING_STATUSES } from "../../domain/appointments/availability.rules";
import type {
  AppointmentRecord,
  AppointmentRepository,
  QueueRepository,
  ScheduleRepository,
  ServiceRecord,
  ServiceRepository,
  UserRecord,
  UserRepository,
} from "../../application/ports";
import {
  Appointment,
  type AppointmentRecord as StoredAppointment,
} from "../models/appointment.model";
import { User, type UserDocument } from "../models/user.model";
import {
  Service,
  type ServiceRecord as StoredService,
} from "../models/service.model";
import { StaffSchedule } from "../models/schedule.model";
import { QueueEntry } from "../models/queue.model";
type AppointmentDocument = HydratedDocument<StoredAppointment>;

const storedId = (value: unknown) => value as string;
function appointmentRecord(document: AppointmentDocument): AppointmentRecord {
  return {
    _id: document._id,
    reference: document.reference,
    customer: document.customer,
    service: document.service,
    staff: document.staff,
    start: document.start,
    end: document.end,
    status: document.status,
    view: document,
  };
}
function userRecord(document: UserDocument): UserRecord {
  return {
    _id: document._id,
    fullName: document.fullName,
    email: document.email,
    phone: document.phone,
    role: document.role,
    createdAt: document.createdAt,
    view: document,
  };
}
type ServiceDocument = HydratedDocument<StoredService>;
function serviceRecord(document: ServiceDocument): ServiceRecord {
  return {
    _id: document._id,
    name: document.name,
    description: document.description,
    duration: document.duration,
    price: document.price,
    active: document.active,
    view: document,
  };
}
const details = [
  { path: "customer", select: "fullName email phone" },
  { path: "service", select: "name description duration price active" },
  { path: "staff", select: "fullName email phone role" },
];
const queuePopulation = {
  path: "appointment",
  populate: [
    { path: "customer", select: "-password" },
    { path: "staff", select: "-password" },
    { path: "service" },
  ],
};
const schedulePopulation = [
  { path: "staff", select: "_id fullName email phone role createdAt" },
  {
    path: "services",
    select: "_id name description duration price active createdAt",
  },
];
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export const appointmentRepository: AppointmentRepository = {
  async referenceExists(reference) {
    return Boolean(await Appointment.exists({ reference }));
  },
  async findById(id) {
    const document = await Appointment.findById(id);
    return document ? appointmentRecord(document) : null;
  },
  async findByReference(reference) {
    const document = await Appointment.findOne({ reference });
    return document ? appointmentRecord(document) : null;
  },
  async emailSource(id) {
    const document = await Appointment.findById(id)
      .populate("customer", "fullName email")
      .populate("service", "name")
      .populate("staff", "fullName")
      .lean();

    return document as unknown as Awaited<
      ReturnType<AppointmentRepository["emailSource"]>
    >;
  },
  async create(value) {
    return appointmentRecord(
      await Appointment.create({
        ...value,
        customer: String(value.customer),
        service: String(value.service),
        staff: String(value.staff),
      }),
    );
  },
  async list(scope) {
    const query: Record<string, unknown> = {};
    if (scope.customerId !== undefined)
      query.customer = new Types.ObjectId(scope.customerId);
    if (scope.statuses !== undefined) query.status = { $in: scope.statuses };
    return Appointment.find(query)
      .populate("customer", "fullName email phone")
      .populate("service", "name description duration price active")
      .populate("staff", "fullName email phone role")
      .sort({ start: 1 });
  },
  async populateDetails(appointment) {
    const document = appointment.view as AppointmentDocument;
    await document.populate(details);
    return document;
  },
  async updateIfUnchanged(appointment, changes) {
    const document = await Appointment.findOneAndUpdate(
      {
        _id: storedId(appointment._id),
        status: appointment.status,
        start: appointment.start,
        end: appointment.end,
        staff: storedId(appointment.staff),
        service: storedId(appointment.service),
      },
      { $set: changes },
      { new: true },
    );
    return document ? appointmentRecord(document) : null;
  },
  copyUpdatedView(original, updated) {
    const document = original.view as AppointmentDocument;
    document.set((updated.view as AppointmentDocument).toObject());
    Object.assign(original, appointmentRecord(document));
  },
  async transition(id, from, to) {
    const rollback =
      (from === AppointmentStatus.IN_SERVICE &&
        to === AppointmentStatus.CHECKED_IN) ||
      (from === AppointmentStatus.COMPLETED &&
        to === AppointmentStatus.IN_SERVICE);
    const document = rollback
      ? await Appointment.findOneAndUpdate(
          { _id: id, status: from },
          { $set: { status: to } },
        )
      : await Appointment.findOneAndUpdate(
          { _id: id, status: from },
          { $set: { status: to } },
          { new: true },
        );
    return document ? appointmentRecord(document) : null;
  },
  async existingInDay(staff, dayStart, dayEnd, excludeId) {
    const query: Record<string, unknown> = {
      staff,
      status: { $in: BOOKING_STATUSES },
      start: { $lt: dayEnd },
      end: { $gt: dayStart },
    };
    if (excludeId && Types.ObjectId.isValid(excludeId))
      query._id = { $ne: new Types.ObjectId(excludeId) };
    return Appointment.find(query)
      .select("start end status")
      .sort({ start: 1 })
      .lean();
  },
  async markNoShows(cutoff) {
    const result = await Appointment.updateMany(
      { status: AppointmentStatus.CONFIRMED, start: { $lt: cutoff } },
      { $set: { status: AppointmentStatus.NO_SHOW } },
    );
    return typeof result.modifiedCount === "number" ? result.modifiedCount : 0;
  },
};
export const userRepository: UserRepository = {
  async emailExists(email) {
    return Boolean(await User.exists({ email }));
  },
  async findByEmail(email, includePassword = false) {
    const document = includePassword
      ? await User.findOne({ email }).select("+password")
      : await User.findOne({ email });
    return document ? userRecord(document as UserDocument) : null;
  },
  async create(value) {
    return userRecord((await User.create(value)) as UserDocument);
  },
  async comparePassword(user, password) {
    return (user.view as UserDocument).comparePassword(password);
  },
  async currentUser(id) {
    return User.findById(id)
      .select("_id fullName email phone role createdAt")
      .lean();
  },
  async identity(id) {
    return User.findById(id).select("_id role").lean();
  },
  async staffDetails(id) {
    return User.findOne({ _id: storedId(id), role: UserRole.STAFF })
      .select("_id fullName email phone role createdAt")
      .lean();
  },
  async listStaff() {
    return User.find({ role: UserRole.STAFF })
      .select("-password")
      .sort({ fullName: 1 })
      .lean();
  },
};
export const serviceRepository: ServiceRepository = {
  async forBooking(id, purpose) {
    const selection =
      purpose === "create"
        ? "_id active duration name price"
        : purpose === "reschedule"
          ? "_id active duration"
          : "_id duration active";
    return Service.findById(id).select(selection).lean();
  },
  async list(isAdmin) {
    return Service.find(isAdmin ? {} : { active: true })
      .sort({ name: 1 })
      .lean();
  },
  async duplicateName(name, exceptId) {
    return Service.findOne({
      ...(exceptId !== undefined ? { _id: { $ne: exceptId } } : {}),
      name: { $regex: `^${escapeRegExp(name)}$`, $options: "i" },
    }).lean();
  },
  async create(value) {
    return Service.create(value);
  },
  async update(id, value) {
    return Service.findByIdAndUpdate(
      id,
      { $set: value },
      { new: true, runValidators: true },
    );
  },
  async findById(id) {
    const document = await Service.findById(id);
    return document ? serviceRecord(document) : null;
  },
  async saveActive(service, active) {
    const document = service.view as ServiceDocument;
    document.active = active;
    await document.save();
    return serviceRecord(document);
  },
  async scheduleServices(ids) {
    return Service.find({ _id: { $in: ids } })
      .select("_id name description duration price active createdAt")
      .lean();
  },
};
export const scheduleRepository: ScheduleRepository = {
  async availability(staff) {
    return StaffSchedule.findOne({ staff: storedId(staff) })
      .select("weeklyIntervals daysOff services")
      .lean<Schedule | null>();
  },
  async details(id) {
    return StaffSchedule.findOne({ staff: storedId(id) })
      .populate(schedulePopulation[0]!)
      .populate(schedulePopulation[1]!)
      .lean();
  },
  async save(id, value) {
    return StaffSchedule.findOneAndUpdate(
      { staff: storedId(id) },
      { $set: { staff: storedId(id), ...value } },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    )
      .populate(schedulePopulation[0]!)
      .populate(schedulePopulation[1]!);
  },
};
export const queueRepository: QueueRepository = {
  async forAppointment(id) {
    return QueueEntry.findOne({ appointment: id });
  },
  async lastNumber(queueDate) {
    const entry = await QueueEntry.findOne({ queueDate })
      .sort({ queueNumber: -1 })
      .collation({ locale: "en", numericOrdering: true })
      .select("queueNumber")
      .lean();
    return entry?.queueNumber;
  },
  async create(value) {
    return QueueEntry.create(value);
  },
  async delete(id) {
    await QueueEntry.deleteOne({ _id: id });
  },
  async populate(id) {
    return QueueEntry.findById(id).populate(queuePopulation).lean().exec();
  },
  async today(queueDate) {
    return QueueEntry.find({ queueDate, completedAt: { $exists: false } })
      .sort({ checkedInAt: 1 })
      .populate(queuePopulation)
      .lean()
      .exec();
  },
  async findById(id) {
    return QueueEntry.findById(id);
  },
  async markCalled(id, calledAt) {
    return QueueEntry.findOneAndUpdate(
      {
        _id: id,
        calledAt: { $exists: false },
        completedAt: { $exists: false },
      },
      { $set: { calledAt } },
      { new: true },
    );
  },
  async markCompleted(id, completedAt) {
    return QueueEntry.findOneAndUpdate(
      { _id: id, completedAt: { $exists: false } },
      { $set: { completedAt } },
      { new: true },
    );
  },
};
