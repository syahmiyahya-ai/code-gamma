# Database Target Model: Code Gamma

This document defines the target database schema for Code Gamma, transitioning from a flat scheduling model to a versioned, auditable operational platform.

## 1. Design Principles

*   **Roster as Source of Truth**: The roster is the central entity. All other operational modules (swaps, leave, tasks) must reconcile against it.
*   **Versioned Rosters**: Every roster period (e.g., "March 2026") supports multiple versions (Draft, Review, Published, Archived).
*   **Backward Compatibility**: The new schema must allow for a phased migration where existing data is preserved as "Legacy Version 0".
*   **Auditability**: Every change to a roster entry or sensitive profile data must be logged with a timestamp and the actor's identity.
*   **Strict Boundaries**: Workflow modules (Swaps, Leave) do not directly mutate `roster_entries`. They create requests that, once approved, trigger a roster update event.

---

## 2. Core Tables

### `staff_profiles` (Extends `users`)
Stores identity and contact information for all ED staff.
*   `id` (TEXT, PK): Supabase Auth UUID.
*   `name` (TEXT): Full name.
*   `email` (TEXT): Hospital email.
*   `phone_number` (TEXT): Contact for urgent coordination.
*   `role_id` (INT, FK): Reference to `roles`.
*   `avatar_url` (TEXT): Profile image.
*   `is_active` (BOOLEAN): Soft-delete flag.

### `roles`
Defines system permissions.
*   `id` (INT, PK)
*   `name` (TEXT): e.g., 'Admin', 'Supervisor', 'Medical Officer'.
*   `permissions` (JSON): Granular permission flags.

### `shift_types`
Definitions of available shift codes.
*   `code` (TEXT, PK): e.g., 'AM', 'PM', 'NS'.
*   `name` (TEXT): Descriptive name.
*   `start_time` (TEXT): HH:mm format.
*   `end_time` (TEXT): HH:mm format.
*   `background_color` (TEXT): Hex code for UI.
*   `text_color` (TEXT): Hex code for UI.

### `roster_periods`
Defines a specific scheduling window.
*   `id` (INT, PK)
*   `name` (TEXT): e.g., "March 2026".
*   `start_date` (TEXT): ISO date.
*   `end_date` (TEXT): ISO date.

### `roster_versions`
Manages the lifecycle of a roster for a specific period.
*   `id` (INT, PK)
*   `period_id` (INT, FK): Reference to `roster_periods`.
*   `version_number` (INT): Incremental version within the period.
*   `status` (TEXT): 'DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'.
*   `created_by` (TEXT, FK): Reference to `staff_profiles`.
*   `published_at` (DATETIME): Null if not published.

### `roster_entries` (Replaces `shifts`)
Individual shift assignments tied to a specific version.
*   `id` (INT, PK)
*   `roster_version_id` (INT, FK): Reference to `roster_versions`.
*   `staff_id` (TEXT, FK): Reference to `staff_profiles`.
*   `shift_type_code` (TEXT, FK): Reference to `shift_types`.
*   `date` (TEXT): ISO date.
*   `is_code_blue` (BOOLEAN): Flag for high-intensity duty.

---

## 3. Workflow Tables

### `shift_swap_requests` (Replaces `shift_swaps`)
*   `id` (INT, PK)
*   `requester_id` (TEXT, FK)
*   `requester_entry_id` (INT, FK): Reference to `roster_entries`.
*   `target_user_id` (TEXT, FK, Nullable): Null for open giveaways.
*   `target_entry_id` (INT, FK, Nullable): Null for giveaways.
*   `status` (TEXT): 'PENDING', 'ACCEPTED', 'APPROVED', 'REJECTED'.
*   `reason` (TEXT)

### `leave_requests`
*   `id` (INT, PK)
*   `user_id` (TEXT, FK)
*   `start_date` (TEXT)
*   `end_date` (TEXT)
*   `status` (TEXT): 'PENDING', 'APPROVED', 'REJECTED'.

### `owed_days`
*   `id` (INT, PK)
*   `user_id` (TEXT, FK)
*   `type` (TEXT): 'PN', 'HKO'.
*   `date_earned` (TEXT)
*   `date_redeemed` (TEXT, Nullable)
*   `status` (TEXT): 'OWED', 'REDEEMED'.

---

## 4. Support Tables

### `announcements`
*   `id` (INT, PK)
*   `title` (TEXT)
*   `content` (TEXT)
*   `author_id` (TEXT, FK)
*   `is_pinned` (BOOLEAN)
*   `created_at` (DATETIME)

### `tasks` & `task_assignments`
*   Standard task tracking schema as currently implemented.

### `notifications`
*   `id` (TEXT, PK)
*   `user_id` (TEXT, FK)
*   `title` (TEXT)
*   `message` (TEXT)
*   `type` (TEXT)
*   `is_read` (BOOLEAN)

### `audit_events` (Replaces `shift_audit_logs`)
*   `id` (INT, PK)
*   `entity_type` (TEXT): 'ROSTER', 'STAFF', 'SWAP'.
*   `entity_id` (TEXT): ID of the affected object.
*   `action` (TEXT): 'CREATE', 'UPDATE', 'DELETE', 'PUBLISH'.
*   `actor_id` (TEXT, FK): Who performed the action.
*   `old_data` (JSON)
*   `new_data` (JSON)
*   `timestamp` (DATETIME)

---

## 5. Relationships

```text
[Roster Period] 1 --- * [Roster Version]
                            1 --- * [Roster Entry]
                                        * --- 1 [Staff Profile]
                                        * --- 1 [Shift Type]
```

---

## 6. Integrity Rules

1.  **Unique Publication**: Only one `roster_version` per `period_id` can have the status `PUBLISHED`.
2.  **Immutability**: Once a `roster_version` is `PUBLISHED` or `ARCHIVED`, its related `roster_entries` cannot be modified directly.
3.  **Audit Requirement**: Any change to `roster_entries` in a `DRAFT` or `REVIEW` version must generate an `audit_event`.
4.  **Workflow Isolation**: The `shift_swap_requests` module must not update `roster_entries`. Upon approval, a background service must create a new `roster_version` (or update the current draft) and log the change.

---

## 7. Migration Strategy

1.  **Phase 1: Shadow Schema**: Deploy new tables alongside existing ones.
2.  **Phase 2: Legacy Versioning**:
    *   Create a default `roster_period` for "Legacy Data".
    *   Create a `roster_version` (ID: 0, Status: 'ARCHIVED') for historical shifts.
    *   Migrate all existing `shifts` into `roster_entries` linked to Version 0.
3.  **Phase 3: API Redirection**: Update backend route handlers to query `roster_entries` filtered by the latest `PUBLISHED` version.
4.  **Phase 4: Deprecation**: Once the versioned system is stable, the old `shifts` and `shift_swaps` tables can be removed.
