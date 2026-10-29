# Smart Appointment & Clinic Queue Management System

A MERN monorepo for clinic appointments, staff schedules, customer bookings, and live waiting-room queues. The backend and frontend share TypeScript interfaces and enums through `@app/shared`.

## Features

- **Authentication and roles:** JWT authentication with `CUSTOMER`, `STAFF`, and `ADMIN` access controls.
- **Customer bookings:** Select a service, practitioner, date, and available time; view, cancel, or reschedule bookings with the same practitioner.
- **Appointment management:** Staff can review pending bookings, confirm them, reschedule them, or cancel them.
- **Staff schedules:** Administrators can create staff accounts and configure weekly working intervals, days off, and assigned services. Staff without a schedule can be configured from an empty schedule form.
- **Live queue:** Check in confirmed appointments, view compact currently-serving rows and a waiting-room table, call a customer, and complete a service. Daily queue numbers start at `A-001`.
- **Queue updates:** Socket.IO events `queue:update`, `queue:call`, and `queue:complete` are sent to authenticated staff/admin connections.
- **No-show job:** Every five minutes, a cron job marks confirmed appointments more than 15 minutes past their start as `NO_SHOW`.
- **Email notifications:** SMTP emails are attempted when an appointment is confirmed, rescheduled, or cancelled. A new pending booking does not trigger a confirmation email.
- **Admin dashboard:** Appointment totals, completed/cancelled counts, an open queue count, estimated revenue, a daily volume chart, and an appointment table with date range, status, practitioner, service, search, sorting, and pagination controls. The statistics API also returns a no-show count.

## Tech stack

- npm workspaces: `shared`, `backend`, and `frontend`.
- Backend: Node.js, Express, MongoDB/Mongoose, Socket.IO, Nodemailer, node-cron, bcryptjs, and jsonwebtoken.
- Frontend: React, Vite, TypeScript, React Router, Axios, and Socket.IO Client.
- Styling: Global defaults in `frontend/src/index.css`, page styles in `frontend/src/pages/styles/`, and component styles in `frontend/src/components/styles/`. Several reusable components also use Tailwind utility classes.

Dependency versions are defined in the workspace manifests and `package-lock.json`. The root and frontend manifests currently declare different React, Router, Vite, and TypeScript major versions, so a single version label would not describe the whole repository accurately.

## Repository structure

```text
smart-appointment-clinic-project/
|-- package.json                         # Workspace scripts and dependencies
|-- package-lock.json
|-- .env.example                         # Backend environment template
|-- tsconfig.base.json
|-- shared/
|   |-- package.json
|   |-- tsconfig.json
|   `-- src/
|       |-- index.ts
|       `-- types/shared_types.ts         # Shared enums, interfaces, response type
|-- backend/
|   |-- package.json
|   |-- tsconfig.json
|   `-- src/
|       |-- server.ts                    # Express and Socket.IO entry point
|       |-- config/db.ts
|       |-- controllers/
|       |-- middleware/
|       |-- models/
|       |-- routes/
|       |-- services/                    # Availability and SMTP mail
|       |-- utils/business-time.ts       # Clinic timezone conversion
|       |-- sockets/queue.socket.ts
|       |-- jobs/noshow.cron.ts
|       `-- scripts/create-admin.ts       # Development admin creation script
`-- frontend/
    |-- package.json
    |-- .env.example
    |-- vite.config.ts
    |-- tsconfig.json
    `-- src/
        |-- app.tsx                      # Routing and access guards
        |-- main.tsx
        |-- index.css                    # Theme, resets, shared text utilities
        |-- services/api.ts              # Axios and authentication storage keys
        |-- context/                     # Authentication and socket providers
        |-- hooks/useQueueSocket.ts
        |-- components/                  # AP_* components, DashboardAppointments
        |   `-- styles/                   # AP_DatePicker, AP_Modal, AP_Navbar CSS
        `-- pages/
            |-- Login.tsx
            |-- Register.tsx
            |-- BookAppointment.tsx
            |-- MyAppointments.tsx
            |-- Appointments.tsx
            |-- LiveQueue.tsx
            |-- Dashboard.tsx
            |-- Services.tsx
            |-- StaffSchedule.tsx
            `-- styles/                   # Page CSS, Auth, Customer, AppointmentSlots
