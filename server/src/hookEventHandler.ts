import * as path from 'path';

import type { AgentEvent, HookProvider } from '../../core/src/provider.js';
import type { AgentStateStore } from './agentStateStore.js';
import { SESSION_END_GRACE_MS } from './constants.js';
import type { SessionRouter } from './sessionRouter.js';
import { getInlineTeammates, hasInlineTeammates, hasPromotedBackgroundAgent } from './teamUtils.js';
import { cancelPermissionTimer, cancelWaitingTimer } from './timerManager.js';
import { notifyBackgroundAgentCompleted } from './transcriptParser.js';
import type { AgentState } from './types.js';

const debug = process.env.PIXEL_AGENTS_DEBUG !== '0';

/**
 * Dispatches normalized AgentEvents to agents based on session_id.
 * Session routing (session→agent mapping, pending sessions, event buffering)
 * is delegated to an injected SessionRouter instance.
 *
 * When an event is successfully delivered, sets `agent.hookDelivered = true` which
 * suppresses heuristic timers (permission 7s, text-idle 5s) for that agent.
 */
/** Callback for session lifecycle events detected via hooks. */
interface SessionLifecycleCallbacks {
  /** Called when an external session is detected (unknown session_id in SessionStart).
   *  transcriptPath is undefined for providers without transcripts (OpenCode, Copilot). */
  onExternalSessionDetected?: (
    sessionId: string,
    transcriptPath: string | undefined,
    cwd: string,
  ) => void;
  /** Called when /clear is detected via hooks (SessionEnd reason=clear + SessionStart source=clear). */
  onSessionClear?: (
    agentId: number,
    newSessionId: string,
    newTranscriptPath: string | undefined,
  ) => void;
  /** Called when a session is resumed (--resume). Clears dismissals so the file can be re-adopted. */
  onSessionResume?: (transcriptPath: string) => void;
  /** Called when a session ends (exit/logout). */
  onSessionEnd?: (agentId: number, reason: string) => void;
  /** Called when an Agent Teams teammate is detected via SubagentStart hook.
   *  Triggers scanning of the session's subagents/ directory for the teammate's JSONL. */
  onTeammateDetected?: (parentAgentId: number, sessionId: string, agentType: string) => void;
  /** Called when a teammate should be removed (e.g. no longer in team config members).
   *  Removes the teammate agent from the office. */
  onTeammateRemoved?: (teammateAgentId: number) => void;
}

export class HookEventHandler {
  private lifecycleCallbacks: SessionLifecycleCallbacks = {};

  /** Highest HookProvider.protocolVersion this handler understands. */
  private static readonly SUPPORTED_PROTOCOL_VERSION = 1;

  constructor(
    private agents: AgentStateStore,
    private waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
    private permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
    private provider: HookProvider,
    private sessionRouter: SessionRouter,
    private watchAllSessionsRef?: { current: boolean },
  ) {
    if (provider.protocolVersion !== HookEventHandler.SUPPORTED_PROTOCOL_VERSION) {
      console.warn(
        `[Pixel Agents] HookProvider "${provider.id}" reports protocolVersion=${provider.protocolVersion}, ` +
          `but handler understands ${HookEventHandler.SUPPORTED_PROTOCOL_VERSION}. ` +
          `Events from this provider will be dropped.`,
      );
    }
  }

  /** Merged set of tool names that spawn subagents (teammates + within-turn subagents
   *  when a team provider is attached, or the base HookProvider set otherwise). */
  private getSubagentToolSet(): ReadonlySet<string> {
    if (this.provider.team) {
      return new Set<string>([
        ...this.provider.team.teammateSpawnTools,
        ...this.provider.team.withinTurnSubagentTools,
      ]);
    }
    return this.provider.subagentToolNames;
  }

  /** Check if a session is tracked (in workspace project dir, or Watch All Sessions ON). */
  private isTrackedSession(transcriptPath?: string, cwd?: string): boolean {
    if (this.watchAllSessionsRef?.current) return true;
    const projectDir = transcriptPath ? path.dirname(transcriptPath) : cwd;
    if (!projectDir) return false;
    return [...this.agents.values()].some(
      (a) => path.resolve(a.projectDir).toLowerCase() === path.resolve(projectDir).toLowerCase(),
    );
  }

