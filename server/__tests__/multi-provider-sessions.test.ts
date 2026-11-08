import { afterEach, describe, expect, it } from 'vitest';

import { HookProvider } from '../../core/src/provider.js';
import { AgentRuntime } from '../src/agentRuntime.js';
import { AgentStateStore } from '../src/agentStateStore.js';
import { claudeProvider } from '../src/providers/hook/claude/claude.js';

/**
 * Task 4: Integration test for multi-provider session coexistence.
 * Demonstrates that two agents from different providers can coexist without collision,
 * even when sharing the same sessionId.
 */

const antigravityProvider: HookProvider = {
  kind: 'hook',
  id: 'antigravity',
  displayName: 'Antigravity',
  protocolVersion: 1,
  subagentToolNames: new Set(['Agent']),
  normalizeHookEvent: (raw) => {
    if (raw.hook_event_name === 'SessionStart') {
      return { 
        sessionId: raw.session_id as string, 
        event: { 
          kind: 'sessionStart', 
          source: 'startup',
          cwd: raw.cwd as string,
          transcriptPath: raw.transcript_path as string
        } 
      };
    }
    if (raw.hook_event_name === 'Stop') {
      return { sessionId: raw.session_id as string, event: { kind: 'turnEnd' } };
    }
    return null;
  },
  formatToolStatus: () => 'Running',
  installHooks: async () => {},
  uninstallHooks: async () => {},
  areHooksInstalled: async () => true,
  consentDisclosure: () => ({ headline: 'Antigravity', disclosure: 'disclosure' }),
  permissionExemptTools: new Set(),
  readingTools: new Set(),
};

describe('Multi-provider session coexistence', () => {
  let store: AgentStateStore;
  let runtimeClaude: AgentRuntime;
  let runtimeAntigravity: AgentRuntime;

  afterEach(() => {
    runtimeClaude?.dispose();
    runtimeAntigravity?.dispose();
  });

  it('allows agents with same sessionId from different providers to coexist (per D-10, D-12)', () => {
    store = new AgentStateStore();
    
    // We use two runtimes sharing the same store to simulate multi-provider environment.
    // In production, AgentRuntime might eventually support multiple providers directly,
    // but namespacing in SessionRouter handles the separation either way.
    runtimeClaude = new AgentRuntime(store, claudeProvider);
    runtimeAntigravity = new AgentRuntime(store, antigravityProvider);

    runtimeClaude.watchAllSessions.current = true;
    runtimeAntigravity.watchAllSessions.current = true;

    const sharedSessionId = 'common-session-123';

    // 1. Spawn Agent A (Claude)
    runtimeClaude.handleHookEvent('claude', {
      hook_event_name: 'SessionStart',
      session_id: sharedSessionId,
      source: 'startup',
      cwd: '/projects/claude-work',
      transcript_path: '/projects/claude-work/session.jsonl'
    });
    // Confirmation event to create the agent
    runtimeClaude.handleHookEvent('claude', {
      hook_event_name: 'Stop',
      session_id: sharedSessionId,
    });

    // 2. Spawn Agent B (Antigravity) with SAME sessionId
    runtimeAntigravity.handleHookEvent('antigravity', {
      hook_event_name: 'SessionStart',
      session_id: sharedSessionId,
      source: 'startup',
      cwd: '/projects/antigravity-work',
      transcript_path: '/projects/antigravity-work/session.jsonl'
    });
    // Confirmation event
    runtimeAntigravity.handleHookEvent('antigravity', {
      hook_event_name: 'Stop',
      session_id: sharedSessionId,
    });

    // Verify both exist in the store
    expect(store.size).toBe(2);

    const agents = [...store.values()];
    const agentA = agents.find(a => a.providerId === 'claude');
    const agentB = agents.find(a => a.providerId === 'antigravity');

    expect(agentA).toBeDefined();
    expect(agentB).toBeDefined();
    
    // Core requirement: unique agent IDs despite same sessionId
    expect(agentA?.id).not.toBe(agentB?.id);
    expect(agentA?.sessionId).toBe(sharedSessionId);
    expect(agentB?.sessionId).toBe(sharedSessionId);

    // Verify providerId persistence on AgentState
    expect(agentA?.providerId).toBe('claude');
    expect(agentB?.providerId).toBe('antigravity');

    // 3. Verify visual differentiation (palette or hueShift)
    // If they happen to pick the same palette, hueShift must differ
    if (agentA?.palette === agentB?.palette) {
      expect(agentA?.hueShift).not.toBe(agentB?.hueShift);
    }
  });
});
