# Audit Event System: Code Gamma

## 1. Design Goals
The Audit Event System is designed to provide a comprehensive, immutable record of all critical operational changes within Code Gamma.

*   **Traceability**: Every significant action must be traceable back to a specific user and timestamp.
*   **Immutability**: Once an audit event is recorded, it can never be modified or deleted.
*   **Accountability**: The system must clearly identify who performed an action, what was changed, and the context of the change.

---

## 2. Audit Event Model
The core of the system is the `audit_events` table, which generalizes the previous shift-specific logging.

### Table: `audit_events`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER/UUID | Primary Key |
| `actor_user_id` | TEXT | ID of the user who performed the action (FK to `users.id`) |
| `event_type` | TEXT | The action performed (e.g., 'CREATE', 'UPDATE', 'APPROVE') |
| `entity_type` | TEXT | The domain object affected (e.g., 'ROSTER_ENTRY', 'SWAP_REQUEST') |
| `entity_id` | TEXT | The unique identifier of the affected entity |
| `before_state` | JSON/TEXT | The state of the entity before the change (Nullable) |
| `after_state` | JSON/TEXT | The state of the entity after the change (Nullable) |
| `metadata` | JSON/TEXT | Additional context (e.g., IP address, user agent, reason) |
| `created_at` | DATETIME | Timestamp of the event (Default: CURRENT_TIMESTAMP) |

---

## 3. Event Types
Events are categorized by their domain module to facilitate filtering and reporting.

### Roster Events
*   `ROSTER_PUBLISHED`: A new roster version becomes the live source of truth.
*   `SHIFT_ASSIGNED`: A shift is assigned to a staff member in a draft version.
*   `SHIFT_MODIFIED`: Details of an existing shift assignment are changed.

### Swap Events
*   `SWAP_REQUESTED`: A user initiates a shift swap or giveaway.
*   `SWAP_ACCEPTED`: A target user accepts a swap request.
*   `SWAP_APPROVED`: An admin finalizes a swap, triggering a roster update.

### Leave Events
*   `LEAVE_SUBMITTED`: A staff member requests time off.
*   `LEAVE_APPROVED`: A supervisor approves a leave request.

### Task Events
*   `TASK_CREATED`: A new operational task is added to the system.
*   `TASK_ASSIGNED`: A task is linked to a specific staff member.
*   `TASK_COMPLETED`: A staff member marks a task as done.

### Announcement Events
*   `ANNOUNCEMENT_CREATED`: A new notice is posted to the board.
*   `ANNOUNCEMENT_PINNED`: An announcement is given high-priority status.

---

## 4. Logging Rules
Audit events **MUST** be generated for the following operations:

1.  **Any state change** to a `published` roster version.
2.  **Any approval or rejection** of workflow items (Swaps, Leave).
3.  **Creation or deletion** of system-wide entities (Announcements, Tasks).
4.  **Changes to user roles** or administrative permissions.
5.  **Manual overrides** performed by system administrators.

---

## 5. Immutability Rules
*   **Append-Only**: The `audit_events` table is strictly append-only. No `UPDATE` or `DELETE` operations are permitted on this table.
*   **Database Level Protection**: Where possible, database triggers or application-level middleware should prevent any modification to existing audit rows.
*   **Integrity Checks**: Periodic checksums or hashing can be implemented to ensure the audit trail has not been tampered with.

---

## 6. Migration Strategy
To transition from the legacy `shift_audit_logs` to the generalized `audit_events` system:

1.  **Shadow Logging**: Implement the `audit_events` table and begin writing all new events to it. For roster changes, write to both `shift_audit_logs` (for backward compatibility) and `audit_events`.
2.  **Legacy Data Wrapper**: Create a script to map existing `shift_audit_logs` entries into the `audit_events` format.
    *   `shift_id` maps to `entity_id`.
    *   `action` maps to `event_type`.
    *   `changed_by` maps to `actor_user_id`.
    *   `old_data`/`new_data` map to `before_state`/`after_state`.
3.  **Deprecation**: Once the frontend and reporting tools are updated to use `audit_events`, the `shift_audit_logs` table can be retired.

---

## 7. Query Examples

### Investigate all changes made by a specific Admin
```sql
SELECT * FROM audit_events 
WHERE actor_user_id = 'admin_uuid' 
ORDER BY created_at DESC;
```

### View the history of a specific shift swap
```sql
SELECT event_type, actor_user_id, created_at, metadata 
FROM audit_events 
WHERE entity_type = 'SWAP_REQUEST' AND entity_id = 'swap_123' 
ORDER BY created_at ASC;
```

### Audit all roster publications in the last 30 days
```sql
SELECT created_at, actor_user_id, metadata 
FROM audit_events 
WHERE event_type = 'ROSTER_PUBLISHED' 
AND created_at > datetime('now', '-30 days');
```
