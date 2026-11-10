---
wave: 1
depends_on: []
files_modified:
  - package.json
  - docs/INSTALL_LOCAL.md
autonomous: true
must_haves:
  truths:
    - 'Users can package the extension locally with one command'
    - 'Generated VSIX includes extension and webview assets'
    - 'Installation instructions are documented'
  artifacts:
    - path: package.json
      provides: 'package:local script'
    - path: dist/local/*.vsix
      provides: 'Installable extension artifact'
    - path: docs/INSTALL_LOCAL.md
      provides: 'Local installation guide'
  key_links:
    - from: 'package.json script'
      to: 'dist/local/*.vsix'
      via: 'npm run package:local execution'
---

# Plan 01 - VSIX Packaging & Installation

## Goal

Enable one-command VSIX packaging and document local installation.

## Requirements

- PACK-01: Automate VSIX packaging.
- PACK-02: Include webview assets in VSIX.
- DOCS-01: Document local installation.

## Tasks

<task>
<id>06-01-01</id>
<files>package.json</files>
<action>
Add `package:local` script to package.json: `npm run check && npm run build && npx @vscode/vsce package --out dist/local/`
</action>
<verify>
<automated>npm run package:local</automated>
</verify>
<done>package.json contains `package:local` script.</done>
</task>

<task>
<id>06-01-02</id>
<files>dist/local/*.vsix</files>
<action>
Verify VSIX is generated and contains webview-ui assets.
</action>
<verify>
<automated>npx @vscode/vsce ls dist/local/*.vsix | grep -i 'webview-ui'</automated>
</verify>
<done>VSIX artifact exists and contains webview-ui assets.</done>
</task>

<task>
<id>06-01-03</id>
<files>docs/INSTALL_LOCAL.md</files>
<action>
Create `docs/INSTALL_LOCAL.md` with instructions on how to install a `.vsix` file using VS Code "Install from VSIX" command.
</action>
<verify>
<automated>ls docs/INSTALL_LOCAL.md</automated>
</verify>
<done>docs/INSTALL_LOCAL.md exists and instructions are clear.</done>
</task>

## Artifacts this phase produces

- `package.json` (modified)
- `dist/local/*.vsix`
- `docs/INSTALL_LOCAL.md`

## Verification criteria

- VSIX file generation successful and artifact is installable.
- Documentation verified.