  /** Set callbacks for session lifecycle events (SessionStart/SessionEnd). */
  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void {
    this.lifecycleCallbacks = callbacks;
  }

  /** Register an agent for hook event routing. Flushes any buffered events for this session. */
  registerAgent(sessionId: string, agentId: number): void {
    const flushed = this.sessionRouter.register(this.provider.id, sessionId, agentId);
    if (debug && flushed.length > 0)
      console.log(
        `[Pixel Agents] Hook: flushing ${flushed.length} buffered event(s) for session ${sessionId.slice(0, 8)}...`,
      );
    for (const { providerId, event } of flushed) {
      this.handleEvent(providerId, event);
    }
  }

  /** Remove an agent's session mapping (called on agent removal/terminal close). */
  unregisterAgent(sessionId: string): void {
    this.sessionRouter.unregister(this.provider.id, sessionId);
  }

  handleEvent(providerId: string, rawEvent: Record<string, unknown>): void {
    if (this.provider.protocolVersion !== HookEventHandler.SUPPORTED_PROTOCOL_VERSION) {
      return; // version mismatch already logged in constructor
    }
    // ── Provider normalization boundary ───────────────────────────────────────
    // All raw provider-specific fields are extracted by provider.normalizeHookEvent.
    // Downstream dispatch uses ONLY the normalized AgentEvent and sessionId.
    const normalized = this.provider.normalizeHookEvent(rawEvent);
    if (!normalized) return; // unknown / uninteresting event -- silently drop

    const { sessionId, event: normEvent } = normalized;

    // CI / e2e diagnostic: see agentStateStore.ts debugLogBroadcast comment.
    if (process.env['PIXEL_AGENTS_DEBUG_LOG']) {
      try {
        const fs = require('fs') as typeof import('fs');
        const sid = sessionId.slice(0, 8);
        const extras =
          normEvent.kind === 'toolStart'
            ? ` toolName=${(normEvent as { toolName: string }).toolName}`
            : '';
        fs.appendFileSync(
          process.env['PIXEL_AGENTS_DEBUG_LOG']!,
          `${new Date().toISOString()} HOOK kind=${normEvent.kind} sid=${sid} provider=${providerId}${extras}\n`,
        );
      } catch {
        /* never crash on diagnostic failure */
      }
    }

    // --- SessionStart: handle /clear for known agents, ignore unknown sessions ---
    if (normEvent.kind === 'sessionStart') {
      const sid = sessionId.slice(0, 8);
      const source = normEvent.source ?? 'unknown';
      const transcriptPath = normEvent.transcriptPath;
      const cwd = normEvent.cwd;
      const tracked = this.isTrackedSession(transcriptPath, cwd);
      if (debug && tracked)
        console.log(`[Pixel Agents] Hook: SessionStart(source=${source}, session=${sid}...)`);

      // Check registered mapping
      const existingAgentId = this.sessionRouter.resolve(providerId, sessionId);
      if (existingAgentId !== undefined) {
        const agent = this.agents.get(existingAgentId);
        if (agent) {
          agent.hookDelivered = true;
        }
        if (debug)
          console.log(
            `[Pixel Agents] Hook: Agent ${existingAgentId} - SessionStart(source=${source}) known`,
          );
        return;
      }
      // Check auto-discovery (agent exists but not yet registered for hooks)
      for (const [id, agent] of this.agents) {
        if (agent.sessionId === sessionId) {
          this.registerAgent(agent.sessionId, id);
          agent.hookDelivered = true;
          if (debug)
            console.log(
              `[Pixel Agents] Hook: Agent ${id} - SessionStart(source=${source}) auto-discovered`,
            );
          return;
        }
      }
      // /clear or /resume: reassign existing agent to new session
      if (normEvent.source === 'clear' || normEvent.source === 'resume') {
        const projectDir = transcriptPath ? path.dirname(transcriptPath) : cwd;
        if (projectDir) {
          for (const [id, agent] of this.agents) {
            const isMatch =
              agent.pendingClear &&
              path.resolve(agent.projectDir).toLowerCase() ===
                path.resolve(projectDir).toLowerCase();
            if (isMatch) {
              agent.pendingClear = false;
              console.log(
                `[Pixel Agents] Hook: Agent ${id} - /${normEvent.source} detected, reassigning to ${sessionId}`,
              );
              this.sessionRouter.unregister(providerId, agent.sessionId);
              this.registerAgent(sessionId, id);
              this.lifecycleCallbacks.onSessionClear?.(id, sessionId, transcriptPath);
              return;
            }
          }
        }
      }
      // Unknown session -- store as pending, create only when a confirmation event
      // arrives (Stop, Notification, PermissionRequest).
      if (transcriptPath || cwd) {
        if (normEvent.source === 'resume' && transcriptPath) {
          this.lifecycleCallbacks.onSessionResume?.(transcriptPath);
        }
        if (debug && tracked)
          console.log(
            `[Pixel Agents] Hook: SessionStart(source=${source}) -> pending external session ${sid}..., awaiting confirmation`,
          );
        this.sessionRouter.storePending(providerId, sessionId, {
          sessionId,
          transcriptPath,
          cwd: cwd ?? '',
        });
      } else {
        if (debug && tracked)
          console.log(
            `[Pixel Agents] Hook: SessionStart -> unknown session ${sid}..., no transcript_path`,
          );
      }
      return;
    }

    // --- All other events: standard agent lookup ---
    // If SessionEnd arrives for a pending external session, discard it (transient session)
    if (normEvent.kind === 'sessionEnd' && this.sessionRouter.hasPending(providerId, sessionId)) {
      this.sessionRouter.discardPending(providerId, sessionId);
      if (debug)
        console.log(
          `[Pixel Agents] Hook: SessionEnd discarded pending external session ${sessionId.slice(0, 8)}...`,
        );
      return;
    }

    // If a confirmation event arrives for a pending external session, create the agent first
    const pending = this.sessionRouter.confirmPending(providerId, sessionId);
    if (pending) {
      if (debug)
        console.log(
          `[Pixel Agents] Hook: ${normEvent.kind} confirmed external session ${sessionId.slice(0, 8)}..., notifying host`,
        );
      this.lifecycleCallbacks.onExternalSessionDetected?.(
        pending.sessionId,
        pending.transcriptPath,
        pending.cwd,
      );
      // Re-process this event now that the agent exists
      this.handleEvent(providerId, rawEvent);
      return;
    }

    let agentId = this.sessionRouter.resolve(providerId, sessionId);
    if (agentId === undefined) {
      for (const [id, agent] of this.agents) {
        if (agent.sessionId === sessionId) {
          this.registerAgent(agent.sessionId, id);
          agentId = id;
          break;
        }
      }
    }
    if (agentId === undefined) {
      const isPending = this.sessionRouter.hasPending(providerId, sessionId);
      const hasBuffered = this.sessionRouter.hasBuffered(providerId, sessionId);
      const hasUnregisteredAgents = [...this.agents.values()].some(
        (a) => a.sessionId && !this.sessionRouter.hasSession(providerId, a.sessionId),
      );
      if (isPending || hasBuffered || hasUnregisteredAgents) {
        if (debug)
          console.log(
            `[Pixel Agents] Hook: ${normEvent.kind} - unknown session ${sessionId.slice(0, 8)}..., buffering`,
          );
        this.sessionRouter.bufferEvent(providerId, rawEvent);
      }
      return;
    }

    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.hookDelivered = true;
    if (debug)
      console.log(
        `[Pixel Agents] Hook: Agent ${agentId} - ${normEvent.kind} (session=${sessionId.slice(0, 8)}...)`,
      );

    // Dispatch on normalized AgentEvent.kind, not raw hook event names.
    switch (normEvent.kind) {
      case 'sessionEnd':
        return this.handleSessionEnd(normEvent, agent, agentId);
      case 'toolStart':
        return this.handlePreToolUse(normEvent, agent, agentId);
      case 'toolEnd':
        return this.handlePostToolUse(agent, agentId);
      case 'subagentStart':
        return this.provider.team
          ? this.handleSubagentStart(normEvent, agent, agentId, sessionId)
          : undefined;
      case 'subagentEnd':
        return this.provider.team ? this.handleSubagentStop(agent, agentId) : undefined;
      case 'permissionRequest':
        return this.handlePermissionRequest(agent, agentId);
      case 'turnEnd':
        return this.handleStop(agent, agentId, normEvent.awaitingInput === true);
      case 'subagentTurnEnd':
        if (!this.provider.team) return;
        if (normEvent.reason === 'completed') {
          return this.handleTaskCompleted(normEvent, agentId);
        }
        return this.handleTeammateIdle(normEvent, agent, agentId);
      case 'progress':
        return;
    }
  }

