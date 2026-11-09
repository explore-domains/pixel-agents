# ED Pixel Agents

## What This Is

A VS Code extension and standalone tool that brings AI coding agents to life as animated pixel art characters in a virtual office. ED Pixel Agents supports Claude Code, Antigravity, Gemini CLI, OpenCode, and GitHub Copilot with multi-agent lifecycle awareness and real-time visualization.

## Core Value

Provide delightful, accurate, real-time pixel art visualization and workspace status for developers using modern AI coding agents (Antigravity, Claude Code, Gemini CLI, OpenCode, and Copilot).

## Current Milestone: v1.1 Local Build and VSIX Packaging

**Goal:** Enable local building and packaging of the ED Pixel Agents VS Code extension for installation (local-only, no GitHub dependency).

**Target features:**
- Automated local build pipeline for extension and webview
- VSIX packaging script (using `vsce`)
- Local development/installation guide in README

## Release History

**Milestone v1.0 Shipped ✅ (2026-11-08)**
- Multi-provider ingestion server with canonical `AgentEvent` model.
- Provider-scoped session routing and collision prevention (deterministic hue shifting).
- Full adapter support for Antigravity, Gemini, OpenCode, and Copilot.
- Office capacity expanded to 5 simultaneous agents.
- Project rebranded to **ED Pixel Agents**.

## Requirements

### Validated

- ✓ Pixel art office canvas and character animation engine — existing
- ✓ Multi-server registry and HTTP hook dispatch listener — existing
- ✓ Interactive consent gating and permission-exempt tool definitions — existing
- ✓ Multi-provider ingestion server and event normalization — v1.0
- ✓ Provider-scoped session routing and palette collision detection — v1.0
- ✓ Antigravity, Gemini, OpenCode, and Copilot adapters — v1.0
- ✓ Rebrand to "ED Pixel Agents" — v1.0

### Active

- [ ] Optimize webview performance for long-running high-event sessions
- [ ] Implement agent-specific idle animations based on hook activity pauses

### Out of Scope

- Rewriting canvas rendering engine or sprite asset pipeline — existing animations and office mechanics are preserved
- Dropping Claude Code support — must remain fully functional as a reference provider
- Unsanctioned monkey-patching of closed CLIs — integrations must use supported hooks, logs, or extension APIs

## Context

- **Codebase Layout**:
  - `core/`: Shared types (`HookProvider`, `AgentEvent`), asset definitions, protocol constants
  - `server/`: HTTP microserver, `HookEventHandler`, session router, consent flow, and provider adapters
  - `adapters/vscode/`: Extension host entrypoint, webview provider, terminal adapter
  - `webview-ui/`: React + canvas frontend rendering the office and character animations
- **Installed Agent Toolchains**:
  - Antigravity CLI (`agy` v1.5.3)
  - Google Gemini CLI (`gemini` v0.67.0)
  - OpenCode (`opencode` v1.18.31)
  - GitHub Copilot CLI (`copilot` v1.0.107)
- **Integration Model**:
  - Agents post lifecycle events (`SessionStart`, `ToolStart`, `ToolEnd`, `Stop`) to a local HTTP server which normalizes them into `AgentEvent` objects and routes them to the pixel office.

## Constraints

- **Compatibility**: VS Code engine `^1.105.0`
- **Runtime**: Node.js `>=20`
- **Zero-Crash Delivery**: Hook scripts must fail silently/gracefully without breaking user CLI runs
- **Non-blocking**: Event dispatch must have negligible latency overhead on CLI agent turns

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Provider-namespaced session routing | Prevents session ID collisions across different agent providers | — Implemented (v1.0) |
| Deterministic hue shifting for collisions | Ensures visual distinction when multiple agents overlap or share palettes | — Implemented (v1.0) |
| Bounded async event queue | Hardens the ingestion server against event spikes and prevents memory leaks | — Implemented (v1.0) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-11-08 after v1.0 completion*