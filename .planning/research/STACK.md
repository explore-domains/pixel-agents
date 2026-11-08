# Technology Stack: Event Hooks for Multi-Agent Integration

**Project:** ED Pixel Agents (VS Code Extension)  
**Researched:** November 8, 2026  
**Focus:** Event hook mechanisms for Antigravity, Gemini CLI, OpenCode, and GitHub Copilot integration

---

## Executive Summary

**Recommendation:** Use **HTTP hooks as the primary integration layer** across all four CLIs, with CLI-specific adapters for hook configuration and event normalization.

Each CLI supports hooks/events at specific lifecycle points, but the mechanism and payload format vary:

| CLI | Hook Type | Primary Events | Configuration |
|-----|-----------|----------------|-----------------|
| **Claude Code** | HTTP, Command, MCP tool, Prompt | `SessionStart`, `PreToolUse`, `PostToolUse`, `Stop` | `.claude/settings.json` |
| **Antigravity** | Command scripts | `PreInvocation`, `PreToolUse`, `PostToolUse`, `PostInvocation`, `Stop` | `~/.gemini/antigravity-cli/hooks.json` |
| **Gemini CLI** | Command scripts, HTTP (remote) | `pre_tool_execution`, `post_tool_execution` | `.agents/hooks.json` |
| **OpenCode** | Plugin (TypeScript/JS), SDK event stream | 25+ lifecycle events | `~/.config/opencode/plugins/` |
| **GitHub Copilot** | Command scripts, HTTP | `PreToolUse`, `PostToolUse`, `Stop`, `PermissionRequest` | `~/.copilot/settings.json` or `.github/copilot.json` |

---

## Recommended Architecture

### Layer 1: Local HTTP Server (Pixel Agents Extension)

Host a lightweight HTTP endpoint within the VS Code extension that:
1. Receives POST requests from each CLI's HTTP hook
2. Normalizes payloads into a canonical `AgentEvent` schema
3. Dispatches events to the webview for pixel character animation
4. Persists activity logs for multi-agent coordination

**Rationale:** HTTP is the only mechanism supported (or planned) by all five CLIs. It avoids CLI-specific lock-in and allows future agents to integrate with minimal friction.

### Layer 2: CLI-Specific Hook Installers

Each CLI needs a small configuration installer that:
1. Writes hook configuration to the CLI's expected location
2. Points to the local HTTP server endpoint
3. Normalizes the hook script/handler format

### Layer 3: Event Normalization Layer

Transform each CLI's native event payload into a canonical schema for the extension core:

```typescript
interface AgentEvent {
  agent: "claude-code" | "antigravity" | "gemini-cli" | "opencode" | "copilot";
  event: "session_start" | "tool_call_before" | "tool_call_after" | "session_end" | "error";
  timestamp: ISO8601;
  sessionId: string;
  payload: Record<string, unknown>; // CLI-specific raw data
  summary?: string; // Human-readable description
}
```

---

## Per-CLI Integration Details

### 1. Claude Code (HookProvider Reference)

**Status:** Already implemented as `HookProvider` reference.

**Hook Events Available:**
- `SessionStart` — session begins/resumes
- `UserPromptSubmit` — user submits prompt
- `PreToolUse` — before tool execution
- `PostToolUse` — after successful tool call
- `PostToolUseFailure` — tool call failed
- `PostToolBatch` — batch of parallel tools completes
- `SubagentStart` / `SubagentStop` — subagent lifecycle
- `Stop` — turn completes
- `SessionEnd` — session terminates

**Hook Configuration Location:**
- User-level: `~/.claude/settings.json`
- Project-level: `.claude/settings.json` (committed)

**HTTP Hook Support:** ✅ Native (recommended for Pixel Agents)

**Integration Point:**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:8765/hooks/claude-code",
            "timeout": 10
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:8765/hooks/claude-code",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:8765/hooks/claude-code",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

