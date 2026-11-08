# ED Pixel Agents

## What This Is

A VS Code extension and standalone tool that brings AI coding agents to life as animated pixel art characters in a virtual office. Originally built for Claude Code as Pixel Agents, ED Pixel Agents expands agent support to other popular coding agents—prioritizing Antigravity, alongside Gemini CLI, OpenCode, and GitHub Copilot—with updated branding and multi-agent lifecycle awareness.

## Core Value

Provide delightful, accurate, real-time pixel art visualization and workspace status for developers using modern AI coding agents (Antigravity, Claude Code, Gemini CLI, OpenCode, and Copilot).

## Requirements

### Validated

- ✓ Pixel art office canvas and character animation engine — existing
- ✓ Claude Code `HookProvider` reference implementation with session lifecycle tracking — existing
- ✓ VS Code extension integration and webview UI — existing
- ✓ Multi-server registry and HTTP hook dispatch listener — existing
- ✓ Interactive consent gating and permission-exempt tool definitions — existing

### Active

- [ ] Rebrand project to "ED Pixel Agents" across extension manifest, UI titles, and documentation
- [ ] Map and document existing codebase architecture (core, server, adapters, webview-ui)
- [ ] Explore and document hook/event mechanisms for Antigravity, Gemini CLI, OpenCode, and Copilot
- [ ] Implement `HookProvider` for Antigravity (`antigravity-hook`, event normalization, installer)
- [ ] Implement `HookProvider`s for Gemini CLI, OpenCode, and Copilot
- [ ] Verify multi-agent presence and activity in the pixel office simultaneously

### Out of Scope

- Rewriting canvas rendering engine or sprite asset pipeline — existing animations and office mechanics are preserved
- Dropping Claude Code support — must remain fully functional as a reference provider
- Unsanctioned monkey-patching of closed CLIs — integrations must use supported hooks, logs, or extension APIs

## Context

- **Codebase Layout**:
  - `core/`: Shared types (`HookProvider`, `AgentEvent`), asset definitions, protocol constants
  - `server/`: HTTP microserver, `HookEventHandler`, session router, consent flow
  - `adapters/vscode/`: Extension host entrypoint, webview provider, terminal adapter
  - `webview-ui/`: React + canvas frontend rendering the office and character animations
- **Installed Agent Toolchains**:
  - Antigravity CLI (`agy` v1.5.3) with plugin/hooks and customizations system
  - Google Gemini CLI (`gemini` v0.67.0)
  - OpenCode (`opencode` v1.18.31)
  - GitHub Copilot CLI (`copilot` v1.0.107) and VS Code extension
- **Integration Model**:
  - Each agent CLI hooks into lifecycle events (`SessionStart`, `ToolStart`, `ToolEnd`, `Stop`, etc.) and posts payloads to Pixel Agents' local HTTP server (`HOOK_API_PREFIX`).

## Constraints

- **Compatibility**: VS Code engine `^1.105.0`
- **Runtime**: Node.js `>=20`
- **Zero-Crash Delivery**: Hook scripts must fail silently/gracefully without breaking user CLI runs
- **Non-blocking**: Event dispatch must have negligible latency overhead on CLI agent turns

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Phased Roadmap (Learn & Rename → Explore Hooks → Implement Providers) | Ensures solid understanding of the architecture and clean branding before integrating new CLIs | — Pending |
| Prioritize Antigravity as first new `HookProvider` | Antigravity is active in the environment, actively used, and supports rich custom extensions/hooks | — Pending |
| Rebrand displayName to "ED Pixel Agents" while keeping core stability | Updates user-facing identity, extension title, and UI without unnecessarily breaking existing storage keys | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-08 after initialization*
