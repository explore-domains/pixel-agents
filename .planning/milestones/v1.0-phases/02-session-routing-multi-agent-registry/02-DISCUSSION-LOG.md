# Phase 02: Session Routing + Multi-Agent Registry - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-08
**Phase:** 02-session-routing-multi-agent-registry
**Areas discussed:** Multi-Agent Collision Prevention, Registry Architecture, Provider-scoped Auth

---

## Multi-Agent Collision Prevention

| Option | Description | Selected |
|--------|-------------|----------|
| Sequential Assignment | Assign avatars sequentially from a fixed set. | |
| Provider-Specified Avatar | Agent specifies a preferred avatar in its hook payload. | ✓ |
| Hue Shift Offset | Apply a hue shift on the second agent to differentiate. | ✓ |
| Fixed Seat Mapping | Assign fixed "office chairs" sequentially. | ✓ |
| Static Seats | Keep agents in original seats even if a session ends. | ✓ |
| Provider + Session ID | Label agents in UI as [Provider] [Session ID]. | ✓ |

**User's choice:** All selected options were confirmed via interactive turns.
**Notes:** User prioritized stability (static seats) and clear identification (session ID labels).

---

## Registry Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Flat Store | AgentStateStore remains flat; SessionRouter handles mapping. | ✓ |
| Global ID Sequence | Single global sequence for all providers. | ✓ |
| Add ProviderId | Add providerId to PersistedAgent and update persist(). | ✓ |

**User's choice:** Confirmed global IDs and flat storage for simplicity.
**Notes:** Decided to add `providerId` to persistence to enable reliable session restoration.

---

## Provider-scoped Auth

| Option | Description | Selected |
|--------|-------------|----------|
| Shared Secret | Keep shared secret for simplicity. | ✓ |
| Shared Secret Validation| Only check the shared secret; trust providerId in path. | ✓ |

**User's choice:** Confirmed shared secret for local environment simplicity.
**Notes:** User chose simpler auth over per-provider tokens for now.

---

## the agent's Discretion

- Specific implementation details of the hue shift range and seat coordinate mapping are left to agent discretion.

## Deferred Ideas

- None — discussion stayed within phase scope.
