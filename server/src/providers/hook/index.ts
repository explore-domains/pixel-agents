import type { HookProvider } from '../../../../core/src/provider.js';
import { antigravityProvider } from './antigravity/antigravity.js';
import { claudeProvider } from './claude/claude.js';
import { copilotProvider } from './copilot/copilot.js';
import { geminiCliProvider } from './gemini-cli/gemini-cli.js';
import { opencodeProvider } from './opencode/opencode.js';

/**
 * Registry of all supported hook-based providers.
 */
export const hookProviders: Record<string, HookProvider> = {
  [antigravityProvider.id]: antigravityProvider,
  [claudeProvider.id]: claudeProvider,
  [copilotProvider.id]: copilotProvider,
  [geminiCliProvider.id]: geminiCliProvider,
  [opencodeProvider.id]: opencodeProvider,
};

/**
 * Get a hook provider by its ID.
 */
export function getHookProvider(providerId: string): HookProvider | undefined {
  return hookProviders[providerId];
}
