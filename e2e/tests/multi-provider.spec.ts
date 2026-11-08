import { expect, test } from '../fixtures/pixel-agents';
import {
  antigravityPreToolUse,
  antigravitySessionStart,
  copilotPreToolUse,
  copilotSessionStart,
  geminiPreToolUse,
  opencodePreToolUse,
  opencodeSessionStart,
  preToolUseBash,
  sendHookEvent,
  sessionStartStartup,
  waitForHookServer,
} from '../helpers/hooks';
import { expectOverlayCount, expectOverlayVisible } from '../helpers/office';
import { openPixelAgentsPanel, setSettings } from '../helpers/webview';

test.describe('Multi-provider integration', () => {
  test('receives and normalizes events from all 5 providers @area:integration', async ({
    pixelAgents,
  }) => {
    const { frame, window, tmpHome, workspaceDir, narrator } = pixelAgents;

    narrator.step('enabling Watch All Sessions so all external sessions are adopted');
    await setSettings(frame, {
      watchAllSessions: true,
    });

    await openPixelAgentsPanel(window);
    const serverConfig = await waitForHookServer(tmpHome);

    const providers = [
      { id: 'claude', name: 'Claude' },
      { id: 'antigravity', name: 'Antigravity' },
      { id: 'gemini-cli', name: 'Gemini' },
      { id: 'opencode', name: 'OpenCode' },
      { id: 'copilot', name: 'Copilot' },
    ];

    for (const provider of providers) {
      narrator.step(`sending events for ${provider.name}`);
      const sessionId = `test-sess-${provider.id}`;

      // 1. Session Start
      let startEvent;
      switch (provider.id) {
        case 'antigravity':
          startEvent = antigravitySessionStart(sessionId, [workspaceDir]);
          break;
        case 'opencode':
          startEvent = opencodeSessionStart(sessionId, workspaceDir);
          break;
        case 'copilot':
          startEvent = copilotSessionStart(sessionId, workspaceDir);
          break;
        case 'claude':
          startEvent = sessionStartStartup(sessionId, workspaceDir);
          break;
        default:
          // Gemini uses tool use to start session (no explicit start hook in STACK.md)
          startEvent = null;
      }

      if (startEvent) {
        console.log(`Sending startEvent for ${provider.id}:`, JSON.stringify(startEvent));
        await sendHookEvent(serverConfig, startEvent, provider.id);
      }

      // 2. PreToolUse
      let toolEvent;
      const toolName = provider.id === 'antigravity' ? 'write_file' : 'Bash';
      const statusText = provider.id === 'antigravity' ? 'Using write_file' : 'Running: ls';

      switch (provider.id) {
        case 'antigravity':
          toolEvent = antigravityPreToolUse(sessionId, 'write_file', { path: 'test.txt' });
          break;
        case 'gemini-cli':
          toolEvent = geminiPreToolUse(sessionId, 'Bash', { command: 'ls' });
          break;
        case 'opencode':
          toolEvent = opencodePreToolUse(sessionId, 'Bash', { command: 'ls' });
          break;
        case 'copilot':
          toolEvent = copilotPreToolUse(sessionId, 'Bash', { command: 'ls' });
          break;
        case 'claude':
          toolEvent = preToolUseBash(sessionId, 'ls');
          break;
      }
      console.log(`Sending toolEvent for ${provider.id}:`, JSON.stringify(toolEvent));
      await sendHookEvent(serverConfig, toolEvent, provider.id);

      narrator.check(`${provider.name} agent appeared and is active`);
      await expectOverlayVisible(frame, statusText);
    }

    narrator.step('verifying all 5 agents are on screen');
    await expectOverlayCount(frame, 5);
    narrator.check('all 5 providers successfully integrated');
  });
});
