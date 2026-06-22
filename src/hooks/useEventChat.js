import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Hook that owns one event chat session — the Discord-style revamp:
//
//   • Initial REST fetch returns event meta + channels + first page of the
//     default channel's messages.
//   • A WebSocket stays open for the duration of the chat; it carries
//     new-message events, edits, deletes, reactions, pins, typing
//     indicators, and presence updates.
//   • Optimistic send: POST returns the canonical row; the WS echo is
//     de-duped by id.
//   • Channel switching only re-fetches messages (the channel list comes
//     from the bootstrap and is updated locally).

const REST_BASE = '/api/events';
const CHAT_PAGE_SIZE = 25;
const CHAT_BACKFILL_LIMIT = 25;

// ─── localStorage cache (A3) ─────────────────────────────────────────
//
// Stale-while-revalidate per event. We bound the footprint at 5 events
// × ~6 channels × ~150 messages each, well under the ~5 MB
// localStorage cap browsers enforce. Cache rows older than 24h are
// dropped at read time so a long-stale entry can't survive forever.
const LS_KEY_PREFIX  = 'icai_chat_v1:';
const LS_EVENT_INDEX = 'icai_chat_v1_events';
const LS_MAX_EVENTS  = 5;
const LS_MAX_PER_CH  = 150;
const LS_MAX_AGE_MS  = 24 * 60 * 60 * 1000;

function lsKey(eventId) { return LS_KEY_PREFIX + eventId; }