```

## Business rules and implementation details

1. **Availability and booking:** A service must be active and assigned to the selected staff member. The appointment must fit inside their working hours and avoid days off and overlapping appointments. `PENDING`, `CONFIRMED`, `CHECKED_IN`, and `IN_SERVICE` appointments block availability. Booking validation requires starts in 15-minute increments. Adjacent appointment boundaries are allowed.
2. **Booking locks:** Creation, confirmation, and rescheduling use short-lived MongoDB lock records for 15-minute slices of the requested staff time, then validate availability before saving. These application-level checks and locks are not a MongoDB transaction or a database-level exclusion constraint for every possible overlapping interval.
3. **Rescheduling:** The endpoint accepts a new `start` timestamp and retains the appointment's service, practitioner, reference, and status. Completed, cancelled, and no-show appointments cannot be rescheduled.
4. **No-shows:** The cron job runs every five minutes and updates only `CONFIRMED` appointments whose start is more than 15 minutes in the past. Checked-in and other statuses are excluded. The grace period is hardcoded in `backend/src/jobs/noshow.cron.ts`.
5. **Revenue:** Estimated revenue sums the current service prices for completed appointments whose start falls within the selected range. Prices are not snapshotted at booking, so later service price changes can affect this estimate.
6. **Open queue count:** The dashboard's `waitingNow` metric counts queue entries with a check-in time and no completion time. It includes currently serving entries and is not limited to today's date or the selected dashboard range.
7. **Timezone:** Display formatting, availability timestamps, queue day boundaries, dashboard range boundaries, offset-free appointment timestamps, and the cron job use `Asia/Beirut`. The backend resolves date-specific offsets, including daylight-saving transitions; day boundaries use calendar dates rather than a fixed 24-hour duration.
8. **Responses and storage:** API responses use `success` with optional `data`, `message`, and `error` fields. The Axios client stores authentication under `auth_token` and `auth_user`, adds Bearer tokens to requests, and clears authentication on HTTP 401 responses.

## API endpoints

Protected HTTP endpoints expect `Authorization: Bearer <token>`. Customers can access and manage only their own appointments; staff and administrators can access all appointments.

### Authentication

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Register a customer; role is always `CUSTOMER` |
| POST | `/api/auth/login` | Public | Authenticate and issue a JWT |
| GET | `/api/auth/me` | Authenticated | Retrieve the current user |

### Services

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/api/services` | Public | Active services; authenticated admins see inactive services too |
| POST | `/api/services` | Admin | Create a service |
| PUT | `/api/services/:id` | Admin | Update service details |
| PATCH | `/api/services/:id/status` | Admin | Set `active` if supplied, otherwise toggle it |

### Staff and schedules

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/api/users/staff` | Authenticated | List staff members, including for customer booking selection |
| POST | `/api/users/staff` | Admin | Create a staff account |
| GET | `/api/staff/:id/schedule` | Authenticated | Fetch a schedule; unconfigured staff return `data: { staff, schedule: null }` |
| PUT | `/api/staff/:id/schedule` | Admin | Create or update weekly hours, days off, and service assignments |

### Appointments and availability

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/api/appointments/availability` | Public | Available slots; requires `serviceId`, `staffId`, and `date=YYYY-MM-DD` |
| POST | `/api/appointments` | Customer | Book using `serviceId`, `staffId`, and `start`; creates a `PENDING` appointment and `APT-XXXXXX` reference |
| GET | `/api/appointments` | Customer / Staff / Admin | List appointments within the caller's access scope |
| GET | `/api/appointments/:id` | Customer / Staff / Admin | Retrieve appointment details within the caller's access scope |
| PATCH | `/api/appointments/:id/confirm` | Staff / Admin | Confirm a pending booking |
| PATCH | `/api/appointments/:id/reschedule` | Customer / Staff / Admin | Reschedule using `{ start }`, keeping the same practitioner |
| PATCH | `/api/appointments/:id/cancel` | Customer / Staff / Admin | Cancel an appointment unless completed, cancelled, or no-show |

