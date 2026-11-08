import { HOOK_EVENT_BUFFER_MS } from './constants.js';

/** Pending external session info (waiting for confirmation event before creating agent). */
export interface PendingExternalSession {
  sessionId: string;
  /** Transcript file path. Undefined for providers without transcripts (OpenCode, Copilot). */
  transcriptPath: string | undefined;
  cwd: string;
}

/** An event waiting to be dispatched once its agent registers. */
export interface BufferedEvent {
  providerId: string;
  event: Record<string, unknown>;
  timestamp: number;
}

/**
 * Maps session IDs to agent IDs, manages pending external sessions, and
 * buffers events that arrive before their agent registers.
 *
 * Session IDs are namespaced by providerId ("providerId:sessionId") to
 * prevent collisions across different agent families.
 */
export class SessionRouter {
  private sessionToAgentId = new Map<string, number>();
  private pendingSessions = new Map<string, PendingExternalSession>();
  private buffer: BufferedEvent[] = [];
  private bufferTimer: ReturnType<typeof setInterval> | null = null;

  // ── Session → Agent mapping ────────────────────────────────────────

  private makeKey(providerId: string, sessionId: string): string {
    return `${providerId}:${sessionId}`;
  }

  /** Register a session→agent mapping. Returns any buffered events for this
   *  session so the caller can re-dispatch them. */
  register(providerId: string, sessionId: string, agentId: number): BufferedEvent[] {
    const key = this.makeKey(providerId, sessionId);
    this.sessionToAgentId.set(key, agentId);
    return this.flushBuffered(providerId, sessionId);
  }

  unregister(providerId: string, sessionId: string): void {
    const key = this.makeKey(providerId, sessionId);
    this.sessionToAgentId.delete(key);
  }

  resolve(providerId: string, sessionId: string): number | undefined {
    const key = this.makeKey(providerId, sessionId);
    return this.sessionToAgentId.get(key);
  }

  hasSession(providerId: string, sessionId: string): boolean {
    const key = this.makeKey(providerId, sessionId);
    return this.sessionToAgentId.has(key);
  }

  // ── Pending external sessions ──────────────────────────────────────

  storePending(providerId: string, sessionId: string, info: PendingExternalSession): void {
    const key = this.makeKey(providerId, sessionId);
    this.pendingSessions.set(key, info);
  }

  confirmPending(providerId: string, sessionId: string): PendingExternalSession | undefined {
    const key = this.makeKey(providerId, sessionId);
    const info = this.pendingSessions.get(key);
    if (info) this.pendingSessions.delete(key);
    return info;
  }

  hasPending(providerId: string, sessionId: string): boolean {
    const key = this.makeKey(providerId, sessionId);
    return this.pendingSessions.has(key);
  }

  discardPending(providerId: string, sessionId: string): void {
    const key = this.makeKey(providerId, sessionId);
    this.pendingSessions.delete(key);
  }

  // ── Event buffering ────────────────────────────────────────────────

  bufferEvent(providerId: string, event: Record<string, unknown>): void {
    this.buffer.push({ providerId, event, timestamp: Date.now() });
    if (!this.bufferTimer) {
      this.bufferTimer = setInterval(() => {
        this.pruneExpired();
      }, HOOK_EVENT_BUFFER_MS);
    }
  }

  hasBuffered(providerId: string, sessionId: string): boolean {
    return this.buffer.some((b) => b.providerId === providerId && b.event.session_id === sessionId);
  }

  pruneExpired(): void {
    const cutoff = Date.now() - HOOK_EVENT_BUFFER_MS;
    this.buffer = this.buffer.filter((b) => b.timestamp > cutoff);
    this.cleanupBufferTimer();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  dispose(): void {
    if (this.bufferTimer) {
      clearInterval(this.bufferTimer);
      this.bufferTimer = null;
    }
    this.sessionToAgentId.clear();
    this.buffer = [];
    this.pendingSessions.clear();
  }

  // ── Private ────────────────────────────────────────────────────────

  private flushBuffered(providerId: string, sessionId: string): BufferedEvent[] {
    const toFlush = this.buffer.filter(
      (b) => b.providerId === providerId && b.event.session_id === sessionId,
    );
    this.buffer = this.buffer.filter(
      (b) => !(b.providerId === providerId && b.event.session_id === sessionId),
    );
    this.cleanupBufferTimer();
    return toFlush;
  }

  private cleanupBufferTimer(): void {
    if (this.buffer.length === 0 && this.bufferTimer) {
      clearInterval(this.bufferTimer);
      this.bufferTimer = null;
    }
  }
}
