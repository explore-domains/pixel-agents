# Phase 01: Core Hook Ingestion + Shared Event Model - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Establishing the canonical infrastructure for multi-agent event ingestion, including a generic local HTTP route, internal session namespacing, and an asynchronous ingestion queue to ensure non-blocking delivery for Antigravity, Gemini, OpenCode, and Copilot.

</domain>

<decisions>
## Implementation Decisions

### Normalization Strategy
- **D-01:** Use a generic route `POST /api/hooks/:providerId` (Option A). This maximizes scalability and standardizes validation logic across all 5 agent providers.

### Session Namespacing
- **D-02:** Namespace sessions internally using a composite key `providerId:sessionId` (Option A). This guarantees isolation in the pixel office even if separate agents use identical raw session IDs (e.g., `default`).

### Auth Scope
- **D-03:** Use a single shared secret (`PIXEL_AGENTS_TOKEN`) for all hook providers (Option A). This prioritizes installation simplicity for the local developer environment.

### Async Ingestion
- **D-04:** Implement a fire-and-forget async bounded queue for event ingestion (Option A). The HTTP server will immediately acknowledge hooks with `202 Accepted`, preventing UI rendering latency from hanging the agent CLIs.

### the agent's Discretion
- The specific implementation of the bounded queue (length, eviction policy) is left to the agent's discretion, provided it satisfies the non-blocking constraint.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Roadmap
- `.planning/PROJECT.md` — Project goals, constraints, and current context.
- `.planning/ROADMAP.md` — Phase structure and success criteria.
- `.planning/REQUIREMENTS.md` — V1 requirements mapping.

### Research
- `.planning/research/SUMMARY.md` — Synthesized research on provider hooks, architecture, and pitfalls.
- `.planning/research/ARCHITECTURE.md` — Normalization boundary and event flow design.
- `.planning/research/PITFALLS.md` — Latency, collision, and auth risk analysis.

### Codebase
- `server/src/httpServer.ts` — Current Fastify server implementation.
- `server/src/hookEventHandler.ts` — Existing event dispatch logic.
- `server/src/sessionRouter.ts` — Current session routing and buffering.
- `server/src/providers/hook/claude/claude.ts` — Reference HookProvider implementation.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HookProvider` interface: Use as the contract for all 4 new agent adapters.
- `claudeProvider`: The existing reference implementation for normalization and status formatting.
- `Fastify` server: Re-use the existing `httpServer.ts` routes but extend with the generic `:providerId` pattern.

### Established Patterns
- `AgentEvent` union: The target schema for all normalized payloads.
- `SessionRouter.register/resolve`: Extend to support internal namespacing.

### Integration Points
- `httpServer.ts`: Add the generic hook route and integration with the async queue.
- `hookEventHandler.ts`: Hook into the new registry and namespaced router.

</code_context>

<specifics>
## Specific Ideas
- No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas
- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-Core Hook Ingestion + Shared Event Model*
*Context gathered: 2026-11-08*
