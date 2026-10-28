# Smart Appointment & Clinic Queue Management System

A full-stack MERN monorepo for managing clinic service appointments, staff schedules, customer booking workflows, and real-time waiting room queues. Built with strict TypeScript contract enforcement across shared interfaces, concurrency-safe booking logic, and real-time Socket.IO synchronization.

---

## Key Features

- **Strict Type Safety**: Monorepo architecture sharing contract types, DTO interfaces, and status enums via `@app/shared`.
- **Role-Based Access Control (RBAC)**: Secure JWT authentication separating `CUSTOMER`, `STAFF`, and `ADMIN` access.
- **Concurrency-Safe Booking**: Slot availability engine built with atomic database guards to prevent double-booking identical staff time slots.
- **Real-Time Queue Management**: Sequential daily queue numbering (`A-001`), waiting room state transitions, and live Socket.IO broadcasts (`queue:updated`, `queue:called`, `queue:completed`).
- **Staff Appointment Approvals**: Dedicated staff interface to review and confirm `PENDING` bookings into `CONFIRMED` status.
- **Automated Background Jobs**: `node-cron` background job enforcing a 15-minute grace period before marking un-checked-in appointments as `NO_SHOW`.
- **Transactional Notifications**: Integrated Nodemailer SMTP service sending booking confirmation, reschedule, and cancellation alerts.
- **Operational Analytics**: Comprehensive admin metrics covering appointment status volume, revenue calculation, and daily demand distribution.

---

## Tech Stack

- **Monorepo Management**: npm Workspaces
- **Shared Package**: TypeScript (`@app/shared`)
- **Backend**: Node.js, Express, MongoDB (Mongoose), Socket.IO, Nodemailer, node-cron, bcryptjs, jsonwebtoken
- **Frontend**: React 18 (Vite), TypeScript, Axios (with Bearer interceptors), React Router v6, Socket.IO Client
- **Timezone Standard**: `Asia/Beirut` (UTC+3)

---

## Repository Structure

```text
smart-appointment-clinic-project/
├── package.json                   # Root workspace orchestrator
├── .gitignore                     # Git tracking exclusions
├── README.md                      # Documentation
├── shared/                        # Shared TypeScript package (@app/shared)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── shared_types.ts        # Enums, interfaces, and API response wrappers
│       └── index.ts               # Shared entry point exports
├── backend/                       # Express API Server
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts              # Express & Socket.IO server entry point
│       ├── config/
│       │   └── db.ts              # MongoDB connection setup
│       ├── controllers/
│       │   ├── auth.controller.ts
│       │   ├── service.controller.ts
│       │   ├── schedule.controller.ts
│       │   ├── appointment.controller.ts
│       │   ├── queue.controller.ts
│       │   ├── dashboard.controller.ts
│       │   └── user.controller.ts
│       ├── middleware/
│       │   └── auth.middleware.ts # JWT authentication & role authorization guards
│       ├── models/
│       │   ├── user.model.ts
│       │   ├── service.model.ts
│       │   ├── schedule.model.ts
│       │   ├── appointment.model.ts
│       │   └── queue.model.ts
│       ├── routes/
│       │   ├── auth.routes.ts
│       │   ├── service.routes.ts
│       │   ├── schedule.routes.ts
│       │   ├── appointment.routes.ts
│       │   ├── queue.routes.ts
│       │   ├── dashboard.routes.ts
│       │   └── user.routes.ts
│       ├── services/
│       │   ├── availability.service.ts
│       │   └── mail.service.ts
│       ├── sockets/
│       │   └── queue.socket.ts    # Socket.IO connection & event handlers
│       └── jobs/
│           └── noshow.cron.ts     # 5-minute grace period cron automation
└── frontend/                      # React SPA (Vite)
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx                # Main routing shell & ProtectedRoute guards
        ├── main.tsx
        ├── services/
        │   └── api.ts             # Axios client with JWT interceptors & storage keys
        ├── context/
        │   ├── AuthContext.tsx    # Authentication state provider
        │   └── SocketContext.tsx  # WebSocket connection provider
        ├── hooks/
        │   └── useQueueSocket.ts  # Queue event hook
        ├── components/            # Reusable AP_* component library & CSS
        │   ├── AP_Button.tsx / .css
        │   ├── AP_Textbox.tsx / .css
        │   ├── AP_Select.tsx / .css
        │   ├── AP_DatePicker.tsx / .css
        │   ├── AP_Table.tsx / .css
        │   ├── AP_Modal.tsx / .css
        │   ├── AP_Navbar.tsx / .css
        │   └── AP_ProfileModal.tsx / .css
        └── pages/                 # SPA route views & CSS
            ├── Home.tsx / .css
            ├── Login.tsx / .css
            ├── Register.tsx / .css
            ├── BookAppointment.tsx / .css
            ├── MyAppointments.tsx / .css
            ├── LiveQueue.tsx / .css
            ├── Appointments.tsx / .css
            ├── Services.tsx / .css
            ├── StaffSchedule.tsx / .css
            └── Dashboard.tsx / .css

```

