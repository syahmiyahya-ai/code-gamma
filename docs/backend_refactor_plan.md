# Backend Refactor Plan: Code Gamma

## 1. The Problem: Monolithic `server.ts`
Currently, `server.ts` acts as a "God Object" containing over 900 lines of code. It mixes several distinct responsibilities:
*   **Server Configuration**: Express setup, Vite middleware, and environment variables.
*   **Database Initialization**: Schema creation, migrations, and seeding.
*   **Authentication**: Supabase client setup and (eventually) middleware.
*   **Business Logic**: Complex calculations for rosters, swaps, and tasks.
*   **API Routing**: Dozens of endpoints defined in a single flat file.
*   **External Integrations**: Google Calendar sync and file handling.

**Risks**: High cognitive load for developers, difficult to write unit tests, prone to merge conflicts, and challenging to audit for security.

---

## 2. Target Architecture
The goal is to move toward a **Domain-Driven Service Architecture** where logic is separated by responsibility.

```text
server/
├── db/             # Database connection and schema management
├── routes/         # Express route handlers (Request/Response logic)
├── services/       # Domain business logic (Roster, Swaps, Audit)
├── middleware/     # Auth, Logging, and Error handling
└── utils/          # Shared helper functions
```

---

## 3. Layer Responsibilities

### Route Layer (`server/routes/`)
*   **Input**: Receives Express `req` and `res` objects.
*   **Validation**: Checks for required body parameters and headers.
*   **Delegation**: Calls the appropriate method in the **Service Layer**.
*   **Output**: Sends the HTTP response (200 OK, 400 Bad Request, etc.).
*   **Rule**: No direct database queries or complex business logic.

### Service Layer (`server/services/`)
*   **Logic**: Performs calculations, state transitions, and cross-module coordination.
*   **Persistence**: Interacts with the database via `better-sqlite3`.
*   **Audit**: Calls `auditService` to log changes.
*   **Rule**: No knowledge of HTTP or Express. Should be testable in isolation.

### Database Layer (`server/db/`)
*   **Connection**: Manages the `better-sqlite3` instance.
*   **Schema**: Handles table creation and migrations.

---

## 4. Example Implementation: Roster Domain

### Service: `server/services/rosterService.ts`
```typescript
import { db } from "../db/connection";
import { auditService } from "./auditService";

export const rosterService = {
  updateShift: (id: number, shiftCode: string, actorId: string) => {
    const before = db.prepare("SELECT * FROM shifts WHERE id = ?").get(id);
    
    db.prepare("UPDATE shifts SET shift_code = ? WHERE id = ?").run(shiftCode, id);
    
    const after = db.prepare("SELECT * FROM shifts WHERE id = ?").get(id);
    
    auditService.logAuditEvent({
      actorUserId: actorId,
      eventType: 'UPDATE',
      entityType: 'SHIFT',
      entityId: id,
      beforeState: before,
      afterState: after
    });
    
    return after;
  }
};
```

### Route: `server/routes/rosterRoutes.ts`
```typescript
import { Router } from "express";
import { rosterService } from "../services/rosterService";

const router = Router();

router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { shift_code } = req.body;
  const actorId = req.user.id; // From Auth Middleware

  const updatedShift = rosterService.updateShift(Number(id), shift_code, actorId);
  res.json(updatedShift);
});

export default router;
```

---

## 5. Migration Strategy
To avoid a "Big Bang" rewrite, we will refactor incrementally:

1.  **Step 1: Extract Database**: Move the `db` instance and initialization logic from `server.ts` to `server/db/connection.ts`.
2.  **Step 2: Domain Extraction**: Pick one domain (e.g., `Announcements`) and move its logic to a Service and its routes to a Route file.
3.  **Step 3: Plug into `server.ts`**: Use `app.use("/api/announcements", announcementRoutes)` in the main file.
4.  **Step 4: Repeat**: Gradually move Roster, Swaps, and Tasks logic out of `server.ts`.
5.  **Step 5: Cleanup**: Once all routes are moved, `server.ts` will only contain server configuration and middleware setup.

**Backward Compatibility**: During migration, existing routes in `server.ts` will continue to work alongside the new modular routes.
