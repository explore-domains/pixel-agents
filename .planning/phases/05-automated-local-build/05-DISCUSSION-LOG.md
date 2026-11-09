# Phase 5: Automated Local Build - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-09
**Phase:** 5-Automated Local Build
**Areas discussed:** Build Pipeline, VSIX Packaging, Installation Guide

---

## Build Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Enhance Existing Build | Enhance the existing "npm run build" | |
| New Local Build Script | Create a new dedicated "npm run local-build" | ✓ |

**User's choice:** New Local Build Script
**Notes:** User wants a clean separation for local-only builds.

## Build Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Fast Compile | Only compile extension and webview (skip linting/testing) | |
| Full Verification | Run linting and type checks before building | ✓ |

**User's choice:** Full Verification
**Notes:** Ensures local builds are high quality.

## Dependencies

| Option | Description | Selected |
|--------|-------------|----------|
| Assume Installed | Build script should assume dependencies are already installed | |
| Auto-Install Missing | Build script should automatically run "npm install" | ✓ |

**User's choice:** Auto-Install Missing
**Notes:** Makes the build more robust for fresh checkouts or dev environments.

## Artifacts

| Option | Description | Selected |
|--------|-------------|----------|
| Stay in dist/ | Keep using "dist/" (standard for this project) | |
| New local-build dir | Use a new "local-build/" directory to avoid polluting main dist | ✓ |

**User's choice:** New local-build dir
**Notes:** Isolation of local build artifacts.

---

## VSIX Packaging

| Option | Description | Selected |
|--------|-------------|----------|
| DevDependency (Local) | Add "@vscode/vsce" as a devDependency | |
| Use npx (No dependency) | Use "npx @vscode/vsce" to avoid adding another dependency | ✓ |

**User's choice:** Use npx (No dependency)
**Notes:** Prefers lighter dependency footprint for local tools.

## Packaging Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-build on package | Packaging script should automatically run the "local-build" pipeline | ✓ |
| Manual build required | Packaging script should fail if build is not present | |

**User's choice:** Auto-build on package
**Notes:** Streamlines the path from code to VSIX.

---

## Installation Guide

| Option | Description | Selected |
|--------|-------------|----------|
| New File (docs/LOCAL_INSTALL.md) | Create a new file "docs/LOCAL_INSTALL.md" | ✓ |
| Append to root README.md | Append to root "README.md" | |

**User's choice:** New File (docs/LOCAL_INSTALL.md)
**Notes:** Keeps README focused on general project info.

## Guide Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Install only | Keep it simple: Installation steps only | |
| Full lifecycle support | Include update/uninstall instructions | ✓ |

**User's choice:** Full lifecycle support
**Notes:** Comprehensive documentation for local extension users.

---

## the agent's Discretion

- Choice of internal build script structure (shell vs JS).
- Specific compiler flags and vsce configuration for local optimization.

## Deferred Ideas

- None mentioned.
