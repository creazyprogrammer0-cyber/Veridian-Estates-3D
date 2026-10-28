# Security Specification — Veridian Estates Platform

## 1. Data Invariants
1. **Default-Deny Catch-All**: Every path not explicitly matched is denied for both `read` and `write`.
2. **Verified Identity**: Write operations by authenticated administrators require `request.auth != null && request.auth.token.email_verified == true`.
3. **Bootstrapped & Lookup Admin RBAC**: An administrator is verified either via the bootstrapped owner email (`creazyprogrammer0@gmail.com` with `email_verified == true`) or via an existing document in `/admins/$(request.auth.uid)`.
4. **Public Read Isolation**: Public visitors can only `get` or `list` records in `projects`, `buildings`, `floors`, `apartments` when `resource.data.publicationStatus == 'published'`, and `tourManifests` when `resource.data.captureStatus == 'published'`. Unpublished drafts are strictly invisible to non-admins.
5. **Relational Integrity**:
   - A `Building` cannot be created unless its `projectId` exists in `/projects/$(incoming().projectId)`.
   - A `Floor` cannot be created unless its `buildingId` exists in `/buildings/$(incoming().buildingId)`.
   - An `Apartment` cannot be created unless its `projectId`, `buildingId`, and `floorId` exist.
6. **PII Protection on Inquiries**: Customer inquiries in `/inquiries/{inquiryId}` contain PII (`customerEmail`, `customerPhone`). Public visitors can `create` a strictly validated inquiry with initial status `'new'` or `'site_visit_requested'` and empty `internalNotes`, and `createdAt == request.time`, but **cannot** `get`, `list`, `update`, or `delete` any inquiry. Only verified administrators can `read` or `update` inquiries.
7. **Terminal State Locking**: Once an `Inquiry` reaches `status == 'closed'`, non-admin updates are blocked; only `isAdmin()` can modify or reopen it.
8. **Strict Key & Size Enforcement**: Every entity validation helper enforces `hasAll`, `hasOnly`, string `.size()` bounds, regex ID format, and server timestamp equality (`request.time`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Project**: Adding `"isFeaturedHack": true` to a `/projects/{id}` write -> Denied by `hasOnly`.
2. **Unverified Admin Email Spoof**: Request with `email == 'creazyprogrammer0@gmail.com'` and `email_verified == false` -> Denied by `isVerifiedAdmin()`.
3. **Self-Assigned Admin Role**: Authenticated non-admin attempting to write `/admins/{theirUid}` -> Denied because only `isSuperAdmin()` can write to `/admins`.
4. **Orphaned Building Creation**: Creating a `/buildings/{id}` pointing to a non-existent `projectId` -> Denied by `exists(/databases/$(database)/documents/projects/$(incoming().projectId))`.
5. **Orphaned Apartment Creation**: Creating an `/apartments/{id}` pointing to a non-existent `floorId` -> Denied by `exists(/databases/$(database)/documents/floors/$(incoming().floorId))`.
6. **Public Scraping of Unpublished Drafts**: Unauthenticated `list` query on `/projects` without filtering `publicationStatus == 'published'` -> Denied by `resource.data.publicationStatus == 'published'`.
7. **Public PII Leak on Inquiries**: Unauthenticated or non-admin authenticated user executing `get` or `list` on `/inquiries` -> Denied (`allow get, list: if isAdmin()`).
8. **Inquiry Status Pre-Confirmation Exploit**: Public visitor submitting a new inquiry with `status: 'site_visit_confirmed'` or non-empty `internalNotes` -> Denied by `create` gate requiring `incoming().status in ['new', 'site_visit_requested'] && incoming().internalNotes == ''`.
9. **Timestamp Forgery**: Submitting an inquiry or project with a forged past/future `createdAt` -> Denied by `incoming().createdAt == request.time`.
10. **Immutable Field Mutation**: Updating `ownerId` or `createdAt` on an existing project -> Denied by `incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`.
11. **ID Poisoning / Oversized Payload**: Creating a document with a 1,500-character ID or 50,000-character message -> Denied by `isValidId()` and `message.size() <= 2000`.
12. **Value Poisoning on Update**: Updating `status` on `/inquiries/{id}` to a boolean `true` without invoking `isValidInquiry(incoming())` -> Denied because `isValidInquiry(incoming())` wraps the entire `allow update` expression.

## 3. Red Team Audit Matrix
- **Identity Spoofing**: Blocked (`ownerId == request.auth.uid` on create, immutable on update).
- **State Shortcutting**: Blocked (public inquiries locked to initial statuses; terminal state locked).
- **Resource Poisoning**: Blocked (all strings bounded by `size()`, all IDs validated by `isValidId`).
- **Update Validation Gate**: Every `allow update` starts with `isValid[Entity](incoming())`.
