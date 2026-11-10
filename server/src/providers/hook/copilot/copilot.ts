import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { AgentEvent, HookProvider } from '../../../../../core/src/provider.js';

function getSessionDirs(workspacePath: string): string[] {
  const sessionRootDir = path.join(os.homedir(), '.copilot', 'session-state');
  if (!fs.existsSync(sessionRootDir)) return [];

  const dirs = fs.readdirSync(sessionRootDir);
  const matchingDirs: string[] = [];

  // Remove trailing slash for comparison
  const targetCwd = workspacePath.replace(/[\\/]$/, '');

  for (const d of dirs) {
    const sessionDir = path.join(sessionRootDir, d);
    const workspaceYaml = path.join(sessionDir, 'workspace.yaml');

    if (fs.existsSync(workspaceYaml)) {
      try {
        const content = fs.readFileSync(workspaceYaml, 'utf-8');
        // Check for exact cwd match in the YAML
        if (content.includes(`cwd: ${targetCwd}\n`) || content.includes(`cwd: ${targetCwd}\r\n`)) {
          matchingDirs.push(sessionDir);
        }
      } catch {
        // ignore
      }
    }
  }
  return matchingDirs;
}

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
  getSessionDirs,
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
