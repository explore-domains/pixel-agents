# Roadmap

## Phase 1: Core Hook Ingestion + Shared Event Model

**Goal:** Establish canonical event normalization and HTTP ingestion server capable of receiving events from all 5 agents.
**Mode:** standard
**Plans:** 1/1 plans complete
**Plan list:**

- [x] 01-PLAN.md — establish generic hook ingestion, canonical AgentEvent model, and provider-safe session namespacing.

**Success Criteria**:

1. Extension HTTP server ingests raw payloads from all 5 agents.
2. Canonical `AgentEvent` schema implemented.
3. Event normalization working for all 5 providers.

## Phase 2: Session Routing + Multi-Agent Registry

**Goal:** Implement robust session ID namespacing and provider-specific registry to prevent collisions in the pixel office.
**Mode:** standard
**Plans:** 1/1 plans complete
**Plan list:**

- [x] 02-01-PLAN.md — implement provider-scoped session registry with collision prevention and persistence.

**Success Criteria**:

1. Multi-provider session registry functional.
2. Two or more agents can be active in the office without colliding avatars.
3. Provider-scoped auth handles event payloads securely.

## Phase 3: Provider Integrations (Adapters)

**Goal:** Build and deploy adapters for Antigravity, Gemini CLI, OpenCode, and Copilot.
**Mode:** standard
**Plans:** 1/1 plans complete
**Plan list:**

- [x] 03-01-PLAN.md — implement provider adapters for Antigravity, Gemini CLI, OpenCode, and Copilot; complete five-agent UI and ED Pixel Agents branding.

**Success Criteria**:

1. Antigravity, Gemini, OpenCode, Copilot adapters operational.
2. E2E test of all 5 CLI integrations.
3. Rebrand UI to "ED Pixel Agents" verified.

## Phase 4: UX Polish + Safety / Ops Hardening

**Goal:** Optimize event delivery latency and harden the extension against concurrency/crash issues.
**Mode:** standard
**Plans:** 1/1 plans complete
**Plan list:**

- [x] 04-01-PLAN.md — harden the async hook queue, add latency smoke checks, and validate the final office under load.

**Success Criteria**:

1. Bounded async event queue implemented.
2. Latency metrics verify negligible impact on CLI execution.
3. Final E2E performance validation pass.
