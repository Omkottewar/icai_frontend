import { useCallback, useEffect, useRef, useState } from 'react';

// Hook that owns one event chat session:
//   • Initial REST fetch for the latest N messages + my user id + event meta.
//   • WebSocket connection that pushes new messages from other clients.
//   • Optimistic send: POST returns the canonical row, which de-dupes against
//     the WebSocket echo of the same message via the row id.
//   • Reconnect with exponential backoff (1s → 2s → 4s → 8s, capped at 8s).
//
// Callers get { event, me, messages, onlineCount, status, error,
//               send, loadOlder, refresh }.
//
// Status: 'idle' before mount, 'loading' during initial fetch,
//         'open' when WS connected, 'reconnecting' between drops,
//         'forbidden' when 403 (not registered), 'error' for other failures.

const REST_BASE = '/api/events';

function wsUrlFor(eventId) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/events/${eventId}/chat`;
}

export function useEventChat(eventId, { enabled = true } = {}) {
  const [event, setEvent] = useState(null);
  const [me, setMe] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const wsRef = useRef(null);
  const backoffRef = useRef(1000);
  const reconnectTimerRef = useRef(null);
  const aliveRef = useRef(true);
  // Stops the reconnect loop after MAX_WS_ATTEMPTS consecutive failures —
  // avoids hammering the server (and spamming vite's proxy log with
  // `write ECONNABORTED` lines) when the endpoint is persistently refusing,
  // e.g. user lost their registration mid-session.
  const wsAttemptsRef = useRef(0);
  const MAX_WS_ATTEMPTS = 5;

  // ── Initial load ─────────────────────────────────────────────────────
  // Returns true if the REST call succeeded — caller uses this to decide
  // whether to open the WebSocket.
  const initialLoad = useCallback(async () => {
    if (!eventId || !enabled) return false;
    setStatus('loading');
    setError(null);
    try {
      const r = await fetch(`${REST_BASE}/${eventId}/chat?pageSize=50`, { credentials: 'include' });
      const j = await r.json().catch(() => ({}));
      if (r.status === 403) { setStatus('forbidden'); setError(new Error('Only registered attendees can view this chat')); return false; }
      if (!r.ok)            { setStatus('error');     setError(new Error(j.error || `HTTP ${r.status}`)); return false; }
      setEvent(j.event);
      setMe(j.me);
      setMessages(j.messages || []);
      setOnlineCount(j.online_count || 0);
      setHasMore((j.messages || []).length >= 50);
      setStatus('open'); // optimistic — WS will confirm with the hello frame
      return true;
    } catch (e) {
      setStatus('error'); setError(e);
      return false;
    }
  }, [eventId, enabled]);

  // ── WebSocket lifecycle ──────────────────────────────────────────────
  const connectWs = useCallback(() => {
    if (!eventId || !enabled) return;
    // Close any existing socket before opening a new one.
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      try { wsRef.current.close(); } catch { /* ignore */ }
    }

    wsAttemptsRef.current += 1;
    const ws = new WebSocket(wsUrlFor(eventId));
    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = 1000;
      wsAttemptsRef.current = 0; // reset on a real connection
      setStatus('open');
    };
    ws.onmessage = (ev) => {
      let frame;
      try { frame = JSON.parse(ev.data); } catch { return; }
      if (frame.type === 'message' && frame.message) {
        setMessages((prev) => {
          // De-dupe by id — POST already inserted our own message.
          if (prev.some((m) => m.id === frame.message.id)) return prev;
          return [...prev, frame.message];
        });
      } else if (frame.type === 'presence' || frame.type === 'hello') {
        if (typeof frame.online_count === 'number') setOnlineCount(frame.online_count);
      }
    };
    ws.onerror = () => {
      // Don't change status here — onclose runs next and owns the reconnect.
    };
    ws.onclose = () => {
      if (!aliveRef.current) return;
      // Stop after too many consecutive failures — the endpoint is
      // probably refusing us (403 / event gone). Falling back to the REST
      // data the page already has is better than retrying forever.
      if (wsAttemptsRef.current >= MAX_WS_ATTEMPTS) {
        setStatus('error');
        setError((prev) => prev || new Error('Live updates unavailable — message history is still shown.'));
        return;
      }
      setStatus('reconnecting');
      // Backoff: 1s, 2s, 4s, then cap at 8s.
      const delay = backoffRef.current;
      backoffRef.current = Math.min(8000, delay * 2);
      reconnectTimerRef.current = setTimeout(() => {
        if (aliveRef.current) connectWs();
      }, delay);
    };
  }, [eventId, enabled]);

  useEffect(() => {
    aliveRef.current = true;
    wsAttemptsRef.current = 0;
    backoffRef.current = 1000;
    initialLoad().then((ok) => {
      // Only attempt the WebSocket if the REST gate passed. A 403 from
      // GET /chat would also produce a WS rejection — no point spamming
      // the upgrade endpoint just to learn the same thing.
      if (ok && aliveRef.current) connectWs();
    });
    return () => {
      aliveRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) { try { wsRef.current.close(); } catch { /* ignore */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, enabled]);

  // ── Send ──────────────────────────────────────────────────────────────
  const send = useCallback(async (body) => {
    const text = (body || '').trim();
    if (!text || !eventId) return null;
    try {
      const r = await fetch(`${REST_BASE}/${eventId}/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      // Append locally so the sender sees their message immediately even if
      // the WS echo races a beat behind. WS handler de-dupes by id.
      setMessages((prev) => (prev.some((m) => m.id === j.id) ? prev : [...prev, j]));
      return j;
    } catch (e) {
      setError(e);
      return null;
    }
  }, [eventId]);

  // ── Pagination upwards ───────────────────────────────────────────────
  const loadOlder = useCallback(async () => {
    if (!eventId || !messages.length || !hasMore) return;
    const oldest = messages[0];
    try {
      const r = await fetch(
        `${REST_BASE}/${eventId}/chat/older?before=${encodeURIComponent(oldest.created_at)}&pageSize=50`,
        { credentials: 'include' },
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      const older = j.messages || [];
      if (older.length < 50) setHasMore(false);
      if (older.length === 0) return;
      setMessages((prev) => [...older, ...prev]);
    } catch (e) {
      setError(e);
    }
  }, [eventId, messages, hasMore]);

  const refresh = useCallback(() => initialLoad(), [initialLoad]);

  return {
    event, me,
    messages,
    onlineCount,
    status, error,
    hasMore,
    send, loadOlder, refresh,
  };
}
