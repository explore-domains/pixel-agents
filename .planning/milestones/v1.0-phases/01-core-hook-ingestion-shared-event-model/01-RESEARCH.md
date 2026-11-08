# Phase 01: Core Hook Ingestion + Shared Event Model - Research

**Researched:** 2026-11-08
**Domain:** Multi-agent event normalization and HTTP ingestion server
**Confidence:** HIGH

## Summary

The goal of Phase 1 is to establish the foundation for multi-agent event ingestion by creating a generic local HTTP route, implementing a canonical `AgentEvent` schema, and building a dispatch layer that routes events to agents based on provider/workspace sessions. The project is already architecturally prepared for this through a provider-isolated design where each agent adapter translates raw hook payloads into a unified `AgentEvent` union at the normalization boundary.

The current `claudeProvider` serves as the baseline reference. To implement this phase, we must extend the existing Fastify server to accept events for 5 agents (Claude Code, Antigravity, Gemini CLI, OpenCode, Copilot), build the infrastructure for `HookEventHandler` to dispatch events agnostic of provider-specific hook names, and ensure the `SessionRouter` can handle provider-namespaced session identification.

**Primary recommendation:** Build a generic `POST /api/hooks/:providerId` ingestion endpoint and implement the `HookProvider` interface for the required providers, ensuring all raw-to-canonical normalization happens within the provider module.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTTP Ingestion | API/Backend | — | Receives webhook payloads from CLI agents |
| Event Normalization | API/Backend | — | Translates provider-specific JSON to canonical `AgentEvent` |
| Session Routing | API/Backend | — | Maps CLI session IDs to internal agent identities |
| Event Dispatch | API/Backend | — | Routes normalized events based on `AgentEvent.kind` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Fastify | [verified: npm registry] | HTTP Server | Existing codebase implementation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fastify | Express | Performance/Type safety preference in existing codebase |

## Package Legitimacy Audit

> **Required** whenever this phase installs external packages.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| None | N/A | N/A | N/A | N/A | N/A | Approved |

*No new packages are required for this phase.*

## Architecture Patterns

### System Architecture Diagram

```
[Agent CLI]
    ↓ POST /api/hooks/:providerId (Raw Event)
[HTTP Server (Fastify)]
    ↓ Callback (providerId, Raw Event)
[HookEventHandler]
    ├─ normalizeHookEvent (provider.normalizeHookEvent) 
    │   (Raw Event → Canonical AgentEvent)
    ├─ SessionRouter.resolve(session_id) → agentId
    └─ Dispatch on AgentEvent.kind
        ├─ 'toolStart'        → UI updates (PreToolUse)
        ├─ 'toolEnd'          → UI updates (PostToolUse)
        ├─ 'turnEnd'          → UI updates (Stop/Notification)
        └─ ...etc
```

### Recommended Project Structure
```
server/src/
├── httpServer.ts       # Canonical ingestion endpoint
├── hookEventHandler.ts # Provider-agnostic dispatching
├── sessionRouter.ts    # Provider-agnostic session-to-agent mapping
└── providers/
    ├── index.ts        # Provider registry
    └── hook/           # Provider adapters
        ├── claude/     # Reference implementation
        ├── antigravity/
        ├── gemini-cli/
        ├── opencode/
        └── copilot/
```

### Pattern 1: Normalization Boundary
**What:** All raw fields are read **only in the provider module**. Downstream handlers never access provider-specific fields, only the canonical `AgentEvent`.
**When to use:** Whenever integrating a new agent provider.
**Example:**
```typescript
// server/src/providers/hook/claude/claude.ts
normalizeHookEvent(raw: Record<string, unknown>): { sessionId: string; event: AgentEvent } | null {
  // Translate provider-specific fields here
}
```

### Anti-Patterns to Avoid
- **Branching on Provider ID:** Never use `if (providerId === 'claude')` in downstream handlers. Everything should be generic and handle all agents via the `AgentEvent` interface.
- **Global Session ID Assumptions:** Never assume raw session IDs are globally unique. Always use the namespaced `providerId:sessionId` composite key.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP Server | Custom HTTP logic | Fastify | Performance, type safety, existing codebase |
| Event Dispatch | Provider-specific logic | `HookEventHandler` | Provider isolation and maintainability |

## Common Pitfalls

### Pitfall 1: Session ID Collisions
**What goes wrong:** Events from one agent route to another's session.
**Why it happens:** Two providers use the same session ID format or raw session IDs are treated as globally unique.
**How to avoid:** Namespace identity by `providerId:sessionId`. Validate session ID format uniqueness per provider.
**Warning signs:** Events from one agent appear in another agent's office session.

## Code Examples

### Normalization Boundary Contract
```typescript
// core/src/provider.ts
interface HookProvider {
  readonly id: string;
  readonly protocolVersion: number;
  normalizeHookEvent(raw: Record<string, unknown>): 
    { sessionId: string; event: AgentEvent } | null;
  // ...
}
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No new external packages needed for Phase 1 | Package Legitimacy Audit | High - would require further research into dependencies |

## Open Questions

1. **How do Antigravity, Gemini CLI, OpenCode, and Copilot format their session IDs?**
   - *What we know:* Claude Code uses UUIDs.
   - *What's unclear:* The exact format for the other 4.
   - *Recommendation:* Research during Phase B (Explore).

2. **How do they authenticate hook POST requests?**
   - *What we know:* Shared `PIXEL_AGENTS_TOKEN` is used for authentication.
   - *What's unclear:* If any CLI agent requires more specific authentication mechanism.
   - *Recommendation:* Research during Phase B.

## Environment Availability

**Environment Availability:** AUDITED (Node.js/Fastify assumed)

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | ✓ | 20+ | — |
| Fastify | API Layer | ✓ | (Existing) | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (inferred from codebase) |
| Config file | vitest.config.ts |
| Quick run command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| CORE-01 | Canonical `AgentEvent` normalization | unit | `npm test server/src/providers/hook/` |

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Shared token `PIXEL_AGENTS_TOKEN` (Phase 1) |
| V5 Input Validation | yes | `providerId` regex, body validation |

### Known Threat Patterns for {stack}
*   **Unauthorized Hook Delivery:** Ensure the HTTP server only accepts POST requests with a valid token.
*   **Replay/Spoofing:** Future phases should explore signed payloads; Phase 1 uses shared token for local developer environment simplicity.

## Sources

### Primary (HIGH confidence)
- `.planning/research/SUMMARY.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/phases/01-core-hook-ingestion-shared-event-model/01-CONTEXT.md`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Existing codebase uses Fastify.
- Architecture: HIGH - Thoroughly documented in `ARCHITECTURE.md`.
- Pitfalls: HIGH - Documented in `PITFALLS.md` and synthesized in `SUMMARY.md`.

**Research date:** 2026-11-08
**Valid until:** 2026-12-08
