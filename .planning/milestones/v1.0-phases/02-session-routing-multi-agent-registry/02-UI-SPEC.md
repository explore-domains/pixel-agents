# UI Design Contract: Phase 02 - Session Routing + Multi-Agent Registry

**Status:** Draft
**Phase:** 02 - session-routing-multi-agent-registry

## Design System
- **Spacing:** 4px, 8px, 16px, 24px, 32px to ensure grid alignment.
- **Typography:** FS Pixel Sans
  - Base: 22px
  - Agent labels: 22px
  - Tooltip text: 18px
  - Empty/error messages: 22px
- **Palette:**
  - Background: `--color-bg` (#1e1e2e)
  - Secondary: `--color-bg-dark` (#181828)
  - Accent: `--color-accent` (#6030ff) (Reserved For: Active agent highlight, tooltip border, selected agent avatar indicator)
  - Text: `--color-text` (rgba(255, 255, 255, 0.9))
- **Pixel-art style:** No rounded corners, `2px 2px 0px #0a0a14` shadow.

## Multi-Agent Registry UI Requirements

### Avatar Rendering
- **Provider-Specified Mapping:** Use provider-specific avatar definitions.
- **Collision Prevention:** If avatar IDs collide, apply Hue Shift Offset.
- **Fade-In Entrance:** Agents enter via Standard Fade-In at assigned seat.
- **Visibility:** Equal visibility for all active agents (no z-index occlusion per D-07).
- **Focal Point:** Active (most recent) agent avatar carries visual emphasis (subtle glow or scale).

### Agent Positioning
- **Fixed Seats:** 1-5 seat mapping.
- **Static Seats:** Do not shift when agents leave.

### Agent Identification (Labels)
- **Label Format:** `[Provider Name] [Session ID]` (Example: "Claude Code #A123")
- **Tooltip:** Detailed tooltip on hover (using existing component).

## Copywriting Contract
- **Agent Labels:** `{ProviderName} {SessionID}`
- **Empty State Copy:** "No agents active. Launch an agent to start working."
- **Error State Copy:** "Failed to connect agent session. Please check your provider authentication and try again."
- **Destructive Actions:** (None in this phase).

## Implementation Plan
- Extend `AgentStateStore` to include `providerId`.
- Update `paletteAssigner.ts` for hue shift logic on avatar collisions.
- Update `SessionRouter` for namespaced `makeKey`.

## Safety Gate
- Registry component registry: None (manual implementation).
