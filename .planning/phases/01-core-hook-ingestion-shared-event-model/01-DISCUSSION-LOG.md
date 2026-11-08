# Phase 01: Core Hook Ingestion + Shared Event Model - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-08
**Phase:** 01-Core Hook Ingestion + Shared Event Model
**Areas discussed:** Normalization Strategy, Session Namespacing, Auth Scope, Async Ingestion

---

## Normalization Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Generic route (Option A) | Scalable, standardizes validation | ✓ |
| Separate routes (Option B) | Isolated per-provider handling | |

**User's choice:** Option A
**Notes:** Decided to use generic route for scalability and consistency.

---

## Session Namespacing

| Option | Description | Selected |
|--------|-------------|----------|
| Namespace internally (Option A) | Composite key `providerId:sessionId` | ✓ |
| Require unique IDs (Option B) | Force unique IDs at source | |

**User's choice:** Option A
**Notes:** Guaranteed isolation regardless of what the CLI agents do.

---

## Auth Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Shared secret (Option A) | Single token for all providers | ✓ |
| Per-provider tokens (Option B) | Unique secret per provider | |

**User's choice:** Option A
**Notes:** Prioritizing installation simplicity.

---

## Async Ingestion

| Option | Description | Selected |
|--------|-------------|----------|
| Fire-and-forget queue (Option A) | Non-blocking, robust | ✓ |
| Synchronous dispatch (Option B) | Simple, blocking | |

**User's choice:** Option A
**Notes:** Non-blocking is required to prevent CLI agent CLI hangs.

---

## the agent's Discretion

- The specific implementation of the bounded queue (length, eviction policy).

## Deferred Ideas

None — discussion stayed within phase scope.
