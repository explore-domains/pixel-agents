# Phase 5: Automated Local Build - Pattern Map

**Mapped:** 2026-11-09
**Files analyzed:** 4 new/modified files
**Analogs found:** 3 / 4

## File Classification

| New/Modified File                | Role    | Data Flow        | Closest Analog                    | Match Quality |
| -------------------------------- | ------- | ---------------- | --------------------------------- | ------------- |
| `package.json` (scripts section) | config  | request-response | `package.json` (existing)         | exact         |
| `scripts/build-local.mjs`        | utility | batch            | `scripts/verify-vsix-package.mjs` | role-match    |
| `scripts/package-vsix.mjs`       | utility | batch            | `scripts/verify-vsix-package.mjs` | role-match    |
| `docs/LOCAL_INSTALL.md`          | doc     | transform        | `docs/external-assets.md`         | role-match    |

---

## Pattern Assignments

### `package.json` (scripts section) — config, request-response

**Analog:** `package.json` (existing)

**Existing script pattern** (lines 91–125):

```json
"scripts": {
  "vscode:prepublish": "npm run package",
  "build:extension": "node esbuild.js --production",
  "build:webview": "cd webview-ui && npm run build",
  "compile": "npm run asyncapi:generate && npm run check-types && npm run lint && node esbuild.js && npm run build:webview",
  "build": "npm run compile",
  "package": "npm run asyncapi:generate && npm run check-types && npm run lint && node esbuild.js --production && npm run build:webview",
  "asyncapi:generate": "tsx scripts/generate-messages.ts"
}
```

**Pattern to apply:**

- Sequential npm run chain: each script calls ordered dependencies via `npm run`
- Full verification before build: `asyncapi:generate && check-types && lint`
- Separate build script (esbuild.js) run via `node`
- Webview build delegated to child workspace: `cd webview-ui && npm run build`

**For local-build script, add to scripts section:**

```json
"local-build": "node scripts/build-local.mjs",
"local-build:package": "npm run local-build && node scripts/package-vsix.mjs",
```

---

### `scripts/build-local.mjs` (utility, batch)

**Analog:** `scripts/verify-vsix-package.mjs` (lines 1–50)

**Import/setup pattern** (lines 1–9):

```javascript
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
```

**Error handling & early exit pattern** (lines 111–113, 130–133):

```javascript
async function main() {
  const vsixPath = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(vsixPath)) throw new Error(`VSIX does not exist: ${vsixPath}`);
  // ... work ...
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
```

**Async subprocess execution pattern** (lines 1–2, 114–116):

```javascript
import { execFile } from 'node:child_process';
// ...
const { stdout } = await execFileAsync('unzip', ['-Z1', vsixPath], {
  maxBuffer: 20 * 1024 * 1024,
});
```

**Alternative pattern from `esbuild.js` (lines 1–14, 85–114):** If preferring synchronous shell spawning:

