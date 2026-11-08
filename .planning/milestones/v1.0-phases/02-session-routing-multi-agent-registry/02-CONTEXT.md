# Phase 02: Session Routing + Multi-Agent Registry - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement robust session ID namespacing and provider-specific registry to prevent collisions in the pixel office, enabling two or more agents to be active simultaneously.

</domain>

<decisions>
## Implementation Decisions

### Multi-Agent Collision Prevention
- **D-01:** Use Provider-Specified Avatar mapping for agent identification.
- **D-02:** When multiple agents request the same avatar ID, apply a Hue Shift Offset to differentiate them.
- **D-03:** Use Fixed Seat Mapping (1-5) for agent positioning.
- **D-04:** Use Static Seats; do not shift remaining agents when a session ends.
- **D-05:** Label agents in UI as `[Provider Name] [Session ID]`.
- **D-06:** Provide Detailed Tooltip on hover (using existing tooltip component).
- **D-07:** Render agents with Equal Visibility (no special z-index focus for active agents).
- **D-08:** Keep agent sessions separate even if they share a project directory.
- **D-09:** Agents enter via Standard Fade-In at assigned seat.

### Registry Architecture
- **D-10:** Maintain flat structure for `AgentStateStore` (delegating provider-scoping to `SessionRouter`).
- **D-11:** Use global sequence for Agent ID generation.
- **D-12:** Add `providerId` to `PersistedAgent` and update `persist()` to include it for restoration.

### Provider-scoped Auth
- **D-13:** Continue using Shared Secret for hook payload authentication.
- **D-14:** Implement Shared Secret Validation (trust providerId in path, check shared secret).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Roadmap
- `.planning/PROJECT.md` — Project goals, constraints, and current context.
- `.planning/ROADMAP.md` — Phase structure and success criteria.
- `.planning/REQUIREMENTS.md` — V1 requirements mapping.

### Codebase
- `server/src/sessionRouter.ts` — Session ID namespacing and registry mapping.
- `server/src/agentStateStore.ts` — Agent registry management and persistence.
- `server/src/paletteAssigner.ts` — Avatar/palette assignment logic.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AgentStateStore`: Can be extended with `providerId` in `persist()`.
- `paletteAssigner.ts`: Already handles diverse palette assignment; needs update to handle collision-based hue shifting.
- `SessionRouter`: Already implements namespacing with `makeKey(providerId, sessionId)`.

### Established Patterns
- HookEvent normalization boundary: All provider events are normalized before registry processing.

### Integration Points
- `server/src/agentStateStore.ts`: Update `PersistedAgent` type and `persist()`/`loadPersistedAgents()`.
- `server/src/paletteAssigner.ts`: Integrate hue shift logic when collisions detected.

</code_context>

<specifics>
## Specific Ideas
- Multi-agent rendering should feel seamless and consistent.

</specifics>

<deferred>
## Deferred Ideas
- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-Session Routing + Multi-Agent Registry*
*Context gathered: 2026-11-08*