  /**
   * Handle SessionEnd: /clear marks pendingClear (SessionStart follows),
   * exit/logout marks agent waiting or triggers cleanup.
   */
  private handleSessionEnd(
    normEvent: Extract<AgentEvent, { kind: 'sessionEnd' }>,
    agent: AgentState,
    agentId: number,
  ): void {
    const reason = normEvent.reason;
    if (debug)
      console.log(
        `[Pixel Agents] Hook: Agent ${agentId} - SessionEnd(reason=${reason ?? 'unknown'})`,
      );

    // /clear and /resume send SessionEnd then SessionStart. Wait briefly for the follow-up.
    // All other reasons (exit, logout, prompt_input_exit) are final -- despawn immediately.
    const expectsFollowUp = reason === 'clear' || reason === 'resume';

    if (expectsFollowUp) {
      agent.pendingClear = true;
      this.markAgentWaiting(agent, agentId);
      if (debug)
        console.log(
          `[Pixel Agents] Hook: Agent ${agentId} - SessionEnd(reason=${reason}), awaiting possible SessionStart`,
        );
      // Safety net: if SessionStart never arrives, clean up the zombie agent
      setTimeout(() => {
        if (agent.pendingClear) {
          agent.pendingClear = false;
          this.lifecycleCallbacks.onSessionEnd?.(agentId, reason);
        }
      }, SESSION_END_GRACE_MS);
    } else {
      // Immediate cleanup for exit/logout. onSessionEnd → removeTeammates in the
      // ViewProvider cleans up all teammates of this lead at once.
      this.markAgentWaiting(agent, agentId);
      this.lifecycleCallbacks.onSessionEnd?.(agentId, reason ?? 'unknown');
    }
  }

