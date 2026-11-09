# Requirements

## Milestone v1.1: Local Build and VSIX Packaging

### BUILD: Local Build Pipeline
- [ ] **BUILD-01**: User can build the extension and webview via a single `npm` script.
- [ ] **BUILD-02**: Build process is local-only (no external CI/GitHub dependency).

### PACK: VSIX Packaging
- [ ] **PACK-01**: User can generate a `.vsix` file using `vsce`.
- [ ] **PACK-02**: `.vsix` file contains all necessary assets (webview bundles, extension code).

### DOCS: Documentation
- [ ] **DOCS-01**: README contains steps for local installation from VSIX.

## Future Requirements
- [ ] **UI-03**: Add "agent status" dashboard in webview.
- [ ] **UI-04**: Implement customizable character sprites.

## Out of Scope
- Automated build via GitHub Actions (explicitly requested to be local-only).
- Rewriting canvas rendering engine or sprite asset pipeline.
- Dropping Claude Code support.
- Unsanctioned monkey-patching of closed CLIs.

## Traceability
(To be filled by roadmap)
