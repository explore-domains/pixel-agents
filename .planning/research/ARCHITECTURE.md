# Architecture: Multi-Provider Event Normalization

**Project:** ED Pixel Agents  
**Researched:** 2026-11-08  
**Mode:** Architecture dimension for multi-CLI integration  

## Executive Summary

ED Pixel Agents' event system already **decouples providers from downstream handlers** through a normalization boundary. Each CLI (Claude Code, Antigravity, Gemini CLI, OpenCode, Copilot) posts raw hook events to `POST /api/hooks/:providerId`, which are normalized into a unified `AgentEvent` union, then dispatched to session-agnostic handlers (HookEventHandler, JSONL polling, webview).

The system is ready for 5 CLIs. **No architectural rewrite is needed.** Instead, the pattern is:

1. **Provider** (e.g., `antigravityProvider`) implements `normalizeHookEvent()` — translates CLI-specific JSON to `AgentEvent`
2. **HTTP Router** accepts events at `POST /api/hooks/{providerId}` and routes to `HookEventHandler.handleEvent(providerId, event)`
3. **Session Router** maps `session_id` → `agentId` per provider (buffering events if the agent isn't registered yet)
4. **Handlers** dispatch on `AgentEvent.kind`, not raw hook names — agnostic to provider differences

**Key architectural properties:**
- ✓ Provider isolation: Claude-specific field names (snake_case `tool_name`, `notification_type`) never escape provider module
- ✓ Event schema unification: All providers produce the same `AgentEvent` union at the normalization boundary
- ✓ Session routing independence: One `SessionRouter` per server, keyed by session_id; multiple providers can share it
- ✓ Graceful degradation: Providers without JSONL transcripts (OpenCode, Copilot) use hooks-only mode; providers with transcripts use hybrid polling + hooks
- ✓ Testability: Provider normalization is pure function (no I/O, no side effects)

## Current System: Claude Code Baseline

### Data Flow

```
CLI (Claude Code)
    ↓ POST /api/hooks/claude {hook_event_name: "PreToolUse", tool_name: "Read", ...}
HTTP Server (httpServer.ts)
    ↓ route → onHookEvent callback → providerId: "claude"
AgentRuntime.handleHookEvent(providerId, raw_event)
    ↓ route → hookEventHandler.handleEvent(providerId, raw_event)
HookEventHandler
    ├─ normalizeHookEvent (provider.normalizeHookEvent) 
    │   "PreToolUse" + tool_name="Read" → { kind: 'toolStart', toolName: 'Read', ... }
    ├─ SessionRouter.resolve(session_id) → agentId
    │   (buffers event if agent not yet registered)
    └─ dispatch on AgentEvent.kind
        ├─ 'toolStart'        → handlePreToolUse()
        ├─ 'toolEnd'          → handlePostToolUse()
        ├─ 'turnEnd'          → handleStop()
        ├─ 'permissionRequest' → handlePermissionRequest()
        ├─ 'sessionStart'      → SessionStart logic (register known agents, detect external sessions)
        ├─ 'sessionEnd'        → SessionEnd logic (clear agents, cleanup)
        └─ ...team events (subagentStart, subagentEnd, subagentTurnEnd)
        
JSONL Polling (parallel)
    ├─ fileWatcher.ts polls transcripts every 1000ms
    └─ transcriptParser.ts (from JSONL) → messages to webview
    
Webview (React Canvas)
    ← broadcast: agentToolStart, agentStatus, agentToolDone, subagentToolStart, ...
    → character animations, status labels, permission bubbles
```

### Normalization Boundary (Single Source of Truth)

**File:** `server/src/providers/hook/claude/claude.ts`  
**Function:** `normalizeHookEvent(raw)`

The provider translates **raw** → **normalized**:

| Raw Event | Raw Fields | AgentEvent.kind | Normalized |
|-----------|-----------|-----------------|-----------|
| `PreToolUse` | `tool_name`, `tool_input` | `toolStart` | `{ kind: 'toolStart', toolName, input, runInBackground }` |
| `PostToolUse` / `PostToolUseFailure` | (none) | `toolEnd` | `{ kind: 'toolEnd', toolId: 'current' }` |
| `Stop` | (none) | `turnEnd` | `{ kind: 'turnEnd', awaitingInput?: false }` |
| `Notification(idle_prompt)` | `notification_type` | `turnEnd` | `{ kind: 'turnEnd', awaitingInput: true }` |
| `Notification(permission_prompt)` | `notification_type` | `permissionRequest` | `{ kind: 'permissionRequest' }` |
| `PermissionRequest` | (none) | `permissionRequest` | `{ kind: 'permissionRequest' }` |
| `SubagentStart` | `agent_type`, `run_in_background` | `subagentStart` | `{ kind: 'subagentStart', toolId, toolName: agentType, ... }` |
| `SubagentStop` | (none) | `subagentEnd` | `{ kind: 'subagentEnd', toolId: 'current' }` |
| `SessionStart` | `source`, `transcript_path`, `cwd` | `sessionStart` | `{ kind: 'sessionStart', source?, transcriptPath?, cwd? }` |
| `SessionEnd` | `reason` | `sessionEnd` | `{ kind: 'sessionEnd', reason? }` |
| `TeammateIdle` / `TaskCompleted` | (provider-specific) | `subagentTurnEnd` | `{ kind: 'subagentTurnEnd', reason: 'idle' \| 'completed' }` |

**Pattern:** All raw fields are read **only in the provider module**. Downstream (HookEventHandler.ts) never accesses `event.tool_name` or `event.notification_type` — only `normEvent.kind` and the normalized fields.

### Protocol Contract

**File:** `core/src/provider.ts`  
**Interface:** `HookProvider`

Every provider must implement:

```typescript
interface HookProvider {
  readonly kind: 'hook';
  readonly id: string;                          // e.g., 'claude', 'antigravity', 'gemini-cli'
  readonly displayName: string;                 // e.g., 'Claude Code', 'Antigravity'
  readonly protocolVersion: number;             // 1 (bump on breaking AgentEvent changes)
  
  // Core: normalize raw hook → AgentEvent
  normalizeHookEvent(raw: Record<string, unknown>): 
    { sessionId: string; event: AgentEvent } | null;
  
  // Hooks lifecycle
  installHooks(serverUrl: string, authToken: string): Promise<void>;
  uninstallHooks(): Promise<void>;
  areHooksInstalled(): Promise<boolean>;
  consentDisclosure(): { headline: string; disclosure: string };
  
  // Display + metadata
  formatToolStatus(toolName: string, input?: unknown): string;
  readonly permissionExemptTools: ReadonlySet<string>;
  readonly subagentToolNames: ReadonlySet<string>;
  readonly readingTools: ReadonlySet<string>;
  readonly terminalNamePrefix?: string;
  contextWindowForModel?(model: string): number | undefined;
  
  // File-based fallback (heuristic mode): directories, transcripts, session parsing
  getSessionDirs?(workspacePath: string): string[];
  getAllSessionRoots?(): string[];
  readonly sessionFilePattern?: string;
  parseTranscriptLine?(line: string): AgentEvent | null;
  buildLaunchCommand?(sessionId: string, cwd: string, opts?: {...}): {...};
  
  // Agent Teams (optional)
  readonly team?: TeamProvider;
}
```

### Registration

**File:** `server/src/providers/index.ts`

```typescript
export const hookProviders: readonly HookProvider[] = [claudeProvider];

export function hookProviderById(id: unknown): HookProvider | undefined {
  return typeof id === 'string' ? hookProviders.find((p) => p.id === id) : undefined;
}
```

**For each new CLI:** Add to this list. The rest of the server discovers providers dynamically:
- `onSetHooksEnabled(providerId, enabled)` in cli.ts calls `hookProviderById(providerId)` to install/uninstall
- `HookEventHandler` checks `provider.protocolVersion` at construction time
- HTTP `/api/hooks/:providerId` routes to the same handler for all providers

## Multi-Provider Architecture: Unchanged for 5 CLIs

### HTTP Routing Layer

**File:** `server/src/httpServer.ts`

```typescript
app.post<{
  Params: { providerId: string };
  Body: Record<string, unknown>;
}>(`${HOOK_API_PREFIX}/:providerId`, 
  // Auth + schema validation (providerId: /^[a-z0-9-]+$/)
  async (request, reply) => {
    const { providerId } = request.params;
    const event = request.body;
    
    if (event.session_id && event.hook_event_name) {
      options.onHookEvent?.(providerId, event);
    }
    
    reply.send('ok');
  }
);
```

**Why this works for 5 CLIs:**
- Route is generic: accepts any `providerId` matching `/^[a-z0-9-]+$/`
- No branching on provider ID — each provider installs its own hooks with the correct URL
- Bearer token auth is per-server, not per-provider
- Body validation is minimal: only checks presence of `session_id` and `hook_event_name` (every provider must send both)

### Session Routing

**File:** `server/src/sessionRouter.ts`

The `SessionRouter` is **provider-agnostic**:

```typescript
export class SessionRouter {
  private sessionToAgentId = new Map<string, number>();
  
  register(sessionId: string, agentId: number): BufferedEvent[] { ... }
  resolve(sessionId: string): number | undefined { ... }
  bufferEvent(providerId: string, event): void { ... }  // providerId only for logging
}
```

**Key:** The mapping is `session_id` → `agentId`, not `(providerId, session_id)` → `agentId`. This means:

- ✓ If Antigravity and Claude Code launch sessions in the **same project directory**, they can be disambiguated by workspace/projectDir and adopted into the same office
- ✓ If they launch in **different projects**, they get different offices (different server instances or different workspaces)
- ⚠️ **Collision risk:** If two providers use session ID formats that collide, the second one's events route to the first one's agent. This is mitigated by:
  - Each provider's session format is unique (Claude: UUIDs in `~/.claude/projects/`, Antigravity: different format, etc.)
  - If a collision occurs, it's caught at agent startup: `hookDelivered=true` on SessionStart only if the session's sessionId matches the registered agent

**Action:** Document session ID format uniqueness in the provider integration checklist.

### Event Handler

**File:** `server/src/hookEventHandler.ts`

The handler receives `(providerId, raw_event)` and:

1. **Calls `provider.normalizeHookEvent(raw_event)`** to get `{ sessionId, event: AgentEvent }`
2. **Silently drops `null` returns** (unknown event types)
3. **Dispatches on `AgentEvent.kind`**, not on raw hook name
4. **Routes to the correct agent** via `SessionRouter.resolve(sessionId)`
5. **Buffers if agent isn't registered yet** (race condition: hook event arrives before agent created)

**Provider-agnostic dispatching:**

```typescript
switch (normEvent.kind) {
  case 'toolStart':      return this.handlePreToolUse(normEvent, agent, agentId);
  case 'toolEnd':        return this.handlePostToolUse(agent, agentId);
  case 'turnEnd':        return this.handleStop(agent, agentId, normEvent.awaitingInput);
  case 'permissionRequest': return this.handlePermissionRequest(agent, agentId);
  case 'sessionStart':   return this.handleSessionStart logic...
  // ... etc. No `if (providerId === 'claude')` anywhere
}
```

**The provider is passed in but used only for metadata:**
- `this.provider.formatToolStatus(toolName, input)` — format display status
- `this.provider.team?.extractTeammateNameFromEvent(event)` — extract team identity
- `this.provider.subagentToolNames` — tool classification (spawn tools vs regular tools)

## Variant Patterns: How Different CLIs Integrate

### Scenario 1: Claude Code (Baseline)

- **Session ID:** UUID (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- **Transcript:** JSONL at `~/.claude/projects/{workspace}/session-{id}.jsonl`
- **Hooks:** Install hook script into Claude's config; fires on every SessionStart, PreToolUse, PostToolUse, Stop, PermissionRequest, SessionEnd
- **Mode:** Hybrid (hooks + JSONL polling)
  - Hooks: instant feedback for tool start, permission, session end
  - JSONL: detailed turn state, context usage, tool results
- **Provider fields:**
  - `normalizeHookEvent()`: Translate snake_case (`tool_name`, `tool_input`, etc.)
  - `formatToolStatus()`: Claude tool set (Read, Edit, Write, Bash, WebSearch, Task, Agent, etc.)
  - `permissionExemptTools`: Task, Agent, AskUserQuestion
  - `subagentToolNames`: Task, Agent
  - `team`: `claudeTeamProvider` (Agent Teams support)
  - `getSessionDirs()`: Return `~/.claude/projects/{normalized-workspace-path}/`
  - `parseTranscriptLine()`: Parse JSONL records into AgentEvent

### Scenario 2: Antigravity

**Assumptions (to be validated in Phase B):**
- **Session ID:** Custom format (e.g., `agy-{timestamp}-{hash}` or similar)
- **Transcript:** Stored in Antigravity's config directory (e.g., `~/.antigravity/sessions/`)
- **Hooks:** Antigravity's plugin/customization system fires hooks (POST to Pixel Agents server)
- **Event format:** Likely different casing/field names (e.g., camelCase vs snake_case)
- **Mode:** Hybrid or hooks-only (depends on transcript availability)

**Integration pattern:**
```typescript
// server/src/providers/hook/antigravity/antigravity.ts

export const antigravityProvider: HookProvider = {
  kind: 'hook',
  id: 'antigravity',
  displayName: 'Antigravity',
  protocolVersion: 1,
  
  normalizeHookEvent(raw) {
    const eventName = raw.eventName;  // camelCase (example)
    const sessionId = raw.sessionID;  // example field name
    
    switch (eventName) {
      case 'ToolStart':  // Antigravity's event name
        return {
          sessionId,
          event: {
            kind: 'toolStart',
            toolId: raw.toolId,
            toolName: raw.toolName,
            input: raw.toolInput,  // camelCase → normalized
          },
        };
      // ... other events
      default: return null;
    }
  },
  
  installHooks: async (serverUrl, authToken) => {
    // Install hook scripts into Antigravity's plugin/config directory
    // Hook scripts POST to `${serverUrl}/api/hooks/antigravity` with Bearer token
  },
  
  formatToolStatus(toolName, input) {
    // Antigravity-specific tools: likely different from Claude
  },
  
  getSessionDirs(workspacePath) {
    return [path.join(os.homedir(), '.antigravity', 'sessions')];
  },
  
  // team?: antigravityTeamProvider (if Antigravity has subagent support)
};
```

**No changes to HookEventHandler, SessionRouter, or httpServer.ts.** They accept the event and dispatch exactly as for Claude.

### Scenario 3: Gemini CLI (Hooks Only)

**Assumptions:**
- **Session ID:** Format TBD (validate in Phase B)
- **Transcript:** May not have JSONL; all state from hooks
- **Hooks:** Fires similar events to Claude (e.g., ToolStart, ToolEnd, SessionStart, etc.)
- **Mode:** Hooks-only (`hooksOnly: true` in AgentState)

**Integration pattern:**
```typescript
// server/src/providers/hook/gemini-cli/gemini-cli.ts

export const geminiCliProvider: HookProvider = {
  kind: 'hook',
  id: 'gemini-cli',
  displayName: 'Google Gemini CLI',
  protocolVersion: 1,
  
  normalizeHookEvent(raw) {
    // Gemini's event format (TBD in Phase B)
    // Similar to Claude, or different?
  },
  
  installHooks: async (serverUrl, authToken) => {
    // Gemini's customization/config mechanism
  },
  
  formatToolStatus(toolName, input) {
    // Gemini's tool set
  },
  
  // No getSessionDirs/parseTranscriptLine needed if no JSONL
  // (hooksOnly mode falls back to hooks-only state management)
};
```

**AgentRuntime behavior:**
- If provider has no `getSessionDirs()`, JSONL polling is skipped for that provider's agents
- Agent gets `hooksOnly: true` and `providerId: 'gemini-cli'`
- All state changes come from hooks; no transcript parsing

### Scenario 4: OpenCode (Hooks Only)

**Assumptions:**
- **Session ID:** OpenCode's internal session format
- **Transcript:** Not used (hooks only)
- **Hooks:** Custom hook mechanism (to be explored in Phase B)
- **Mode:** Hooks-only

**Integration:** Same pattern as Gemini CLI—no transcript parsing.

### Scenario 5: GitHub Copilot (TBD)

**Assumptions:**
- **Session ID:** GitHub's session identifier
- **Transcript:** May be available via VS Code extension API or Copilot's own logs
- **Hooks:** GitHub Copilot's event system (explore in Phase B)
- **Mode:** Hooks-only or transcript-based (details TBD)

## Event Normalization Examples

### Example 1: Claude PreToolUse → Antigravity ToolStart

| Aspect | Claude | Antigravity (Hypothetical) |
|--------|--------|---------------------------|
| **HTTP POST** | `POST /api/hooks/claude` | `POST /api/hooks/antigravity` |
| **Raw Event** | `{ hook_event_name: "PreToolUse", session_id: "uuid", tool_name: "Read", tool_input: { file_path: "foo.ts" }, ... }` | `{ eventName: "ToolStart", sessionID: "agy-...", toolName: "Read", toolInput: { filePath: "foo.ts" }, ... }` |
| **normalizeHookEvent()** | Reads `hook_event_name`, `tool_name`, `tool_input` | Reads `eventName`, `toolName`, `toolInput` |
| **Returns** | `{ sessionId: "uuid", event: { kind: 'toolStart', toolName: 'Read', input: { file_path: "foo.ts" }, ... } }` | `{ sessionId: "agy-...", event: { kind: 'toolStart', toolName: 'Read', input: { filePath: "foo.ts" }, ... } }` |
| **Handler sees** | `normEvent.kind === 'toolStart'`, `normEvent.toolName === 'Read'` | **Identical** |

### Example 2: Notification Collapse

| Aspect | Claude Stop | Claude Notification (idle) |
|--------|-------------|---------------------------|
| **Raw Event** | `{ hook_event_name: "Stop", session_id: "uuid" }` | `{ hook_event_name: "Notification", session_id: "uuid", notification_type: "idle_prompt" }` |
| **normalizeHookEvent()** | Recognizes "Stop" | Recognizes Notification + idle_prompt |
| **Returns** | `{ sessionId: "uuid", event: { kind: 'turnEnd', awaitingInput: false } }` | `{ sessionId: "uuid", event: { kind: 'turnEnd', awaitingInput: true } }` |
| **Handler** | `handleStop(agent, agentId, false)` → "Done" | `handleStop(agent, agentId, true)` → "Waiting for input" |

**Benefit:** The handler **never reads** raw event names. It dispatches on `AgentEvent.kind`, which is provider-agnostic.

## Session-Agent Mapping Strategy

### Within One Provider (Claude Code)

```
Session A (UUID 550e...) 
  ↓ SessionStart → pending (no project dir match)
  ↓ SessionStart + cwd matching workspace → external session detected
  ↓ Agent created, registerAgent(sessionId, agentId=5)
  ↓ Future events: SessionRouter.resolve(sessionId) → agentId=5
```

### Across Multiple Providers

```
Project: ~/my-app

Server 1: Running Claude Code
  Agent 1: session_id = "550e8400-e29b-41d4-a716-446655440000"
  
Server 2: Running Antigravity  
  Agent 2: session_id = "agy-1730987654-a1b2c3d4"
  
(Different servers, different offices — no conflict)

---

SAME server, multiple projects:

Server 1:
  Project ~/my-app:
    Agent 1: Claude Code, session_id = "550e8400..."
    Agent 2: Antigravity, session_id = "agy-..."
    
  Project ~/other-app:
    Agent 3: Claude Code, session_id = "6c3a..."
    Agent 4: OpenCode, session_id = "oc-..."
    
(Same SessionRouter, but different agents via projectDir filtering)
```

**SessionRouter constraints:**
- One `sessionToAgentId` map per server (shared by all providers)
- Collisions prevented by **unique session ID formats per provider**
- External sessions disambiguated by **cwd + projectDir matching**

## Graceful Degradation: Hooks-Only vs Hybrid

### Claude Code (Hybrid: Hooks + JSONL)

```
Agent created with:
  sessionId: "550e..."
  jsonlFile: "~/.claude/projects/.../session-550e....jsonl"
  providerId: "claude"
  hooksOnly: undefined (false)
  
Flow:
  ├─ Hooks fire → instant UI feedback (tool start, permission, stop)
  └─ JSONL polling @ 1000ms → detailed turn state, context usage, tool results
```

### Gemini CLI (Hooks-Only: No JSONL)

```
Agent created with:
  sessionId: "gem-..."
  jsonlFile: undefined or empty
  providerId: "gemini-cli"
  hooksOnly: true
  
Flow:
  ├─ Hooks fire → UI feedback (all state from hooks)
  └─ JSONL polling skipped (no transcript file)
  
AgentRuntime.adoptJSONLFile():
  if (!agent.jsonlFile || agent.hooksOnly) return;  // skip
```

**Benefit:** The same Agent can be hybrid or hooks-only; the server adapts automatically based on provider capabilities.

## Potential Hazards & Mitigations

### Hazard 1: Session ID Collisions

**Risk:** Two providers use the same session ID format; events from one provider route to the other's agent.

**Mitigation:**
- Document **session ID format requirements** per provider in the integration checklist
- Validate at registration time: `registerAgent()` checks that the sessionId matches the agent's known provider's format
- Test: Add e2e test spawning two agents (Claude + Antigravity) in the same project, fire events from both, verify each agent receives its own events

### Hazard 2: Missing normalizeHookEvent Fields

**Risk:** A provider's normalizeHookEvent drops a field (e.g., doesn't set `input`), and a handler crashes trying to read it.

**Mitigation:**
- `AgentEvent` fields are optional where they may be absent (e.g., `input?: unknown`, `runInBackground?: boolean`)
- Handler branches check for field presence before use (e.g., `if (normEvent.toolName !== 'Task')`)
- Unit tests: For each provider, verify normalizeHookEvent returns a valid AgentEvent for all event types

### Hazard 3: Provider installers Fail Silently

**Risk:** `installHooks()` throws and is caught; user never knows hooks aren't installed.

**Mitigation:**
- `onSetHooksEnabled()` in cli.ts catches and logs: `console.error(\`[Pixel Agents] ${err.message}\`)`
- WebSocket client shows a toast/banner: "Hooks installation failed; see terminal for details"
- Test: Mock installer failures; verify error is logged and propagated to the WebSocket client

### Hazard 4: protocolVersion Mismatch

**Risk:** A provider ships `protocolVersion: 2`, but the server only understands version 1; events are silently dropped.

**Mitigation:**
- HookEventHandler constructor logs a warning: `console.warn(\`[Pixel Agents] HookProvider "${provider.id}" reports protocolVersion=${provider.protocolVersion}, but handler understands ${SUPPORTED_PROTOCOL_VERSION}.\`)`
- Handler returns early; events from that provider are dropped
- Test: Add a test provider with `protocolVersion: 2`; verify warning is logged and events are dropped

### Hazard 5: External Session Adoption Race

**Risk:** SessionStart fires for an unknown session, is stored as pending; before confirmation event arrives, user manually adds the agent via Directory; two agents track the same session.

**Mitigation:**
- SessionStart stores only if `transcriptPath || cwd` is present (validates the data)
- onExternalSessionDetected fires only when a confirmation event (Stop, Notification, etc.) arrives
- External agents are isolated from known agents until confirmed
- Timeout: SESSION_END_GRACE_MS (2s) clears zombie pending sessions if follow-up SessionStart never arrives

## Component Interaction Matrix

| Component | Responsibility | Multi-Provider Readiness |
|-----------|-----------------|--------------------------|
| **HTTP Router** (`httpServer.ts`) | Accept POST `:providerId` → callback | ✓ Generic, no provider-specific logic |
| **Event Callback** (`server.ts` + `cli.ts`) | Route to `runtime.handleHookEvent()` | ✓ Passes through providerId |
| **AgentRuntime** | Dispatch to HookEventHandler | ✓ Passes through providerId |
| **HookEventHandler** | Normalize + dispatch on AgentEvent.kind | ✓ Calls provider.normalizeHookEvent() |
| **SessionRouter** | Map session_id → agentId (all providers) | ✓ No provider-specific logic |
| **Provider Registry** (`providers/index.ts`) | Discover all bundled providers | ⚠️ **Action:** Add new providers to `hookProviders[]` |
| **JSONL Polling** (`agentRuntime.ts`) | Adopt transcripts by file path + provider | ⚠️ **Action:** Each provider must define `getSessionDirs()` and `sessionFilePattern` |
| **Consent Gate** (`consentGate.ts`) | Ask permission to install hooks | ✓ Loops over `hookProviders`, shows each provider's disclosure |
| **Hook Installation** (`cli.ts` + provider) | Install hooks for a provider | ✓ Calls provider.installHooks() + provider.uninstallHooks() |

## Readiness Assessment

### Ready Now (No Changes)

- ✓ HTTP routing for 5 CLIs
- ✓ Session routing and event buffering
- ✓ Event dispatch on normalized kinds
- ✓ Hooks-only and hybrid mode support
- ✓ Consent gate (loops over all providers)
- ✓ WebSocket broadcast (provider-agnostic)

### Required Before Phase C (Implementation)

- **Provider implementations:** Antigravity, Gemini CLI, OpenCode, Copilot
  - Each provider: `normalizeHookEvent()` implementation
  - Each provider: `installHooks()` / `uninstallHooks()` implementation
  - Each provider: `formatToolStatus()` for provider-specific tools
  - Providers with transcripts: `getSessionDirs()` + `parseTranscriptLine()`
  - Providers with teams: `team?: TeamProvider` implementation

- **Hook script standards:** Define what every hook must POST:
  - Minimum fields: `hook_event_name` (string), `session_id` (string)
  - Optional but recommended: `transcript_path` (string), `cwd` (string)
  - No bearer token in POST body (rides Authorization header)

- **Session ID format documentation:** 
  - Claude: UUID (`{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}`)
  - Antigravity: [TBD in Phase B]
  - Gemini CLI: [TBD in Phase B]
  - OpenCode: [TBD in Phase B]
  - Copilot: [TBD in Phase B]

- **Session lifecycle testing:** E2E test suite covering:
  - Multiple agents (different providers) in one project
  - Hook events from all 5 CLIs routed to correct agents
  - External session detection + adoption
  - Consent flow (user toggles hooks on/off per provider)
  - Graceful degradation (hooks only, hybrid, missing transcripts)

### Not Required (Stretch Goals)

- Multi-provider subagent support (teams) — Phase C focuses on single-agent support first
- Global session scanning for OpenCode/Copilot — Phase A supports project-scoped adoption
- Unified log aggregation — Each CLI logs to its own backend; Pixel Agents doesn't unify

## Recommended Implementation Sequence

1. **Phase B (Explore):** Document each CLI's hook mechanism, session format, transcript availability
2. **Phase C.1 (Antigravity):** Implement antigravityProvider, test single-agent hybrid flow
3. **Phase C.2 (Gemini CLI):** Implement geminiCliProvider, test hooks-only flow
4. **Phase C.3 (OpenCode):** Implement openCodeProvider
5. **Phase C.4 (Copilot):** Implement copilotProvider
6. **Phase D (Verify):** E2E test all 5 CLIs simultaneously, multi-project scenarios

## Files to Create / Modify

### Create (One Per Provider)

| File | Purpose |
|------|---------|
| `server/src/providers/hook/antigravity/antigravity.ts` | `antigravityProvider` export |
| `server/src/providers/hook/antigravity/antigravityHookInstaller.ts` | Install/uninstall hooks |
| `server/src/providers/hook/gemini-cli/gemini-cli.ts` | `geminiCliProvider` export |
| `server/src/providers/hook/gemini-cli/geminiCliHookInstaller.ts` | Install/uninstall hooks |
| `server/src/providers/hook/opencode/opencode.ts` | `openCodeProvider` export |
| `server/src/providers/hook/opencode/opencodeHookInstaller.ts` | Install/uninstall hooks |
| `server/src/providers/hook/copilot/copilot.ts` | `copilotProvider` export |
| `server/src/providers/hook/copilot/copilotHookInstaller.ts` | Install/uninstall hooks |

### Modify

| File | Change |
|------|--------|
| `server/src/providers/index.ts` | Add 4 new provider exports + add to `hookProviders[]` array |
| `server/src/cli.ts` | No changes (already generic) |
| `server/src/httpServer.ts` | No changes (already generic) |
| `server/src/hookEventHandler.ts` | No changes (already generic) |
| `server/src/agentRuntime.ts` | No changes (already generic) |
| Tests | Add provider-specific unit tests + multi-provider e2e tests |

---

## Conclusion

**The architecture is extensible and ready for 5 CLIs without refactoring.** Each new CLI is a new provider module implementing the `HookProvider` interface. The normalization boundary (provider.normalizeHookEvent) is the single point of provider-specific logic; downstream components are agnostic.

**Key architectural wins:**
1. No branching on `providerId` downstream of normalization
2. Same handlers serve all providers
3. Session routing is provider-agnostic
4. Hybrid and hooks-only modes coexist
5. Extensibility is zero-cost: adding a 6th provider doesn't touch httpServer, hookEventHandler, or sessionRouter

**Next step:** Phase B explores each CLI's hook mechanism, session format, and transcript availability—feeding directly into Phase C provider implementations.
