# Bulk SMS Platform

Catholic Church, Umoja's bulk SMS sending platform. An admin/staff operator onboards **Members** (individually or via CSV import), organizes them into **Groups**, and sends **Campaigns** — bulk SMS messages targeted at all members, a group, or a hand-picked selection — with a live send progress view and a full audit trail.

- **Backend:** [backend/](backend/), Node.js + Express 5 + TypeScript, PostgreSQL via Prisma, JWT auth, Socket.io for live campaign progress.
- **Frontend:** [frontend/](frontend/), React 19 + TypeScript + Vite, Tailwind CSS, React Router, TanStack Query, Zustand.

## Features

- **Member onboarding**: add members one at a time or bulk-import a CSV (`name`, `phone`, optional `email`/`groups`), with phone numbers normalized and duplicates skipped.
- **Groups**: organize members into named segments to target a send at.
- **Bulk SMS campaigns**: compose a message (with a `{{name}}` personalization token), pick an audience (all members / a group / a selection), preview the recipient count and SMS segment cost, and send. Sends run in the background in small batches through the SMS gateway.
- **Live delivery progress**: a campaign's detail page shows a live progress bar and a per-recipient delivery log (sent/failed/pending) over Socket.io, plus a "retry failed" action.
- **Admin**: operator account management (Super Admin/Admin/Staff), org-wide audit log of every create/update/delete/login.
- Opt-out support: a member can be marked unsubscribed and is excluded from every future send without losing their record.

## Tech stack

| | Backend | Frontend |
|---|---|---|
| Language | TypeScript | TypeScript |
| Framework | Express 5 | React 19 + Vite |
| Data | PostgreSQL + Prisma ORM (`pg` driver adapter) | TanStack Query, Axios |
| Auth | JWT (`jsonwebtoken`), bcrypt | Zustand session store |
| Realtime | Socket.io (campaign send progress) | socket.io-client |
| SMS gateway | Advanta/QuickSMS | - |
| Styling | n/a | Tailwind CSS v4 + a custom CSS design system |
| Other | Zod validation, Multer + csv-parse for CSV import, Pino logging | React Hook Form + Zod resolvers, React Router, Recharts, SweetAlert2 |

## Roles

`SUPER_ADMIN`, `ADMIN`, `STAFF` — operator accounts that sign into the platform, enforced both by backend route guards (`requireRole`) and frontend route guards (`RoleGuard`). Operators manage everyone; `SUPER_ADMIN`/`ADMIN` additionally manage other operator accounts and the audit log.

Not to be confused with **Members** (the SMS recipients members are onboarded), who never sign in.

## Project structure

```
backend/
  src/
    modules/          # auth, admin, members, groups, campaigns, sms, audit
    middleware/        # auth, error handling, CSV upload
    lib/                # env validation, JWT, logging, Prisma client, Socket.io
    shared/             # error classes, guards, schemas, types, utils
  prisma/schema.prisma  # data model
frontend/
  src/
    pages/             # dashboards, members, groups, campaigns, admin, auth, shared
    components/        # layout and shared components
    api/                # Axios client + typed API calls
    stores/             # Zustand stores (auth, notifications)
    router/index.tsx    # route table + role guards
```

## Data model

Defined in [backend/prisma/schema.prisma](backend/prisma/schema.prisma):

- `User` — an operator account.
- `Member` — an SMS recipient (name, normalized phone, optional email/notes, subscribed flag), onboarded by a `User`, belonging to zero or more `Group`s.
- `Group` — a named member segment a campaign can target.
- `Campaign` — one bulk send (name, message, audience type, recipient/sent/failed counts, status) + its `CampaignRecipient` rows, one per recipient, snapshotting name/phone/status/error so the delivery log stays accurate even if the member is later edited.
- `AuditLog` — every create/update/delete/login across the system.

## API

All routes are mounted in [backend/src/app.ts](backend/src/app.ts). Base path is the API root (e.g. `http://localhost:3000`); every route below requires `Authorization: Bearer <jwt>`.

| Prefix | Routes | Purpose |
|---|---|---|
| `/auth` | `POST /login`, `GET /me`, `PATCH /me` | Operator login, profile |
| `/admin` | `GET/POST /users`, `GET/PATCH/DELETE /users/:id`, `GET /audit-logs` | Operator account management, audit log (Admin/Super Admin) |
| `/members` | `GET /`, `GET/PATCH/DELETE /:id`, `POST /`, `POST /import` | Member CRUD, CSV bulk import |
| `/groups` | `GET /`, `GET/PATCH/DELETE /:id`, `POST /` | Group CRUD, group member listing |
| `/campaigns` | `POST /preview`, `GET /`, `GET /:id`, `GET /:id/recipients`, `POST /`, `POST /:id/retry-failed` | Audience preview, campaign CRUD, delivery log, retry |

## Getting started

### Prerequisites
- Node.js 20+
- A PostgreSQL database
- An Advanta/QuickSMS account (for actually sending campaigns - the rest of the platform works without one)

### Backend

```bash
cd backend
cp .env.example .env   # fill in DATABASE_URL and JWT_SECRET at minimum
npm install
npx prisma generate
npx prisma db push     # or migrate, once you have migrations
npm run dev             # http://localhost:3000
```

Required env vars: `DATABASE_URL`, `JWT_SECRET`. The `ADVANTA_*` SMS gateway vars are optional at boot but required for `POST /campaigns` to actually send - see [backend/.env.example](backend/.env.example).

Seed a super admin + sample groups/members: `npx tsx prisma/seed.ts` (creates `admin@example.com` / `Admin@123!`).

### Frontend

```bash
cd frontend
cp .env.example .env    # set VITE_API_BASE_URL and VITE_SOCKET_URL to the backend URL
npm install
npm run dev              # Vite dev server
```

## Scripts

**Backend** (`backend/package.json`): `npm run dev` (nodemon + tsx), `npm run build` (Prisma generate + tsc), `npm start` (run compiled build). `backend/scripts/create-user.ts` and `set-super-admin.ts` manage operator accounts directly against the database.
**Frontend** (`frontend/package.json`): `npm run dev`, `npm run build` (tsc -b + vite build), `npm run lint`, `npm run preview`.
