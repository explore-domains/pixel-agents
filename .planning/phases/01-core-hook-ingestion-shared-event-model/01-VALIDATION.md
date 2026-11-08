---
phase: 1
slug: core-hook-ingestion-shared-event-model
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-08
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before /gsd-verify-work:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | CORE-01 | — | Validates generic route accepts multiple provider IDs | unit | `npx vitest run server/src/__tests__/httpServer.test.ts` | ⬜ pending | ⬜ pending |
| 01-01-02 | 01 | 1 | CORE-01 | — | Normalization translation is correct for test payloads | unit | `npx vitest run server/src/__tests__/hookEventHandler.test.ts` | ⬜ pending | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/src/__tests__/httpServer.test.ts` — stubs for CORE-01 generic route
- [ ] `server/src/__tests__/hookEventHandler.test.ts` — stubs for normalization logic

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-agent ingestion | CORE-01 | Integration complexity | Run manual-hook-events.http with multiple providers and check logs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending