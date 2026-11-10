---
phase: 06
slug: vsix-packaging-installation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-11-09
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                           |
| ---------------------- | ----------------------------------------------- |
| **Framework**          | shell / custom                                  |
| **Config file**        | none                                            |
| **Quick run command**  | `ls dist/local/*.vsix`                          |
| **Full suite command** | `npm run package:local && ls dist/local/*.vsix` |
| **Estimated runtime**  | ~15 seconds                                     |

---

## Sampling Rate

- **After every task commit:** Run `ls dist/local/*.vsix`
- **After every plan wave:** Run `npm run package:local && ls dist/local/*.vsix`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type   | Automated Command          | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ---------- | --------------- | ----------- | -------------------------- | ----------- | ---------- |
| 06-01-01 | 01   | 1    | PACK-01     | N/A        | N/A             | integration | `npm run package:local`    | ❌ W0       | ⬜ pending |
| 06-01-02 | 01   | 1    | PACK-02     | N/A        | N/A             | integration | `ls dist/local/*.vsix`     | ❌ W0       | ⬜ pending |
| 06-01-03 | 01   | 1    | DOCS-01     | N/A        | N/A             | source      | `ls docs/INSTALL_LOCAL.md` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `dist/local/` directory creation.
- [ ] `docs/` directory existence check.

---

## Manual-Only Verifications

| Behavior                     | Requirement | Why Manual  | Test Instructions                                                   |
| ---------------------------- | ----------- | ----------- | ------------------------------------------------------------------- |
| VSIX installation in VS Code | PACK-02     | Environment | Install the generated VSIX manually in VS Code and verify it loads. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
