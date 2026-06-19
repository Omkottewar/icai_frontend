// Pragyaan AI — frontend API client.
//
// Wraps the /api/pragyaan/* surface defined in backend/server/routes/pragyaan.ts:
//
//   GET  /config            → { disclaimer, languages }
//   GET  /starters          → { role, starters[] }
//   GET  /conversations/:id → { conversation, messages[] } (with ?anonId for anons)
//   POST /chat              → SSE stream (token | done | error frames)
//   POST /feedback          → { ok: true }
//
// The chat endpoint streams as text/event-stream, so we consume it via fetch +
// ReadableStream (EventSource doesn't support POST or sending cookies reliably
// across origins). Anonymous callers persist a stable `anonId` in localStorage
// so the server can match a conversation back to its owner.

const BASE = '/api/pragyaan';
const ANON_KEY = 'icai_pragyaan_anon_id_v1';

/** Stable anonymous client id, generated on first use and reused thereafter. */
export function getAnonId() {
  if (typeof localStorage === 'undefined') return null;
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = (crypto?.randomUUID && crypto.randomUUID()) ||
        `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

async function getJson(path) {
  const r = await fetch(`${BASE}${path}`, { credentials: 'include' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(j.error || j.message || `HTTP ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return j;
}

export function getConfig() {
  return getJson('/config');
}

export function getStarters() {
  return getJson('/starters');
}

export function getConversation(id, anonId) {
  const qs = anonId ? `?anonId=${encodeURIComponent(anonId)}` : '';
  return getJson(`/conversations/${encodeURIComponent(id)}${qs}`);
}

export async function sendFeedback({ messageId, rating, comment }) {
  const r = await fetch(`${BASE}/feedback`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messageId, rating, comment: comment ?? null }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(j.message || j.error || `HTTP ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return j;
}

// ── SSE parser ──────────────────────────────────────────────────────────────
// Pulls "event: …\ndata: …\n\n" frames out of an incremental UTF-8 stream.
// The server emits three event types: token, done, error.

function parseFrames(buf, onFrame) {
  let idx;
  let cursor = 0;
  while ((idx = buf.indexOf('\n\n', cursor)) !== -1) {
    const raw = buf.slice(cursor, idx);
    cursor = idx + 2;
    let event = 'message';
    let data = '';
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (event === 'message' && !data) continue;
    let parsed = null;
    if (data) {
      try { parsed = JSON.parse(data); }
      catch { parsed = { raw: data }; }
    }
    onFrame(event, parsed);
  }
  return buf.slice(cursor);
}

/**
 * Stream a Pragyaan answer.
 *
 *   const { abort } = streamChat(
 *     { message, conversationId, anonId, lang },
 *     {
 *       onToken: (delta) => …,
 *       onDone:  ({ conversationId, messageId, citations, noAnswer, lang }) => …,
 *       onError: (err) => …,
 *     },
 *   );
 *
 * Returns `{ abort }` so the caller can cancel an in-flight stream (e.g. when
 * the widget is closed or a second send fires while the first is still going).
 */
export function streamChat(body, handlers) {
  const controller = new AbortController();
  const { onToken, onDone, onError } = handlers;

  const run = async () => {
    let res;
    try {
      res = await fetch(`${BASE}/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (err?.name !== 'AbortError') onError?.(err);
      return;
    }

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        detail = j.message || j.error || detail;
      } catch { /* ignore */ }
      onError?.(new Error(detail));
      return;
    }

    if (!res.body) {
      onError?.(new Error('No response body'));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let finished = false;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        buf = parseFrames(buf, (event, payload) => {
          if (event === 'token' && payload?.delta) {
            onToken?.(payload.delta);
          } else if (event === 'done') {
            finished = true;
            onDone?.(payload || {});
          } else if (event === 'error') {
            onError?.(new Error(payload?.error || 'stream_error'));
          }
        });
      }
    } catch (err) {
      if (err?.name !== 'AbortError' && !finished) onError?.(err);
    }
  };

  run();
  return { abort: () => controller.abort() };
}
