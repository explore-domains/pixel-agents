# Phase 5: Automated Local Build - Context

**Gathered:** 2026-11-09
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a single-command local build pipeline for the ED Pixel Agents extension and its React webview. It ensures the build process is entirely local-only, removing any external CI or GitHub dependencies for local development and packaging.

</domain>

<decisions>
## Implementation Decisions

### Build Pipeline
- **D-01:** Implement a new dedicated `npm run local-build` script to separate local-only build flows from standard prepublish/CI tasks.
- **D-02:** The `local-build` script must perform "Full Verification," including linting and type checks, before proceeding with the build.
- **D-03:** The build pipeline must automatically handle missing dependencies by running `npm install` in both the project root and `webview-ui` if `node_modules` are not present.
- **D-04:** Build artifacts for this local flow should be stored in a new `local-build/` directory to avoid polluting the standard `dist/` directory used by official releases.

### VSIX Packaging
- **D-05:** Use `npx @vscode/vsce package` for VSIX generation to avoid adding `vsce` as a permanent devDependency.
- **D-06:** The packaging script must automatically trigger the `local-build` pipeline first to ensure the artifact is built from fresh, verified code.

### Documentation
- **D-07:** Create a new documentation file `docs/LOCAL_INSTALL.md` dedicated to local installation instructions.
- **D-08:** The installation guide must cover the full lifecycle: initial installation from VSIX, updating the extension, and uninstallation.

### the agent's Discretion
- **Architecture**: The agent has discretion over how to structure the `local-build` script (e.g., whether to use a shell script, a JS script, or a series of npm script concatenations).
- **Tooling**: Discretion on specific flags for `esbuild` and `vsce` to optimize for local installation (e.g., including sourcemaps).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope
- `.planning/ROADMAP.md` — Phase 5 goal and success criteria.
- `.planning/REQUIREMENTS.md` — Requirements BUILD-01, BUILD-02, PACK-01, PACK-02, DOCS-01.

### Build Configuration
- `package.json` — Existing build scripts and workspace definitions.
- `esbuild.js` — Core extension build logic.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `esbuild.js`: Existing build logic for the extension host can be adapted or reused for the local build.
- `webview-ui/package.json`: Contains the build script for the frontend.

### Established Patterns
- `npm-run-all`: Project uses this for parallel/sequential script execution.
- `tsx`: Used for running TypeScript scripts (like `scripts/generate-messages.ts`).

### Integration Points
- `package.json`: Where the new `local-build` and packaging scripts will be registered.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly requested a "local build script, no build via github required."
- Artifacts should go to `local-build/` to keep local experiments isolated.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 5-Automated Local Build*
*Context gathered: 2026-11-09*
