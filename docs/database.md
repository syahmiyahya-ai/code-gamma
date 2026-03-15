# Code Gamma Database Documentation

This document describes the SQLite database schema for the Code Gamma Roster Management System.

## Tables

### `users`
Stores staff information and authentication details.
- `id` (TEXT, PK): Unique identifier for the user.
- `name` (TEXT): Full name of the staff member.
- `role` (TEXT): System role (Staff, Supervisor, RosterAdmin, SystemAdmin).
- `phone_number` (TEXT): Contact number.
- `email` (TEXT): Email address.
- `avatar_url` (TEXT): URL to profile picture.
- `google_access_token` (TEXT): OAuth token for calendar sync.
- `google_refresh_token` (TEXT): OAuth refresh token.

### `shift_types`
Defines the available shift categories.
- `code` (TEXT, PK): Short code (e.g., AM, PM, NS).
- `name` (TEXT): Full name of the shift.
- `start_time` (TEXT): Shift start time.
- `end_time` (TEXT): Shift end time.
- `description` (TEXT): Details about the shift responsibilities.
- `background_color` (TEXT): UI color for the shift block.
- `text_color` (TEXT): UI text color for contrast.

### `shifts`
The core roster table mapping users to dates and shift types.
- `id` (INTEGER, PK, AI): Unique shift assignment ID.
- `user_id` (TEXT, FK): Reference to `users.id`.
- `date` (TEXT): Date of the shift (YYYY-MM-DD).
- `shift_code` (TEXT, FK): Reference to `shift_types.code`.
- `is_code_blue` (INTEGER): Flag for Code Blue response duty.

### `shift_audit_logs`
Legacy audit table for shift changes.
- `id` (INTEGER, PK, AI): Log ID.
- `shift_id` (INTEGER): Reference to the modified shift.
- `action` (TEXT): Action performed (CREATE, UPDATE, DELETE).
- `changed_by` (TEXT): User ID who made the change.
- `old_data` (TEXT): JSON representation of previous state.
- `new_data` (TEXT): JSON representation of new state.
- `timestamp` (DATETIME): Time of change.

### `audit_events`
Modern structured audit table for all system events.
- `id` (INTEGER, PK, AI): Event ID.
- `actor_user_id` (TEXT, FK): User who performed the action.
- `event_type` (TEXT): Type of event (e.g., ROSTER_ENTRY_CREATED).
- `entity_type` (TEXT): Type of entity affected (e.g., SHIFT).
- `entity_id` (TEXT): ID of the affected entity.
- `before_state` (TEXT): JSON before state.
- `after_state` (TEXT): JSON after state.
- `metadata` (TEXT): Additional context.
- `created_at` (DATETIME): Event timestamp.

### `shift_swaps`
Manages requests for shift exchanges between staff.
- `id` (INTEGER, PK, AI): Swap request ID.
- `requester_id` (TEXT, FK): User requesting the swap.
- `requester_shift_id` (INTEGER, FK): Shift to be given away.
- `target_user_id` (TEXT, FK): User requested to take the shift (null for open giveaway).
- `target_shift_id` (INTEGER, FK): Shift to be taken in return (optional).
- `status` (TEXT): Request status (PENDING, ACCEPTED, APPROVED, REJECTED).
- `reason` (TEXT): User-provided reason.
- `created_at` (DATETIME): Request time.

### `tasks`
General tasks assigned to staff.
- `id` (INTEGER, PK, AI): Task ID.
- `title` (TEXT): Task heading.
- `description` (TEXT): Detailed instructions.
- `due_date` (TEXT): Deadline.
- `created_by` (TEXT, FK): User who created the task.
- `is_edited` (INTEGER): Flag if task was modified.
- `is_deleted` (INTEGER): Soft delete flag.

### `task_assignments`
Mapping of tasks to specific users.
- `id` (INTEGER, PK, AI): Assignment ID.
- `task_id` (INTEGER, FK): Reference to `tasks.id`.
- `user_id` (TEXT, FK): Reference to `users.id`.
- `status` (TEXT): Completion status (PENDING, COMPLETED).
- `completed_at` (DATETIME): Time of completion.

### `announcements`
System-wide broadcasts.
- `id` (INTEGER, PK, AI): Announcement ID.
- `title` (TEXT): Heading.
- `content` (TEXT): Body text.
- `author_id` (TEXT, FK): User who posted.
- `is_pinned` (INTEGER): Flag for priority display.

### `notifications`
User-specific alerts and messages.
- `id` (TEXT, PK): Unique notification ID.
- `user_id` (TEXT, FK): Recipient.
- `title` (TEXT): Alert heading.
- `message` (TEXT): Alert content.
- `type` (TEXT): Category (SYSTEM, SWAP_REQUEST, etc.).
- `related_entity_id` (TEXT): Contextual ID (e.g., swap ID).
- `is_read` (INTEGER): Read status.

## Relationships

- **Users** are the central entity, linked to shifts, tasks, swaps, announcements, and notifications.
- **Shifts** link users to shift types and are the subject of swaps and audits.
- **Tasks** can have multiple assignments to different users.
- **Audit Events** track changes across all entities, linked back to the actor (User).
