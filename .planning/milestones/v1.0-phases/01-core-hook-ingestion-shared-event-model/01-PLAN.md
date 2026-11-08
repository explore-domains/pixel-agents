---
phase: 01-core-hook-ingestion-shared-event-model
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - core/src/provider.ts
  - server/src/httpServer.ts
  - server/src/hookEventHandler.ts
  - server/src/sessionRouter.ts
  - server/src/providers/hook/
autonomous: true
requirements:
  - CORE-01
user_setup: []
must_haves:
  truths:
    - "The HTTP ingestion server accepts raw hook payloads from all 5 agent providers without blocking the CLI call path."
    - "Each provider's raw payload is normalized into the canonical AgentEvent model before dispatch."
    - "Session routing uses provider-scoped identity so identical raw session IDs do not collide across providers."
  artifacts:
    - path: "core/src/provider.ts"
      provides: "Canonical AgentEvent union and HookProvider contract"
    - path: "server/src/httpServer.ts"
      provides: "HTTP server route and auth gate for provider-specific hook ingestion"
    - path: "server/src/sessionRouter.ts"
      provides: "Namespaced session registry and buffered event handling"
    - path: "server/src/hookEventHandler.ts"
      provides: "Provider-agnostic event dispatch based on normalized AgentEvent.kind"
    - path: "server/src/providers/hook/"
      provides: "Per-provider normalization adapters for Claude, Antigravity, Gemini CLI, OpenCode, and Copilot"
  key_links:
    - from: "server/src/httpServer.ts"
      to: "server/src/hookEventHandler.ts"
      via: "POST /api/hooks/:providerId -> onHookEvent callback"
      pattern: "HOOK_API_PREFIX.*providerId"
    - from: "server/src/hookEventHandler.ts"
      to: "core/src/provider.ts"
      via: "provider.normalizeHookEvent(raw)"
      pattern: "normalizeHookEvent\(raw\)"
    - from: "server/src/sessionRouter.ts"
      to: "server/src/hookEventHandler.ts"
      via: "sessionId registry + buffered event replay"
      pattern: "register\(sessionId, agentId\)"
---

<objective>
Establish the canonical ingestion boundary for multi-agent hooks so raw payloads from all providers are validated, normalized, and dispatched without session collisions or UI latency regressions.

Purpose: This phase creates the shared event model and HTTP ingestion layer required before provider adapters, routing, and UI integration can work reliably.
Output: A generic provider hook route, namespaced session registry, normalized AgentEvent contract, and a bounded async ingestion flow ready for the remaining 5-agent provider work.
</objective>

<execution_context>
@/home/philipp/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/philipp/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/01-core-hook-ingestion-shared-event-model/01-CONTEXT.md
@.planning/phases/01-core-hook-ingestion-shared-event-model/01-RESEARCH.md
@core/src/provider.ts
@server/src/httpServer.ts
@server/src/hookEventHandler.ts
@server/src/sessionRouter.ts
@server/src/providers/hook/claude/claude.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: lock the canonical AgentEvent contract and normalize provider boundaries</name>
  <files>core/src/provider.ts, server/src/hookEventHandler.ts</files>
  <read_first>core/src/provider.ts, server/src/hookEventHandler.ts</read_first>
  <action>Define the canonical `AgentEvent` union and `HookProvider` contract in `core/src/provider.ts` with provider-agnostic event kinds (`toolStart`, `toolEnd`, `turnEnd`, `sessionStart`, `sessionEnd`, `permissionRequest`, `subagentStart`, `subagentEnd`). Keep all raw provider-field extraction inside provider-specific normalization logic and ensure `HookEventHandler.handleEvent` only reads normalized events, not provider-specific payload keys. Use the existing Claude implementation as the reference contract and avoid adding provider-specific branching in shared dispatch code.</action>
  <verify>
    <automated>npm test -- --run server/src/providers/hook/</automated>
  </verify>
  <acceptance_criteria>
    - `AgentEvent` contains the canonical union used by the server dispatcher for all providers.
    - `HookEventHandler.handleEvent` calls `provider.normalizeHookEvent(raw)` and acts only on `normalized.event.kind`.
    - A provider-specific payload with a raw `session_id` and `hook_event_name` is accepted only when normalized to a valid `AgentEvent`.
  </acceptance_criteria>
  <done>Shared event model exists and is the only contract used by downstream dispatch.</done>
</task>

<task type="auto">
  <name>Task 2: add the generic ingestion route, auth gate, and bounded async queue</name>
  <files>server/src/httpServer.ts, server/src/sessionRouter.ts</files>
  <read_first>server/src/httpServer.ts, server/src/sessionRouter.ts</read_first>
  <action>Extend `server/src/httpServer.ts` with the generic `POST /api/hooks/:providerId` route and `PIXEL_AGENTS_TOKEN` bearer validation, returning `202 Accepted` immediately after enqueueing, so the HTTP call does not block agent execution. Add a bounded, fire-and-forget queue and call `onHookEvent` with `(providerId, rawEvent)` after validation. In `server/src/sessionRouter.ts`, switch the session map to namespaced keys using `providerId:sessionId` and maintain buffered event replay for sessions that register later; keep the queue and session buffer small enough to avoid UI stalls while preserving event ordering for the same session.</action>
  <verify>
    <automated>npm test -- --run server/src/httpServer.test.ts server/src/sessionRouter.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - A POST to `/api/hooks/claude` with a valid token returns HTTP 202 immediately.
    - A raw event from a second provider using an identical session ID is stored under a distinct namespaced key and does not collide with Claude events.
    - Buffered events replay once the matching session registers, without reordering unrelated sessions.
  </acceptance_criteria>
  <done>The ingestion endpoint is generic, authenticated, non-blocking, and session-safe across providers.</done>
