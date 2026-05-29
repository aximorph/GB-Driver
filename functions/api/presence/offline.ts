/**
 * POST /api/presence/offline
 * Body: { provinceId: string, sessionId: string }
 *
 * Deletes the presence key immediately when driver ends shift.
 */

interface Env {
  GBDRIVER_PRESENCE: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { provinceId, sessionId } = await request.json() as { provinceId: string; sessionId: string };
    if (!provinceId || !sessionId) {
      return new Response('Missing provinceId or sessionId', { status: 400 });
    }

    await env.GBDRIVER_PRESENCE.delete(`pres:${provinceId}:${sessionId}`);
    return new Response('ok', { status: 200 });
  } catch {
    return new Response('Bad request', { status: 400 });
  }
};
