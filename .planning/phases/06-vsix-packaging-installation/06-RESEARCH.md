# Phase 06: VSIX Packaging & Installation - Research

**Date:** 2026-11-09

## Domain Analysis

- **Goal:** Automate VSIX packaging and document local installation.
- **Constraints:** Must include extension JS and webview assets, should be robust, and maintain workspace cleanliness.
- **Tools:** `vsce` (Visual Studio Code Extensions CLI).

## Technical Approach

- **Packaging:** Use `npx @vscode/vsce package` with custom output dir (`--out dist/local/`).
- **Automation:** Update `package.json` with `package:local` script: `npm run check && npm run build && npx @vscode/vsce package --out dist/local/`.
- **Packaging Artifacts:** Ensure `vsce` packs the correct files (using `.vscodeignore` or `files` field in `package.json`).
- **Documentation:** Create `docs/INSTALL_LOCAL.md` with instructions on how to install a `.vsix` in VS Code.

## File List

- **Modified:** `package.json` (add script)
- **Created:** `docs/INSTALL_LOCAL.md`
- **Created:** `dist/local/` (via `vsce`)

## Validation Architecture

- **Criteria:**
  - `npm run package:local` completes.
  - `dist/local/*.vsix` exists.
  - VSIX contains `extension.js` and `webview-ui` folder.
  - Installation via VS Code "Install from VSIX" works.

## Risk Summary

- **Dependencies:** `vsce` might need configuration to include webview assets if they are not in the `files` list. Need to verify `.vscodeignore` and `package.json` files list.