```javascript
const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  // Use `esbuild.context()` for watch mode, or conditional logic for arg parsing
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

**For local-build script:**

- Use `execFileAsync` to run `npm install` if `node_modules` missing (root + webview-ui)
- Use `child_process.execSync()` or `execFileAsync` to run the existing compile chain (asyncapi:generate, check-types, lint, esbuild)
- Output all artifacts to `local-build/` instead of `dist/`
- Chain: check node_modules → asyncapi → check-types → lint → esbuild with `--outdir local-build/` → webview build to `local-build/webview/`
- Console.log progress markers (✓ Copied assets / ✓ Built hooks / ✓ Built extension)

---

### `scripts/package-vsix.mjs` (utility, batch)

**Analog:** `scripts/verify-vsix-package.mjs` (structural)

**Subprocess spawning for external tools** (lines 10–15, 114–116):

```javascript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Run external tool (in this case, unzip; for vsce, use 'vsce' or 'npx' + '@vscode/vsce'):
await execFileAsync('unzip', ['-Z1', vsixPath], { maxBuffer: 20 * 1024 * 1024 });
```

**Arg parsing and path resolution** (lines 33–37):

```javascript
function parseArgs(argv) {
  if (argv.length !== 1)
    throw new Error('Usage: node scripts/verify-vsix-package.mjs <extension.vsix>');
  return path.resolve(argv[0]);
}
```

**Error handling wrapper** (lines 130–133):

```javascript
main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
```

**For packaging script:**

- Use `execFileAsync('npx', ['@vscode/vsce', 'package', '--allow-star-activation', '--out', outputPath])` to invoke vsce without adding it as devDependency
- Accept an optional `--out` arg for output filename (default: `pixel-agents-local.vsix`)
- Wrap in try/catch, log success message with VSIX path
- Do NOT use `process.argv.includes()` — instead parse formally like verify-vsix-package does
- Exit non-zero on error

---

### `docs/LOCAL_INSTALL.md` (doc, transform)

**Analog:** `docs/external-assets.md` (structure)

**Document structure pattern** (lines 1–40):

````markdown
# Title

First paragraph: goal/context

## Section Header

Inline code blocks for paths, commands, config keys.

### Subheader

Longer code blocks with markdown fence.

```bash
command example
```
````

1. Numbered steps for user workflows
2. Each step is one bounded action

````

**Pattern to apply:**
- H1 title: `# ED Pixel Agents — Local Installation Guide`
- Opening paragraph: explain the audience (local dev + users wanting to install locally from VSIX)
- H2 sections: Prerequisites | Installation from VSIX | Updating | Uninstallation | Troubleshooting
- Each section has numbered workflow steps (1. 2. 3.)
- Code blocks for shell commands (use markdown fence with `bash` language tag)
- Path references inline: `` `pixel-agents-local.vsix` ``
- Config file paths: `` `~/.pixel-agents/config.json` ``
- VSCode command names: **Developer: Reload Window** (bold)

---

## Shared Patterns

### Subprocess Execution in Build Scripts

**Source:** `scripts/verify-vsix-package.mjs` + `esbuild.js`

**Apply to:** `scripts/build-local.mjs`, `scripts/package-vsix.mjs`

Use Node.js `child_process.execFileAsync` (promisified `execFile`) for:
- Running `npm install` in root and `webview-ui/`
- Running existing compile tasks
- Running `vsce` via `npx`

Pattern:
```javascript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function runCommand(cmd, args, options = {}) {
  const { stdout, stderr } = await execFileAsync(cmd, args, options);
  if (stderr) console.log(stderr);
  return stdout;
}

await runCommand('npm', ['install'], { cwd: './webview-ui' });
````

### Error Handling in Scripts

**Source:** `scripts/verify-vsix-package.mjs` lines 130–133 + `scripts/generate-messages.ts` lines 150–153

**Apply to:** Both build and package scripts

Pattern:

```javascript
main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
```

Or in TypeScript:

```typescript
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### Console Progress Markers

**Source:** `esbuild.js` lines 31, 62, 109–111

**Apply to:** `scripts/build-local.mjs`

Pattern:

```javascript
console.log('✓ Copied assets/ → local-build/assets/');
console.log('✓ Built hooks/ → local-build/hooks/');
console.log('[build] Extension bundled: local-build/extension.js');
```

---

## No Analog Found

Files with close matches in the codebase (all four new files have working analogs):

| File   | Reason                                                |
| ------ | ----------------------------------------------------- |
| (none) | All files have analogs or follow established patterns |

---

## Metadata

**Analog search scope:** root `package.json`, `scripts/*.mjs`, `docs/`, `esbuild.js`
**Files scanned:** 12 source files
**Pattern extraction date:** 2026-11-09

---

## Key Takeaways

1. **package.json scripts:** Parallel naming convention (compile → build, asyncapi:generate → compile chain). New scripts follow this: `local-build` + `local-build:package` mirrors `package` + `vscode:prepublish`.

2. **Build scripts (.mjs):** Established project convention is Node.js + async/await with `execFileAsync`, formal arg parsing, and error handlers that log and exit non-zero.

3. **Docs:** Follow external-assets.md structure: H1 title → context → H2 sections → numbered steps → code blocks with inline paths/references.

4. **Output directory:** `local-build/` mirrors existing structure of `dist/` — esbuild `--outdir`, webview → subdirectory, hooks bundled to subdirectory. Pattern: `{ outdir: 'local-build', outfile: 'local-build/extension.js' }`.

5. **Artifact isolation:** Keep sourcemaps ON for local-build (unlike production build `--minify`). Use `sourcemap: !production` logic but force `sourcemap: true` for local builds.
