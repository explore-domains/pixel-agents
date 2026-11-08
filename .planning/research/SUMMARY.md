# Project Research Summary

**Project:** ED Pixel Agents
**Domain:** VS Code extension for multi-agent lifecycle visualization
**Researched:** 2026-11-08
**Confidence:** MEDIUM

## Executive Summary

ED Pixel Agents is a local-first VS Code extension that visualizes multiple AI coding agents as a shared office. The core product idea is simple: each agent emits lifecycle events such as session start, tool use, wait states, and end-of-session, and the extension turns those signals into pixel-character behavior. The research consistently points to a single winning pattern: normalize provider-specific hook payloads into a canonical event model before any UI logic runs. That keeps the product architecture resilient as more CLIs are added and prevents the webview from learning each tool's custom event schema.

The recommended stack is a local HTTP ingestion server inside the extension, paired with CLI-specific hook installers that bridge each agent to the canonical API. Claude Code already has native HTTP hook support; Antigravity, Gemini CLI, and Copilot need shell/command adapters; OpenCode is best integrated via SDK event subscription or a tiny plugin. This is the right integration model because it minimizes provider lock-in while preserving real-time responsiveness. The extension should treat the event stream as fire-and-forget, asynchronous, and bounded, not as a log replay engine.

The biggest risks are not feature gaps but operational correctness: latency spikes, session identity collisions, and weak local auth boundaries. The mitigation is straightforward and should be built in from day one: use async, coalesced event delivery; namespace sessions by provider/workspace/lifetime; and use provider-scoped secrets or signed payloads for loopback traffic. If those rules are respected, the architecture scales cleanly to a five-agent office without a rewrite.

## Key Findings

### Recommended Stack

The strongest recommendation from the stack research is to use HTTP hooks as the primary integration layer across agents, with CLI-specific adapters where native HTTP is unavailable. Claude Code offers the cleanest baseline because it natively supports HTTP hooks and exposes rich lifecycle events like `SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`, and permission notifications. Antigravity and Gemini CLI both support command-script hooks and can bridge to the local server with a tiny shell wrapper; OpenCode supports a plugin/SDK event stream with richer lifecycle coverage; GitHub Copilot follows a similar command-script or HTTP model and is likely hooks-only or partial transcript-based.

**Core technologies:**
- VS Code extension host + webview — runtime for the agent office and animation layer
- Local HTTP server — canonical ingestion endpoint for all providers
- CLI hook installers — writes provider-specific config files or scripts pointing back to the local server
- Event normalization layer — converts each provider's raw payload into a shared `AgentEvent` schema
- Optional transcript polling — fallback for providers with JSONL session logs (Claude baseline)

### Expected Features

The product's table stakes are not broad agent telemetry; they are a small set of lifecycle events that drive the user-visible animation model. The essential events are `session_start`, `tool_call_before`, `tool_call_after`, and `session_end`, with `error` and `permission_request` as the key exceptions. These events are enough to make a character enter the office, work, pause, and leave. Differentiators include “permission wait” states, deep-thinking pauses between tool events, and tool-specific visual props so the UI reflects actual work rather than generic activity.

**Must have (table stakes):**
- Session start / session end transitions — agents appear and leave the office
- Tool-call before/after states — working vs done states for each agent
- Error handling visualization — confused or frustrated state on failures
- Provider-agnostic event routing — same animation behavior across all CLIs

**Should have (competitive):**
- Permission wait behavior — visual cue when the agent requests user input
- Deep thinking delay animation — displays latency instead of dead silence
- Tool-specific art and status text — read/search/edit/shell states feel native

**Defer (v2+):**
- Full log streaming and transcript replay — too noisy for real-time animation
- Broad analytics dashboards — not required for the core office experience
- Cross-agent orchestration beyond simple office state — not needed for MVP

### Architecture Approach

The architecture is already strongly aligned to a provider-isolated normalization design. Each CLI has a provider adapter whose job is to translate raw hook payloads into the same `AgentEvent` contract. The HTTP server accepts events at a generic route such as `POST /api/hooks/:providerId`, passes them into the `HookEventHandler`, and resolves the correct agent by `session_id` through a shared `SessionRouter`. The downstream handlers operate only on normalized events (`toolStart`, `toolEnd`, `turnEnd`, `permissionRequest`, etc.), never on raw provider fields. This is the correct pattern to scale from one CLI to five.

**Major components:**
1. Provider adapters — translate raw CLI events into canonical `AgentEvent` objects
2. HTTP ingestion layer — generic route, provider ID validation, async acceptance
3. Session router + registry — maps live sessions to agent instances and buffers early events
4. Event handler dispatch — routes on `AgentEvent.kind`, not raw hook names
5. Webview renderer — consumes normalized events to animate characters and status state

### Critical Pitfalls

The research identifies a set of concrete design constraints rather than abstract concerns. The top risks are latency, session collisions, and auth drift. If events are processed synchronously or the webview updates on every hook, the office will feel laggy. If sessions are not namespaced by provider/workspace/lifespan, a second agent can overwrite or merge with the first. If a shared secret is reused across providers, a compromised CLI can spoof events for another agent. These are all preventable with a small number of explicit rules.