The appointment list endpoint currently returns the complete accessible list. The dashboard table applies its date range, filters, sorting, and pagination in the browser.

### Queue

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/queue/check-in` | Staff / Admin | Check in a confirmed booking using `{ reference }` and assign a daily queue number |
| GET | `/api/queue/today` | Staff / Admin | Today's uncompleted entries, including waiting and currently serving |
| PATCH | `/api/queue/:id/call` | Staff / Admin | Call the specified checked-in queue entry; appointment becomes `IN_SERVICE` |
| PATCH | `/api/queue/:id/complete` | Staff / Admin | Complete the specified in-service entry; appointment becomes `COMPLETED` |

The call endpoint acts on the supplied queue entry ID; it does not automatically select the next patient.

### Dashboard and health

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/api/dashboard/stats` | Admin | Metrics and daily chart; accepts `startDate` and `endDate` in `YYYY-MM-DD` format, defaulting to the last seven days when both are omitted |
| GET | `/api/health` | Public | API health response |

## Local setup

### Prerequisites

- Node.js 22.12 or newer, compatible with the Vite and Mongoose engine ranges in the current lockfile.
- npm with workspace support.
- A local MongoDB instance or MongoDB Atlas connection.

### 1. Install dependencies

Run from the repository root:

```bash
git clone https://github.com/PaulRiachy/smart-appointment-clinic-project.git
cd smart-appointment-clinic-project
npm install
```

### 2. Configure environment files

Copy the root `.env.example` to a root `.env`. The API server explicitly loads `.env` from the repository root, not from `backend/`.

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=apex_appointment_db
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1d
CLIENT_URL=http://localhost:5173

# Optional SMTP configuration; use your provider's values.
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM="Smart Clinic <noreply@example.com>"
```

`MONGO_URI` and `MONGO_DB_NAME` are required for the database connection. `JWT_SECRET` is required for authentication. `PORT`, `JWT_EXPIRES_IN`, and `CLIENT_URL` default to the values shown above if omitted.

The root example also contains `TIMEZONE` and `NO_SHOW_GRACE_PERIOD_MINS`, but the backend currently does not read these variables; timezone and grace-period values are defined in code.

SMTP is optional for running the app. Missing configuration or send failures are logged; email delivery is not guaranteed and a send failure does not roll back the appointment update. `SMTP_FROM` falls back to `SMTP_USER`; port 465 selects a secure SMTP connection.

Copy `frontend/.env.example` to `frontend/.env` if you need to override these frontend defaults:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### 3. Build shared types and run development servers

From the repository root:

```bash
npm run build:shared
npm run dev:backend
```

In a second terminal:

```bash
npm run dev:frontend
```

The default frontend URL is `http://localhost:5173`; the API health endpoint is `http://localhost:5000/api/health`. The backend uses `tsx watch`. Rebuild `shared` when changing its compiled exports used by the backend.

### 4. Create an administrator for local development

Public registration creates customers only. Review and change the hardcoded account details in `backend/src/scripts/create-admin.ts` before running this development helper from the root:

```bash
npx tsx backend/src/scripts/create-admin.ts
```

The helper reads the root `.env` and does not log passwords. After signing in as an administrator, create services, staff accounts, and staff schedules before making customer bookings.

## Build and regression checks

The root exposes these build scripts:

```bash
npm run build:shared
npm run build:backend
npm run build:frontend
npm run build
```

`npm run build` compiles shared contracts and the backend, then type-checks and bundles the frontend. The backend's `start` script runs `backend/dist/server.js` after a successful build.

Run the regression checks from the repository root:

```bash
npm test
```

This builds the shared and backend workspaces, then runs Node's test runner. Tests cover booking conflicts and lock cleanup, timezone boundaries, concurrent appointment updates, authentication, queue numbering, and frontend state/effect regressions. Database, SMTP, and frontend network access are mocked; these checks do not require a running clinic database and do not replace browser or live-database integration tests.
