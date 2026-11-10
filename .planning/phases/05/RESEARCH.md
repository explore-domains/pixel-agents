# Research: Phase 5 - Automated Local Build

## 1. Current State

The build process is currently sequential and coupled with linting/type-checking in the `compile` script:
`"compile": "npm run asyncapi:generate && npm run check-types && npm run lint && node esbuild.js && npm run build:webview"`

- Extension build (`esbuild.js`) is separate from Webview build (`webview-ui` via Vite).
- Both are chained together in the main `compile` script.
- Linting/type-checking runs as part of the build, slowing down the edit-build-debug loop.

## 2. Proposed Changes

- **Decouple Quality Checks**: Move `lint` and `check-types` to a separate `check` script. `build` should only be concerned with producing artifacts.
- **Unify Build**: Create a single entry point (e.g., `npm run build`) that orchestrates both extension and webview builds.
- **Parallelize**: Use `npm-run-all` (already a devDependency) to run extension and webview builds in parallel.

## 3. Dependencies & Tools

- `npm-run-all` (exists)
- `esbuild` (exists)
- `vite` (exists)

## 4. Verification Plan

1. `npm run build` generates artifacts in `dist/`.
2. Artifacts are complete (extension + webview).
3. Build completes without `lint`/`check-types` overhead.
4. Extension works in local VS Code.