  /**
   * Handle PreToolUse: instantly mark agent as active (cancel waiting state).
   * JSONL still handles detailed tool tracking (toolId, status text, webview messages).
   * This just ensures the character starts animating without waiting for the 500ms JSONL poll.
   */
  private handlePreToolUse(
    normEvent: Extract<AgentEvent, { kind: 'toolStart' }>,
    agent: AgentState,
    agentId: number,
  ): void {
    const toolName = normEvent.toolName;
    const toolInput = (normEvent.input as Record<string, unknown> | undefined) ?? {};
    const status = this.provider.formatToolStatus(toolName, toolInput);
    const hookToolId = `hook-${Date.now()}`;

    // Track for PostToolUse/SubagentStart correlation (always, even if suppressed below).
    // currentHookIsTeammateSpawn is the authoritative teammate-vs-subagent discriminator.
    // It is NOT cleared in PostToolUse to survive the PostToolUse-before-SubagentStart race.
    agent.currentHookToolId = hookToolId;
    agent.currentHookToolName = toolName;
    agent.currentHookIsTeammateSpawn =
      this.provider.team?.isTeammateSpawnCall(toolName, toolInput) ?? false;

    // When a lead has inline teammates, hook tool events are ambiguous (could be
    // from the lead or any teammate -- they share session_id). Suppress hook-originated
    // tool display on the lead. Both lead and teammate tools display via JSONL polling.
    if (hasInlineTeammates(agentId, this.agents)) return;

    // Cancel waiting, mark active
    cancelWaitingTimer(agentId, this.waitingTimers);
    agent.isWaiting = false;
    agent.permissionSent = false;
    agent.hadToolsInTurn = true;

    // Send tool start + active state to webview (instant, no 500ms JSONL delay).
    // Skip for Task/Agent tools — their sub-agent characters need the stable JSONL
    // tool ID (not the transient hook ID) so that SubagentStop/tool_result cleanup
    // can find and remove them. JSONL handles agentToolStart (with runInBackground)
    // for these tools.
    if (toolName !== 'Task' && toolName !== 'Agent') {
      this.agents.broadcast({
        type: 'agentToolStart',
        id: agentId,
        toolId: hookToolId,
        status,
        toolName,
      });
    }
    this.agents.broadcast({
      type: 'agentStatus',
      id: agentId,
      status: 'active',
    });
  }

