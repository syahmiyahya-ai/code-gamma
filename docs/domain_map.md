# Domain Map: Code Gamma

## 1. Core Domain Modules
These modules represent the essential operational pillars of the Emergency Department.

*   **Roster**: Manages the scheduling of medical officers. It is the central engine of the platform, defining who is on duty, where, and when.
*   **Shift Swaps**: Orchestrates the peer-to-peer exchange and giveaway of shifts. It manages the lifecycle of a swap from request to final administrative approval.
*   **Staff**: Manages the identity, roles, and contact information of all department members. It serves as the source of truth for user profiles.
*   **Announcements**: A broadcast domain for operational updates and administrative notices.
*   **Notifications**: A cross-cutting domain that handles the delivery of real-time alerts and system messages to users.

---

## 2. Secondary Modules
Optional extensions that provide additional operational depth.

*   **Tasks**: Coordination of non-clinical duties and assignments.
*   **Owed Days**: Tracking and redemption of earned rest days (HKO/PN).
*   **Document Library**: Management of operational resources, SOPs, and forms.
*   **Leave Management**: Handling of annual and emergency leave requests and their impact on the roster.

---

## 3. Domain Boundaries
To maintain system integrity, each module has strict ownership over its data entities.

| Module | Owns | Must NOT Modify |
| :--- | :--- | :--- |
| **Roster** | Shifts, Shift Types, Audit Logs | User Roles, Swap Statuses |
| **Shift Swaps** | Swap Requests, Swap Workflow | Shift Codes (directly), Staff Profiles |
| **Staff** | User Profiles, Roles, Avatars | Shift Assignments, Task Statuses |
| **Announcements** | Notice Board Content, Pins | User Notifications |
| **Tasks** | Task Definitions, Assignments | Roster Entries |
| **Owed Days** | HKO/PN Balances, Redemption Logs | Shift Assignments |

---

## 4. Proposed Backend Structure
While `server.ts` currently acts as a monolith, the following logical structure is proposed for future refactoring to maintain domain clarity.

```text
server/
├── roster/          # Logic for shifts, types, and audit logs
├── swaps/           # Logic for swap requests and approvals
├── staff/           # Logic for user profiles and directory
├── announcements/   # Logic for notice board
├── notifications/   # Logic for alert delivery
├── tasks/           # Logic for task assignments and nudges
├── leave/           # Logic for leave requests
└── resources/       # Logic for document library and owed days
```

---

## 5. API Responsibility Map
Each API route is owned by a specific domain module.

| Route | Owning Module |
| :--- | :--- |
| `/api/shifts`, `/api/shift-types`, `/api/audit-logs` | **Roster** |
| `/api/shift-swaps` | **Shift Swaps** |
| `/api/users` | **Staff** |
| `/api/announcements` | **Announcements** |
| `/api/notifications` | **Notifications** |
| `/api/tasks`, `/api/my-tasks`, `/api/task-assignments` | **Tasks** |
| `/api/leave-requests` | **Leave Management** |
| `/api/owed-days` | **Owed Days** |
| `/api/documents` | **Document Library** |

---

## 6. Cross-Module Rules
To prevent "spaghetti code," modules must interact through defined rules:

1.  **Roster as Source of Truth**: The **Shift Swaps** and **Leave** modules cannot directly update the `shifts` table. They must trigger a "Roster Update" event or call a Roster service method to ensure audit logs are correctly generated.
2.  **Notification Triggering**: Any module can trigger a notification, but only the **Notifications** module can manage the `notifications` table state (e.g., marking as read).
3.  **Staff Isolation**: No module (except **Staff**) is permitted to modify user roles or contact information.
4.  **Task Independence**: The **Tasks** module tracks assignments but does not influence shift scheduling or leave eligibility.

---

## 7. Future Expansion Strategy
When adding new features:
1.  **Identify Domain**: Determine if the feature fits an existing module or requires a new one.
2.  **Define Ownership**: Explicitly state which database tables the new feature "owns."
3.  **Enforce Boundaries**: Ensure the new feature does not directly mutate data owned by other modules.
4.  **Incremental Rollout**: Implement the backend logic first, followed by the API, and finally the frontend UI components, maintaining backward compatibility at each step.
