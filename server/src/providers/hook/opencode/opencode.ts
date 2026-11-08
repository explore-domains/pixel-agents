import type { HookProvider } from '../../../../../core/src/provider.js';

export const opencodeProvider: HookProvider = {
  kind: 'hook',
  id: 'opencode',
  displayName: 'OpenCode CLI',
  protocolVersion: 1,
  normalizeHookEvent: () => null,
  installHooks: async () => {},
  uninstallHooks: async () => {},
  areHooksInstalled: async () => false,
  consentDisclosure: () => ({ headline: 'OpenCode', disclosure: 'OpenCode' }),
  formatToolStatus: (toolName) => `Using ${toolName}`,
  permissionExemptTools: new Set(),
  subagentToolNames: new Set(),
  readingTools: new Set(),
};