function lsReadCache(eventId) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(lsKey(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.cachedAt || Date.now() - parsed.cachedAt > LS_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function lsWriteCache(eventId, payload) {
  if (typeof localStorage === 'undefined') return;
  try {
    // Truncate per channel so storage stays bounded.
    const trimmed = { ...payload, cachedAt: Date.now() };
    if (trimmed.messagesByCh) {
      const out = {};
      for (const [cid, msgs] of Object.entries(trimmed.messagesByCh)) {
        out[cid] = Array.isArray(msgs) ? msgs.slice(-LS_MAX_PER_CH) : [];
      }
      trimmed.messagesByCh = out;
    }
    localStorage.setItem(lsKey(eventId), JSON.stringify(trimmed));

    // LRU-ish index of which event keys are live so we can evict the
    // oldest when we exceed LS_MAX_EVENTS.
    let index = [];
    try { index = JSON.parse(localStorage.getItem(LS_EVENT_INDEX) || '[]'); } catch { /* reset */ }
    index = index.filter((id) => id !== eventId);
    index.push(eventId);
    while (index.length > LS_MAX_EVENTS) {
      const evict = index.shift();
      try { localStorage.removeItem(lsKey(evict)); } catch { /* ignore */ }
    }
    localStorage.setItem(LS_EVENT_INDEX, JSON.stringify(index));
  } catch {
    // QuotaExceededError or private-mode — silently skip. The chat
    // still works, just without the warm-paint optimisation.
  }
}

function wsUrlFor(eventId) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/events/${eventId}/chat`;
}

// A small uuid generator — uses the platform crypto.randomUUID() when
// available (every modern browser), falls back to a v4-ish random
// string otherwise. We only need uniqueness within a (user, channel),
// not cryptographic strength.
function newClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC 4122-ish v4 fallback.
  return 'cli-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function useEventChat(eventId, { enabled = true } = {}) {
  // ── Bootstrap state ──────────────────────────────────────────────────
  const [event, setEvent]       = useState(null);
  const [me, setMe]             = useState(null);
  const [channels, setChannels] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messagesByCh, setMessagesByCh] = useState({});
  const [hasMoreByCh, setHasMoreByCh]   = useState({});
  const [pinnedByCh, setPinnedByCh]     = useState({});
  const [typingByCh, setTypingByCh]     = useState({});
  const [onlineCount, setOnlineCount]   = useState(0);
  const [status, setStatus]             = useState('idle');
  const [error, setError]               = useState(null);
  // Last message we *saw* per channel — used as the `?since=` cursor on
  // reconnect to fetch anything that arrived while the socket was down.
  const lastSeenAtByCh = useRef({});

  const wsRef = useRef(null);
  const backoffRef = useRef(1000);
  const reconnectTimerRef = useRef(null);
  // Separate timer for the visible "reconnecting…" pill. We wait ~1.5s
  // before showing it so a brief blip that recovers quickly doesn't
  // flash the badge.
  const reconnectStatusTimerRef = useRef(null);
  const aliveRef = useRef(true);
  const wsAttemptsRef = useRef(0);
  const activeIdRef = useRef(null);
  const meRef = useRef(null);
  const MAX_WS_ATTEMPTS = 5;

  // Refs mirror activeId and me so WS handlers (which capture the
  // first-render closure) always see the latest value without forcing a
  // socket reconnect on every change.
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { meRef.current = me; }, [me]);

  // ── Initial bootstrap ────────────────────────────────────────────────
  //
  // Two phases:
  //   1) Hydrate from localStorage synchronously (if present + fresh) so
  //      the chat paints with last-known content before the network even
  //      starts talking. The user sees their familiar messages instead
  //      of a spinner.
  //   2) Fire the REST bootstrap; replace state when it lands. The
  //      server is the canonical source — we just merged the cache for
  //      a faster first paint.
  const bootstrap = useCallback(async () => {
    if (!eventId || !enabled) return false;

    // ── (1) Cache priming ────────────────────────────────────────────
    const cached = lsReadCache(eventId);
    if (cached?.event) {
      setEvent(cached.event);
      setMe(cached.me ?? null);
      setChannels(cached.channels ?? []);
      if (cached.activeId) setActiveId(cached.activeId);
      if (cached.messagesByCh) setMessagesByCh(cached.messagesByCh);
      setStatus('loading');  // still loading; we're just rendering a hint
    } else {
      setStatus('loading');
    }
    setError(null);

    // ── (2) Network bootstrap ────────────────────────────────────────
    try {
      const r = await fetch(`${REST_BASE}/${eventId}/chat?pageSize=${CHAT_PAGE_SIZE}`, { credentials: 'include' });
      const j = await r.json().catch(() => ({}));
      if (r.status === 403) { setStatus('forbidden'); setError(new Error('Only registered attendees can view this chat')); return false; }
      if (!r.ok)            { setStatus('error');     setError(new Error(j.error || `HTTP ${r.status}`)); return false; }
      setEvent(j.event);
      setMe(j.me);
      setChannels(j.channels || []);
      setOnlineCount(j.online_count || 0);

      const defId = j.default_channel_id;
      // A1 — seed messagesByCh for EVERY channel returned by the
      // server, not just the default. Channel switching is now
      // zero-network for the first paint of every channel.
      if (j.messages_by_channel_id) {
        setMessagesByCh((prev) => {
          const next = { ...prev };
          for (const [cid, msgs] of Object.entries(j.messages_by_channel_id)) {
            next[cid] = Array.isArray(msgs) ? msgs : [];
          }
          return next;
        });
        setHasMoreByCh((prev) => {
          const next = { ...prev };
          for (const [cid, msgs] of Object.entries(j.messages_by_channel_id)) {
            next[cid] = (Array.isArray(msgs) ? msgs.length : 0) >= 30;
          }
          return next;
        });
        // Seed reconnect-catchup watermarks from the bootstrap payload.
        // Without this, a WS drop *before* the first live message arrived
        // leaves `lastSeenAtByCh` empty → the onopen catch-up loop
        // iterates zero channels and silently misses anything posted
        // during the gap. Symptom: "I have to close/reopen to see new
        // messages." Seeding here means catch-up has a baseline from
        // the moment the chat loads.
        for (const [cid, msgs] of Object.entries(j.messages_by_channel_id)) {
          if (Array.isArray(msgs) && msgs.length > 0) {
            lastSeenAtByCh.current[cid] = msgs[msgs.length - 1].created_at;
          }
        }
      } else if (defId) {
        // Legacy server (pre-A1) → fall back to the flat `messages` shape.
        setMessagesByCh((m) => ({ ...m, [defId]: j.messages || [] }));
        setHasMoreByCh((h) => ({ ...h, [defId]: (j.messages || []).length >= CHAT_PAGE_SIZE }));
        const msgs = j.messages || [];
        if (msgs.length > 0) lastSeenAtByCh.current[defId] = msgs[msgs.length - 1].created_at;
      }

      if (defId) setActiveId((cur) => cur || defId);
      setStatus('open');
      return true;
    } catch (e) {
      setStatus('error'); setError(e);
      return false;
    }
  }, [eventId, enabled]);

  // Reconnect / refocus catch-up: ask the server for everything newer
  // than our per-channel high-watermark. Used both on WS reconnect and
  // on `visibilitychange` (a proxy can silently drop a long-idle WS in
  // a backgrounded tab; the connection still shows readyState=OPEN
  // until we try to send, but inbound frames have stopped). Idempotent
  // — re-running it with no gap returns zero rows.
  //
  // NOTE: /catchup only returns messages with created_at > since. It
  // does NOT return state changes on older messages (reactions, pins,
  // edits, deletes). For those, refreshChannel() below re-fetches the
  // recent slice so any mutation on already-loaded rows surfaces.
  const catchupAll = useCallback(async () => {
    if (!eventId) return;
    const watermarks = lastSeenAtByCh.current;
    const channelIds = Object.keys(watermarks);
    for (const ch of channelIds) {
      try {
        const since = watermarks[ch];
        if (!since) continue;
        const r = await fetch(
          `${REST_BASE}/${eventId}/chat/channels/${ch}/catchup?since=${encodeURIComponent(since)}`,
          { credentials: 'include' },
        );
        if (!r.ok) continue;
        const j = await r.json();
        const fresh = j.messages || [];
        if (fresh.length === 0) continue;
        setMessagesByCh((m) => {
          const cur = m[ch] || [];
          const ids = new Set(cur.map((x) => x.id));
          const added = fresh.filter((x) => !ids.has(x.id));
          if (added.length === 0) return m;
          return { ...m, [ch]: [...cur, ...added] };
        });
        lastSeenAtByCh.current[ch] = fresh[fresh.length - 1].created_at;
      } catch { /* ignore per-channel catchup failures */ }
    }
  }, [eventId]);

  // Re-fetch the most-recent slice of a channel and merge it into local
  // state. This is how reactions / deletions / edits / pins that we
  // missed (WS dropped, frame lost in proxy buffer, browser throttled
  // the socket) become visible without forcing the user to close-and-
  // reopen the chat box.
  //
  // Merge rules:
  //  • The fresh slice is authoritative for any message whose id appears
  //    in it — we replace local state with the server row (picking up
  //    new reactions, deleted_at, edited_at, pinned_at, etc).
  //  • Messages older than the fresh-slice window are kept (the user
  //    may have scrolled up to load history; refetching the latest 25
  //    must not blow that away).
  //  • Optimistic 'pending' / 'failed' bubbles that the server hasn't
  //    confirmed yet stay at the bottom so the user doesn't see their
  //    own in-flight send vanish.
  const refreshChannel = useCallback(async (channelId) => {
    if (!eventId || !channelId) return;
    try {
      // `cache: 'no-store'` forces a fresh network request — otherwise
      // the browser may serve a recently-cached page response that
      // pre-dates the user's reaction / pin / edit, overwriting their
      // optimistic chip with stale state.
      const r = await fetch(
        `${REST_BASE}/${eventId}/chat/channels/${channelId}/messages?pageSize=${CHAT_PAGE_SIZE}`,
        { credentials: 'include', cache: 'no-store' },
      );
      if (!r.ok) return;
      const j = await r.json();
      const fresh = j.messages || [];
      if (fresh.length === 0) return;
      const freshIds = new Set(fresh.map((x) => x.id));
      const freshClientIds = new Set(fresh.map((x) => x.client_id).filter(Boolean));
      const freshOldest = fresh[0].created_at;

      setMessagesByCh((m) => {
        const cur = m[channelId] || [];
        const older = cur.filter((x) => x.created_at < freshOldest && !freshIds.has(x.id));
        const pendingTail = cur.filter((x) =>
          (x.status === 'pending' || x.status === 'failed') &&
          !freshIds.has(x.id) &&
          (!x.client_id || !freshClientIds.has(x.client_id))
        );
        return { ...m, [channelId]: [...older, ...fresh, ...pendingTail] };
      });
      lastSeenAtByCh.current[channelId] = fresh[fresh.length - 1].created_at;
    } catch { /* ignore — next refresh will retry */ }
  }, [eventId]);

  // ── WebSocket lifecycle ─────────────────────────────────────────────
  const connectWs = useCallback(() => {
    if (!eventId || !enabled) return;
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      try { wsRef.current.close(); } catch { /* ignore */ }
    }
    wsAttemptsRef.current += 1;
    const ws = new WebSocket(wsUrlFor(eventId));
    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = 1000;
      wsAttemptsRef.current = 0;
      // Cancel any pending "show reconnecting pill" timer — we reconnected
      // before it fired, so the user never sees the blip.
      if (reconnectStatusTimerRef.current) {
        clearTimeout(reconnectStatusTimerRef.current);
        reconnectStatusTimerRef.current = null;
      }
      setStatus('open');
      // Close two gaps left by the WS drop: new messages we missed
      // (catchupAll, since-based) AND state changes on existing
      // messages — reactions, deletes, edits, pins — which /catchup
      // does NOT return. refreshChannel refetches the visible slice
      // so those mutations surface immediately.
      catchupAll();
      if (activeIdRef.current) refreshChannel(activeIdRef.current);
    };
    ws.onmessage = (ev) => {
      let frame;
      try { frame = JSON.parse(ev.data); } catch { return; }

      if (frame.type === 'message' && frame.message?.channel_id) {
        const ch = frame.message.channel_id;
        setMessagesByCh((m) => {
          const cur = m[ch] || [];
          // B1 dedup — match on id OR client_id. Echo from another
          // tab arrives with the canonical server id; the local
          // optimistic copy was pushed with client_id. We swap the
          // optimistic row for the canonical one rather than appending
          // a duplicate.
          const incoming = frame.message;
          const idx = cur.findIndex((x) =>
            x.id === incoming.id ||
            (incoming.client_id && x.client_id === incoming.client_id)
          );
          if (idx >= 0) {
            const copy = cur.slice();
            // Preserve any client-only fields ("status: 'pending'" → server
            // overwrite removes that automatically by spreading) and keep
            // the message under the canonical server id.
            copy[idx] = { ...cur[idx], ...incoming, status: undefined };
            return { ...m, [ch]: copy };
          }
          return { ...m, [ch]: [...cur, incoming] };
        });
        // Track the latest timestamp per channel for reconnect-catchup.
        lastSeenAtByCh.current[ch] = frame.message.created_at;
        setChannels((cs) => cs.map((c) => c.id === ch
          ? {
              ...c,
              last_message_at: frame.message.created_at,
              unread_count: c.id === activeIdRef.current ? 0 : (c.unread_count || 0) + 1,
            }
          : c));
        return;
      }

      if (frame.type === 'message:edited') {
        const { channel_id: ch, message_id, body, edited_at } = frame;
        setMessagesByCh((m) => ({
          ...m,
          [ch]: (m[ch] || []).map((msg) => msg.id === message_id ? { ...msg, body, edited_at } : msg),
        }));
        return;
      }

      if (frame.type === 'message:deleted') {
        const { channel_id: ch, message_id } = frame;
        const deletedAt = new Date().toISOString();
        setMessagesByCh((m) => ({
          ...m,
          [ch]: (m[ch] || []).map((msg) => msg.id === message_id
            ? { ...msg, deleted_at: deletedAt, body: '', attachments: [], reactions: [], reply_count: 0, pinned_at: null }
            : msg),
        }));
        return;
      }

      if (frame.type === 'reaction') {
        const { message_id, emoji, user_id, action } = frame;
        // Single merge function shared with optimistic / rollback /
        // refresh paths. Idempotent: if the user is already in the
        // reaction's user_ids, re-applying 'add' is a no-op.
        applyReactionChange(message_id, emoji, user_id, action === 'added' ? 'add' : 'remove');
        return;
      }

      if (frame.type === 'pin:added' || frame.type === 'pin:removed') {
        const { channel_id: ch, message_id, pinned_at } = frame;
        const update = (msg) => msg.id === message_id ? { ...msg, pinned_at } : msg;
        setMessagesByCh((m) => ({ ...m, [ch]: (m[ch] || []).map(update) }));
        setPinnedByCh((p) => ({ ...p, [ch]: undefined })); // refetch on next view
        return;
      }

      if (frame.type === 'typing' && frame.channel_id && frame.user_id) {
        const my = meRef.current;
        if (my && frame.user_id === my.id) return;
        const ch = frame.channel_id;
        setTypingByCh((t) => ({
          ...t,
          [ch]: { ...(t[ch] || {}), [frame.user_id]: Date.now() },
        }));
        return;
      }

      if (frame.type === 'presence' || frame.type === 'hello') {
        if (typeof frame.online_count === 'number') setOnlineCount(frame.online_count);
      }
    };
    ws.onerror = () => { /* close handler owns reconnect */ };
    ws.onclose = () => {
      if (!aliveRef.current) return;
      // Never permanently give up. Mobile networks blip constantly
      // (screen lock, app background, Wi-Fi ↔ data handoff) — five
      // failures used to flip status to 'error' forever, which then
      // disabled the composer despite REST sends still working. Now
      // we just back off harder past the soft cap (60s ceiling after
      // 5 fast retries) and keep trying. The visibility-change
      // handler also force-reconnects on tab refocus, so users
      // recover the moment they're actively looking at the chat.
      if (reconnectStatusTimerRef.current) clearTimeout(reconnectStatusTimerRef.current);
      reconnectStatusTimerRef.current = setTimeout(() => {
        if (aliveRef.current && wsRef.current?.readyState !== 1) {
          setStatus('reconnecting');
        }
      }, 1500);

      const delay = backoffRef.current;
      // Fast cap for the first few attempts (1s → 2s → 4s → 8s),
      // then a long cap for prolonged outages (cap at 60s) so we
      // don't pound the server while the user is offline.
      const next = delay * 2;
      backoffRef.current = wsAttemptsRef.current >= MAX_WS_ATTEMPTS
        ? Math.min(60000, next)
        : Math.min(8000, next);
      reconnectTimerRef.current = setTimeout(() => {
        if (aliveRef.current) connectWs();
      }, delay);
    };
  }, [eventId, enabled, catchupAll, refreshChannel]);

  useEffect(() => {
    aliveRef.current = true;
    wsAttemptsRef.current = 0;
    backoffRef.current = 1000;
    bootstrap().then((ok) => {
      if (ok && aliveRef.current) connectWs();
    });
    return () => {
      aliveRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (reconnectStatusTimerRef.current) clearTimeout(reconnectStatusTimerRef.current);
      if (wsRef.current) { try { wsRef.current.close(); } catch { /* ignore */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, enabled]);

  // Re-catch-up whenever the tab becomes visible. A WS that's been idle
  // in a background tab can be killed by an intermediary without sending
  // a close frame — readyState still reads OPEN, but inbound traffic has
  // stopped. We can't reliably detect that; running a catch-up on tab
  // refocus is cheap (empty result when nothing's new) and closes the
  // gap that was causing "I have to close/reopen to see new messages."
  // If the WS has actually died we force a reconnect too.
  useEffect(() => {
    if (!eventId || !enabled) return;
    // Throttle: any combination of focus + visibilitychange events
    // firing within 5s should run at most once. Without this, clicking
    // around in the same window can trigger a refetch + WS reconnect
    // storm — especially if the server is rejecting upgrades (401/403),
    // every focus fires another doomed connect attempt.
    let lastRunAt = 0;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRunAt < 5000) return;
      lastRunAt = now;

      catchupAll();
      // Also re-sync the active channel's recent slice so reactions /
      // deletions / edits / pins that happened while the tab was in
      // the background show up. /catchup alone doesn't return those.
      if (activeIdRef.current) refreshChannel(activeIdRef.current);

      const ws = wsRef.current;
      const isDead = !ws || ws.readyState === WebSocket.CLOSED;
      // Force an immediate reconnect when the user comes back and
      // the WS is dead — reset the backoff so we don't make them
      // wait the full long-backoff interval. They're engaged again.
      if (isDead) {
        backoffRef.current = 1000;
        wsAttemptsRef.current = 0;
        connectWs();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [eventId, enabled, catchupAll, connectWs, refreshChannel]);

  // ── Persist to localStorage (debounced) — feeds the warm-paint on
  // the next time this user opens the chat. We only persist when we
  // have a real server-side `event` (after the network bootstrap
  // completes) so that a cache miss doesn't immediately write a half-
  // shape back.
  useEffect(() => {
    if (!eventId || !event) return;
    const handle = setTimeout(() => {
      lsWriteCache(eventId, {
        event,
        me,
        channels,
        activeId,
        messagesByCh,
      });
    }, 1000);
    return () => clearTimeout(handle);
  }, [eventId, event, me, channels, activeId, messagesByCh]);

  // ── Safety-net refresh — every 25s, refetch the active channel's
  // recent slice. This is the backstop for reactions / deletes / pins
  // that we missed via WS: a proxy buffer that swallows one frame, an
  // OS-level WS throttle in a partially-foregrounded tab, etc. The
  // page endpoint has `Cache-Control: private, max-age=10` + an ETag
  // derived from the newest message's updated_at, so a no-op refresh
  // hits the 304 fast path — no DB work on the server.
  // Skipped while the tab is hidden (no point burning cycles when the
  // user isn't watching).
  useEffect(() => {
    if (!eventId || !enabled) return;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const cid = activeIdRef.current;
      if (cid) refreshChannel(cid);
    }, 25_000);
    return () => clearInterval(id);
  }, [eventId, enabled, refreshChannel]);

  // ── Typing decay — sweep stale typers every 1.5s ─────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - 4000;
      setTypingByCh((t) => {
        const next = { ...t };
        let changed = false;
        for (const ch of Object.keys(next)) {
          const before = next[ch] || {};
          const after = {};
          for (const uid of Object.keys(before)) {
            if (before[uid] > cutoff) after[uid] = before[uid];
            else changed = true;
          }
          if (Object.keys(after).length === 0) { delete next[ch]; changed = true; }
          else next[ch] = after;
        }
        return changed ? next : t;
      });
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // ── Derived state for the active channel ─────────────────────────────
  const messages = useMemo(() => (activeId ? (messagesByCh[activeId] || []) : []), [activeId, messagesByCh]);
  const hasMore  = useMemo(() => (activeId ? (hasMoreByCh[activeId] ?? true) : false), [activeId, hasMoreByCh]);
  const pinned   = useMemo(() => (activeId ? (pinnedByCh[activeId] || []) : []), [activeId, pinnedByCh]);
  const typingUserIds = useMemo(() => {
    if (!activeId) return [];
    return Object.keys(typingByCh[activeId] || {}).filter((u) => !me || u !== me.id);
  }, [activeId, typingByCh, me]);

  // ── Operations ───────────────────────────────────────────────────────

  const loadOlder = useCallback(async (pageSize = CHAT_PAGE_SIZE) => {
    if (!activeId) return;
    const list = messagesByCh[activeId] || [];
    if (!list.length || hasMoreByCh[activeId] === false) return;
    const oldest = list[0];
    const r = await fetch(
      `${REST_BASE}/${eventId}/chat/channels/${activeId}/messages?before=${encodeURIComponent(oldest.created_at)}&pageSize=${pageSize}`,
      { credentials: 'include' },
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return;
    const older = j.messages || [];
    setMessagesByCh((m) => ({ ...m, [activeId]: [...older, ...list] }));
    if (older.length < pageSize) setHasMoreByCh((h) => ({ ...h, [activeId]: false }));
  }, [eventId, activeId, messagesByCh, hasMoreByCh]);

  // A4 — viewport-fill backfill. After the first paint of a channel
  // the canvas might still have empty space below the messages
  // because we only seeded 25 rows. Fire one silent backfill of up to
  // 25 more so the user has scroll history immediately available.
  const backfilledRef = useRef(new Set());
  useEffect(() => {
    if (!activeId) return;
    if (backfilledRef.current.has(activeId)) return;
    const list = messagesByCh[activeId];
    if (!list || list.length === 0) return;
    if (list.length >= 50) {
      backfilledRef.current.add(activeId);
      return;
    }
    backfilledRef.current.add(activeId);
    loadOlder(CHAT_BACKFILL_LIMIT);
  }, [activeId, messagesByCh, loadOlder]);

  const setChannel = useCallback(async (channelId) => {
    setActiveId(channelId);
    setChannels((cs) => cs.map((c) => c.id === channelId
      ? { ...c, unread_count: 0, last_read_at: new Date().toISOString() }
      : c));
    fetch(`${REST_BASE}/${eventId}/chat/channels/${channelId}/read`, {
      method: 'POST', credentials: 'include',
    }).catch(() => { /* best-effort */ });
    if (!messagesByCh[channelId]) {
      const r = await fetch(
        `${REST_BASE}/${eventId}/chat/channels/${channelId}/messages?pageSize=50`,
        { credentials: 'include' },
      );
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setMessagesByCh((m) => ({ ...m, [channelId]: j.messages || [] }));
        setHasMoreByCh((h) => ({ ...h, [channelId]: (j.messages || []).length >= 50 }));
        const msgs = j.messages || [];
        if (msgs.length > 0) lastSeenAtByCh.current[channelId] = msgs[msgs.length - 1].created_at;
      }
    } else {
      // Already have a cached page from bootstrap or a previous visit.
      // Re-sync in the background so any reactions / deletions / edits /
      // pins that happened while we were viewing another channel are
      // reflected. Cheap (one HTTP call, often a 304 thanks to the page
      // endpoint's ETag) and doesn't block the channel switch.
      refreshChannel(channelId);
    }
  }, [eventId, messagesByCh, refreshChannel]);

  // B1 — internal POST helper. Used by both the initial send and the
  // retry path. Bound retries to maxAttempts; backoff is 1s, 2s, 4s.
  // We resolve to { ok, message?, error? } so the caller can decide
  // how to surface failure (silently flip to "failed" vs. show toast).
  const postMessageOnce = useCallback(async (payload, ch) => {
    try {
      const r = await fetch(`${REST_BASE}/${eventId}/chat/channels/${ch}/messages`, {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, error: new Error(j.error || `HTTP ${r.status}`) };
      return { ok: true, message: j };
    } catch (e) {
      return { ok: false, error: e };
    }
  }, [eventId]);

  // Public send — synchronous-feeling. Returns IMMEDIATELY after the
  // optimistic bubble is queued; the actual POST + retry loop runs in
  // the background so the composer's draft can clear right away.
  //
  // Previously we `await`-ed the first POST attempt before returning,
  // which meant the textarea sat frozen until the server replied. On a
  // remote DB that's a 1-3s freeze — terrible UX. Now the user sees
  // their bubble + an empty composer in the next paint, and the server
  // round-trip happens off-thread.
  //
  // Background flow:
  //   1) POST attempt. On success, swap the pending row for the canonical
  //      one (matched by client_id).
  //   2) On failure, retry up to 3 times with backoff (the server uses
  //      client_id to make this idempotent — no double-posts).
  //   3) If all retries fail, flip the row to `failed` status so the UI
  //      can offer a Retry button. The user's text is preserved on the
  //      message itself so a retry can re-post without re-typing.
  const send = useCallback(({ body, parent_post_id = null, attachments = [], mention_user_ids = [] } = {}) => {
    if (!activeId) return null;
    const text = (body || '').trim();
    if (!text && attachments.length === 0) return null;

    const ch = activeId;
    const client_id = newClientId();
    const myId = meRef.current?.id ?? null;
    const myName = meRef.current?.name ?? '';
    const optimistic = {
      id: 'tmp_' + client_id,
      client_id,
      channel_id: ch,
      parent_post_id,
      body: text,
      attachments,
      mention_user_ids,
      pinned_at: null,
      edited_at: null,
      created_by: myId,
      author_name: myName,
      author_badge: null,
      created_at: new Date().toISOString(),
      reactions: [],
      reply_count: 0,
      status: 'pending',
    };
    setMessagesByCh((m) => ({ ...m, [ch]: [...(m[ch] || []), optimistic] }));

    // Background network worker — explicitly NOT awaited. The send()
    // caller already has its synchronous confirmation (the optimistic
    // bubble + a returned `client_id` for tracking).
    const payload = { body: text, parent_post_id, attachments, mention_user_ids, client_id };
    const backoff = [0, 1000, 2000, 4000];

    (async () => {
      let lastError = null;
      for (let attempt = 0; attempt < backoff.length; attempt += 1) {
        if (backoff[attempt] > 0) await new Promise((res) => setTimeout(res, backoff[attempt]));
        const res = await postMessageOnce(payload, ch);
        if (res.ok) {
          setMessagesByCh((m) => {
            const cur = m[ch] || [];
            const idx = cur.findIndex((x) => x.client_id === client_id);
            if (idx < 0) return m; // already swapped by WS echo
            const copy = cur.slice();
            copy[idx] = { ...cur[idx], ...res.message, status: undefined };
            return { ...m, [ch]: copy };
          });
          return;
        }
        lastError = res.error;
      }
      setMessagesByCh((m) => {
        const cur = m[ch] || [];
        const idx = cur.findIndex((x) => x.client_id === client_id);
        if (idx < 0) return m;
        const copy = cur.slice();
        copy[idx] = { ...cur[idx], status: 'failed', error_message: lastError?.message || 'Send failed' };
        return { ...m, [ch]: copy };
      });
    })();

    // Return a thin descriptor synchronously so the composer can clear
    // its draft + attachment list without awaiting the network.
    return { client_id };
  }, [activeId, postMessageOnce]);

  // Manual retry triggered from the bubble's "Retry" link. Re-POST with
  // the same client_id so the server treats it as idempotent.
  const retrySend = useCallback(async (messageClientId) => {
    let target = null;
    let ch = null;
    for (const [cid, list] of Object.entries(messagesByCh)) {
      const m = list.find((x) => x.client_id === messageClientId && x.status === 'failed');
      if (m) { target = m; ch = cid; break; }
    }
    if (!target || !ch) return null;
    // Flip back to pending so the UI un-dims.
    setMessagesByCh((m) => {
      const cur = m[ch] || [];
      const idx = cur.findIndex((x) => x.client_id === messageClientId);
      if (idx < 0) return m;
      const copy = cur.slice();
      copy[idx] = { ...cur[idx], status: 'pending', error_message: undefined };
      return { ...m, [ch]: copy };
    });
    const res = await postMessageOnce({
      body: target.body,
      parent_post_id: target.parent_post_id,
      attachments: target.attachments,
      mention_user_ids: target.mention_user_ids,
      client_id: messageClientId,
    }, ch);
    if (res.ok) {
      setMessagesByCh((m) => {
        const cur = m[ch] || [];
        const idx = cur.findIndex((x) => x.client_id === messageClientId);
        if (idx < 0) return m;
        const copy = cur.slice();
        copy[idx] = { ...cur[idx], ...res.message, status: undefined };
        return { ...m, [ch]: copy };
      });
      return res.message;
    }
    setMessagesByCh((m) => {
      const cur = m[ch] || [];
      const idx = cur.findIndex((x) => x.client_id === messageClientId);
      if (idx < 0) return m;
      const copy = cur.slice();
      copy[idx] = { ...cur[idx], status: 'failed', error_message: res.error?.message || 'Send failed' };
      return { ...m, [ch]: copy };
    });
    return null;
  }, [messagesByCh, postMessageOnce]);

  const editMessage = useCallback(async (messageId, body) => {
    const r = await fetch(`${REST_BASE}/${eventId}/chat/messages/${messageId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(new Error(j.error || `HTTP ${r.status}`));
      return false;
    }
    return true;
  }, [eventId]);

  const deleteMessage = useCallback(async (messageId) => {
    const r = await fetch(`${REST_BASE}/${eventId}/chat/messages/${messageId}`, {
      method: 'DELETE', credentials: 'include',
    });
    if (!r.ok) { setError(new Error(`HTTP ${r.status}`)); return false; }
    return true;
  }, [eventId]);

  // Applies an `add` / `remove` toggle for (messageId, emoji, userId) to
  // local state. Returns the action that was actually applied ('added' |
  // 'removed' | null if the message wasn't found). Idempotent: re-applying
  // an `add` for a user already in user_ids is a no-op.
  //
  // We extracted this so the optimistic toggle, rollback, and the WS
  // broadcast handler all share one set of merge rules — drift between
  // those was the kind of bug that made reactions "feel off."
  const applyReactionChange = useCallback((messageId, emoji, userId, action) => {
    let applied = null;
    setMessagesByCh((m) => {
      const next = { ...m };
      for (const [ch, list] of Object.entries(m)) {
        const idx = list.findIndex((x) => x.id === messageId);
        if (idx < 0) continue;
        const msg = list[idx];
        const reactions = Array.isArray(msg.reactions) ? [...msg.reactions] : [];
        const rIdx = reactions.findIndex((r) => r.emoji === emoji);
        if (action === 'add') {
          if (rIdx >= 0) {
            if (reactions[rIdx].user_ids.includes(userId)) {
              applied = null;
              return m; // no-op
            }
            const r = reactions[rIdx];
            reactions[rIdx] = { ...r, user_ids: [...r.user_ids, userId], count: r.count + 1 };
          } else {
            reactions.push({ emoji, user_ids: [userId], count: 1 });
          }
          applied = 'added';
        } else {
          if (rIdx < 0) { applied = null; return m; }
          if (!reactions[rIdx].user_ids.includes(userId)) { applied = null; return m; }
          const r = reactions[rIdx];
          const ui = r.user_ids.filter((u) => u !== userId);
          if (ui.length === 0) reactions.splice(rIdx, 1);
          else reactions[rIdx] = { ...r, user_ids: ui, count: ui.length };
          applied = 'removed';
        }
        const copy = list.slice();
        copy[idx] = { ...msg, reactions };
        next[ch] = copy;
        return next;
      }
      return m;
    });
    return applied;
  }, []);

  const toggleReaction = useCallback(async (messageId, emoji) => {
    const myId = meRef.current?.id;
    if (!myId) return;
    // tmp_* ids are optimistic-pending messages we haven't received a
    // canonical row for yet — server would 404 on the post lookup.
    if (typeof messageId === 'string' && messageId.startsWith('tmp_')) return;

    // Optimistic toggle in one functional update. We read the current
    // reactions array straight from the updater's `m` parameter, NOT
    // from a ref — refs can be stale by a tick, and a stale read flips
    // the prediction the wrong way. After this returns, the chip is
    // already on screen.
    setMessagesByCh((m) => {
      for (const ch of Object.keys(m)) {
        const list = m[ch];
        const idx = list.findIndex((x) => x.id === messageId);
        if (idx < 0) continue;
        const msg = list[idx];
        const reactions = Array.isArray(msg.reactions) ? msg.reactions.slice() : [];
        const rIdx = reactions.findIndex((r) => r.emoji === emoji);
        if (rIdx >= 0) {
          const r = reactions[rIdx];
          if (r.user_ids.includes(myId)) {
            // Toggle off.
            const ui = r.user_ids.filter((u) => u !== myId);
            if (ui.length === 0) reactions.splice(rIdx, 1);
            else reactions[rIdx] = { ...r, user_ids: ui, count: ui.length };
          } else {
            // Add my id to existing pill.
            reactions[rIdx] = { ...r, user_ids: [...r.user_ids, myId], count: r.count + 1 };
          }
        } else {
          // Create new pill.
          reactions.push({ emoji, user_ids: [myId], count: 1 });
        }
        const newList = list.slice();
        newList[idx] = { ...msg, reactions };
        return { ...m, [ch]: newList };
      }
      return m;
    });

    // Send to server. The WS broadcast (idempotent via applyReactionChange)
    // will confirm; if it's missed, the 25s periodic refresh corrects it.
    // Failures are silent — periodic refresh is also the rollback path.
    try {
      await fetch(`${REST_BASE}/${eventId}/chat/messages/${messageId}/reactions`, {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
    } catch { /* periodic refresh will reconcile */ }
  }, [eventId]);

  const togglePin = useCallback(async (messageId, currentlyPinned) => {
    if (typeof messageId === 'string' && messageId.startsWith('tmp_')) return;
    const newPinnedAt = currentlyPinned ? null : new Date().toISOString();
    // Optimistic flip so the pin icon updates instantly. WS broadcast
    // arriving later sets pinned_at to the canonical server timestamp —
    // visually identical to what we wrote optimistically.
    setMessagesByCh((m) => {
      const next = { ...m };
      for (const [ch, list] of Object.entries(m)) {
        const idx = list.findIndex((x) => x.id === messageId);
        if (idx < 0) continue;
        const copy = list.slice();
        copy[idx] = { ...copy[idx], pinned_at: newPinnedAt };
        next[ch] = copy;
        return next;
      }
      return m;
    });
    try {
      const r = await fetch(`${REST_BASE}/${eventId}/chat/messages/${messageId}/${currentlyPinned ? 'unpin' : 'pin'}`, {
        method: 'POST', credentials: 'include',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch {
      // Rollback to the prior state.
      setMessagesByCh((m) => {
        const next = { ...m };
        for (const [ch, list] of Object.entries(m)) {
          const idx = list.findIndex((x) => x.id === messageId);
          if (idx < 0) continue;
          const copy = list.slice();
          copy[idx] = { ...copy[idx], pinned_at: currentlyPinned ? new Date().toISOString() : null };
          next[ch] = copy;
          return next;
        }
        return m;
      });
    }
  }, [eventId]);

  const loadPinned = useCallback(async (channelId) => {
    if (!channelId) return;
    const r = await fetch(`${REST_BASE}/${eventId}/chat/channels/${channelId}/pinned`, { credentials: 'include' });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setPinnedByCh((p) => ({ ...p, [channelId]: j.messages || [] }));
  }, [eventId]);

  const searchInActive = useCallback(async (q) => {
    if (!activeId || !q) return [];
    const r = await fetch(
      `${REST_BASE}/${eventId}/chat/channels/${activeId}/search?q=${encodeURIComponent(q)}`,
      { credentials: 'include' },
    );
    const j = await r.json().catch(() => ({}));
    return r.ok ? (j.messages || []) : [];
  }, [eventId, activeId]);

  const searchParticipants = useCallback(async (q) => {
    const r = await fetch(
      `${REST_BASE}/${eventId}/chat/participants${q ? `?q=${encodeURIComponent(q)}` : ''}`,
      { credentials: 'include' },
    );
    const j = await r.json().catch(() => ({}));
    return r.ok ? (j.rows || []) : [];
  }, [eventId]);

  const uploadAttachment = useCallback(async (file) => {
    if (!file) return null;
    const b64 = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload  = () => resolve(String(fr.result).replace(/^data:[^;]+;base64,/, ''));
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
    const r = await fetch(`${REST_BASE}/${eventId}/chat/upload`, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: file.name, mime_type: file.type, data_base64: b64 }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(new Error(j.error || `HTTP ${r.status}`)); return null; }
    return j;
  }, [eventId]);

  // Throttled typing emit — fires at most once per 1.5s.
  const lastTypingSentRef = useRef(0);
  const emitTyping = useCallback(() => {
    if (!activeId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify({ type: 'typing', channel_id: activeId })); }
      catch { /* ignore */ }
    }
  }, [activeId]);

  // ── Moderation + extras ─────────────────────────────────────────────
  const loadRoster = useCallback(async () => {
    const r = await fetch(`${REST_BASE}/${eventId}/chat/roster`, { credentials: 'include' });
    const j = await r.json().catch(() => ({}));
    return r.ok ? (j.members || []) : [];
  }, [eventId]);

  const reportMessage = useCallback(async (messageId, reason) => {
    const r = await fetch(`${REST_BASE}/${eventId}/chat/messages/${messageId}/report`, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(new Error(j.error || `HTTP ${r.status}`)); return false; }
    return true;
  }, [eventId]);

  const muteUser = useCallback(async ({ user_id, channel_id = null, minutes = null, reason = null }) => {
    const r = await fetch(`${REST_BASE}/${eventId}/chat/mutes`, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id, channel_id, minutes, reason }),
    });
    return r.ok;
  }, [eventId]);

  const freezeChannel = useCallback(async (channelId, freeze) => {
    const r = await fetch(`${REST_BASE}/${eventId}/chat/channels/${channelId}/${freeze ? 'freeze' : 'unfreeze'}`, {
      method: 'POST', credentials: 'include',
    });
    if (r.ok) setChannels((cs) => cs.map((c) => c.id === channelId ? { ...c, frozen: freeze } : c));
    return r.ok;
  }, [eventId]);

  const archiveChannel = useCallback(async (channelId) => {
    const r = await fetch(`${REST_BASE}/${eventId}/chat/channels/${channelId}/archive`, {
      method: 'POST', credentials: 'include',
    });
    if (r.ok) setChannels((cs) => cs.map((c) => c.id === channelId ? { ...c, archived_at: new Date().toISOString() } : c));
    return r.ok;
  }, [eventId]);

  return {
    event, me,
    channels, activeChannelId: activeId, setChannel,
    messages, pinned, hasMore,
    typingUserIds, onlineCount,
    status, error,
    // operations
    send, retrySend, editMessage, deleteMessage, toggleReaction, togglePin,
    loadOlder, loadPinned,
    searchInActive, searchParticipants, uploadAttachment, emitTyping,
    // moderation + extras
    loadRoster, reportMessage, muteUser, freezeChannel, archiveChannel,
  };
}