**Notes:**
- HTTP hook input arrives as JSON POST body
- HTTP hook output expects JSON with `hookSpecificOutput` for decisions
- No output = pass-through (do not block)
- Timeout default is 600s; lower for Pixel Agents to ~5–10s

---

### 2. Antigravity CLI (Priority New Integration)

**Status:** Active in environment (agy v1.5.3), hooks mechanism established.

**Hook Events Available:**
- `PreInvocation` — before agent invocation starts
- `PreToolUse` — before tool call (can allow/deny)
- `PostToolUse` — after tool call succeeds
- `PostInvocation` — after agent invocation completes
- `Stop` — session termination

**Hook Configuration Location:**
- `~/.gemini/antigravity-cli/hooks.json`

**HTTP Hook Support:** ❌ Command scripts only (on local machine)

**Shell Script Handler Requirement:**

Antigravity pipes JSON to stdin of a command hook. The script returns JSON to stdout.

**Sample Hook Configuration:**
```json
{
  "hooks": {
    "PreInvocation": {
      "command": "/path/to/pixel-agents-hook.sh",
      "args": ["PreInvocation"]
    },
    "PostInvocation": {
      "command": "/path/to/pixel-agents-hook.sh",
      "args": ["PostInvocation"]
    },
    "PreToolUse": {
      "command": "/path/to/pixel-agents-hook.sh",
      "args": ["PreToolUse"]
    },
    "PostToolUse": {
      "command": "/path/to/pixel-agents-hook.sh",
      "args": ["PostToolUse"]
    },
    "Stop": {
      "command": "/path/to/pixel-agents-hook.sh",
      "args": ["Stop"]
    }
  }
}
```

**Bridging to HTTP:**

The hook script acts as a bridge that:
1. Reads JSON from stdin
2. Calls `curl` to POST to the local HTTP server
3. Returns decision JSON to stdout

```bash
#!/bin/bash
# pixel-agents-antigravity-hook.sh
EVENT_NAME="$1"
PAYLOAD=$(cat)

# POST to Pixel Agents server
curl -s -X POST "http://localhost:8765/hooks/antigravity" \
  -H "Content-Type: application/json" \
  -H "X-Hook-Event: $EVENT_NAME" \
  -d "$PAYLOAD" > /dev/null

# Return allow/pass decision
echo "{}"
```

**Payload Example (PreToolUse):**
```json
{
  "hookEventName": "PreToolUse",
  "conversationId": "abc-123",
  "stepIdx": 4,
  "toolCall": {
    "name": "write_file",
    "args": { "path": "/tmp/test.txt", "content": "..." }
  },
  "workspacePaths": ["/home/user/project"]
}
```

**Notes:**
- Hook script must exit cleanly (0) even if HTTP POST fails
- Antigravity does not block on hook result; hooks are observational for our use case
- Conversation ID maps to session in Pixel Agents

---

### 3. Gemini CLI (New Integration)

**Status:** Available (gemini v0.67.0), hooks recently launched.

**Hook Events Available:**
- `pre_tool_execution` — before tool runs (can allow/deny)
- `post_tool_execution` — after tool finishes (observational)

**Hook Configuration Location:**
- `.agents/hooks.json` (project-level, or inline via SDK)

**HTTP Hook Support:** ✅ HTTP hooks (via remote environments); ❌ local CLI uses command scripts

**Local CLI Configuration (Command Script):**
```json
{
  "hooks": {
    "pre_tool_execution": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bash",
            "args": ["/path/to/pixel-agents-gemini-hook.sh"]
          }
        ]
      }
    ],
    "post_tool_execution": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bash",
            "args": ["/path/to/pixel-agents-gemini-hook.sh"]
          }
        ]
      }
    ]
  }
}
```

**Hook Script (Same Bridging Pattern as Antigravity):**
```bash
#!/bin/bash
PAYLOAD=$(cat)

curl -s -X POST "http://localhost:8765/hooks/gemini" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" > /dev/null

# Return allow for pre_tool_execution, empty for post_tool_execution
if echo "$PAYLOAD" | grep -q "pre_tool_execution"; then
  echo '{"decision": "allow"}'
else
  echo '{}'
fi
```

