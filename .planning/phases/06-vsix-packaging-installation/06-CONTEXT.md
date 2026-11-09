# Phase 6: VSIX Packaging & Installation - Context

**Gathered:** 2026-11-09
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase generates an installable VSIX artifact for ED Pixel Agents and documents the local installation flow, ensuring developers can run the extension locally without external dependencies or publishing to the VS Code Marketplace.

</domain>

<decisions>
## Implementation Decisions

### Packaging Tooling
- **D-01:** Use `npx @vscode/vsce package` to generate the `.vsix` file, avoiding additional permanent devDependencies.

### Output Location
- **D-02:** All `.vsix` artifacts shall be output to `dist/local/` to maintain a clean workspace.

### Documentation Strategy
- **D-03:** Local installation instructions shall be created in `docs/INSTALL_LOCAL.md`.

### Build Chaining
- **D-04:** The packaging script (`npm run package:local`) must be robust: `npm run check && npm run build && npx @vscode/vsce package --out dist/local/`.

### the agent's Discretion
- **Packaging flags**: The agent has discretion over flags passed to `vsce` (e.g., `--no-dependencies`, `--no-markdown`) to ensure the generated artifact includes necessary bundled webview assets while remaining as slim as possible.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Scope
- `.planning/ROADMAP.md` — Phase 6 goal and success criteria.
- `.planning/REQUIREMENTS.md` — Requirements PACK-01, PACK-02, DOCS-01.

### Build Configuration
- `package.json` — Existing build and lint scripts.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `package.json`: Target for adding the new `package:local` script.

### Established Patterns
- `npm run check` (Phase 5): For lint/type-checking before packaging.
- `npm run build` (Phase 5): For generating artifacts before packaging.

</code_context>

---

*Phase: 6-VSIX Packaging & Installation*
*Context gathered: 2026-11-09*
