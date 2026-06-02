import { useEffect, useMemo, useRef, useState } from 'react';
import { useEventChat } from '../../hooks/useEventChat';
import { IconArrowLeft, IconArrowRight } from '../../icons';

// Full-screen WhatsApp-style overlay for an event chat.
//
// Layout:
//   ┌─────────────────────────────────────────────────────────┐
//   │ ← header: avatar · event title · "N participants"  ⋮    │
//   ├─────────────────────────────────────────────────────────┤
//   │  ┌── Mon, 12 Jun ──┐                                    │
//   │  │ Aanya  ●        │                                    │
//   │  │ Welcome everyone│                                    │
//   │  │            10:24│                                    │
//   │  ├─────────────────┤                                    │
//   │                          ┌── you ───┐                   │
//   │                          │ Thanks!  │                   │
//   │                          │     10:25│                   │
//   │                          └──────────┘                   │
//   ├─────────────────────────────────────────────────────────┤
//   │  [Type a message...........]                  [➤ send]  │
//   └─────────────────────────────────────────────────────────┘

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// "Today" / "Yesterday" / "Mon, 12 Jun" / "12 Jun 2026" — Whatsapp-ish.
function fmtDay(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString())  return 'Yesterday';
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString('en-IN', sameYear
    ? { weekday: 'short', day: '2-digit', month: 'short' }
    : { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

// Stable colour per author. Picks from the same chart palette the chairman
// dashboard uses so received-message avatars share visual DNA with the
// portal's data-vis pills, donuts, and committee bars.
const AUTHOR_TINTS = [
  '#3622FF', // primary navy
  '#16A34A', // secondary green
  '#0891B2', // teal
  '#F59E0B', // amber
  '#7C3AED', // violet
  '#E11D48', // coral
  '#0EA5E9', // sky
  '#65A30D', // lime
];
function authorTint(id) {
  if (!id) return AUTHOR_TINTS[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AUTHOR_TINTS[h % AUTHOR_TINTS.length];
}

// Group consecutive messages by day so the UI can drop a date divider once
// per day instead of once per message.
function groupByDay(messages) {
  const out = [];
  let lastKey = null;
  for (const m of messages) {
    const key = new Date(m.created_at).toDateString();
    if (key !== lastKey) {
      out.push({ kind: 'day', key, iso: m.created_at });
      lastKey = key;
    }
    out.push({ kind: 'msg', ...m });
  }
  return out;
}

export default function EventChat({ event, onClose }) {
  const eventId = event?.id;
  const {
    event: meta, me, messages, onlineCount,
    status, error, hasMore,
    send, loadOlder,
  } = useEventChat(eventId, { enabled: !!eventId });

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  // Side-panel by default; user can expand to full-screen via the toolbar
  // button. Closing the chat resets this — next open always starts as a panel.
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Esc closes. We only lock body scroll in full-screen mode so the page
  // behind a side-panel chat stays interactive.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!isFullScreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isFullScreen]);

  // Auto-scroll to the bottom whenever new messages arrive AND we're already
  // near the bottom (so we don't yank the user away when they're scrolling
  // up to read history).
  const scrollerRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    const newest = last?.id;
    if (newest === lastMessageIdRef.current) return;

    const wasNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    const wasFirstLoad = lastMessageIdRef.current === null;
    if (wasNearBottom || wasFirstLoad) {
      // requestAnimationFrame so layout settles before we measure scrollHeight.
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
    lastMessageIdRef.current = newest;
  }, [messages]);

  // Load older messages when the user scrolls within ~80px of the top.
  function onScroll(e) {
    if (!hasMore) return;
    if (e.currentTarget.scrollTop < 80) {
      // Anchor the scroll position so loading older items doesn't yank.
      const el = e.currentTarget;
      const prevHeight = el.scrollHeight;
      loadOlder().then(() => {
        requestAnimationFrame(() => {
          const newHeight = el.scrollHeight;
          el.scrollTop = newHeight - prevHeight;
        });
      });
    }
  }

  async function onSend(e) {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const sent = await send(text);
      if (sent) setDraft('');
    } finally {
      setSending(false);
    }
  }

  function onComposerKey(e) {
    // Enter to send, Shift+Enter for newline (a standard WhatsApp web behaviour).
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  const grouped = useMemo(() => groupByDay(messages), [messages]);
  const registeredCount = meta?.registered_count ?? event?.registered_count;

  return (
    <div
      className={`ec-root ${isFullScreen ? 'is-fullscreen' : 'is-panel'}`}
      role="dialog"
      aria-modal={isFullScreen ? 'true' : 'false'}
      aria-label="Event chat"
    >
      <ChatStyles />

      <header className="ec-header">
        <button className="ec-back" onClick={onClose} aria-label="Close chat">
          <IconArrowLeft size="sm" />
        </button>
        <div
          className="ec-header-avatar"
          aria-hidden="true"
          style={{ background: authorTint(eventId || 'event') }}
        >
          {initials(meta?.title || event?.title || 'Event')}
        </div>
        <div className="ec-header-title">
          <div className="ec-header-name">{meta?.title || event?.title || 'Event chat'}</div>
          <div className="ec-header-sub">
            {typeof registeredCount === 'number' && (
              <span>{registeredCount.toLocaleString('en-IN')} participants</span>
            )}
            {onlineCount > 0 && (
              <span className="ec-online-pill">{onlineCount} online</span>
            )}
            {status === 'reconnecting' && (
              <span className="ec-status-pill">reconnecting…</span>
            )}
          </div>
        </div>
        <button
          className="ec-icon-btn"
          onClick={() => setIsFullScreen((v) => !v)}
          aria-label={isFullScreen ? 'Shrink to side panel' : 'Expand to full screen'}
          title={isFullScreen ? 'Shrink to side panel' : 'Expand to full screen'}
        >
          {isFullScreen ? <CollapseIcon /> : <ExpandIcon />}
        </button>
        <button className="ec-icon-btn" aria-label="More options" title="More options">⋮</button>
      </header>

      <div className="ec-canvas" ref={scrollerRef} onScroll={onScroll}>
        {status === 'loading' && messages.length === 0 && (
          <div className="ec-empty">Loading conversation…</div>
        )}

        {status === 'forbidden' && (
          <div className="ec-empty">
            <strong>Locked.</strong>
            <span>Only registered attendees can view this chat.</span>
          </div>
        )}

        {status === 'error' && (
          <div className="ec-empty">
            <strong>Something went wrong.</strong>
            <span>{error?.message || 'Please close and re-open the chat.'}</span>
          </div>
        )}

        {status !== 'loading' && status !== 'forbidden' && status !== 'error' && messages.length === 0 && (
          <div className="ec-empty">
            <strong>You're in! 🎉</strong>
            <span>Say hi to the others registered for this event.</span>
          </div>
        )}

        <div className="ec-day-track">
          {grouped.map((item, i) => {
            if (item.kind === 'day') {
              return (
                <div key={`day-${item.key}`} className="ec-day-divider">
                  <span>{fmtDay(item.iso)}</span>
                </div>
              );
            }
            const mine = me && item.created_by === me.id;
            const prev = grouped[i - 1];
            const showAuthor = !mine && (!prev || prev.kind !== 'msg' || prev.created_by !== item.created_by);
            return (
              <MessageBubble
                key={item.id}
                message={item}
                mine={mine}
                showAuthor={showAuthor}
              />
            );
          })}
        </div>
      </div>

      <form className="ec-composer" onSubmit={onSend}>
        <textarea
          className="ec-composer-input"
          placeholder="Type a message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onComposerKey}
          rows={1}
          disabled={status === 'forbidden' || status === 'error'}
        />
        <button
          type="submit"
          className="ec-composer-send"
          disabled={!draft.trim() || sending || status === 'forbidden' || status === 'error'}
          aria-label="Send message"
        >
          <IconArrowRight size="sm" />
        </button>
      </form>
    </div>
  );
}

// Inline SVGs for the panel/full-screen toggle. Match the stroke + line
// caps used by the rest of the icons in icons/index.jsx.
function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h6v6M14 10l7-7M9 21H3v-6M10 14l-7 7" />
    </svg>
  );
}
function CollapseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
    </svg>
  );
}

