import type { AgentEvent, HookProvider } from '../../../../../core/src/provider.js';

export function normalizeHookEvent(
  raw: Record<string, unknown>,
): { sessionId: string; event: AgentEvent } | null {
  const eventName = raw.hook_event_name;
  const sessionId = raw.session_id || (raw.cwd as string);
  if (typeof eventName !== 'string' || typeof sessionId !== 'string') return null;

  switch (eventName) {
    case 'SessionStart':
      return {
        sessionId,
        event: {
          kind: 'sessionStart',
          cwd: typeof raw.cwd === 'string' ? raw.cwd : undefined,
        },
      };

    case 'PreToolUse': {
      const toolName = typeof raw.tool_name === 'string' ? raw.tool_name : '';
      const toolInput =
        typeof raw.tool_input === 'object' && raw.tool_input !== null
          ? (raw.tool_input as Record<string, unknown>)
          : {};
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
    case 'PostToolUseFailure':
      return { sessionId, event: { kind: 'toolEnd', toolId: 'current' } };

    case 'Stop':
      return { sessionId, event: { kind: 'turnEnd' } };

    case 'SessionEnd':
      return {
        sessionId,
        event: {
          kind: 'sessionEnd',
        },
      };

    case 'PermissionRequest':
      return { sessionId, event: { kind: 'permissionRequest' } };

    default:
      return null;
  }
}

export const copilotProvider: HookProvider = {
  kind: 'hook',
  id: 'copilot',
  displayName: 'GitHub Copilot CLI',
  protocolVersion: 1,
  normalizeHookEvent,
  installHooks: async () => {},
  uninstallHooks: async () => {},
  areHooksInstalled: async () => true,
  consentDisclosure: () => ({
    headline: 'GitHub Copilot Hooks',
    disclosure: 'Connect GitHub Copilot CLI to Pixel Agents.',
  }),
  formatToolStatus: (toolName) => `Using ${toolName}`,
  permissionExemptTools: new Set(),
  subagentToolNames: new Set(),
  readingTools: new Set(['Read', 'Grep', 'Glob']),
};
