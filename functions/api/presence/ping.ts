/**
 * POST /api/presence/ping
 * Body: { provinceId: string, sessionId: string }
 *
 * Writes/refreshes presence with a 35-minute TTL in KV.
 * Key format: `pres:{provinceId}:{sessionId}`
 */

interface Env {
  GBDRIVER_PRESENCE: KVNamespace;
}

const TTL_SECONDS = 35 * 60; // 35 minutes (slightly longer than 30-min client TTL)

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { provinceId, sessionId } = await request.json() as { provinceId: string; sessionId: string };
    if (!provinceId || !sessionId) {
      return new Response('Missing provinceId or sessionId', { status: 400 });
    }

    const key = `pres:${provinceId}:${sessionId}`;
    await env.GBDRIVER_PRESENCE.put(key, String(Date.now()), {
      expirationTtl: TTL_SECONDS,
    });

    return new Response('ok', { status: 200 });
  } catch {
    return new Response('Bad request', { status: 400 });
  }
};
