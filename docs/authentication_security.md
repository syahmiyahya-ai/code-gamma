# Authentication Security: Code Gamma

## 1. Current Risk: Client-Side Trust
Currently, the Code Gamma backend relies on the `user_id` provided by the client in request bodies or headers to identify the actor of an operation.

**The Risk**: This creates a critical **Impersonation Vulnerability**. A malicious user or a compromised client can manually craft an API request with a different `user_id` (e.g., an Admin's ID), and the server will execute the command with those elevated privileges. There is currently no server-side verification that the user making the request is actually the owner of that identity.

---

## 2. Secure Authentication Flow
To close this trust boundary, the system must transition to a **Token-Based Verification** model using Supabase Auth JWTs (JSON Web Tokens).

### The Flow:
1.  **Client**: Authenticates with Supabase Auth and receives a short-lived JWT.
2.  **Request**: The client includes this JWT in the `Authorization: Bearer <token>` header for every API call.
3.  **Middleware**: An Express middleware intercepts the request before it reaches the route handler.
4.  **Verification**: The middleware verifies the JWT signature using the Supabase Project Secret.
5.  **Identity Extraction**: The backend extracts the verified `user_id` (the `sub` claim) from the token.
6.  **Context Injection**: The backend fetches the user's role from the local SQLite database and attaches a `user` object to the request context (`req.user`).
7.  **Execution**: The route handler uses `req.user.id` for all operations, ignoring any client-provided IDs.

---

## 3. Backend Middleware
A centralized `authMiddleware` will be responsible for enforcing security across all protected routes.

### Middleware Responsibilities:
*   **Header Parsing**: Extract the Bearer token from the `Authorization` header.
*   **JWT Validation**: Use the Supabase SDK or a JWT library to verify the token's validity and expiration.
*   **User Enrichment**: Query the local `users` table to retrieve the user's `name` and `role`.
*   **Request Decoration**: Populate `req.user` with the verified identity:
    ```typescript
    req.user = {
      id: "verified-uuid-from-supabase",
      email: "user@hospital.com",
      role: "Admin" | "Staff",
      name: "Dr. Smith"
    }
    ```

---

## 4. Route Security Rules
Once the middleware is active, the following rules must be strictly followed in all API route handlers:

1.  **Identity Source**: Never use `req.body.user_id` or `req.query.user_id` to identify the person performing the action. Always use `req.user.id`.
2.  **Authorization**: Use `req.user.role` to restrict access to administrative routes (e.g., roster editing, announcement pinning).
3.  **Ownership Checks**: For operations like "Edit My Profile" or "Cancel My Swap," verify that the resource being modified belongs to `req.user.id`.

---

## 5. Integration with Audit Logging
The **Audit Logging System** depends on the verified identity to maintain a tamper-resistant trail.

*   The `actorUserId` passed to `auditService.logAuditEvent` **MUST** be sourced from `req.user.id`.
*   This ensures that even if a client attempts to spoof an audit log by sending a fake ID, the system will record the actual authenticated user who triggered the event.

---

## 6. Migration Strategy
To move to this secure model without breaking the existing platform:

1.  **Phase 1: Implementation**: Create the `authMiddleware` and the Supabase server-side client.
2.  **Phase 2: Optional Enforcement**: Apply the middleware to all `/api` routes but allow a "fallback" mode where it logs a warning if a token is missing but still processes the request using the legacy `user_id`.
3.  **Phase 3: Route Refactoring**: Update each route handler to prioritize `req.user.id` over `req.body.user_id`.
4.  **Phase 4: Strict Enforcement**: Change the middleware to return a `401 Unauthorized` error if a valid JWT is not provided.
5.  **Phase 5: Cleanup**: Remove all `user_id` fields from the frontend request payloads and the backend `req.body` parsing logic.

*This transition ensures that Code Gamma remains the definitive and secure source of truth for ED operations.*
