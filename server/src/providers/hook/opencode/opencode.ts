import type { AgentEvent, HookProvider } from '../../../../../core/src/provider.js';

export function normalizeHookEvent(
  raw: Record<string, unknown>,
): { sessionId: string; event: AgentEvent } | null {
  const eventName = raw.eventType;
  const sessionId = raw.sessionId;
  if (typeof eventName !== 'string' || typeof sessionId !== 'string') return null;

  const payload = raw.payload as Record<string, unknown> | undefined;

  switch (eventName) {
    case 'session.start':
      return {
        sessionId,
        event: {
          kind: 'sessionStart',
        },
      };

    case 'tool.pre': {
      const toolName = typeof payload?.toolName === 'string' ? payload.toolName : '';
      const toolInput = typeof payload?.input === 'object' ? payload.input : {};
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

    case 'tool.post':
      return { sessionId, event: { kind: 'toolEnd', toolId: 'current' } };

    case 'session.end':
      return { sessionId, event: { kind: 'sessionEnd' } };

    default:
      return null;
  }
}

export const opencodeProvider: HookProvider = {
  kind: 'hook',
  id: 'opencode',
  displayName: 'OpenCode CLI',
  protocolVersion: 1,
  normalizeHookEvent,
  installHooks: async () => {},
  uninstallHooks: async () => {},
  areHooksInstalled: async () => true,
  consentDisclosure: () => ({ headline: 'OpenCode', disclosure: 'OpenCode' }),
  formatToolStatus: (toolName) => `Using ${toolName}`,
  permissionExemptTools: new Set(),
  subagentToolNames: new Set(),
  readingTools: new Set(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch']),
};
