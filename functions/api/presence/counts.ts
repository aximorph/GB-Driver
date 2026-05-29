/**
 * GET /api/presence/counts
 *
 * Returns total online drivers and top-5 provinces.
 * KV keys expire automatically so all listed keys are "live" sessions.
 *
 * Response: { total: number, top5: { provinceId: string, count: number }[] }
 */

interface Env {
  GBDRIVER_PRESENCE: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  // List all keys — KV auto-expires stale ones (TTL set on ping)
  const counts: Record<string, number> = {};
  let cursor: string | undefined;

  do {
    const result = await env.GBDRIVER_PRESENCE.list({
      prefix: 'pres:',
      cursor,
      limit: 1000,
    });

    for (const key of result.keys) {
      // key.name = "pres:{provinceId}:{sessionId}"
      const parts = key.name.split(':');
      if (parts.length >= 3) {
        const provinceId = parts[1];
        counts[provinceId] = (counts[provinceId] ?? 0) + 1;
      }
    }

    cursor = result.list_complete ? undefined : (result as { cursor?: string }).cursor;
  } while (cursor);

  const provinces = Object.entries(counts)
    .map(([provinceId, count]) => ({ provinceId, count }))
    .sort((a, b) => b.count - a.count);

  const total = provinces.reduce((s, p) => s + p.count, 0);

  return new Response(
    JSON.stringify({ total, top5: provinces.slice(0, 5) }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
