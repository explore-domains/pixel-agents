import type { HookProvider } from '../../../../../core/src/provider.js';

export const antigravityProvider: HookProvider = {
  kind: 'hook',
  id: 'antigravity',
  displayName: 'Antigravity CLI',
  protocolVersion: 1,
  normalizeHookEvent: () => null, // Stub
  installHooks: async () => {},
  uninstallHooks: async () => {},
  areHooksInstalled: async () => false,
  consentDisclosure: () => ({ headline: 'Antigravity', disclosure: 'Antigravity' }),
  formatToolStatus: (toolName) => `Using ${toolName}`,
  permissionExemptTools: new Set(),
  subagentToolNames: new Set(),
  readingTools: new Set(),
};
