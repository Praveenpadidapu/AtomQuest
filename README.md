# ATOMQUEST HACKATHON 1.0 - Goal Setting & Tracking Portal

A fully functional web-based portal for the full lifecycle of employee goals, from creation and alignment to quarterly check-ins. 

## Features Implemented
- **Secure Authentication**: Credentials-based NextAuth.js role-based routing (Employee, Manager, Admin) using stateless JWT sessions.
- **Employee Workflow**: Goal Creation with real-time Zod validations (100% weight, max 8 goals, min 10%), Quarterly Check-in updates.
- **Manager Workflow**: Team Check-in Dashboard, Approval Workflow with Inline Edits.
- **Admin Workflow**: Complete Dashboard metrics, CSV Export functionality.
- **Bonus Features**: Simulated micro-animations, Premium dark UI, modular design, full backend API structure.
- **Tech Stack**: Next.js 16 (App Router with Turbopack), React 19, TypeScript, NextAuth.js, Prisma, SQLite, Vanilla CSS Modules.

## Prerequisites
- Node.js (v20.9.0 or newer)
- npm

## Setup & Run Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Create a `.env` file in the root directory (based on `.env.example`) and add the following variables:
   ```env
   DATABASE_URL="file:./dev.db"
   NEXTAUTH_SECRET="fallback_secret_for_local_dev"
   NEXTAUTH_URL="http://localhost:3000"
   ```

3. **Initialize Database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Seed Database** (Populates credential-based mock users, goals, and check-ins)
   ```bash
   node prisma/seed.js
   ```

5. **Run the Project**
   - **Development Mode**:
     ```bash
     npm run dev
     ```
   - **Production Mode**:
     ```bash
     npm run build
     ```
     ```bash
     npm run start
     ```

6. **Log in to the Portal**
   Open `http://localhost:3000/login` and use the following seeded accounts:
   
   | Role | Email Address | Password | Name |
   |------|---------------|----------|------|
   | **Admin** | `admin@atomquest.com` | `password123` | System Admin |
   | **Manager** | `manager1@atomquest.com` | `password123` | Bob Manager |
   | **Employee** | `employee1@atomquest.com` | `password123` | Alice Employee |
   | **Employee** | `employee2@atomquest.com` | `password123` | Charlie Employee |

---

## 🛠️ Troubleshooting Port Conflicts
If you see the error:
`Error: listen EADDRINUSE: address already in use :::3000`

It means port 3000 is already occupied by a running process (or the background server is active). You can resolve this by:
1. **Freeing up Port 3000**:
   - **Windows (PowerShell)**:
     ```powershell
     npx kill-port 3000
     ```
2. **Running on a Different Port**:
   - **Development**:
     ```bash
     npm run dev -- -p 3001
     ```
   - **Production**:
     ```bash
     npm run start -- -p 3001
     ```

