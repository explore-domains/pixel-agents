# Phase 5 Plan: Automated Local Build

requirements: [BUILD-01, BUILD-02]
must_haves:
truths: ['One-command build works locally', 'Build output complete']
artifacts: [dist/extension.js, dist/webview/, dist/assets/, dist/hooks/, dist/uninstall.js]
key_links: [none]

## Goal

Enable one-command local building of the extension and its webview.

<tasks>
  <task>
    <name>Update package.json and orchestrate build</name>
    <files>
      <file>package.json</file>
    </files>
    <action>
      1. Create "check" script: `"check": "npm run asyncapi:generate && npm run check-types && npm run lint"`
      2. Update "build" script: `"build": "npm run asyncapi:generate && npm-run-all -p build:extension build:webview"`
    </action>
    <verify>
      Verify "npm run build" runs both extension and webview builds in parallel.
    </verify>
    <done>
      "npm run build" succeeds and triggers both builds.
    </done>
  </task>

  <task>
    <name>Verify artifact integrity</name>
    <files>
      <file>dist/</file>
    </files>
    <action>
      Run "npm run build" and verify presence of all required artifacts.
    </action>
    <verify>
      Test presence of:
      - dist/extension.js
      - dist/cli.js
      - dist/webview/
      - dist/assets/
      - dist/hooks/
      - dist/uninstall.js
    </verify>
    <done>
      All required files present in dist/ folder.
    </done>
  </task>
</tasks>
