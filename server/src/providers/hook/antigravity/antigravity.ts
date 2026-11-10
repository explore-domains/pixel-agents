import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { AgentEvent, HookProvider } from '../../../../../core/src/provider.js';

function getSessionDirs(workspacePath: string): string[] {
  const historyPath = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'history.jsonl');
  if (!fs.existsSync(historyPath)) return [];

  const lines = fs.readFileSync(historyPath, 'utf-8').split('\n');
  const sessionDirs = new Set<string>();

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (record.workspace === workspacePath && record.conversationId) {
        sessionDirs.add(
          path.join(os.homedir(), '.gemini', 'antigravity-cli', 'brain', record.conversationId),
        );
      }
    } catch {}
  }
  return Array.from(sessionDirs);
}

export function normalizeHookEvent(
  raw: Record<string, unknown>,
): { sessionId: string; event: AgentEvent } | null {
  const eventName = raw.hookEventName;
  const sessionId = raw.conversationId;
  if (typeof eventName !== 'string' || typeof sessionId !== 'string') return null;

  switch (eventName) {
    case 'PreInvocation':
      return {
        sessionId,
        event: {
          kind: 'sessionStart',
          cwd:
            Array.isArray(raw.workspacePaths) && typeof raw.workspacePaths[0] === 'string'
              ? raw.workspacePaths[0]
              : undefined,
        },
      };

    case 'PreToolUse': {
      const toolCall = raw.toolCall as Record<string, unknown> | undefined;
      const toolName = typeof toolCall?.name === 'string' ? toolCall.name : '';
      const toolInput =
        typeof toolCall?.args === 'object' && toolCall?.args !== null ? toolCall.args : {};
      return {
        sessionId,
        event: {
          kind: 'toolStart',
          toolId: `hook-${Date.now()}`,
          toolName,
          input: toolInput,
        },
      };
    }

    case 'PostToolUse':
      return { sessionId, event: { kind: 'toolEnd', toolId: 'current' } };

    case 'PostInvocation':
      return { sessionId, event: { kind: 'turnEnd' } };

    case 'Stop':
      return { sessionId, event: { kind: 'sessionEnd' } };

    default:
      return null;
  }
}

export const antigravityProvider: HookProvider = {
  kind: 'hook',
  id: 'antigravity',
  displayName: 'Antigravity CLI',
  protocolVersion: 1,
  normalizeHookEvent,
  getSessionDirs,
  installHooks: async () => {},
  uninstallHooks: async () => {},
  areHooksInstalled: async () => true,
  consentDisclosure: () => ({
    headline: 'Install Antigravity Hooks',
    disclosure:
      'Antigravity CLI hooks allow Pixel Agents to track your agent activity.\n\n' +
      'This will create a hook bridge script and update your Antigravity configuration.',
  }),
  formatToolStatus: (toolName) => `Using ${toolName}`,
  permissionExemptTools: new Set(),
  subagentToolNames: new Set(),
  readingTools: new Set(['read_file', 'list_files', 'search']),
};
