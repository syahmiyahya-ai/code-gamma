# Code Gamma Refactoring Roadmap

**Author:** Principal Engineer
**Date:** 2026-03-15
**Status:** Draft / In-Progress

## 1. Executive Summary
Code Gamma has successfully reached its MVP state. However, to scale to a multi-ward hospital environment and ensure clinical safety, we must address significant architectural drift and technical debt. The primary focus is moving from a "monolithic SQLite" approach to a "distributed Supabase" architecture while hardening security and improving developer velocity.

---

## 2. Identified Issues

### A. Architectural Drift
*   **Database Split-Brain**: The tech stack specifies Supabase (PostgreSQL), but the backend is currently implemented using local SQLite (`better-sqlite3`). This prevents horizontal scaling and real-time synchronization across instances.
*   **Insecure Auth**: The backend relies on an unverified `x-user-id` header. It must transition to JWT verification using Supabase Auth.
*   **Layered Violation**: Business logic (e.g., notification creation) is leaking into the transport layer (`server.ts`).

### B. Duplicated Logic
*   **Audit Systems**: We have two parallel audit systems (legacy `shift_audit_logs` and new `audit_events`). These must be unified.
*   **Frontend Fetching**: Every component implements its own `fetch` + `loading` + `error` state.
*   **Permission Checks**: Role-based logic is duplicated across frontend and backend without a single source of truth.

### C. Fragile Modules
*   **`server.ts`**: At 500+ lines, it is a "God Object" that handles everything from OAuth to DB migrations.
*   **Roster Validation**: Clinical safety rules (e.g., max consecutive night shifts) are hardcoded in `rosterValidationService.ts`.
*   **Migration Strategy**: DB schema updates are handled via `try-catch` blocks in the app startup, which is prone to race conditions.

### D. Scaling Risks
*   **Database Contention**: SQLite will become a bottleneck with concurrent staff updates.
*   **Polling Overhead**: Real-time features (Notifications) use 30s polling, which doesn't scale and provides a poor UX.
*   **Data Volume**: Audit logs and shifts are fetched in bulk without pagination.

---

## 3. Refactoring Roadmap

### Phase 1: Infrastructure Alignment (High Priority)
*   [ ] **Supabase Migration**: Rewrite `server/db/db.ts` to use Supabase PostgreSQL.
*   [ ] **JWT Verification**: Implement middleware to verify Supabase tokens on all `/api` routes.
*   [ ] **Schema Unification**: Consolidate `schema.sql` and `supabase_schema.sql`.

### Phase 2: Backend Decomposition
*   [ ] **Route Extraction**: Move all route handlers from `server.ts` to `server/routes/`.
*   [ ] **Service Unification**: Merge audit systems and centralize notification triggers.
*   [ ] **Configuration Table**: Move hardcoded clinical rules to a `system_settings` table.

### Phase 3: Frontend Modernization
*   [ ] **TanStack Query Integration**: Replace manual `fetch` calls with managed queries/mutations.
*   [ ] **Real-time Layer**: Replace polling with Supabase Realtime subscriptions.
*   [ ] **Shared UI Library**: Extract common patterns (Modals, Toasts, Loaders) into `src/shared/components`.

### Phase 4: Operational Excellence
*   [ ] **Pagination**: Implement cursor-based pagination for Audit Logs and Tasks.
*   [ ] **Logging & Monitoring**: Enhance `server/utils/logger.ts` to stream to an external provider.

---

## 4. Next Steps (Immediate Actions)
1.  **Modularize `server.ts`**: Extract User and Notification routes to reduce file complexity.
2.  **Prepare Supabase Client**: Setup the backend Supabase client to allow side-by-side migration.
3.  **Unify Audit Logging**: Refactor `rosterService` to use a single audit path.
