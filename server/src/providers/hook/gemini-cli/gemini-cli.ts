import type { HookProvider } from '../../../../../core/src/provider.js';

export const geminiCliProvider: HookProvider = {
  kind: 'hook',
  id: 'gemini-cli',
  displayName: 'Gemini CLI',
  protocolVersion: 1,
  normalizeHookEvent: () => null,
  installHooks: async () => {},
  uninstallHooks: async () => {},
  areHooksInstalled: async () => false,
  consentDisclosure: () => ({ headline: 'Gemini', disclosure: 'Gemini' }),
  formatToolStatus: (toolName) => `Using ${toolName}`,
  permissionExemptTools: new Set(),
  subagentToolNames: new Set(),
  readingTools: new Set(),
};
