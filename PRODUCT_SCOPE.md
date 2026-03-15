# Product Scope: Code Gamma

## 1. Core Mission
**"To serve as the single source of truth for Emergency Department (ED) staff operations."**

Code Gamma is designed to eliminate fragmented communication (WhatsApp, Excel, printed sheets) by providing a centralized, real-time platform for operational coordination. It focuses exclusively on the **people** and **processes** that run the department, not the patients they treat.

---

## 2. Core Modules (Phase 1)
These modules form the "Minimum Viable Product" and are essential for daily operations.

*   **Roster Management**: Dynamic viewer and editor for medical officer shifts. Must support complex shift codes (EP, AM, PM, NS, etc.).
*   **Shift Swaps & Giveaways**: A formalized workflow for staff to exchange or surrender shifts with automated conflict checking.
*   **Announcements (Notice Board)**: Centralized broadcast system for operational updates, protocol changes, and administrative notices.
*   **Staff Directory**: A searchable database of team members, roles, and contact information to facilitate quick peer-to-peer communication.
*   **Real-time Notifications**: Alerts for roster changes, swap requests, and urgent administrative broadcasts.

---

## 3. Phase 2 Modules
Secondary features that enhance operational efficiency but are not strictly required for the system to function.

*   **Task Coordination**: Assignment and tracking of non-clinical operational tasks (e.g., "Equipment Check", "SOP Review").
*   **Owed Days Tracking**: Automated management of HKO (Owed Off-duty) and PN (Post-night) rest days to ensure labor compliance.
*   **Document Library**: A repository for static operational resources, such as department SOPs, clinical guidelines (as PDF resources), and leave forms.
*   **Leave Management Integration**: A formal request system that feeds directly into the roster editor to prevent scheduling conflicts.

---

## 4. Nice-to-Have Modules
Future enhancements for long-term scalability and user experience.

*   **External Calendar Sync**: Integration with Google/iCal for personal schedule management.
*   **Staffing Analytics**: Data visualization on staffing trends, leave patterns, and department coverage.
*   **Automated Roster Generation**: Algorithmic suggestions for roster creation based on staff preferences and fairness rules.

---

## 5. Explicitly Excluded Features
To prevent feature creep and maintain focus, the following are strictly out of scope:

*   **Electronic Medical Records (EMR)**: No clinical patient notes or history.
*   **Clinical Documentation**: No procedure logs, discharge summaries, or referral letters.
*   **Lab/Radiology Results**: No integration with diagnostic systems.
*   **Patient Database**: No storage of patient names, IDs, or clinical data.
*   **Billing & Finance**: No integration with hospital payment or insurance systems.

---

## 6. Feature Decision Rule
When evaluating a new feature request, apply the **"Staff vs. Patient"** rule:

> **"Does this feature help a staff member manage their time, their tasks, or their team, WITHOUT requiring access to clinical patient data?"**

*   If **YES** (and it relates to ED operations) -> **Consider for Roadmap.**
*   If **NO** (it involves patient clinical data or EMR functionality) -> **Reject.**

*Code Gamma is an operational tool, not a clinical one.*
