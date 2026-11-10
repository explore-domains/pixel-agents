# Phase 5: Research

## BUILD-01: Automated Build Script

The build script needs to invoke:

1. `npm install` (if node_modules missing - auto-install)
2. `npm run compile` (from existing scripts)

## BUILD-02: Local-only

Ensure no network calls to external CI systems.

## Pattern Analysis

Use `scripts/` folder for build utility scripts.
Use `esbuild.js` for bundling.