1. **Event delivery latency** — make event ingestion async and coalesced; process freshest state, not every intermediate transition.
2. **Session ID collisions** — namespace identity by provider, workspace, and process lifetime; never treat a raw session ID as globally unique.
3. **Shared auth mistakes** — use local-only traffic and provider-scoped tokens or signed payloads; do not reuse one secret across all agents.
4. **Stale event overwrite** — time-order updates using timestamps or monotonic sequence numbers before accepting new state.
5. **Silent hook failure** — log and surface failed dispatches so the office does not drift silently from the truth.

## Implications for Roadmap

Based on the combined research, the highest-value phase ordering is clear: begin with the shared ingestion and normalization infrastructure, then add session registration and office rendering, then layer on provider-specific integrations and polish.

### Phase 1: Core Hook Ingestion + Shared Event Model
**Rationale:** This is the foundation for every other provider and the main architectural decision. The research shows that provider-specific differences are isolated at the normalization boundary, so the core server should be built first.
**Delivers:** A generic local HTTP endpoint, provider ID validation, normalized event schema, and a minimal dispatch layer.
**Addresses:** Table stakes from the feature research: `session_start`, `tool_call_before`, `tool_call_after`, and `session_end` across providers.
**Avoids:** Latency and silent failure pitfalls by requiring async receipt, coalescing, and logging.

### Phase 2: Session Routing + Multi-Agent Registry
**Rationale:** The office cannot work correctly until state is mapped to a stable agent identity. The architecture research explicitly calls out `session_id` → `agentId` mapping and the risk of collisions across providers and workspaces.
**Delivers:** Session registry, per-agent state machine, buffered event handling, and collision guardrails.
**Uses:** The canonical `AgentEvent` model and the shared `SessionRouter` pattern.
**Implements:** The architecture's required normalization and routing boundary.
**Avoids:** Session collisions and stale-state overwrite issues.

### Phase 3: Provider Integrations (Claude baseline + others)
**Rationale:** Once the core system exists, each provider can be added as a thin adapter. Claude is the baseline reference; Antigravity, Gemini CLI, OpenCode, and Copilot follow the same event contract but different installation mechanisms.
**Delivers:** Working adapters for the supported CLIs and the first true multi-agent office experience.
**Addresses:** Real-world table stakes and differentiators: permission wait, tool-specific visual states, and agent lifecycle transitions.
**Avoids:** Integration drift by requiring each provider to normalize into the same event contract before UI logic.

### Phase 4: UX Polish + Safety / Ops Hardening
**Rationale:** The final layer should make the office feel alive without introducing mismatches or false state. The pitfall analysis strongly warns against latency, stale rendering, and insecure local trust assumptions.
**Delivers:** Better animations, event ordering, and provider-scoped auth or signed payload protection.
**Addresses:** Differentiators such as “deep thinking” states, permission wait states, and tool context labeling.
**Avoids:** Replay, ghost sessions, and spoofing attacks.

### Phase Ordering Rationale

- Build the normalization boundary first because it decouples provider variance from office rendering.
- Add session routing before provider expansion because multiple agents make collisions and stale events worse.
- Leave UI polish until after reliability is stable, because the pitfall research shows timing and state correctness are harder than visuals to get right.
- Keep provider-specific research focused on hook payloads and auth, not on the rendering layer.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Provider hook APIs and local auth model for Antigravity, Gemini CLI, OpenCode, and Copilot
- **Phase 2:** Actual session ID formats and collision scenarios across providers/workspaces
- **Phase 3:** Tool naming and lifecycle payloads for each provider to map correctly to the office's UI states

Phases with standard patterns and low research risk:
- **Core HTTP ingestion + event normalization:** well-defined pattern already present in the architecture doc
- **Basic office rendering:** standard webview state machine pattern once normalized events exist

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | The research is strong on the event-hook landscape and provider support matrix, but some provider APIs are newly launched or only partially documented. |
| Features | HIGH | The core lifecycle events are consistent across tools and match the product's expected user experience. |
| Architecture | HIGH | The normalization boundary and session routing pattern are explicit and already aligned with the existing codebase design. |
| Pitfalls | MEDIUM | The risk analysis is concrete and project-specific, but it is mostly design-level reasoning rather than empirically measured runtime data. |

**Overall confidence:** MEDIUM

### Gaps to Address

- Validate the actual session ID and metadata formats for Antigravity, Gemini CLI, and Copilot in real runtime usage.
- Confirm whether OpenCode and Copilot will operate in hooks-only mode or whether transcript-based fallback is required.
- Define the exact secret model for local event delivery: provider-scoped tokens, signed payloads, or loopback-only trust with validation.
- Recheck whether any provider emits duplicate or out-of-order tool lifecycle events that need coalescing or deduplication in the session state machine.

## Sources

### Primary sources
- .planning/research/STACK.md — hook support matrix, provider-by-provider integration strategy
- .planning/research/FEATURES.md — required lifecycle events and MVP feature prioritization
- .planning/research/ARCHITECTURE.md — normalization boundary, provider registration, session routing, event dispatch
- .planning/research/PITFALLS.md — latency, collision, auth, and stale-state risk analysis

### Secondary / corroborating sources
- Official and product documentation for Claude Code, Antigravity, Gemini CLI, OpenCode, and GitHub Copilot hook/event configuration
- Existing project design assumptions for the local HTTP server, session router, and webview-driven office UI

---
*Research completed: 2026-11-08*
*Ready for roadmap: yes*
