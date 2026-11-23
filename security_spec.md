# FurrowFlow Security Specification (Phase 0 — Payload-First Security TDD)

## 1. Data Invariants

1. **Root Ownership Invariant**: Every `farms/{farmId}` document must have an immutable `ownerId` matching `request.auth.uid` at creation, and only verified Google accounts (`request.auth.token.email_verified == true`) may write.
2. **Master Gate Relational Invariant**: No subcollection document (`members`, `plants`, `fishTanks`, `tasks`, `completions`) may exist without an existing parent `/farms/{farmId}` document whose `ownerId` matches `incoming().ownerId`, and `incoming().farmId == farmId`.
3. **PII Isolation Invariant**: `/users/{userId}` is strictly isolated to `request.auth.uid == userId` (`get`, `create`, `update`; `list` and `delete` denied). No emails, phone numbers, or addresses are stored in shared farm collections.
4. **Tiered Update Invariant**:
   - **Tier 1 (Farm Owner)**: May create/edit/delete members, plants, fish tanks, and custom tasks, and mark tasks done.
   - **Tier 2 (Assigned Authenticated Worker)**: May only list/get documents where `assignedUid == request.auth.uid` and only update state fields (`lastWateredDate` / `lastMulchedDate` / `lastPrunedDate` / `currentStage` / `nextDrawdownDate` / `lastDrawdownDate` / `status` / `completedDate` / `updatedAt`) via strict `affectedKeys().hasOnly(...)` action branches.
5. **Terminal State Locking**:
   - `completions/{completionId}` records are created with `status == 'done'` and forbid `update` entirely (immutable ledger; undo uses `delete` by owner or `completedByUid`).
   - One-time `tasks/{taskId}` (`recurrenceDays == 0`) with `status == 'completed'` cannot be modified by Tier 2 workers once completed.
6. **Bounded Array & Size Invariant**: Every string has explicit `.size()` bounds and regex patterns matching `firebase-blueprint.json`; `irrigationBedIds` on `fishTanks` is strictly bounded to `size() <= 10` with type validation.
7. **Temporal Integrity**: `createdAt == request.time` on create; `updatedAt == request.time` on update; `createdAt` and `ownerId` and `farmId` are immutable on update.
8. **Secure List Queries**: Every `allow list` rule evaluates `resource.data` directly (`ownerId == request.auth.uid` or `assignedUid == request.auth.uid`) with zero `get()` or `exists()` calls inside `list`.

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Path | Malicious Payload / Condition | Expected Result |
|---|---------------|-------------|-------------------------------|-----------------|
| 1 | Unauthenticated Read | `/farms/farm_1` | `auth: null`, `get` | `PERMISSION_DENIED` |
| 2 | Unverified Email Spoof | `/farms/farm_1` | `email_verified: false`, `create` | `PERMISSION_DENIED` |
| 3 | Cross-User PII Read | `/users/victim_uid` | `auth.uid: attacker_uid`, `get` | `PERMISSION_DENIED` |
| 4 | Owner Identity Spoofing | `/farms/farm_x` | `ownerId: "victim_uid"` while `auth.uid: "attacker_uid"` | `PERMISSION_DENIED` |
| 5 | Shadow / Ghost Field Injection | `/farms/farm_1/plants/p1` | Valid plant fields + `isAdmin: true` | `PERMISSION_DENIED` |
| 6 | Orphaned Subcollection Write | `/farms/nonexistent/plants/p1` | Parent farm does not exist | `PERMISSION_DENIED` |
| 7 | Path ID Poisoning (1.5KB ID) | `/farms/farm_1/plants/<200-char-junk$id>` | Invalid document ID characters/length | `PERMISSION_DENIED` |
| 8 | Client Timestamp Forgery | `/farms/farm_1/tasks/t1` | `createdAt: Timestamp(2020-01-01)` != `request.time` | `PERMISSION_DENIED` |
| 9 | Unbounded Array Poisoning | `/farms/farm_1/fishTanks/ft1` | `irrigationBedIds` with 15 items or non-string item `[123]` | `PERMISSION_DENIED` |
| 10 | Immutable Field Hijack | `/farms/farm_1/plants/p1` | Update changing `ownerId` or `farmId` or `createdAt` | `PERMISSION_DENIED` |
| 11 | Tier 2 Privilege Escalation | `/farms/farm_1/fishTanks/ft1` | Assigned worker attempts to alter `capacityLiters` or `assigneeId` | `PERMISSION_DENIED` |
| 12 | Terminal Ledger Tampering | `/farms/farm_1/completions/c1` | Attempt to `update` an existing `status: "done"` completion log | `PERMISSION_DENIED` |
