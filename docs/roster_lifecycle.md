# Roster Lifecycle: Code Gamma

## 1. Roster Versioning
To ensure accountability and prevent accidental data loss, Code Gamma implements a versioned roster system. Each roster period can have multiple versions, but only one can be active at a time.

### Proposed Table: `roster_versions`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID/INT | Primary Key |
| `period_id` | INT | Reference to `roster_periods` |
| `version_number` | INT | Incremental version for the period |
| `status` | TEXT | Current state (draft, review, published, archived) |
| `created_at` | DATETIME | Timestamp of creation |
| `published_at` | DATETIME | Timestamp when status became 'published' |
| `created_by` | UUID | Reference to the admin who created the version |

---

## 2. Lifecycle States
The roster moves through four distinct states to ensure quality control.

| State | Description | Access Level |
| :--- | :--- | :--- |
| **Draft** | Initial creation phase. Work in progress. | Visible only to Roster Admins. |
| **Review** | Pending final approval from a supervisor or head of department. | Visible to Admins and Supervisors. |
| **Published** | The "Live" roster. The single source of truth for the ward. | Visible to all Staff. |
| **Archived** | Historical record. Replaced by a newer version or period. | Visible to Admins for audit purposes. |

---

## 3. Editing Rules
Access control is strictly enforced based on the roster's current state.

*   **Draft**: Fully editable by Roster Admins. No notifications are sent to staff during this phase.
*   **Review**: Editable by Supervisors. Admins have read-only access or limited "comment" capability.
*   **Published**: **Read-Only**. No direct edits allowed. Any changes must occur via the **Shift Swap** system or by creating a new "Correction" version.
*   **Archived**: **Immutable**. Data cannot be changed under any circumstances to preserve audit integrity.

---

## 4. Database Changes
The system transitions from a flat `shifts` table to a relational versioned structure.

### New Table: `roster_periods`
Defines the time boundaries (e.g., "March 2026").
*   `id`, `start_date`, `end_date`, `name`.

### Updated Table: `roster_entries` (formerly `shifts`)
Shifts are now tied to a specific version.
*   `id`
*   `roster_version_id` (FK to `roster_versions`)
*   `staff_id` (FK to `users`)
*   `shift_type_id` (FK to `shift_types`)
*   `date`

---

## 5. Publish Workflow
The transition to "Live" status follows a controlled sequence:

1.  **Admin Edits Draft**: Roster is prepared in the background.
2.  **Submit for Review**: Status changes to `review`; Supervisors are notified.
3.  **Approve & Publish**: Supervisor clicks "Publish".
4.  **System Lock**: The version status becomes `published`. Any previous `published` version for the same period is automatically moved to `archived`.
5.  **Broadcast**: Notifications are triggered to all staff: *"The roster for [Period] is now live."*

---

## 6. Conflict Prevention
To maintain the "Single Source of Truth" mission:
*   **Single Active Version**: The system enforces a unique constraint: only one version per `period_id` can have the status `published`.
*   **Edit Lock**: The API rejects `POST/PUT/DELETE` requests to `roster_entries` if the parent `roster_version` is `published` or `archived`.
*   **Overlap Check**: New `roster_periods` cannot overlap with existing periods.

---

## 7. Migration Strategy
To ensure backward compatibility and zero downtime:

1.  **Shadow Phase**: Create the new tables (`roster_periods`, `roster_versions`).
2.  **Legacy Wrapper**: Create a "Legacy Version" (ID: 0) in `roster_versions` for all existing data in the current `shifts` table.
3.  **Dual-Write (Optional)**: Temporarily update the API to write to both the old flat structure and the new versioned structure.
4.  **Frontend Toggle**: Update the UI to filter shifts by the `published` version ID.
5.  **Deprecation**: Once the versioned system is stable, the old flat `shifts` table can be archived or dropped.

*Existing data remains accessible as "Version 0" of their respective dates.*
