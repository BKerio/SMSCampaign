# SMS Campaign Platform

A bulk SMS platform for the Catholic Church, Umoja. Parish operators keep a register of members, organize them into groups, and send SMS campaigns to everyone, to one group, or to a hand-picked list. Every send is tracked message by message, and every change in the system is recorded in an audit log.

## How the system works

### 1. Operators sign in

Operators are the people who use the platform: parish staff and leaders. Each one signs in with an email and password. There is no public sign-up; a Super Admin or Admin creates operator accounts.

Each operator has an **access level** that decides what they can do:

| Access level | What they can do |
|---|---|
| Staff | Add and manage members and groups, send campaigns, view reports |
| Admin | Everything Staff can do, plus manage operator accounts and view the audit log |
| Super Admin | Everything Admin can do, plus configure the SMS gateway in Settings |

Operators can also hold a **leadership position** (Chairman, Vice Chairman, Secretary, Treasurer or Catechist). The position is descriptive only and does not change access. It is used to sign the messages they send.

### 2. Members are registered

Members are the people who receive SMS. They never sign in. An operator can add members in two ways:

- **One at a time**, with a name, phone number, and optional email, notes and leadership position.
- **Bulk import** from a CSV or Excel file. Phone numbers are cleaned into one standard format, and duplicates are skipped. After the import, the operator sees how many were added, skipped or rejected.

A member can be marked as **opted out**. They stay in the register with their history, but no future campaign is sent to them.

### 3. Members are organized into groups

Groups are named segments such as Youth Choir, Catechists or a Small Christian Community. A member can belong to any number of groups. Within each group, a member can hold a group position: Moderator, Vice Moderator, Secretary, Vice Secretary or Treasurer.

### 4. A campaign is written and sent

To send a campaign, the operator:

1. Gives it a name (seen only by operators).
2. Writes the message. Typing `{{name}}` puts each recipient's own name into their copy. Writing "member" in a greeting is turned into `{{name}}` automatically.
3. Chooses the audience: all members, one group, or selected members.
4. Reviews a preview showing how many people will receive it, what the message will look like, and how many SMS units each copy will use.

Every message is signed automatically at the end with the sending operator's position and name, for example:

```
Hi Jane, harambee is this Sunday after mass.
- Chairman, Peter Otieno
```

When the operator presses Send, the platform saves a snapshot of every recipient's name and phone number, then sends the messages in the background in small batches through the SMS gateway. The operator does not have to wait on the page.

### 5. Delivery is tracked live

Each campaign has a detail page with a progress bar that updates live as messages go out, and a delivery log listing every recipient as sent, failed or pending. If some messages fail, the operator can retry just the failed ones. Because recipient details are snapshotted at send time, the log stays accurate even if a member is edited or removed later.

### 6. Credits, reports and settings

- **SMS credits:** the platform shows the remaining credit balance from the gateway, so operators know whether a send can go through.
- **Reports and dashboard:** summaries of members, groups, campaigns and delivery rates, with export to PDF and Excel.
- **Settings (Super Admin only):** save and test SMS gateway credentials and choose which gateway is active. Advanta is supported for sending today.

### 7. Everything is audited

Every login and every create, update or delete (members, groups, campaigns, operators, settings) is written to the audit log with who did it, when, and what changed. Admins can filter the log by person, action and date.

## Technology

| | Backend | Frontend |
|---|---|---|
| Language | TypeScript | TypeScript |
| Framework | Node.js with Express 5 | React 19 with Vite |
| Data | PostgreSQL on Neon, through Prisma | TanStack Query, Axios |
| File storage | Neon Object Storage (S3 compatible) | |
| Sign-in | JWT tokens, bcrypt password hashing | Zustand session store |
| Live updates | Socket.io | Socket.io client |
| SMS gateway | Advanta | |
| Styling | | Tailwind CSS with a custom design system, Lucide icons |
| Other | Zod validation, CSV parsing, Pino logging | React Hook Form, React Router, Recharts, SweetAlert2 |

## Running it locally

You need Node.js 20 or newer, a PostgreSQL database (the project uses Neon), and an Advanta account if you want to actually send SMS. Everything else works without one.

**Backend**

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

The backend needs `DATABASE_URL` and `JWT_SECRET` in its environment file. It runs on port 4000.

To create the first Super Admin, run `npx tsx prisma/seed.ts`. This creates the login `admin@sms.com` / `Admin@123!`. Running it again resets that account's password, which is useful if you get locked out. Change the password after the first sign-in.

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE_URL` and `VITE_SOCKET_URL` in the frontend environment file to the backend address (for example `http://localhost:4000`).