**Payload Example (pre_tool_execution):**
```json
{
  "tool_call": {
    "name": "code_execution",
    "args": { "code": "print('hello')", "language": "python" }
  },
  "environment_id": "env_xyz789"
}
```

**Notes:**
- Gemini CLI just launched hooks (as of late 2026)
- `pre_tool_execution` can block with `{"decision": "deny", "reason": "..."}`
- `post_tool_execution` response is observational only
- Remote deployments support HTTP hooks natively (future enhancement)

---

### 4. OpenCode (New Integration)

**Status:** Available (opencode v1.18.31), plugin system mature with 25+ hook points.

**Hook Events Available (25+ total):**
- Session: `SessionStart`, `SessionEnd`
- Tool execution: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`
- Retry: `PreRetry`, `PostRetry`
- Shell: `ShellCreateBefore`, `ShellCreateAfter`, `ShellExecuteBefore`, `ShellExecuteAfter`
- File operations: `FileReadBefore`, `FileWriteBefore`, etc.
- Network: `HTTPRequestBefore`, `HTTPResponseAfter`
- And more...

**Hook Configuration Location:**
- Plugin system: `~/.config/opencode/plugins/`
- OR SDK via event stream: `OpenCodeSDK.event.subscribe()`

**HTTP Hook Support:** ❌ Plugins (TypeScript/JavaScript) or SDK events only

**Integration Strategy:**

OpenCode has two paths:
1. **Plugin:** Implement a TypeScript/JS plugin that registers hooks
2. **SDK:** Run a separate Node process that connects to OpenCode via SDK and streams events

**Recommended: SDK Event Stream** (simpler for VS Code extension)

```typescript
// In a background worker or extension process
import { createOpencodeClient } from "@opencode-ai/sdk";

const client = createOpencodeClient({
  baseUrl: "http://localhost:4096" // OpenCode SDK server
});

async function streamOpenCodeEvents() {
  const eventStream = await client.event.subscribe();
  
  for await (const event of eventStream) {
    // Normalize and POST to Pixel Agents
    await fetch("http://localhost:8765/hooks/opencode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: event.type,
        sessionId: event.sessionId,
        payload: event,
        timestamp: new Date().toISOString()
      })
    });
  }
}

streamOpenCodeEvents().catch(console.error);
```

**Alternative: TypeScript Plugin**

If a plugin is preferable, create `~/.config/opencode/plugins/pixel-agents-plugin/`:

```typescript
// index.ts
import { Plugin, Context } from "@opencode/sdk";

