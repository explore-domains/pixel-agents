import type { AgentEvent, HookProvider } from '../../../../../core/src/provider.js';

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
  installHooks: async () => {
    // In a real implementation, this would write to ~/.gemini/antigravity-cli/hooks.json
    // For now, we stub the installer as it requires FS access outside the project.
  },
  uninstallHooks: async () => {},
  areHooksInstalled: async () => true, // Assume true for development
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
