# System Architecture: Code Gamma

## 1. System Overview
Code Gamma is a full-stack operational platform designed for Emergency Department (ED) staff. It provides a centralized interface for roster management, task coordination, and internal communication. The system is built as a Single Page Application (SPA) with a dedicated backend API.

The platform operates as a "Single Source of Truth," consolidating data that was previously scattered across physical sheets, Excel files, and messaging apps.

---

## 2. Frontend Architecture
The frontend is built with **React 19** and **TypeScript**, styled using **Tailwind CSS**.

- **Folder Structure**:
    - `src/pages/`: Top-level route components (`Dashboard`, `Login`, `SetupProfile`).
    - `src/components/`: Reusable UI components and module-specific views.
    - `src/contexts/`: Global state providers (e.g., `AuthContext`).
    - `src/lib/`: External service initializations (e.g., `supabase.ts`).
    - `src/utils/`: Helper functions and business logic (e.g., roster calculations).
- **Routing**: Managed by `react-router-dom` in `App.tsx`. It includes `ProtectedRoute` wrappers to enforce authentication.
- **State Management**: 
    - **Global State**: React Context API (`AuthContext`) manages the current user session and profile data.
    - **Local State**: Standard React `useState` and `useMemo` hooks for component-level data and UI state.
- **Component Hierarchy**: The `Dashboard` acts as the primary layout container, conditionally rendering modules like `AdminRosterTable` or `StaffDashboardView` based on user roles and active tabs.

---

## 3. Backend Architecture
The backend is an **Express.js** server running on **Node.js**.

- **Entry Point**: `server.ts` handles server initialization, database connection, and middleware setup.
- **API Routing**: API endpoints are defined within `server.ts`, following a RESTful pattern (e.g., `/api/shifts`, `/api/tasks`).
- **Service Layer**: Utilities for external integrations (like Google Calendar) are located in the `/server` directory.
- **Database Access Pattern**: The server uses `better-sqlite3` for synchronous, high-performance access to the local SQLite database. Queries are executed directly within route handlers.
- **Development Mode**: In development, the Express server also integrates **Vite** as middleware to provide Hot Module Replacement (HMR) and serve the frontend.

---

## 4. Database Architecture
The system uses **SQLite** for local storage, with a schema designed to support operational workflows.

- **Existing Tables**:
    - `users`: Staff profiles, roles, and contact info.
    - `shift_types`: Definitions of shift codes (AM, PM, NS, etc.) and their styling.
    - `shifts`: Individual shift assignments.
    - `shift_swaps`: Records of requested and approved shift exchanges.
    - `tasks` & `task_assignments`: Operational task tracking.
    - `announcements`: Notice board content.
    - `notifications`: User-specific alerts.
    - `owed_days`: Tracking of HKO and PN rest days.
    - `shift_audit_logs`: Immutable history of roster changes.

- **Schema Files**:
    - `schema.sql`: The authoritative SQLite schema used by the running application.
    - `supabase_schema.sql`: A PostgreSQL-compatible version of the schema intended for future migration or Supabase integration.

---

## 5. Authentication Flow
Authentication is managed via **Supabase Auth**.

1.  **Frontend**: The user logs in via `src/pages/Login.tsx` using the Supabase client.
2.  **Session**: Supabase manages the JWT and session persistence in the browser.
3.  **Backend Integration**: The frontend retrieves the `user_id` from the Supabase session and passes it to API requests. 
4.  **Profile Sync**: The `AuthContext` fetches additional role and profile data from the local SQLite `users` table based on the Supabase `user_id`.

---

## 6. Data Flow Diagram

```text
User Interaction
      ↓
[ React Frontend ] (Vite / React Router)
      ↓
[ Express API ] (server.ts)
      ↓
[ SQLite Database ] (roster.db)
```

---

## 7. Risks and Weak Points
- **Security**: API routes currently rely on client-provided `user_id` without server-side validation of the Supabase JWT.
- **Scalability**: SQLite is excellent for current needs but may require migration to a managed PostgreSQL instance (like Supabase DB) if concurrent write volume increases significantly.
- **Monolith Pattern**: `server.ts` contains all API logic, which may become difficult to maintain as more modules are added.
- **Sync Dependency**: The system assumes a 1:1 match between Supabase Auth users and the local `users` table; any failure in the `SetupProfile` flow can lead to orphaned auth accounts.
