import type { HookProvider } from '../../../../../core/src/provider.js';

export const copilotProvider: HookProvider = {
  kind: 'hook',
  id: 'copilot',
  displayName: 'GitHub Copilot CLI',
  protocolVersion: 1,
  normalizeHookEvent: () => null,
  installHooks: async () => {},
  uninstallHooks: async () => {},
  areHooksInstalled: async () => false,
  consentDisclosure: () => ({ headline: 'Copilot', disclosure: 'Copilot' }),
  formatToolStatus: (toolName) => `Using ${toolName}`,
  permissionExemptTools: new Set(),
  subagentToolNames: new Set(),
  readingTools: new Set(),
};