  /**
   * Handle PostToolUse: no action needed. JSONL handles tool_result processing.
   * Stop hook handles the idle transition. This is here for completeness and
   * to serve as a confirmation event for pending external sessions.
   */
  private handlePostToolUse(agent: AgentState, agentId: number): void {
    if (agent.currentHookToolId) {
      // Suppress tool display when lead has inline teammates (see handlePreToolUse)
      if (!hasInlineTeammates(agentId, this.agents)) {
        this.agents.broadcast({
          type: 'agentToolDone',
          id: agentId,
          toolId: agent.currentHookToolId,
        });
      }
      agent.currentHookToolId = undefined;
      agent.currentHookToolName = undefined;
    }
  }

  // NOTE: PostToolUseFailure used to have its own handler. The behavior was identical
  // to PostToolUse (emit agentToolDone, clear currentHookToolId). Both now normalize to
  // the 'toolEnd' AgentEvent kind and share handlePostToolUse.

  /**
   * Handle SubagentStart: notify webview that a sub-agent is spawning.
   *
   * For Agent Teams teammates (Agent tool with run_in_background), triggers
   * teammate discovery via lifecycle callback -- teammates become independent
   * agents with their own JSONL file watching.
   *
   * For old-style Task/Agent subagents (inline, no run_in_background), creates
   * the child character immediately via hooks without waiting for JSONL polling.
   */
  private handleSubagentStart(
    normEvent: Extract<AgentEvent, { kind: 'subagentStart' }>,
    agent: AgentState,
    agentId: number,
    sessionId: string,
  ): void {
    const agentType = normEvent.toolName;

    // Decide path: teammate spawn vs basic within-turn subagent.
    // Two conditions must BOTH hold for the teammate path:
    //   1. currentHookIsTeammateSpawn === true -- this specific tool call has the
    //      teammate-spawn flag (e.g. Agent with run_in_background=true)
    //   2. agent.teamName set -- JSONL has confirmed this agent is a team lead.
    //      Without this guard, external sessions firing run_in_background=true
    //      for parallel basic subagents would be mis-routed to teammate discovery.
    // Mirrors the same gate used by the periodic scanAllTeammateFiles fallback.
    if (this.provider.team && agent.currentHookIsTeammateSpawn === true && agent.teamName) {
      if (debug)
        console.log(
          `[Pixel Agents] Hook: Agent ${agentId} - SubagentStart: teammate "${agentType}" detected, triggering discovery`,
        );
      this.lifecycleCallbacks.onTeammateDetected?.(agentId, sessionId, agentType);
      return;
    }

    // Basic within-turn subagent path: find parent tool ID from activeToolNames.
    // Use only the real JSONL-populated id -- no synthetic fallback here, or we'd
    // double-track parents once JSONL catches up.
    const parentTools = this.getSubagentToolSet();
    let parentToolId: string | undefined;
    for (const [toolId, toolName] of agent.activeToolNames) {
      if (parentTools.has(toolName)) {
        parentToolId = toolId;
        break;
      }
    }
    if (!parentToolId) return; // JSONL will handle it via agent_progress tool_use

    // Create child sub-agent character immediately (same as old behavior).
    const subToolId = `hook-sub-${agentType}-${Date.now()}`;
    const status = `Subtask: ${agentType}`;

    // Track sub-agent
    let subTools = agent.activeSubagentToolIds.get(parentToolId);
    if (!subTools) {
      subTools = new Set();
      agent.activeSubagentToolIds.set(parentToolId, subTools);
    }
    subTools.add(subToolId);

    let subNames = agent.activeSubagentToolNames.get(parentToolId);
    if (!subNames) {
      subNames = new Map();
      agent.activeSubagentToolNames.set(parentToolId, subNames);
    }
    subNames.set(subToolId, agentType);

    this.agents.broadcast({
      type: 'subagentToolStart',
      id: agentId,
      parentToolId,
      toolId: subToolId,
      status,
    });
  }

