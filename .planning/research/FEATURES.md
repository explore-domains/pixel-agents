# Feature Landscape: Event Tracking

**Domain:** Agent Lifecycle Visualization
**Researched:** 2026-11-08

## Table Stakes: Core Lifecycle Events

These events are required to drive the pixel art animations (e.g., character appearing, thinking, using a tool, disappearing).

| Event Category | Agent Native Event (Typical) | Canonical Event | Pixel Office Behavior | Complexity | Notes |
|----------------|----------------------------|------------------|------------------------|------------|----------|
| **Session Start** | `PreInvocation`, `session.start`, `SessionStart` | `session_start` | Character enters office, settles at desk | Low | Triggers initial "Hello" animation |
| **Tool Call (Pre)** | `PreToolUse`, `tool.pre`, `PreToolUse` | `tool_call_before` | Character starts "working" (typing/searching) | Low | Essential for activity indicators |
| **Tool Call (Post)**| `PostToolUse`, `tool.post`, `PostToolUse` | `tool_call_after` | Character finishes work, looks at result | Low | Signals completion of a specific action |
| **Session End** | `PostInvocation`, `session.end`, `Stop` | `session_end` | Character waves and leaves office | Low | Cleans up canvas state |
| **Error** | `Error`, `exception`, `failure` | `error` | Character looks confused/frustrated (shake animation) | Medium | Requires mapping agent-specific error codes |

## Agent-Specific Event Mapping

Based on research in `STACK.md`, here is how the canonical events map to the specific tools.

### 1. Antigravity (`agy`)
**Mechanism:** Shell hooks via `hooks.json`
- `PreInvocation` $\rightarrow$ `session_start`
- `PreToolUse` $\rightarrow$ `tool_call_before`
- `PostToolUse` $\rightarrow$ `tool_call_after`
- `PostInvocation` $\rightarrow$ `session_end`
- `Stop` $\rightarrow$ `session_end`

### 2. Gemini CLI (`gemini`)
**Mechanism:** Shell hooks via config
- `SessionStart` $\rightarrow$ `session_start`
- `PreToolUse` $\rightarrow$ `tool_call_before`
- `PostToolUse` $\rightarrow$ `tool_call_after`
- `Stop` $\rightarrow$ `session_end`

### 3. OpenCode (`opencode`)
**Mechanism:** Plugin/SDK Event Stream
- `session.start` $\rightarrow$ `session_start`
- `tool.pre` $\rightarrow$ `tool_call_before`
- `tool.post` $\rightarrow$ `tool_call_after`
- `session.end` $\rightarrow$ `session_end`
- `plugin.error` $\rightarrow$ `error`

### 4. GitHub Copilot (`copilot`)
**Mechanism:** Configuration hooks
- `PreToolUse` $\rightarrow$ `tool_call_before`
- `PostToolUse` $\rightarrow$ `tool_call_after`
- `Stop` $\rightarrow$ `session_end`
- `PermissionRequest` $\rightarrow$ `tool_call_before` (Special: Character "asks" for permission)

## Differentiators: High-Fidelity Events

These events add "soul" to the pixel office beyond basic lifecycle tracking.

| Feature | Trigger Event | Behavior | Value Prop |
|---------|---------------|----------|------------|
| **Permission Wait** | `PermissionRequest` (Copilot/OpenCode) | Character leans forward, looks at user expectantly | Visualizes the "human-in-the-loop" block |
| **Deep Thinking** | Long gap between `tool_call_before` and `after` | Character rubs chin, paces around desk | Reduces perceived latency of slow LLM calls |
| **Tool-Specific Art** | `ToolName` in payload (e.g., `read_file`, `shell_exec`) | Character uses specific prop (e.g., magnifying glass for read, terminal for shell) | Makes the visualization feel integrated with actual work |

## Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full Log Streaming** | Overwhelms webview, creates lag, irrelevant for animation | Track only the defined lifecycle events |
| **Synchronous Hooks** | Breaks the user's CLI experience if the Pixel Server is down | Use asynchronous `curl` or non-blocking plugin calls |

## Feature Dependencies

`Character Animation` $\rightarrow$ `Canonical Event` $\rightarrow$ `Agent Adapter` $\rightarrow$ `Native CLI Hook`

## MVP Recommendation

**Priority 1 (Table Stakes):**
- Implement `session_start`, `tool_call_before`, `tool_call_after`, and `session_end` for all four agents.
- Ensure "Error" events trigger a visual cue.

**Priority 2 (Differentiators):**
- Map specific tool names to unique animations (e.g., "Searching" vs "Writing").
- Implement the "Permission Wait" state for Copilot/OpenCode.

## Sources
- `.planning/STACK.md`
- `.planning/PROJECT.md`
- Official Documentation (Antigravity, Gemini CLI, OpenCode, GitHub Copilot)
