import { useCallback, useEffect, useRef, useState } from 'react';

// Hook that owns one Pragyaan chat session against the locked backend
// contract (see the Pragyaan API notes):
//   • POST /api/pragyaan/chat → SSE stream (text/event-stream). We read the
//     body via response.body.getReader() + TextDecoder and parse the frames
//     by hand — `token` deltas are appended to the in-progress assistant
//     message; `done` finalizes it (citations, noAnswer); `error` surfaces a
//     mid-stream failure.
//   • GET /api/pragyaan/starters → role-aware suggested prompts.
//   • GET /api/pragyaan/config   → { disclaimer, languages }.
//   • POST /api/pragyaan/feedback → thumbs up/down (may 503 if not ready).
//
// conversationId is kept in state and replayed on the next send so the server
// threads the conversation. A stable anonId is persisted in localStorage so
// anonymous (signed-out) visitors keep one identity across reloads.
//
// All fetches send credentials:'include' (same-origin /api proxy).
//
// messages: [{ role: 'user'|'assistant', content, citations?, noAnswer?,
//              streaming?, messageId?, error? }]

const ANON_ID_KEY = 'pragyaan_anon_id';

// Read (or lazily create + persist) a stable anonymous id. crypto.randomUUID
// is available in all browsers we target; fall back to a timestamp+random
// token if it's somehow missing (e.g. non-secure context) so we never throw.
function getAnonId() {
  if (typeof localStorage === 'undefined') return null;
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    // incognito / quota / disabled storage — fall back to an ephemeral id so
    // the rest of the hook still works for this page load.
    return `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

const API_BASE = '/api/pragyaan';

export function usePragyaanChat() {
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [starters, setStarters] = useState([]);
  const [config, setConfig] = useState(null);

  // conversationId lives in a ref (read inside the async send without
  // re-creating the callback) mirrored into state for consumers that want to
  // render based on it.
  const conversationIdRef = useRef(null);
  const [conversationId, setConversationId] = useState(null);
  const anonIdRef = useRef(null);
  const abortRef = useRef(null);
  const aliveRef = useRef(true);

  if (anonIdRef.current === null) anonIdRef.current = getAnonId();

  // ── One-time metadata fetches (starters + config) ──────────────────────
  useEffect(() => {
    aliveRef.current = true;
    const anonId = anonIdRef.current;

    (async () => {
      try {
        const r = await fetch(`${API_BASE}/starters`, { credentials: 'include' });
        if (r.ok) {
          const j = await r.json().catch(() => ({}));
          if (aliveRef.current && Array.isArray(j.starters)) setStarters(j.starters);
        }
      } catch { /* non-fatal — starters are a nicety */ }

      try {
        const r = await fetch(`${API_BASE}/config`, { credentials: 'include' });
        if (r.ok) {
          const j = await r.json().catch(() => ({}));
          if (aliveRef.current && j) setConfig(j);
        }
      } catch { /* non-fatal — disclaimer/langs have UI defaults */ }
    })();

    return () => {
      aliveRef.current = false;
      if (abortRef.current) { try { abortRef.current.abort(); } catch { /* ignore */ } }
    };
  }, []);

  // ── Send + consume the SSE stream ──────────────────────────────────────
  const sendMessage = useCallback(async (text, lang) => {
    const message = (text || '').trim();
    if (!message || streaming) return;

    setError(null);
    setStreaming(true);

    // Append the user's message, then a placeholder assistant message we
    // mutate in place as token deltas arrive.
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: message },
      { role: 'assistant', content: '', citations: [], streaming: true },
    ]);

    // Helper: patch the last (in-progress) assistant message.
    const patchAssistant = (patch) => {
      setMessages((prev) => {
        const next = prev.slice();
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === 'assistant') {
            next[i] = typeof patch === 'function' ? patch(next[i]) : { ...next[i], ...patch };
            break;
          }
        }
        return next;
      });
    };

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message,
          conversationId: conversationIdRef.current ?? undefined,
          anonId: anonIdRef.current ?? undefined,
          lang: lang ?? undefined,
        }),
      });

      if (!res.ok || !res.body) {
        // Try to surface a JSON error body if the server failed before
        // upgrading to the event stream.
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || j.message || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let done = false;

      // Parse one SSE frame block ("event: x\n data: {...}"). Returns the
      // {event, data} pair or null when the frame can't be understood.
      const parseFrame = (raw) => {
        let event = 'message';
        const dataLines = [];
        for (const line of raw.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) return null;
        let data = {};
        try { data = JSON.parse(dataLines.join('\n')); } catch { /* keep {} */ }
        return { event, data };
      };

      const handleFrame = (frame) => {
        if (!frame) return;
        const { event, data } = frame;
        if (event === 'token') {
          if (typeof data.delta === 'string') {
            patchAssistant((m) => ({ ...m, content: m.content + data.delta }));
          }
        } else if (event === 'done') {
          done = true;
          if (data.conversationId) {
            conversationIdRef.current = data.conversationId;
            setConversationId(data.conversationId);
          }
          patchAssistant((m) => ({
            ...m,
            streaming: false,
            citations: Array.isArray(data.citations) ? data.citations : [],
            noAnswer: !!data.noAnswer,
            messageId: data.messageId ?? m.messageId,
            lang: data.lang ?? m.lang,
          }));
        } else if (event === 'error') {
          done = true;
          const msg = data.error || 'The assistant ran into a problem. Please try again.';
          setError(new Error(msg));
          patchAssistant((m) => ({ ...m, streaming: false, error: msg }));
        }
      };

      // Read loop: decode chunks, split on the SSE frame delimiter (blank
      // line = "\n\n"), and dispatch complete frames. We normalize CRLF so a
      // proxy that rewrites line endings doesn't break the split.
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const rawFrame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (rawFrame.trim()) handleFrame(parseFrame(rawFrame));
          if (done) break;
        }
      }

      // Flush any trailing frame the server sent without a closing blank line.
      if (!done && buffer.trim()) handleFrame(parseFrame(buffer));

      // Safety net: if the stream ended without an explicit done/error frame,
      // clear the streaming flag so the bubble doesn't spin forever.
      patchAssistant((m) => (m.streaming ? { ...m, streaming: false } : m));
    } catch (e) {
      // AbortError is expected on reset()/unmount — don't surface it.
      if (e.name !== 'AbortError') {
        setError(e);
        patchAssistant((m) => ({ ...m, streaming: false, error: e.message }));
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStreaming(false);
    }
  }, [streaming]);

  // ── Reset the conversation ─────────────────────────────────────────────
  const reset = useCallback(() => {
    if (abortRef.current) { try { abortRef.current.abort(); } catch { /* ignore */ } }
    abortRef.current = null;
    conversationIdRef.current = null;
    setConversationId(null);
    setMessages([]);
    setError(null);
    setStreaming(false);
  }, []);

  // ── Feedback (thumbs up/down). Tolerates the 503 "not ready" case. ──────
  const submitFeedback = useCallback(async (messageId, rating, comment) => {
    if (!messageId || !rating) return false;
    try {
      const r = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messageId, rating, comment: comment ?? undefined }),
      });
      // 503 = feedback store not ready yet — treat as a soft no-op so the UI
      // can show a gentle "try later" rather than an error.
      if (r.status === 503) return false;
      return r.ok;
    } catch {
      return false;
    }
  }, []);

  return {
    messages,
    sendMessage,
    streaming,
    error,
    reset,
    submitFeedback,
    starters,
    config,
    conversationId,
  };
}
