# Backend Design: Audit Logging Service

## 1. Audit Service Architecture
The `auditService` is a centralized backend utility responsible for the creation and persistence of audit events. It serves as the single entry point for all domain modules to record state changes and administrative actions.

*   **Location**: `server/services/auditService.ts`
*   **Responsibility**: Validating, serializing, and inserting audit records into the `audit_events` table.

---

## 2. Logging Interface
The service exposes a standardized, type-safe interface for logging events.

### Function Signature: `logAuditEvent`
```typescript
interface AuditEventParams {
  actorUserId: string;      // The user performing the action
  eventType: string;        // e.g., 'CREATE', 'UPDATE', 'APPROVE', 'PUBLISH'
  entityType: string;       // e.g., 'ROSTER_ENTRY', 'SWAP_REQUEST', 'TASK'
  entityId: string | number; // Unique ID of the affected object
  beforeState?: any;        // Object state prior to change (optional)
  afterState?: any;         // Object state after change (optional)
  metadata?: any;           // Contextual data (IP, reason, etc.) (optional)
}

async function logAuditEvent(params: AuditEventParams): Promise<void>;
```

---

## 3. Integration Points
The `auditService` must be integrated into the following domain services to capture all critical operations:

*   **`rosterService`**: Logs shift assignments, modifications, and roster publications.
*   **`swapService`**: Logs swap requests, acceptances, and final approvals.
*   **`leaveService`**: Logs leave submissions and status updates (Approved/Rejected).
*   **`taskService`**: Logs task creation, assignments, and completions.
*   **`announcementService`**: Logs new posts and pinning/unpinning actions.

---

## 4. Event Enforcement Rules
To ensure a reliable audit trail, the following rules apply:

1.  **Mandatory Logging**: Any database transaction that modifies the state of a `PUBLISHED` roster or a workflow item (Swap/Leave) **MUST** include a call to `logAuditEvent`.
2.  **Transaction Integrity**: Ideally, the audit log insertion should occur within the same database transaction as the entity change to ensure atomicity.
3.  **Actor Identification**: Every API request must provide a valid `actorUserId` (derived from the Supabase session) to the service layer.

---

## 5. Serialization Rules
*   **JSON Storage**: The `beforeState`, `afterState`, and `metadata` fields must be serialized to JSON strings before insertion into the SQLite `audit_events` table.
*   **Deep Copy**: The service should perform a deep copy or snapshot of the objects to ensure that subsequent mutations in the application code do not affect the recorded audit state.
*   **Sensitive Data Masking**: The service must strip sensitive information (e.g., tokens, passwords) from the state objects before serialization.

---

## 6. Performance Considerations
*   **Non-Blocking Execution**: While audit logging is critical, it should not significantly increase API latency. The service should use asynchronous patterns where appropriate.
*   **Batching (Future)**: If write volume increases, the service can implement a background queue to batch audit insertions.
*   **Synchronous SQLite**: Since `better-sqlite3` is synchronous, the service must ensure queries are optimized with proper indexing on `entity_type` and `entity_id`.

---

## 7. Migration Strategy
To maintain backward compatibility with the existing `shift_audit_logs`:

1.  **Dual-Write Phase**: For a transitional period, the `rosterService` will call both the legacy logging logic and the new `auditService`.
2.  **Legacy Wrapper**: The `auditService` can include a helper method to "back-fill" or wrap legacy logs into the new format if requested by the frontend.
3.  **Unified Querying**: The backend will provide a unified API endpoint that can aggregate data from both tables during the migration window.
4.  **Final Cutover**: Once all modules are integrated with `auditService`, the `shift_audit_logs` table will be marked as deprecated and eventually removed.
