# Domain Pitfalls: ED Pixel Agents multi-agent office

**Domain:** VS Code extension + agent lifecycle hooks + pixel office visualization
**Researched:** 2026-11-08
**Overall confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Event delivery latency turns the office into a laggy ghost

**What goes wrong:** Five agents (Claude, Antigravity, Gemini CLI, OpenCode, Copilot) can all fire lifecycle events at once. If the local HTTP listener blocks on each request, serializes payloads, or updates the webview synchronously, the office feels stale and the characters drift behind real work.

**Why it happens:** The extension is designed to be real-time, but hook delivery is effectively a bursty event system. A single slow request, a slow webview update, or an unbounded queue turns a fast CLI into a visual lag machine.

**Consequences:**
- Agent activity appears delayed or inverted
- Characters animate out of sync with real work
- The office collapses into stale state when multiple events arrive in sequence
- Users lose trust in the visualization because it looks slow or wrong

**Prevention:**
- Treat event ingestion as fire-and-forget: accept the request quickly, enqueue, and return immediately
- Use a bounded queue with drop-oldest or coalescing policy for redundant states
- Prioritize the latest state per agent/session instead of processing every intermediate transition
- Keep webview updates batched; do not repaint on every single tool event if the agent state has not meaningfully changed
- Record timestamps and sequence numbers so stale events can be discarded

**Detection:**
- p95/p99 event delivery time > 100–200 ms under a 5-agent burst
- queue depth grows beyond a small threshold
- identical agent state is rendered repeatedly for the same session

---

### Pitfall 2: Session ID collisions make two agents look like one

**What goes wrong:** Different CLIs may reuse common identifiers such as `main`, `default`, `session-1`, or a workspace-local run ID. When those IDs are not namespaced by provider, workspace, and process lifetime, the office merges separate runs into a single avatar or incorrectly reuses the wrong state.

**Why it happens:** The same user can run multiple agents in the same workspace at once. Their lifecycle events can share cookie-like semantics, local temp paths, or shell session conventions even though they are different toolchains.

**Consequences:**
- Agent A appears to continue after Agent B has started
- A closed session keeps updating the wrong character
- The office treats two parallel agents as a single entity
- Stale events resurrect dead sessions and create ghost activity

**Prevention:**
- Namespace every identity as: `agentProvider + workspacePath + sessionId + processStartTime`
- If the CLI does not provide a stable session ID, synthesize one from a strong random value and the current process metadata
- Keep a session registry that maps each live agent instance to a specific visual character
- On session end, explicitly close and evict the mapping before reusing the slot
- Bind session state to workspace roots so the same session ID in different repos does not collide

**Detection:**
- One character jumps between two different agent identities
- A “dead” session emits events after it was closed
- Two agents share the same rendered state or same active session row in the office

---

### Pitfall 3: Local auth is still required when five agents share one office

**What goes wrong:** All agents post to the same local Pixel Agents hook endpoint. If there is no auth boundary, any local script or malicious extension can impersonate an agent and send fake status events. If a shared secret is reused across all five providers, compromise of one provider compromises all.

**Why it happens:** The architecture is local and friendly, which makes it easy to assume trust is implicit. But “same machine” is not the same as “safe by default.” One office with five different providers multiplies the need for identity separation.

**Consequences:**
- Fake events trigger wrong office state or false animations
- A compromised or buggy agent can spoof another provider
- One leaked token grants access to all agent sessions in the office
- Hard-to-debug attacks can masquerade as legitimate session lifecycle activity

**Prevention:**
- Restrict incoming hook traffic to loopback/localhost only
- Use per-provider tokens or HMAC signatures, not one global secret for all agents
- Include agent identity, workspace path, session ID, and nonce in signed payloads
- Rotate tokens when a provider is reinstalled or a session is recreated
- Reject stale or replayed payloads when `timestamp` or `nonce` is invalid

**Detection:**
- Unknown provider IDs appear in the event stream
- Events arrive from non-local sources
- The same secret is reused across agent integrations
- A fake session appears with real-looking lifecycle transitions

---

## Moderate Pitfalls

### Pitfall 4: “Last event wins” is wrong when multiple agents are active

**What goes wrong:** If the system blindly overwrites the most recent state for each office slot, a stale event from an older session can overwrite the active, correct state. This is especially risky when sessions restart or reconnect during fast multi-agent activity.

**Prevention:**
- Include an event timestamp or monotonic sequence on every payload
- Only accept updates if the payload is newer than the current state
- Maintain a per-session state machine instead of a single shared mutable object

---

### Pitfall 5: Hook scripts that fail silently can create “invisible” mismatches

**What goes wrong:** A hook provider that swallows errors is safe for CLI stability, but it may also hide partial delivery, auth failures, or serialization problems. The office then silently diverges from real agent state.

**Prevention:**
- Fail closed for auth/validation issues, not just open
- Log failures to a local debug sink without crashing the agent
- Add a “diagnostic event” path for failed dispatches so maintainers can see the mismatch

---

### Pitfall 6: The office is not one user; it is a shared real-time surface

**What goes wrong:** A single VS Code instance can host multiple agents, multiple workspaces, and multiple sessions. A simplistic model that treats “one office” as a single global state will misattribute activity.

**Prevention:**
- Treat the office as a collection of per-agent, per-workspace runtime instances
- Keep UI state isolated by provider and by workspace root
- Use a session registry keyed by provider and workspace, not just by the current active window

---

## Recommended Design Rules

1. Use local-only, authenticated event delivery; never assume a trusted local host is enough.
2. Namespace all session IDs by provider, workspace, and process lifetime.
3. Keep event processing async and bounded; prefer freshest state over event history.
4. Treat the office as a synchronized projection of live agent state, not a strict log replay.
5. Make every event self-describing: provider ID, workspace, session ID, event type, timestamp, sequence, and payload version.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Hook provider implementation | Latency spikes from synchronous HTTP dispatch | Make delivery async and coalesced |
| Session router | Session ID collisions across providers | Add provider + workspace + process namespace |
| Multi-agent office rendering | Rendering stale or duplicate state | Use per-session monotonic ordering |
| Auth setup | Shared secret reuse across 5 agents | Use provider-specific tokens or signed payloads |
| Installer / setup flow | Secrets drift or get copied across agent installs | Keep secret generation and rotation explicit |

## Sources

- Project context from `.planning/PROJECT.md` describing five-agent office support, local HTTP hook dispatch, and lifecycle-driven events
- Architecture assumptions from the existing Pixel Agents design: HTTP microserver + session router + webview sync
- Project constraints: zero-crash delivery and negligible latency overhead

This is a project-specific risk assessment for the next integration phase, not a generic distributed-systems treatise. The main engineering rule is simple: multi-agent office UX works only if delivery is fast, session identity is strict, and auth is provider-scoped and local-first.