export const plugin: Plugin = {
  name: "pixel-agents",
  hooks: {
    "session.start": async (ctx: Context, event: any) => {
      await fetch("http://localhost:8765/hooks/opencode", {
        method: "POST",
        body: JSON.stringify({
          eventType: "session.start",
          payload: event
        })
      });
    },
    "tool.pre": async (ctx: Context, event: any) => {
      await fetch("http://localhost:8765/hooks/opencode", {
        method: "POST",
        body: JSON.stringify({
          eventType: "tool.pre",
          payload: event
        })
      });
    },
    // ... more hooks
  }
};
```

**Notes:**
- OpenCode SDK requires the server running on `localhost:4096` (configurable)
- Event types are string-based, not enum-bound (flexible)
- Plugin system is TypeScript-first; plugin npm installation recommended
- Easiest for Pixel Agents: Use SDK streaming in a background worker

---

### 5. GitHub Copilot CLI (New Integration)

**Status:** Available (copilot v1.0.107), hooks launched Nov 2024.

**Hook Events Available:**
- `PreToolUse` — before tool execution (can deny)
- `PostToolUse` — after tool succeeds
- `PostToolUseFailure` — after tool fails
- `PermissionRequest` — when permission decision needed
- `Stop` — turn completes
- `SessionStart` / `SessionEnd` — session lifecycle

**Hook Configuration Location:**
- User-level: `~/.copilot/settings.json`
- Project-level: `.github/copilot.json`

**HTTP Hook Support:** ✅ Native (recommended)

**Hook Configuration:**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:8765/hooks/copilot",
            "timeout": 10
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:8765/hooks/copilot",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:8765/hooks/copilot",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

**Payload Example (PostToolUse):**
```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm install"
  },
  "output": "npm notice...",
  "cwd": "/home/user/project",
  "timestamp": "2026-11-08T12:34:56Z"
}
```

**Notes:**
- Copilot's HTTP hooks are clean and well-documented
- Similar to Claude Code in structure and behavior
- Works in both interactive and programmatic modes
- Cloud sessions do not execute local hooks (by design)

---

## Installation & Setup Workflow

### Step 1: Create Hook Installers

For each CLI, provide a setup script in the extension's `.pixel-agents/` directory:

```
.pixel-agents/
├── install-claude-code.sh
├── install-antigravity.sh
├── install-gemini-cli.sh
├── install-opencode.sh
├── install-copilot.sh
└── hook-bridge.sh (shared HTTP POST wrapper)
```

### Step 2: Extension Setup Command

Add a VS Code command that runs installers in sequence:
- Detect which CLIs are installed
- Write hook configs to each CLI's expected path
- Test connectivity to each hook endpoint
- Report success/errors to the user

### Step 3: Local HTTP Server in Extension

Start a lightweight HTTP server when the extension activates:

```typescript
// In VS Code extension
import * as http from "http";

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url.startsWith("/hooks/")) {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      const agent = req.url.split("/")[2]; // 'claude-code', 'antigravity', etc.
      const event = normalizeEvent(agent, JSON.parse(body));
      
      // Dispatch to webview
      this.webviewPanel?.webview.postMessage({
        type: "agentEvent",
        data: event
      });
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    });
  }
});