  /**
   * Handle SubagentStop: notify webview that a sub-agent finished.
   *
   * For Agent Teams teammates: marks all teammate agents as waiting (they're
   * independent agents, not sub-agent characters to destroy).
   *
   * For old-style Task subagents: removes the child character from the office.
   */
  private handleSubagentStop(agent: AgentState, agentId: number): void {
    // Check if this agent has inline teammates (independent agents with leadAgentId).
    // Just mark them waiting -- SubagentStop fires per-task-iteration; teammates may
    // sit idle for minutes between lead requests before being re-invoked.
    // Actual removal is driven by:
    //   - Periodic team config polling (scanTeamConfigsForRemovals) -- teammate
    //     removed when no longer in team config members list
    //   - SessionEnd on lead (removeTeammates in ViewProvider)
    const inlineTeammates = getInlineTeammates(agentId, this.agents);
    if (inlineTeammates.length > 0) {
      if (debug)
        console.log(
          `[Pixel Agents] Hook: Agent ${agentId} - SubagentStop: marking inline teammates as waiting`,
        );
      for (const [id, a] of inlineTeammates) {
        this.markAgentWaiting(a, id);
      }
      return;
    }

    // Old-style within-turn subagents: find a parent tool that actually has tracked
    // sub-agents. The `activeSubagentToolIds.has(toolId)` gate below prevents us
    // from picking a subagent-spawning parent that already had its sub-agents
    // cleared in the same turn.
    const subagentParentTools = this.getSubagentToolSet();
    let parentToolId: string | undefined;
    for (const [toolId, toolName] of agent.activeToolNames) {
      if (subagentParentTools.has(toolName) && agent.activeSubagentToolIds.has(toolId)) {
        parentToolId = toolId;
        break;
      }
    }
    if (!parentToolId) return; // JSONL will handle it via agent_progress tool_result

    agent.activeSubagentToolIds.delete(parentToolId);
    agent.activeSubagentToolNames.delete(parentToolId);
    this.agents.broadcast({
      type: 'subagentClear',
      id: agentId,
      parentToolId,
    });
  }

  /** Handle PermissionRequest: cancel heuristic timer, show permission bubble on agent + sub-agents. */
  private handlePermissionRequest(agent: AgentState, agentId: number): void {
    // When lead has inline teammates, route permission to the teammates instead.
    // The hook fires on the lead's session_id but the permission is for a teammate.
    const inlineTeammates = getInlineTeammates(agentId, this.agents);
    if (inlineTeammates.length > 0) {
      for (const [id, a] of inlineTeammates) {
        cancelPermissionTimer(id, this.permissionTimers);
        a.permissionSent = true;
        this.agents.broadcast({ type: 'agentToolPermission', id });
      }
      return;
    }

    cancelPermissionTimer(agentId, this.permissionTimers);
    agent.permissionSent = true;
    this.agents.broadcast({
      type: 'agentToolPermission',
      id: agentId,
    });
    // Also notify any sub-agents with active tools
    for (const parentToolId of agent.activeSubagentToolNames.keys()) {
      this.agents.broadcast({
        type: 'subagentToolPermission',
        id: agentId,
        parentToolId,
      });
    }
  }

  /** Handle Stop: Claude finished responding, mark agent as waiting. */
  private handleStop(agent: AgentState, agentId: number, awaitingInput = false): void {
    this.markAgentWaiting(agent, agentId, awaitingInput);
  }

  private handleTeammateIdle(
    normEvent: Extract<AgentEvent, { kind: 'subagentTurnEnd' }>,
    agent: AgentState,
    agentId: number,
  ): void {
    const teammateName = normEvent.teammateName;
    const inlineTeammates = getInlineTeammates(agentId, this.agents);

    if (inlineTeammates.length === 0) {
      // No inline teammates — treat as a completed turn for this agent.
      this.markAgentWaiting(agent, agentId);
      return;
    }

    // Match by agentName if available
    if (teammateName) {
      const match = inlineTeammates.find(([, a]) => a.agentName === teammateName);
      if (match) {
        const [id, a] = match;
        if (debug)
          console.log(
            `[Pixel Agents] Hook: TeammateIdle "${teammateName}" -> teammate Agent ${id}`,
          );
        this.markAgentWaiting(a, id);
        return;
      }
    }

    // Fallback: mark all inline teammates as waiting
    if (debug)
      console.log(
        `[Pixel Agents] Hook: TeammateIdle (no teammate_name match) -> marking ${inlineTeammates.length} teammate(s) done`,
      );
    for (const [id, a] of inlineTeammates) {
      this.markAgentWaiting(a, id);
    }
  }

