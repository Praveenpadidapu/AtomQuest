# ATOMQUEST HACKATHON 1.0 - Goal Setting & Tracking Portal

A fully functional web-based portal for the full lifecycle of employee goals, from creation and alignment to quarterly check-ins. 

## Features Implemented
- **Mock Authentication**: Role-based routing (Employee, Manager, Admin).
- **Employee Workflow**: Goal Creation with real-time Zod validations (100% weight, max 8 goals, min 10%), Quarterly Check-in updates.
- **Manager Workflow**: Team Check-in Dashboard, Approval Workflow with Inline Edits.
- **Admin Workflow**: Complete Dashboard metrics, CSV Export functionality.
- **Bonus Features**: Simulated micro-animations, Premium dark UI, modular design, full backend API structure.
- **Tech Stack**: Next.js 14 (App Router), React, TypeScript, Prisma, SQLite, Vanilla CSS Modules.

## Prerequisites
- Node.js (v18 or newer)
- npm

## Setup & Run Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Initialize Database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Seed Database** (Populates mock users, goals, and check-ins)
   ```bash
   node prisma/seed.js
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **Demo Walkthrough**
   - Open `http://localhost:3000`
   - Select the **Employee** card to log in as Alice. Observe her locked goal sheet and test the Q2 Check-in functionality.
   - Logout and select the **Manager** card to log in. Review pending approvals and the team check-in summary.
   - Logout and select the **Admin** card to view the global dashboard and test the CSV export.
