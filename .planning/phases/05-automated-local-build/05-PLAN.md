---
wave: 1
depends_on: []
files_modified:
  - package.json
  - scripts/local-build.js
requirements_addressed:
  - BUILD-01
  - BUILD-02
autonomous: true
must_haves:
  truths:
    - "User can build extension and webview with single npm run local-build command"
    - "Build completes without network access or external CI"
    - "All artifacts (extension.js, webview dist) present in local-build/"
  artifacts:
    - path: "scripts/local-build.js"
      provides: "Build orchestration script"
    - path: "local-build/extension.js"
      provides: "Bundled extension code"
    - path: "local-build/webview-ui/dist/"
      provides: "React webview static assets"
  key_links:
    - from: "scripts/local-build.js"
      to: "package.json"
      via: "reads and executes npm run scripts"
    - from: "scripts/local-build.js"
      to: "local-build/"
      via: "creates and populates output directory"
---

# Phase 5: Automated Local Build - Plan

## Objective
Enable one-command local building of the extension and its webview.

## Tasks

### <task id="1"> Implement local build script
<read_first>
- package.json
- esbuild.js
- webview-ui/package.json
</read_first>
<action>
Create `scripts/local-build.js` that:
1. Verifies `node_modules` existence (run `npm install` if missing).
2. Run Full Verification:
   2a. `npm run asyncapi:generate`
   2b. `npm run check-types`
   2c. `npm run lint`
   2d. If verification fails, abort with error.
3. Run build:
   3a. `npm run build:extension`
   3b. `npm run build:webview`
4. Output to `local-build/`:
   4a. Ensure `local-build/` exists.
   4b. Copy `dist/extension.js` → `local-build/extension.js`
   4c. Copy `webview-ui/dist/` → `local-build/webview-ui/dist/`
</action>
<verify>
- node scripts/local-build.js
- ls -la local-build/
- test -f local-build/extension.js
- test -d local-build/webview-ui/dist
</verify>
<done>
- local-build/extension.js exists and is valid JS
- local-build/webview-ui/dist/ contains Vite build output
- Build log shows no errors from lint, tsc, or esbuild
- Linting and type-checking passed before build started
</done>

### <task id="2"> Add npm script
<read_first>
- package.json
</read_first>
<action>
Add `"local-build": "node scripts/local-build.js"` to `package.json` scripts.
</action>
<verify>
- npm run local-build 2>&1
- echo $?
- grep -q '"local-build"' package.json
</verify>
<done>
- package.json contains "local-build": "node scripts/local-build.js"
- npm run local-build exits with code 0
- No script errors
</done>

## Verification Criteria
- `npm run local-build` works without external network for CI.
- All artifacts present in `local-build/`.

## Artifacts this phase produces
- `scripts/local-build.js`
- `local-build/` (directory)
- `local-build/extension.js`
- `local-build/webview-ui/dist/`