  /**
   * Handle TaskCompleted: a teammate marked its task done.
   * Routes to the specific teammate when identifiable, marking it waiting instantly.
   */
  private handleTaskCompleted(
    normEvent: Extract<AgentEvent, { kind: 'subagentTurnEnd' }>,
    agentId: number,
  ): void {
    const teammateName = normEvent.teammateName;
    if (debug)
      console.log(
        `[Pixel Agents] Hook: Agent ${agentId} - TaskCompleted: ${teammateName ? ` (teammate_name=${teammateName})` : ''}`,
      );

    const inlineTeammates = getInlineTeammates(agentId, this.agents);
    if (inlineTeammates.length === 0) return;

    // Match by agentName if available, otherwise mark all inline teammates waiting
    if (teammateName) {
      const match = inlineTeammates.find(([, a]) => a.agentName === teammateName);
      if (match) {
        const [id, a] = match;
        this.markAgentWaiting(a, id);
        return;
      }
    }
    for (const [id, a] of inlineTeammates) {
      this.markAgentWaiting(a, id);
    }
  }

  /**
   * Transition agent to waiting state. Clears foreground tools (preserves background
   * agents), cancels timers, and notifies the webview. Same logic as the turn_duration
   * handler in transcriptParser.ts.
   */
  private markAgentWaiting(agent: AgentState, agentId: number, awaitingInput = false): void {
    cancelWaitingTimer(agentId, this.waitingTimers);
    cancelPermissionTimer(agentId, this.permissionTimers);

    // Clear foreground tools, preserve background agents (same logic as turn_duration handler).
    // ALWAYS send agentToolsClear at turn end -- even when activeToolIds is empty by now
    // (because tool_results already processed and removed them). Without this, stale
    // sub-agent characters and permission bubbles from the turn would never clear.
    const parentTools = this.getSubagentToolSet();
    for (const toolId of [...agent.activeToolIds]) {
      if (agent.backgroundAgentToolIds.has(toolId)) continue;
      agent.activeToolIds.delete(toolId);
      agent.activeToolStatuses.delete(toolId);
      const toolName = agent.activeToolNames.get(toolId);
      agent.activeToolNames.delete(toolId);
      if (toolName && parentTools.has(toolName)) {
        agent.activeSubagentToolIds.delete(toolId);
        agent.activeSubagentToolNames.delete(toolId);
        // A foreground spawn dropped at Stop without a tool_result: stop its
        // shadow watch too, or it lingers until sessionEnd.
        notifyBackgroundAgentCompleted(agentId, toolId);
      }
    }
    this.agents.broadcast({ type: 'agentToolsClear', id: agentId });
    // Re-send background agent tools to restore them after the clear.
    // toolName + runInBackground are REQUIRED: without them the webview can't
    // recognize the re-sent tool as a subagent spawn and never recreates the
    // Subtask sub-character (extractToolName("Subtask: ...") is not a tool).
    // Skip tools whose background agent was promoted to its own character.
    for (const toolId of agent.backgroundAgentToolIds) {
      if (hasPromotedBackgroundAgent(agentId, toolId, this.agents)) continue;
      const status = agent.activeToolStatuses.get(toolId);
      if (status) {
        this.agents.broadcast({
          type: 'agentToolStart',
          id: agentId,
          toolId,
          status,
          toolName: agent.activeToolNames.get(toolId),
          runInBackground: true,
          isTeammateSpawn: agent.teammateSpawnToolIds?.has(toolId) || undefined,
        });
      }
    }

    agent.isWaiting = true;
    agent.permissionSent = false;
    agent.hadToolsInTurn = false;
    agent.currentHookToolId = undefined;
    this.agents.broadcast({
      type: 'agentStatus',
      id: agentId,
      status: 'waiting',
      awaitingInput,
    });
  }

  /** Clean up timers and maps. Called when the extension disposes. */
  dispose(): void {
    this.sessionRouter.dispose();
  }
}
