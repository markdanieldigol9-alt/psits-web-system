# PSITS Web System

A comprehensive web-based management system for PSITS Region XII built with React, TypeScript, Vite, and Tailwind CSS.

## Project Overview

The PSITS Management System provides role-based access and management capabilities for:

- **Admin**: Full system control and configuration
- **Officer**: Operational management and event coordination
- **Members**: User participation and event registration

## Features

### Core Modules

1. **Authentication** - User login and registration with role-based access control
2. **Dashboard** - Real-time statistics, activity monitoring, and quick actions
3. **Member Management** - Member lifecycle actions (approve/reject/suspend/ban/restore) with status history
4. **Event Management** - Event creation, scheduling, and registration
5. **Payment Tracking** - Payment submission + verification/rejection with status logs
6. **Announcements** - Create, schedule, and target announcements
7. **Live Events** - livestream sessions for PSITS activities
8. **Reports & Analytics** - Membership, event, and financial reports
9. **Live Streaming** - Built-in meeting platform support
10. **Industry Partners** - Partner management and collaboration tracking
11. **Notification System** - Real-time alerts and notifications
12. **Settings** - User and system configuration
13. **Audit Logs** - Action trail for key module updates (members, payments, etc.)

## Tech Stack

- **React 19.2** - UI framework
- **TypeScript 5.9** - Type safety
- **Vite 7.3** - Build tool
- **Tailwind CSS 3.4** - Styling
- **React Router 6.22** - Routing
- **Recharts 2.10** - Charts and analytics
- **Lucide Icons** - Icon library
- **Axios 1.6** - HTTP client

## Quick Start

1. Install dependencies (repo root): `npm install --legacy-peer-deps`
2. Start API + Web together (repo root): `npm run dev`
3. Open `http://localhost:5173`

If you’re already in the `PSITS/` folder:

- Start API + Web together: `npm run dev:full`
- Start the web app only (no API): `npm run dev`

Database migrations:

- Run once (repo root): `npm run api:migrate`

Default seeded admin (created by the backend migration):

- Email: `admin@psits.com`
- Password: `AdminPsits@123`
- Role: `super_admin`

## Status Badges (UI Standard)

- Pending = yellow
- Approved/Active/Verified = green
- Rejected/Inactive = red
- Suspended = orange
- Banned = dark (gray/near-black)
- Ongoing / Registration Open / Live = blue
- Completed / Ended / Registration Closed = gray

## Project Structure

See README.md for detailed structure and development guidelines.

## Deployment & Final Testing

This project ships as a static site. Build the production bundle with:

```bash
npm run build
```

The output will be in `dist/`; you can serve it with any static host.

### GitHub Pages

A workflow is provided in `.github/workflows/deploy.yml`. It builds on push to `main` and deploys `dist/` to the `gh-pages` branch. Enable GitHub Pages in repository settings pointing at that branch.

### Other Hosts (Netlify, Vercel)

- Connect the repository to the host.
- Set build command to `npm run build`.
- Set publish directory to `dist`.
- Add any `VITE_` environment variables via the host interface.

### Final Testing (QA)

1. Run the build locally and `npm run preview` to simulate production.
2. Click through every page in each role: Super Admin, Officer, Member.
3. Verify forms, tables, charts, and navigation behave correctly.
4. Check responsiveness on mobile and tablet widths.
5. Inspect browser console for errors and resolve before releasing.

### Optional Automated Tests

To create a safety net for future changes, you can add Jest and React Testing Library:

```bash
npm install --save-dev jest ts-jest @testing-library/react @testing-library/jest-dom @types/jest
```

A basic config (`jest.config.ts`) and a sample test (`src/__tests__/App.test.tsx`) are included. Run `npm test` to execute the suite.

**Status**: In Development
npm run dev