---

## Core Business Rules & Guarantees

1. **Timezone Standard**: All slot calculation, availability checks, and daily queue resets strictly enforce the `Asia/Beirut` timezone.
2. **Atomic Overlap Protection**: Before creating or rescheduling an appointment, an atomic database check verifies that no overlapping active booking (`PENDING`, `CONFIRMED`, `CHECKED_IN`, `IN_SERVICE`) exists for the assigned staff member. Touching boundaries (e.g. 10:00–10:30 and 10:30–11:00) are permitted.
3. **No-Show Automation**: Every 5 minutes, a background cron job flags any `CONFIRMED` appointment as `NO_SHOW` if the current time exceeds `appointment.start + 15 minutes` and the patient has not checked in. Checked-in, in-service, completed, or cancelled bookings are untouched.
4. **Revenue Integrity**: Dashboard estimated revenue calculation sums only `COMPLETED` service prices. Pending, cancelled, or no-show bookings are excluded.
5. **Contract Consistency**: Authentication data keys (`AUTH_TOKEN_KEY`, `AUTH_USER_KEY`) and standardized response wrappers (`{ success: boolean, data: T, message?: string }`) are strictly enforced across the codebase.

---

## API Endpoints Summary

### Authentication (`/api/auth`)

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | Register a new customer account (forces `CUSTOMER` role) |
| `POST` | `/api/auth/login` | Public | Authenticate user and issue JWT token |
| `GET` | `/api/auth/me` | Authenticated | Retrieve authenticated user profile |

### Services (`/api/services`)

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/services` | Public | List active services (Admin sees all services) |
| `POST` | `/api/services` | Admin | Create a new clinic service |
| `PUT` | `/api/services/:id` | Admin | Edit service details |
| `PATCH` | `/api/services/:id/status` | Admin | Toggle active/inactive status |

### Staff & Schedules (`/api/staff` & `/api/users`)

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/users/staff` | Staff / Admin | List all staff members |
| `POST` | `/api/users/staff` | Admin | Create a staff account |
| `GET` | `/api/staff/:id/schedule` | Authenticated | Fetch weekly schedule and qualified services for a staff member |
| `PUT` | `/api/staff/:id/schedule` | Admin | Update working intervals, days off, and qualified services |

### Appointments & Availability (`/api/appointments`)

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/appointments/availability` | Public | Calculate available timeslots for a service, staff, and date |
| `POST` | `/api/appointments` | Customer | Book a timeslot (generates reference `APT-XXXXXX`, status `PENDING`) |
| `GET` | `/api/appointments` | Authenticated | List appointments (Customers see own; Staff/Admin see all) |
| `GET` | `/api/appointments/:id` | Authenticated | Retrieve single appointment details |
| `PATCH` | `/api/appointments/:id/confirm` | Staff / Admin | Confirm a `PENDING` booking into `CONFIRMED` status |
| `PATCH` | `/api/appointments/:id/reschedule` | Authenticated | Reschedule an appointment after availability check |
| `PATCH` | `/api/appointments/:id/cancel` | Authenticated | Cancel an appointment |

### Queue Management (`/api/queue`)

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/queue/check-in` | Staff / Admin | Check in a confirmed appointment and generate daily queue number (`A-001`) |
| `GET` | `/api/queue/today` | Staff / Admin | Fetch today's active waiting room queue entries |
| `PATCH` | `/api/queue/:id/call` | Staff / Admin | Call next customer (transitions status to `IN_SERVICE`) |
| `PATCH` | `/api/queue/:id/complete` | Staff / Admin | Complete visit (transitions status to `COMPLETED`) |

### Dashboard Analytics (`/api/dashboard`)

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/dashboard/stats` | Admin | Fetch metrics (totals, completed, cancelled, no-show, revenue, volume chart) |

---

## Setup & Local Development

### Prerequisites

* Node.js (v18+ recommended)
* npm (v9+ with Workspaces support)
* MongoDB instance running locally or via MongoDB Atlas

### 1. Installation

Clone the repository and install all monorepo workspace dependencies from the root directory:

```bash
git clone https://github.com/PaulRiachy/smart-appointment-clinic-project.git
cd smart-appointment-clinic-project
npm install

```

### 2. Environment Configuration

Create a `.env` file inside the `backend/` directory:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=smart_appointment_clinic
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=1d
CLIENT_URL=http://localhost:5173

# Nodemailer SMTP Configuration
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM="Smart Clinic" <noreply@smartclinic.com>

```

Create a `.env` file inside the `frontend/` directory (optional if defaults match):

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000

```

### 3. Build & Run

Build the shared contract package first:

```bash
npm run build:shared

```

Start the backend API server in development mode (runs with `tsx watch`):

```bash
npm run dev:backend

```

In a separate terminal, start the React Vite frontend development server:

```bash
npm run dev:frontend

```

Alternatively, build all workspace packages at once:

```bash
npm run build

```

---

## License

ISC License. Developed by **Paul Riachy**.
