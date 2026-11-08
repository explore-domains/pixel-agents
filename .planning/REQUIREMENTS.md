# Requirements

## User Stories
- As a developer, I want to see multiple AI coding agents active simultaneously in my pixel art office, so I can track all my agent work.
- As a developer, I want to support Antigravity, Gemini CLI, OpenCode, and Copilot in addition to Claude Code, so I am not locked into one agent provider.
- As a developer, I want to ensure that agent sessions are accurately tracked and do not collide, so I can trust the office visualization.

## v1 Requirements

### Core Infrastructure
- [x] **CORE-01**: Implement canonical `AgentEvent` normalization boundary in `HookEventHandler`.
- [x] **CORE-02**: Implement multi-provider session registry with namespacing (provider + workspace + sessionID).

### Agent Adapters
- [ ] **ADAP-01**: Implement Antigravity hook adapter (shell-bridge).
- [ ] **ADAP-02**: Implement Gemini CLI hook adapter (shell-bridge).
- [ ] **ADAP-03**: Implement OpenCode hook adapter (plugin/SDK).
- [ ] **ADAP-04**: Implement Copilot hook adapter (native HTTP).

### UI/Visualization
- [ ] **UI-01**: Update Pixel Office canvas to support 5 concurrent agent avatars.
- [ ] **UI-02**: Rebrand UI and extension metadata to "ED Pixel Agents".

## v2 Requirements (Deferred)
- [ ] **UI-03**: Add "agent status" dashboard in webview.
- [ ] **UI-04**: Implement customizable character sprites.

## Out of Scope
- Rewriting canvas rendering engine or sprite asset pipeline.
- Dropping Claude Code support.
- Unsanctioned monkey-patching of closed CLIs.