</task>

<task type="auto">
  <name>Task 3: wire provider dispatch and verification for all 5 agent families</name>
  <files>server/src/providers/hook/, server/src/hookEventHandler.ts</files>
  <read_first>server/src/hookEventHandler.ts, server/src/providers/hook/claude/claude.ts</read_first>
  <action>Register the provider adapter entrypoints under `server/src/providers/hook/` and ensure `HookEventHandler` dispatches by normalized `AgentEvent.kind` instead of provider branching. Add the provider adapter stubs for Antigravity, Gemini CLI, OpenCode, and Copilot alongside the existing Claude reference and map each raw event type to the canonical schema. Validate the same session namespacing and dispatch contracts against the 5 providers without introducing provider-specific logic downstream.</action>
  <verify>
    <automated>npm test -- --run server/src/providers/hook/ server/src/hookEventHandler.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - Every provider adapter implements `normalizeHookEvent(raw)` and returns a valid `{ sessionId, event }` pair or `null` for irrelevant payloads.
    - `HookEventHandler` routes sessionStart, toolStart, toolEnd, and turnEnd events for all supported providers through the same normalized path.
    - The normalized path does not rely on `if (providerId === ...)` branching in the shared handler.
  </acceptance_criteria>
  <done>All 5 provider families can feed the same canonical event pipeline.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → HTTP server | Raw hook payloads arrive from local CLI processes over loopback |
| HTTP server → dispatch layer | Untrusted provider JSON is normalized before downstream processing |
| session registry → UI | Session keys are used for routing and display, so collisions create silent misattribution |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01 | Spoofing | `POST /api/hooks/:providerId` | mitigate | Validate bearer token `PIXEL_AGENTS_TOKEN` at the Fastify route and reject requests before dispatch |
| T-02 | Tampering | normalized event boundary | mitigate | Normalize raw payloads inside provider adapters and reject malformed/unsupported events before downstream state changes |
| T-03 | Repudiation | session registry | mitigate | Keep provider-scoped `providerId:sessionId` keys and trace event provenance in the queue and logs |
| T-04 | Information Disclosure | hook payloads | accept | Local loopback-only interface; payloads are workspace-local and not exposed externally by default |
| T-05 | Denial of Service | queue and buffer | mitigate | Use bounded queue length and eviction policy to prevent unbounded accumulation or latency spikes |
| T-06 | Elevation of Privilege | session routing | mitigate | Require a valid auth token and prevent route access from unregistered providers via the provider registry |
| T-01-SC | Tampering | npm/pip/cargo installs | mitigate | No package installs are required in this phase; if a dependency is later added, the project must re-run the legitimacy gate before installation |
</threat_model>

<verification>
Overall phase verification:
- Unit tests cover the canonical normalization contract, HTTP ingestion route, and session namespacing rules.
- Manual smoke check runs a valid provider payload through `/api/hooks/<providerId>` and confirms a `202` response and queued dispatch.
- Conflict check proves that two providers with the same raw `session_id` resolve to unique internal keys.
</verification>

<success_criteria>
- Generic `POST /api/hooks/:providerId` accepts and acknowledges provider payloads without blocking CLI execution.
- All provider payloads normalize into canonical `AgentEvent` objects before any routing or UI logic touches them.
- Provider-scoped session keys prevent collisions across Claude, Antigravity, Gemini CLI, OpenCode, and Copilot.
- The normalized event flow is ready for downstream session routing and multi-agent office visualization.
</success_criteria>

<output>
Create `.planning/phases/01-core-hook-ingestion-shared-event-model/01-SUMMARY.md` when done.
</output>

## Artifacts this phase produces

- `core/src/provider.ts` — canonical `AgentEvent` union and `HookProvider` contract
- `server/src/httpServer.ts` — generic `POST /api/hooks/:providerId` ingestion route with token validation and 202 reply
- `server/src/sessionRouter.ts` — `providerId:sessionId` registry with buffered event replay
- `server/src/hookEventHandler.ts` — normalized dispatch path for provider-agnostic event handling
- `server/src/providers/hook/claude/claude.ts` — reference normalization boundary to mirror for the other providers
- `server/src/providers/hook/antigravity/` — Antigravity adapter implementing `normalizeHookEvent(raw)`
- `server/src/providers/hook/gemini-cli/` — Gemini CLI adapter implementing `normalizeHookEvent(raw)`
- `server/src/providers/hook/opencode/` — OpenCode adapter implementing `normalizeHookEvent(raw)`
- `server/src/providers/hook/copilot/` — Copilot adapter implementing `normalizeHookEvent(raw)`
- `server/src/providers/hook/index.ts` — registry exposing the supported provider implementations
