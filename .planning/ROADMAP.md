# Roadmap

## Archived Milestones

- [v1.0 (v1.0-milestone)](milestones/v1.0-ROADMAP.md) — Multi-agent ingestion and office capacity expansion.

## Next Milestone

- [ ] **Phase 5: Automated Local Build** - Single-script build for extension and webview.
- [ ] **Phase 6: VSIX Packaging & Installation** - Artifact generation and local install guide.

## Phase Details

### Phase 5: Automated Local Build
**Goal**: Enable one-command local building of the extension and its webview.
**Depends on**: Nothing (v1.1 start)
**Requirements**: BUILD-01, BUILD-02
**Success Criteria** (what must be TRUE):
  1. `npm run build` triggers builds for both extension host and React webview.
  2. Build completes successfully using only local dependencies (no CI/actions).
**Plans**: TBD

### Phase 6: VSIX Packaging & Installation
**Goal**: Generate an installable VSIX artifact and document the local install flow.
**Depends on**: Phase 5
**Requirements**: PACK-01, PACK-02, DOCS-01
**Success Criteria** (what must be TRUE):
  1. `npm run package` generates a `.vsix` file via `vsce`.
  2. The generated `.vsix` includes both the extension JS and the bundled `webview-ui` assets.
  3. README provides verified steps to install the extension from the `.vsix` file.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Automated Local Build | 0/1 | Not started | - |
| 6. VSIX Packaging & Installation | 0/1 | Not started | - |