server.listen(8765, "127.0.0.1");
```

---

## Event Normalization Reference

Each CLI's raw payload must map to the canonical `AgentEvent`:

### Claude Code → AgentEvent

**Input:** `SessionStart` event
```json
{
  "workspace_folder": "/home/user/project",
  "how": "startup",
  "timestamp": "2026-11-08T12:34:56Z"
}
```

**Output:**
```json
{
  "agent": "claude-code",
  "event": "session_start",
  "sessionId": "<workspace_folder>",
  "timestamp": "2026-11-08T12:34:56Z",
  "summary": "Claude Code session started",
  "payload": { "how": "startup" }
}
```

### Antigravity → AgentEvent

**Input:** `PreToolUse` event
```json
{
  "hookEventName": "PreToolUse",
  "conversationId": "abc-123",
  "toolCall": { "name": "write_file", "args": {...} }
}
```

**Output:**
```json
{
  "agent": "antigravity",
  "event": "tool_call_before",
  "sessionId": "abc-123",
  "timestamp": "2026-11-08T12:34:56Z",
  "summary": "Antigravity tool call: write_file",
  "payload": { "toolCall": {...} }
}
```

### Gemini CLI → AgentEvent

**Input:** `post_tool_execution` event
```json
{
  "tool_call": { "name": "code_execution", "args": {...} },
  "environment_id": "env_xyz789"
}
```

**Output:**
```json
{
  "agent": "gemini-cli",
  "event": "tool_call_after",
  "sessionId": "env_xyz789",
  "timestamp": "2026-11-08T12:34:56Z",
  "summary": "Gemini CLI tool executed: code_execution",
  "payload": { "tool_call": {...} }
}
```

### OpenCode → AgentEvent

**Input:** SDK event (via stream)
```json
{
  "type": "session.start",
  "sessionId": "session-456",
  "timestamp": "2026-11-08T12:34:56Z"
}
```

**Output:**
```json
{
  "agent": "opencode",
  "event": "session_start",
  "sessionId": "session-456",
  "timestamp": "2026-11-08T12:34:56Z",
  "summary": "OpenCode session started",
  "payload": {}
}
```

### Copilot CLI → AgentEvent

**Input:** `Stop` event
```json
{
  "cwd": "/home/user/project",
  "execution_count": 3,
  "stop_reason": "user_interrupt"
}
```

**Output:**
```json
{
  "agent": "copilot",
  "event": "session_end",
  "sessionId": "/home/user/project",
  "timestamp": "2026-11-08T12:34:56Z",
  "summary": "Copilot CLI session ended",
  "payload": { "stop_reason": "user_interrupt" }
}
```

---

## Gotchas & Risk Mitigation

### 1. **Antigravity Hook Script Overhead**
- **Risk:** Shell script + curl for every hook event adds latency.
- **Mitigation:** Cache curl connection, set short timeouts (5s), make HTTP POST async.

### 2. **Gemini CLI Remote-Only HTTP Support**
- **Status:** Local CLI currently has no native HTTP hooks.
- **Mitigation:** Use command-script bridge (as documented) for local; plan future remote integration.

### 3. **OpenCode SDK Server Dependency**
- **Risk:** SDK requires `localhost:4096` OpenCode server running.
- **Mitigation:** Add health check; fall back to plugin if SDK unavailable.

### 4. **Multi-Agent Session Collision**
- **Risk:** Multiple agents running concurrently in same workspace may conflict on session ID.
- **Mitigation:** Prepend agent name to session ID (e.g., `claude-code:abc-123`), or use composite key `{agent}:{sessionId}`.

### 5. **Hook Timeout Cascades**
- **Risk:** If Pixel Agents HTTP server is slow, all CLIs' hooks timeout and degrade.
- **Mitigation:** Async HTTP POSTs from hook scripts; document timeout settings per CLI.

### 6. **Zero-Crash Requirement**
- **Risk:** Hook script failures must not crash the CLI.
- **Mitigation:** All hook scripts must exit 0; errors logged to local file, not returned.

---

## Installation Commands (Placeholder)

```bash
# Claude Code
echo '{
  "hooks": {
    "SessionStart": [{
      "matcher": "*",
      "hooks": [{
        "type": "http",
        "url": "http://localhost:8765/hooks/claude-code",
        "timeout": 10
      }]
    }]
  }
}' | jq . > ~/.claude/settings.json

# Antigravity
mkdir -p ~/.gemini/antigravity-cli
# (copy antigravity hook config)

# Gemini CLI
mkdir -p .agents
# (copy gemini hook config)

# OpenCode
npm install -g @pixel-agents/opencode-plugin
# OR use SDK stream in background

# Copilot CLI
mkdir -p ~/.copilot
# (copy copilot hook config)
```

---

## Sources

| Source | Confidence | URL / Details |
|--------|------------|---------------|
| Claude Code Hooks Docs | HIGH | https://code.claude.com/docs/en/hooks.md (comprehensive reference) |
| Antigravity Hooks | HIGH | https://antigravity.google/docs/hooks/ + Mete Atamel blog (atamel.dev) |
| Gemini CLI Hooks | HIGH | https://geminicli.com/docs/hooks/ (official launch Nov 2024) |
| OpenCode Plugin System | MEDIUM | https://opencode.ai/docs/plugins/ + SDK docs (developing) |
| Copilot CLI Hooks | HIGH | https://docs.github.com/copilot/concepts/agents/hooks (official) |

---

## Next Steps (Post-Research)

1. **Build Hook Installers** — Implement `.pixel-agents/install-*.sh` scripts
2. **Test HTTP Endpoint** — Spin up local server, verify all CLIs can POST
3. **Normalization Layer** — Map each CLI's payloads to canonical `AgentEvent`
4. **Implement Antigravity HookProvider** — First new provider (after Claude Code reference)
5. **Multi-Agent Testing** — Run all 5 CLIs in parallel; verify pixel office shows activity
6. **Timeout & Error Handling** — Add exponential backoff, fallback behaviors