function MessageBubble({ message, mine, showAuthor }) {
  const tint = authorTint(message.created_by);
  return (
    <div className={`ec-row ${mine ? 'is-mine' : 'is-theirs'}`}>
      {!mine && showAuthor && (
        <span className="ec-row-avatar" style={{ background: tint }} aria-hidden="true">
          {initials(message.author_name)}
        </span>
      )}
      {!mine && !showAuthor && <span className="ec-row-avatar-spacer" aria-hidden="true" />}

      <div className={`ec-bubble ${mine ? 'is-mine' : 'is-theirs'}`}>
        {!mine && showAuthor && (
          <div className="ec-bubble-author" style={{ color: tint }}>{message.author_name}</div>
        )}
        <div className="ec-bubble-body">{message.body}</div>
        <div className="ec-bubble-time">{fmtTime(message.created_at)}</div>
      </div>
    </div>
  );
}

// ─── styles (scoped via class prefix) ─────────────────────────────────────
// Re-themed to match the ICAI portal:
//   • Navy (var(--primary) ≈ #3622FF) for the brand accent — same gradient
//     used by the "CA" logo on the chairman dashboard and the Reset Filters
//     button on the branch insights page.
//   • Light card surfaces (var(--card), var(--background)) with the site's
//     subtle 1px border + low-elevation shadow vocabulary.
//   • No WhatsApp beige, no WhatsApp green. The receiver bubbles are plain
//     white cards; the sender bubble is the navy primary gradient.
function ChatStyles() {
  return (
    <style>{`
      .ec-root {
        position: fixed; top: 0; bottom: 0; left: 0;
        z-index: 200;
        background: var(--background);
        display: flex; flex-direction: column;
        color: var(--foreground);
        font-family: inherit;
        /* Width transition powers the panel ↔ full-screen toggle. */
        transition: width .35s cubic-bezier(.32, .72, 0, 1);
        will-change: transform, width;
      }

      /* Side panel (default) — slides in from the left, no backdrop. */
      .ec-root.is-panel {
        width: min(420px, 100vw);
        border-right: 1px solid var(--border);
        box-shadow: 12px 0 32px -16px oklch(0.36 0.13 255 / .25);
        animation: ecSlideInLeft .32s cubic-bezier(.32, .72, 0, 1);
      }
      .ec-root.is-fullscreen {
        width: 100vw;
        box-shadow: none;
        animation: ecFadeIn .2s ease-out;
      }
      @keyframes ecSlideInLeft {
        from { transform: translateX(-100%); opacity: .85; }
        to   { transform: translateX(0);     opacity: 1; }
      }
      @keyframes ecFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @media (max-width: 520px) {
        .ec-root.is-panel { width: 100vw; box-shadow: none; border-right: 0; }
      }

      /* ── Header ── frosted white bar, foreground text, navy avatar tile */
      .ec-header {
        height: 64px; flex: 0 0 64px;
        display: flex; align-items: center; gap: .65rem;
        padding: 0 .75rem;
        background: rgba(255,255,255,.85);
        backdrop-filter: blur(14px) saturate(140%);
        -webkit-backdrop-filter: blur(14px) saturate(140%);
        border-bottom: 1px solid var(--border);
        color: var(--foreground);
      }
      .ec-back, .ec-icon-btn {
        display: grid; place-items: center;
        width: 34px; height: 34px; border-radius: 9px;
        background: transparent; border: 0;
        color: var(--muted-foreground); cursor: pointer;
        transition: background .15s, color .15s;
        flex-shrink: 0;
      }
      .ec-back:hover, .ec-icon-btn:hover {
        background: oklch(0.36 0.13 255 / .08);
        color: var(--primary);
      }
      .ec-icon-btn:last-child { font-size: 1.2rem; line-height: 1; }
      .ec-header-avatar {
        width: 40px; height: 40px; border-radius: 10px;
        display: grid; place-items: center;
        color: white; font-weight: 700; font-size: .8125rem;
        letter-spacing: -.02em;
        flex-shrink: 0;
        background: linear-gradient(135deg, var(--primary), oklch(0.30 0.13 255));
        box-shadow: 0 4px 12px -2px oklch(0.36 0.13 255 / .45);
      }
      .ec-header-title { flex: 1; min-width: 0; line-height: 1.2; }
      .ec-header-name {
        font-size: 15px; font-weight: 700; letter-spacing: -.005em;
        color: var(--foreground);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .ec-header-sub {
        font-size: 12px; color: var(--muted-foreground); margin-top: .15rem;
        display: flex; align-items: center; gap: .4rem;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      /* Sub-pill style for "X online" — matches the live indicator on the
         branch dashboard. */
      .ec-online-pill {
        display: inline-flex; align-items: center; gap: .3rem;
        padding: .1rem .45rem; border-radius: 999px;
        background: oklch(0.50 0.16 145 / .10);
        color: oklch(0.42 0.14 145);
        font-size: 10px; font-weight: 600;
        border: 1px solid oklch(0.50 0.16 145 / .20);
      }
      .ec-online-pill::before {
        content: ''; width: 6px; height: 6px; border-radius: 999px;
        background: oklch(0.50 0.16 145);
      }
      .ec-status-pill {
        display: inline-flex; align-items: center;
        padding: .1rem .45rem; border-radius: 999px;
        background: oklch(0.78 0.15 75 / .15);
        color: oklch(0.45 0.12 75);
        font-size: 10px; font-weight: 600;
        border: 1px solid oklch(0.78 0.15 75 / .25);
      }

      /* ── Canvas ── light background with a barely-there navy wash at the
         top so messages "rise" from the brand colour. */
      .ec-canvas {
        flex: 1; min-height: 0;
        overflow-y: auto; overflow-x: hidden;
        padding: 1.25rem .9rem 1.5rem;
        background:
          radial-gradient(900px 360px at 50% -10%, oklch(0.36 0.13 255 / .04), transparent 60%),
          var(--background);
      }
      .ec-day-track {
        max-width: 880px; margin: 0 auto;
        display: flex; flex-direction: column; gap: .25rem;
      }

      /* Day divider chip — eyebrow style from the chairman dashboard. */
      .ec-day-divider {
        display: flex; justify-content: center;
        margin: 1rem 0 .75rem;
      }
      .ec-day-divider span {
        font-size: 10px; font-weight: 700;
        text-transform: uppercase; letter-spacing: .07em;
        padding: .25rem .65rem; border-radius: 999px;
        background: oklch(0.36 0.13 255 / .08);
        color: var(--primary);
        font-variant-numeric: tabular-nums;
      }

      .ec-empty {
        max-width: 360px; margin: 3rem auto;
        background: var(--card);
        border: 1px dashed var(--border);
        border-radius: 14px;
        padding: 1.25rem 1.4rem; text-align: center;
        display: flex; flex-direction: column; gap: .35rem;
        font-size: 13px; color: var(--muted-foreground);
      }
      .ec-empty strong {
        font-size: 14px; color: var(--foreground); font-weight: 700;
      }

      /* ── Rows ── */
      .ec-row {
        display: flex; align-items: flex-end; gap: .5rem;
        margin: .15rem 0;
      }
      .ec-row.is-theirs { justify-content: flex-start; }
      .ec-row.is-mine   { justify-content: flex-end; }

      .ec-row-avatar, .ec-row-avatar-spacer {
        width: 30px; height: 30px; border-radius: 9px;
        flex-shrink: 0;
      }
      .ec-row-avatar {
        display: grid; place-items: center;
        color: white; font-weight: 700; font-size: 10px;
        letter-spacing: -.01em;
      }
      .ec-row-avatar-spacer { background: transparent; }

      /* ── Bubbles ──
         Theirs = white card with site border, foreground text.
         Mine   = navy primary gradient with white text. Both reuse the
                  14px card radius the rest of the site uses, with one
                  corner squared to point back at the author. */
      .ec-bubble {
        position: relative;
        max-width: min(74%, 540px);
        padding: .55rem .75rem .375rem;
        border-radius: 14px;
        font-size: 14px;
        line-height: 1.45;
      }
      .ec-bubble.is-theirs {
        background: var(--card);
        color: var(--foreground);
        border: 1px solid var(--border);
        border-top-left-radius: 4px;
        box-shadow: 0 1px 2px rgba(15,23,42,.04);
      }
      .ec-bubble.is-mine {
        background: linear-gradient(135deg, var(--primary), oklch(0.30 0.13 255));
        color: white;
        border-top-right-radius: 4px;
        box-shadow: 0 4px 14px -6px oklch(0.36 0.13 255 / .45);
      }

      .ec-bubble-author {
        font-size: 11px; font-weight: 700;
        margin-bottom: .15rem;
        letter-spacing: -.005em;
      }
      .ec-bubble-body {
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow-wrap: anywhere;
        padding-right: 58px; /* leave room for the timestamp */
      }
      .ec-bubble-time {
        position: absolute; right: .65rem; bottom: .3rem;
        font-size: 10px;
        font-variant-numeric: tabular-nums;
        opacity: .75;
      }
      .ec-bubble.is-theirs .ec-bubble-time { color: var(--muted-foreground); }
      .ec-bubble.is-mine   .ec-bubble-time { color: rgba(255,255,255,.85); }

      /* ── Composer ── matches the site's .input-base styling */
      .ec-composer {
        flex: 0 0 auto;
        display: flex; align-items: flex-end; gap: .5rem;
        padding: .75rem .9rem .9rem;
        background: var(--card);
        border-top: 1px solid var(--border);
      }
      .ec-composer-input {
        flex: 1; min-height: 40px; max-height: 140px;
        padding: .55rem .85rem;
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: 10px;
        font: inherit;
        font-size: 14px;
        color: var(--foreground);
        resize: none; outline: 0;
        transition: border-color .15s, box-shadow .15s;
      }
      .ec-composer-input:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px oklch(0.36 0.13 255 / .12);
      }
      .ec-composer-input::placeholder { color: var(--muted-foreground); }
      .ec-composer-send {
        flex: 0 0 40px;
        display: grid; place-items: center;
        width: 40px; height: 40px; border-radius: 10px;
        background: linear-gradient(135deg, var(--primary), oklch(0.30 0.13 255));
        color: white;
        border: 0; cursor: pointer;
        box-shadow: 0 6px 16px -8px oklch(0.36 0.13 255 / .55);
        transition: transform .15s, box-shadow .15s, filter .15s;
      }
      .ec-composer-send:hover:not(:disabled) {
        transform: translateY(-1px);
        filter: brightness(1.06);
        box-shadow: 0 8px 22px -8px oklch(0.36 0.13 255 / .55);
      }
      .ec-composer-send:disabled {
        opacity: .4; cursor: not-allowed;
        transform: none; box-shadow: none; filter: none;
      }

      /* Phones: slightly tighter and full-width bubbles. */
      @media (max-width: 640px) {
        .ec-canvas { padding: .85rem .65rem 1.1rem; }
        .ec-bubble { max-width: 84%; font-size: 14.5px; }
      }
    `}</style>
  );
}
