import { describe, expect, it, vi } from 'vitest';

import { AgentStateStore } from '../src/agentStateStore.js';
import { createHttpServer } from '../src/httpServer.js';

describe('httpServer performance', () => {
  it('handles burst of events within queue cap', async () => {
    const store = new AgentStateStore();
    const onHookEvent = vi.fn();
    const server = await createHttpServer({
      embedded: true,
      token: 'test-token',
      store,
      onHookEvent,
    });

    const burstSize = 50;
    for (let i = 0; i < burstSize; i++) {
      await server.app.inject({
        method: 'POST',
        url: `/api/hooks/claude`,
        headers: { authorization: 'Bearer test-token' },
        body: { session_id: `sess-${i}` },
      });
    }

    // Allow time for queue processing
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(onHookEvent).toHaveBeenCalledTimes(burstSize);
    server.app.close();
  });

  it('evicts oldest on overflow', async () => {
    const store = new AgentStateStore();
    const onHookEvent = vi.fn();
    const server = await createHttpServer({
      embedded: true,
      token: 'test-token',
      store,
      onHookEvent,
    });

    // Enqueue many items rapidly. Don't await each to allow queue to build up.
    const total = 1200;
    const promises = [];
    for (let i = 0; i < total; i++) {
      promises.push(server.app.inject({
        method: 'POST',
        url: `/api/hooks/claude`,
        headers: { authorization: 'Bearer test-token' },
        body: { session_id: `sess-${i}` },
      }));
    }
    await Promise.all(promises);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // It should have processed exactly MAX_HOOK_QUEUE_SIZE items that were in the queue plus
    // any that were processed during the injection.
    // Since MAX_HOOK_QUEUE_SIZE is 1000, and we injected 1200, we expect some to be evicted.
    // The exact number processed depends on timing, but it should be <= 1000 + some overlap.
    
    expect(onHookEvent.mock.calls.length).toBeLessThan(total);
    // The last items should be the latest ones
    expect(onHookEvent).toHaveBeenLastCalledWith('claude', { session_id: `sess-${total - 1}` });
    
    server.app.close();
  });
});
