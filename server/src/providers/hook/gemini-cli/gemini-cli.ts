import type { AgentEvent, HookProvider } from '../../../../../core/src/provider.js';

export function normalizeHookEvent(
  raw: Record<string, unknown>,
): { sessionId: string; event: AgentEvent } | null {
  const eventName = raw.event_type;
  const sessionId = raw.environment_id;
  if (typeof eventName !== 'string' || typeof sessionId !== 'string') return null;

  switch (eventName) {
    case 'pre_tool_execution': {
      const toolCall = raw.tool_call as Record<string, unknown> | undefined;
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
  installHooks: async () => {},
  uninstallHooks: async () => {},
  areHooksInstalled: async () => true,
  consentDisclosure: () => ({ headline: 'Gemini', disclosure: 'Gemini' }),
  formatToolStatus: (toolName) => `Using ${toolName}`,
  permissionExemptTools: new Set(),
  subagentToolNames: new Set(),
  readingTools: new Set(),
};
