import { describe, expect, it } from 'vitest';

import { antigravityProvider } from '../src/providers/hook/antigravity/antigravity.js';
import { copilotProvider } from '../src/providers/hook/copilot/copilot.js';
import { geminiCliProvider } from '../src/providers/hook/gemini-cli/gemini-cli.js';
import { opencodeProvider } from '../src/providers/hook/opencode/opencode.js';

describe('Provider Adapters Normalization', () => {
  describe('Antigravity', () => {
    it('normalizes SessionStart (PreInvocation)', () => {
      const raw = {
        hookEventName: 'PreInvocation',
        conversationId: 'agy-sess-1',
        workspacePaths: ['/home/user/project'],
      };
      const result = antigravityProvider.normalizeHookEvent(raw);
      expect(result).toEqual({
        sessionId: 'agy-sess-1',
        event: {
          kind: 'sessionStart',
          cwd: '/home/user/project',
        },
      });
    });

    it('normalizes PreToolUse', () => {
      const raw = {
        hookEventName: 'PreToolUse',
        conversationId: 'agy-sess-1',
        toolCall: {
          name: 'write_file',
          args: { path: 'test.txt' },
        },
      };
      const result = antigravityProvider.normalizeHookEvent(raw);
      expect(result?.sessionId).toBe('agy-sess-1');
      expect(result?.event.kind).toBe('toolStart');
      expect((result?.event as any).toolName).toBe('write_file');
      expect((result?.event as any).input).toEqual({ path: 'test.txt' });
    });
  });

  describe('Gemini CLI', () => {
    it('normalizes pre_tool_execution', () => {
      const raw = {
        event_type: 'pre_tool_execution',
        environment_id: 'gemini-env-1',
        tool_call: {
          name: 'code_execution',
          args: { code: 'print(1)' },
        },
      };
      const result = geminiCliProvider.normalizeHookEvent(raw);
      expect(result?.sessionId).toBe('gemini-env-1');
      expect(result?.event.kind).toBe('toolStart');
      expect((result?.event as any).toolName).toBe('code_execution');
    });
  });

  describe('OpenCode', () => {
    it('normalizes session.start', () => {
      const raw = {
        eventType: 'session.start',
        sessionId: 'oc-sess-1',
        payload: {},
      };
      const result = opencodeProvider.normalizeHookEvent(raw);
      expect(result).toEqual({
        sessionId: 'oc-sess-1',
        event: {
          kind: 'sessionStart',
        },
      });
    });

    it('normalizes tool.pre', () => {
      const raw = {
        eventType: 'tool.pre',
        sessionId: 'oc-sess-1',
        payload: {
          toolName: 'Read',
          input: { file_path: 'a.ts' },
        },
      };
      const result = opencodeProvider.normalizeHookEvent(raw);
      expect(result?.sessionId).toBe('oc-sess-1');
      expect(result?.event.kind).toBe('toolStart');
      expect((result?.event as any).toolName).toBe('Read');
    });
  });

  describe('Copilot', () => {
    it('normalizes SessionStart', () => {
      const raw = {
        hook_event_name: 'SessionStart',
        session_id: 'cp-sess-1',
        cwd: '/project',
      };
      const result = copilotProvider.normalizeHookEvent(raw);
      expect(result).toEqual({
        sessionId: 'cp-sess-1',
        event: {
          kind: 'sessionStart',
          cwd: '/project',
        },
      });
    });

    it('normalizes PreToolUse', () => {
      const raw = {
        hook_event_name: 'PreToolUse',
        session_id: 'cp-sess-1',
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
      };
      const result = copilotProvider.normalizeHookEvent(raw);
      expect(result?.sessionId).toBe('cp-sess-1');
      expect(result?.event.kind).toBe('toolStart');
      expect((result?.event as any).toolName).toBe('Bash');
    });
  });
});
