import * as os from 'os';
import * as path from 'path';

import type { AgentEvent, HookProvider } from '../../../../../core/src/provider.js';

function getSessionDirs(workspacePath: string): string[] {
  const dirName = path.basename(workspacePath).toLowerCase();
  const projectDir = path.join(os.homedir(), '.gemini', 'tmp', dirName, 'chats');
  return [projectDir];
}

export function normalizeHookEvent(
  raw: Record<string, unknown>,
): { sessionId: string; event: AgentEvent } | null {
  const eventName = raw.event_type || raw.type; // Support both hook events and log records
  const sessionId = (raw.environment_id as string) || (raw.id as string);
  if (typeof eventName !== 'string' || typeof sessionId !== 'string') return null;

  switch (eventName) {
    case 'gemini':
    case 'pre_tool_execution': {
      const toolCalls = (raw.toolCalls as any[]) || (raw.tool_call ? [raw.tool_call] : []);
      if (toolCalls.length > 0) {
        const toolCall = toolCalls[0];
        const toolName = typeof toolCall?.name === 'string' ? toolCall.name : '';
        const toolInput =
          typeof toolCall?.args === 'object' && toolCall?.args !== null ? toolCall.args : {};
        return {
          sessionId,
          event: {
            kind: 'toolStart',
            toolId: toolCall.id || `hook-${Date.now()}`,
            toolName,
            input: toolInput,
          },
        };
      }
      return null;
    }

    case 'post_tool_execution':
      return { sessionId, event: { kind: 'toolEnd', toolId: 'current' } };

    default:
      return null;
  }
}

export const geminiCliProvider: HookProvider = {
  kind: 'hook',
  id: 'gemini-cli',
  displayName: 'Gemini CLI',
  protocolVersion: 1,
  normalizeHookEvent,
  getSessionDirs,
  installHooks: async () => {},
  uninstallHooks: async () => {},
  areHooksInstalled: async () => true,
  consentDisclosure: () => ({ headline: 'Gemini', disclosure: 'Gemini' }),
  formatToolStatus: (toolName) => `Using ${toolName}`,
  permissionExemptTools: new Set(),
  subagentToolNames: new Set(),
  readingTools: new Set(),
};
