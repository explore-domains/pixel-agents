# Installing ED Pixel Agents Locally

## Build and Package

Generate a `.vsix` file from source:

```bash
npm run package:local
```

This runs type-checking, linting, and both the extension and webview builds, then outputs the artifact to `dist/local/ed-pixel-agents-*.vsix`.

## Install in VS Code

### Option 1 — Command Palette

1. Open VS Code.
2. Open the Command Palette: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS).
3. Run **Extensions: Install from VSIX…**
4. Navigate to `dist/local/` and select the `.vsix` file.
5. Reload VS Code when prompted.

### Option 2 — VS Code CLI

```bash
code --install-extension dist/local/ed-pixel-agents-*.vsix
```

### Option 3 — Drag and Drop

Drag the `.vsix` file onto the Extensions view sidebar in VS Code.

## Verify Installation

1. Open the Command Palette and run **ED Pixel Agents: Show Panel**.
2. The pixel art office panel should open in the bottom panel area.

## Uninstall

Open the Extensions view (`Ctrl+Shift+X`), search for **ED Pixel Agents**, and click **Uninstall**.
