import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useEventChat } from '../../hooks/useEventChat';
import {
  IconArrowLeft, IconArrowRight, IconSearch, IconPlus, IconX,
  IconDownload, IconCheckCircle, IconFileText, IconTrash,
  IconUsers, IconShield,
} from '../../icons';

// Discord-style event chat. Channels in a left rail, message canvas in the
// middle, composer at the bottom. Built around the useEventChat hook which
// handles the REST + WebSocket plumbing.
//
// Major features mounted here (Phase 1 + 2 of the revamp):
//   • channel sidebar with unread badges (#general / Q&A / announcements)
//   • markdown body rendering (bold, italic, inline + block code, links,
//     mentions)
//   • emoji reactions (toggle, count, mine-state)
//   • replies (preview parent in composer + above the message)
//   • edit + delete own messages (admins can do others' too — server gate)
//   • pinned messages strip at the top of each channel
//   • typing indicator
//   • search bar (channel-scoped)
//   • @mention autocomplete over event registrants
//   • attachment composer with file picker + image-paste from clipboard
//
// We deliberately don't try to look pixel-perfect Discord — the visual
// language stays in the ICAI portal's navy/green vocabulary so it doesn't
// jar against the rest of the site.

const COMMON_EMOJIS = ['👍', '❤️', '😄', '🎉', '🤔', '😢', '👏', '🙏'];

const TIME_FMT = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : TIME_FMT.format(d);
}
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
const AUTHOR_TINTS = ['#3622FF', '#16A34A', '#0891B2', '#F59E0B', '#7C3AED', '#E11D48', '#0EA5E9', '#65A30D'];
function authorTint(id) {
  if (!id) return AUTHOR_TINTS[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AUTHOR_TINTS[h % AUTHOR_TINTS.length];
}

// ─── Markdown renderer (chat-tuned) ─────────────────────────────────────
// Handles inline `code`, ```fenced code blocks```, **bold**, *italic*,
// [link](url), auto-link bare URLs, and @mentions of the shape
// @[Name](user-id). Returns React nodes (no dangerouslySetInnerHTML).
function ChatMarkdown({ text }) {
  if (!text) return null;
  const parts = [];
  let key = 0;

  // Split on fenced code blocks first so we don't try to format inside them.
  const fenced = text.split(/```([\s\S]*?)```/);
  for (let f = 0; f < fenced.length; f += 1) {
    const segment = fenced[f];
    if (f % 2 === 1) {
      parts.push(<pre key={`pre-${key++}`} className="cm-code-block"><code>{segment}</code></pre>);
      continue;
    }
    // Inside a regular segment: split by lines and render each with inline parser.
    const lines = segment.split(/\n/);
    for (let li = 0; li < lines.length; li += 1) {
      if (li > 0) parts.push(<br key={`br-${key++}`} />);
      parts.push(...renderInline(lines[li], `inl-${f}-${li}`));
    }
  }
  return <>{parts}</>;
}

function renderInline(text, keyPrefix) {
  const out = [];
  let buf = '';
  let n = 0;
  const flushBuf = () => {
    if (!buf) return;
    // Auto-link bare URLs inside plain buffer text.
    const re = /https?:\/\/[^\s)]+/g;
    let lastIndex = 0;
    let m;
    while ((m = re.exec(buf)) !== null) {
      if (m.index > lastIndex) out.push(<Fragment key={`${keyPrefix}-t-${n++}`}>{buf.slice(lastIndex, m.index)}</Fragment>);
      out.push(<a key={`${keyPrefix}-u-${n++}`} href={m[0]} target="_blank" rel="noopener noreferrer" className="cm-link">{m[0]}</a>);
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < buf.length) out.push(<Fragment key={`${keyPrefix}-t-${n++}`}>{buf.slice(lastIndex)}</Fragment>);
    buf = '';
  };
  const push = (node) => { flushBuf(); out.push(<Fragment key={`${keyPrefix}-x-${n++}`}>{node}</Fragment>); };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    // Legacy: @[Name](user_id) → mention chip. Older messages stored
    // before the plain-text mention rewrite used this encoded form;
    // keep the parser so they still render nicely.
    if (ch === '@' && text[i + 1] === '[') {
      const closeBracket = text.indexOf(']', i + 2);
      if (closeBracket > 0 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen > 0) {
          const name = text.slice(i + 2, closeBracket);
          push(<span className="cm-mention" title={`@${name}`}>@{name}</span>);
          i = closeParen + 1;
          continue;
        }
      }
    }

    // New: plain-text "@Name" — match runs of word characters + spaces
    // until punctuation, whitespace, or end. We only style it as a
    // mention when the @ is at the start of input or after whitespace
    // (so "you@example.com" doesn't get styled).
    if (ch === '@' && (i === 0 || /\s/.test(text[i - 1]))) {
      // Grab the longest plausible name run: letters/digits/spaces/hyphens/dots,
      // stop at any other punctuation or end. Trim trailing whitespace.
      const tail = text.slice(i + 1);
      const m = tail.match(/^([A-Za-z][\w .'-]*?)(?=$|[,.!?;:()\n]|\s\s|@)/);
      if (m && m[1]) {
        const name = m[1].trimEnd();
        if (name.length > 0) {
          push(<span className="cm-mention" title={`@${name}`}>@{name}</span>);
          i += 1 + name.length;
          continue;
        }
      }
    }

    // [text](url)
    if (ch === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket > 0 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen > 0) {
          const label = text.slice(i + 1, closeBracket);
          const url = text.slice(closeBracket + 2, closeParen);
          push(<a href={/^(https?:|mailto:|tel:)/i.test(url) ? url : '#'} target="_blank" rel="noopener noreferrer" className="cm-link">{label}</a>);
          i = closeParen + 1;
          continue;
        }
      }
    }

    // **bold**
    if (ch === '*' && text[i + 1] === '*') {
      const close = text.indexOf('**', i + 2);
      if (close > 0) {
        push(<strong>{renderInline(text.slice(i + 2, close), `${keyPrefix}-b${n}`)}</strong>);
        i = close + 2;
        continue;
      }
    }

    // *italic*
    if (ch === '*') {
      const close = text.indexOf('*', i + 1);
      if (close > 0 && close > i + 1) {
        push(<em>{renderInline(text.slice(i + 1, close), `${keyPrefix}-i${n}`)}</em>);
        i = close + 1;
        continue;
      }
    }

    // `inline code`
    if (ch === '`') {
      const close = text.indexOf('`', i + 1);
      if (close > 0) {
        push(<code className="cm-code-inline">{text.slice(i + 1, close)}</code>);
        i = close + 1;
        continue;
      }
    }

    buf += ch;
    i += 1;
  }
  flushBuf();
  return out;
}

// Group consecutive messages by day for the date divider rail.
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

// Channel icon prefix — discord uses # for text channels; we keep that
// convention since it tells the user instantly "this is a text channel."
function channelGlyph(kind) {
  if (kind === 'qa') return '?';
  if (kind === 'announcements') return '📣';
  return '#';
}

// ─── Root component ─────────────────────────────────────────────────────
export default function EventChat({ event, onClose }) {
  const eventId = event?.id;
  const chat = useEventChat(eventId, { enabled: !!eventId });
  const {
    event: meta, me, channels, activeChannelId, setChannel,
    messages, pinned, hasMore, typingUserIds, onlineCount,
    status, error,
    send, retrySend, deleteMessage, toggleReaction, togglePin,
    loadOlder, loadPinned, searchInActive, searchParticipants, uploadAttachment, emitTyping,
    loadRoster, reportMessage,
  } = chat;

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId),
    [channels, activeChannelId],
  );

  // Layout state
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Replying state
  const [replyTo, setReplyTo] = useState(null);   // { id, body, author_name } | null

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Member-roster sidebar (right rail) state.
  const [rosterOpen, setRosterOpen] = useState(false);
  const [roster, setRoster] = useState([]);

  // Tracks the "first unread message id" for the active channel so we can
  // draw a divider where the user last left off. Captured ONCE on channel
  // switch using the channel's `last_read_at`; not recomputed after that
  // so the line stays put as new messages arrive.
  const [unreadAnchor, setUnreadAnchor] = useState(null);

  // Jump-to-bottom button visibility — only show when the user has
  // scrolled far enough up to be missing live messages.
  const [showJumpBtn, setShowJumpBtn] = useState(false);
  const [pendingNewCount, setPendingNewCount] = useState(0);

  // Drag-drop overlay visibility.
  const [dragOver, setDragOver] = useState(false);

  // Esc closes
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Click-outside-to-close (panel mode only). In full-screen mode the
  // chat fills the viewport so there's nothing to click outside of.
  // We use a ref on the root container and listen on the document so
  // ANY click whose target isn't inside the chat closes the panel.
  // mousedown rather than click — so the panel closes on the first
  // press, not after a drag-select that might originate inside.
  const rootRef = useRef(null);
  useEffect(() => {
    if (isFullScreen) return;
    const onDown = (e) => {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(e.target)) return;
      onClose?.();
    };
    // Use capture so we catch the click before any in-page handler
    // (e.g. the EventRow accordion's own click).
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [isFullScreen, onClose]);
  useEffect(() => {
    if (!isFullScreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isFullScreen]);

  // Auto-scroll to bottom on new messages if we were already near bottom.
  const scrollerRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    const newest = last?.id;
    if (newest === lastMessageIdRef.current) return;
    const wasNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    const wasFirstLoad = lastMessageIdRef.current === null;
    if (wasNearBottom || wasFirstLoad) {
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    }
    lastMessageIdRef.current = newest;
  }, [messages]);

  // Load older when scrolling near the top + show jump-to-bottom button
  // when we've drifted up far enough that incoming live messages would
  // otherwise be invisible.
  function onScroll(e) {
    const el = e.currentTarget;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJumpBtn(distFromBottom > 240);
    if (distFromBottom <= 240) setPendingNewCount(0);
    if (hasMore && el.scrollTop < 80) {
      const prevHeight = el.scrollHeight;
      loadOlder().then(() => {
        requestAnimationFrame(() => {
          const newHeight = el.scrollHeight;
          el.scrollTop = newHeight - prevHeight;
        });
      });
    }
  }

  // Bump the "X new messages" counter when a message arrives while we're
  // scrolled away from the bottom.
  useEffect(() => {
    if (!showJumpBtn) return;
    setPendingNewCount((n) => n + 1);
  }, [messages.length, showJumpBtn]);

  function jumpToBottom() {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setShowJumpBtn(false);
    setPendingNewCount(0);
  }

  // Drag-drop file upload — intercept on the canvas, send through
  // uploadAttachment. We only accept image/* + application/pdf to match
  // the server-side gate.
  function onCanvasDragOver(e) {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      setDragOver(true);
    }
  }
  function onCanvasDragLeave() { setDragOver(false); }
  async function onCanvasDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 0) return;
    // Forward to composer via a window event — the composer owns the
    // "pending attachments" state.
    window.dispatchEvent(new CustomEvent('event-chat:drop-files', { detail: { files } }));
  }

  // Fetch pinned strip when active channel changes.
  useEffect(() => {
    if (activeChannelId) loadPinned(activeChannelId);
  }, [activeChannelId, loadPinned]);

  // Reset reply / search when switching channels.
  useEffect(() => {
    setReplyTo(null);
    setSearchOpen(false);
    setSearchQ('');
    setSearchResults([]);
  }, [activeChannelId]);

  // Capture the unread-anchor exactly once per channel switch — the first
  // message whose created_at > the channel's last_read_at. After that we
  // freeze the anchor (don't recompute as new messages arrive) so the
  // visual divider stays at "where you were when you got here."
  useEffect(() => {
    if (!activeChannelId) { setUnreadAnchor(null); return; }
    const channel = channels.find((c) => c.id === activeChannelId);
    if (!channel?.last_read_at) { setUnreadAnchor(null); return; }
    const lastRead = new Date(channel.last_read_at).getTime();
    const firstUnread = messages.find((m) => new Date(m.created_at).getTime() > lastRead);
    setUnreadAnchor(firstUnread ? firstUnread.id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannelId]);

  // Open the roster lazily — first fetch when it's first shown, then
  // re-fetch on each open so the online state stays fresh.
  useEffect(() => {
    if (!rosterOpen) return;
    let cancelled = false;
    loadRoster().then((rows) => { if (!cancelled) setRoster(rows); });
    const id = setInterval(() => {
      loadRoster().then((rows) => { if (!cancelled) setRoster(rows); });
    }, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [rosterOpen, loadRoster]);

  // Search effect
  useEffect(() => {
    if (!searchOpen || !searchQ.trim() || searchQ.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const r = await searchInActive(searchQ.trim());
      setSearchResults(r);
    }, 250);
    return () => clearTimeout(handle);
  }, [searchOpen, searchQ, searchInActive]);

  const grouped = useMemo(() => groupByDay(messages), [messages]);
  const registeredCount = meta?.registered_count ?? event?.registered_count;

  return (
    <div
      ref={rootRef}
      className={`ec-root ${isFullScreen ? 'is-fullscreen' : 'is-panel'}`}
      role="dialog"
      aria-modal={isFullScreen ? 'true' : 'false'}
      aria-label="Event chat"
    >
      <ChatStyles />

      {/* ── Channel sidebar ──────────────────────────────────────── */}
      <ChannelSidebar
        channels={channels}
        activeId={activeChannelId}
        onPick={setChannel}
        eventTitle={meta?.title || event?.title}
        onlineCount={onlineCount}
        registeredCount={registeredCount}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* ── Main column ──────────────────────────────────────────── */}
      <section className="ec-main">
        <header className="ec-header">
          <button className="ec-icon-btn ec-mobile-only" onClick={() => setMobileSidebarOpen((s) => !s)} aria-label="Toggle channels">
            ☰
          </button>
          <button className="ec-back" onClick={onClose} aria-label="Close chat" title="Close">
            <IconArrowLeft size="sm" />
          </button>
          <div className="ec-header-title">
            <div className="ec-header-name">
              <span className="ec-channel-glyph">{channelGlyph(activeChannel?.kind)}</span>
              {activeChannel?.name || '—'}
            </div>
            <div className="ec-header-sub">
              {activeChannel?.description && (
                <span className="ec-channel-desc">{activeChannel.description}</span>
              )}
              {status === 'reconnecting' && (
                <span className="ec-status-pill">reconnecting…</span>
              )}
            </div>
          </div>
          <button className={'ec-icon-btn ' + (searchOpen ? 'is-active' : '')} onClick={() => setSearchOpen((o) => !o)} aria-label="Search this channel" title="Search this channel">
            <IconSearch size="sm" />
          </button>
          <button className={'ec-icon-btn ' + (rosterOpen ? 'is-active' : '')} onClick={() => setRosterOpen((o) => !o)} aria-label="Toggle member roster" title="Toggle member roster">
            <IconUsers size="sm" />
          </button>
          <button className="ec-icon-btn" onClick={() => setIsFullScreen((v) => !v)} aria-label={isFullScreen ? 'Shrink to side panel' : 'Expand to full screen'} title={isFullScreen ? 'Shrink to side panel' : 'Expand to full screen'}>
            {isFullScreen ? <CollapseIcon /> : <ExpandIcon />}
          </button>
        </header>

        {/* ── Pinned strip ─────────────────────────────────────── */}
        {pinned.length > 0 && (
          <div className="ec-pinned-strip">
            <span className="ec-pinned-label">📌 Pinned</span>
            <div className="ec-pinned-list">
              {pinned.slice(0, 3).map((m) => (
                <button
                  key={'pin-' + m.id}
                  type="button"
                  className="ec-pinned-item"
                  onClick={() => {
                    const el = document.getElementById('msg-' + m.id);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  title={m.body}
                >
                  <strong>{m.author_name}:</strong> <span>{m.body.slice(0, 80)}{m.body.length > 80 ? '…' : ''}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Search panel ─────────────────────────────────────── */}
        {searchOpen && (
          <SearchPanel
            value={searchQ}
            onChange={setSearchQ}
            results={searchResults}
            onPick={(m) => {
              setSearchOpen(false);
              setSearchQ('');
              requestAnimationFrame(() => {
                const el = document.getElementById('msg-' + m.id);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              });
            }}
            onClose={() => { setSearchOpen(false); setSearchQ(''); setSearchResults([]); }}
          />
        )}

        {/* ── Message canvas ───────────────────────────────────── */}
        <div
          className={'ec-canvas' + (dragOver ? ' is-drag-over' : '')}
          ref={scrollerRef}
          onScroll={onScroll}
          onDragOver={onCanvasDragOver}
          onDragLeave={onCanvasDragLeave}
          onDrop={onCanvasDrop}
        >
          {dragOver && (
            <div className="ec-drop-overlay">
              <IconPlus size="lg" />
              <strong>Drop to upload</strong>
              <span>Images and PDFs only · max 8 MB each</span>
            </div>
          )}
          {showJumpBtn && (
            <button type="button" className="ec-jump-btn" onClick={jumpToBottom}>
              {pendingNewCount > 0 ? `${pendingNewCount} new ↓` : 'Jump to bottom ↓'}
            </button>
          )}
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
              <span>Say hi in #{activeChannel?.name || 'this channel'}.</span>
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
              const showAuthor = !prev || prev.kind !== 'msg' || prev.created_by !== item.created_by;
              const parent = item.parent_post_id ? messages.find((m) => m.id === item.parent_post_id) : null;
              return (
                <Fragment key={item.id}>
                  {unreadAnchor === item.id && (
                    <div className="ec-unread-divider"><span>New messages</span></div>
                  )}
                  <MessageItem
                    message={item}
                    parent={parent}
                    mine={mine}
                    showAuthor={showAuthor}
                    meId={me?.id}
                    onDelete={async () => {
                      if (!confirm('Delete this message?')) return;
                      await deleteMessage(item.id);
                    }}
                    onReport={async () => {
                      const reason = prompt('Why are you reporting this message?');
                      if (!reason || !reason.trim()) return;
                      const ok = await reportMessage(item.id, reason.trim());
                      if (ok) alert('Thanks — a moderator will review this.');
                    }}
                    onReply={() => setReplyTo({ id: item.id, body: item.body, author_name: item.author_name })}
                    onReact={(emoji) => toggleReaction(item.id, emoji)}
                    onPin={() => togglePin(item.id, !!item.pinned_at)}
                    onRetry={() => item.client_id && retrySend(item.client_id)}
                  />
                </Fragment>
              );
            })}
          </div>

          {typingUserIds.length > 0 && (
            <div className="ec-typing">
              <span className="ec-typing-dots"><i></i><i></i><i></i></span>
              <span>{typingUserIds.length === 1 ? 'Someone' : `${typingUserIds.length} people`} typing…</span>
            </div>
          )}
        </div>

        {/* ── Composer ─────────────────────────────────────────── */}
        <Composer
          eventId={eventId}
          channelId={activeChannelId}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          send={send}
          uploadAttachment={uploadAttachment}
          emitTyping={emitTyping}
          searchParticipants={searchParticipants}
          // Composer only disables on hard blocks: not registered for the
          // event (forbidden) or no channel selected. WS status ('error' /
          // 'reconnecting') does NOT disable — sending is a REST POST,
          // independent of the WS that delivers live updates. Mobile
          // networks blip often; on a flaky link the user can still
          // send and read their own messages, and live updates resume
          // when the WS reconnects.
          disabled={status === 'forbidden' || !activeChannelId}
        />
      </section>

      {/* ── Member roster (right rail) ─────────────────────────── */}
      {rosterOpen && <RosterSidebar roster={roster} onClose={() => setRosterOpen(false)} />}
    </div>
  );
}

// ─── Member roster sidebar ──────────────────────────────────────────────
function RosterSidebar({ roster, onClose }) {
  const online = roster.filter((m) => m.is_online);
  const offline = roster.filter((m) => !m.is_online);
  return (
    <aside className="ec-roster">
      <div className="ec-roster-head">
        <strong>Members</strong>
        <span className="muted-text" style={{ fontSize: '.72rem' }}>{roster.length}</span>
        <button type="button" className="ec-icon-btn" onClick={onClose} aria-label="Close roster"><IconX size="sm" /></button>
      </div>
      {online.length > 0 && (
        <>
          <div className="ec-roster-section">Online — {online.length}</div>
          {online.map((m) => <RosterRow key={m.id} member={m} />)}
        </>
      )}
      {offline.length > 0 && (
        <>
          <div className="ec-roster-section">Offline — {offline.length}</div>
          {offline.map((m) => <RosterRow key={m.id} member={m} />)}
        </>
      )}
      {roster.length === 0 && <div className="ec-empty" style={{ margin: '1rem' }}>No members yet.</div>}
    </aside>
  );
}

function RosterRow({ member }) {
  return (
    <div className={'ec-roster-row' + (member.is_online ? ' is-online' : '')}>
      <span className="ec-row-avatar ec-roster-avatar" style={{ background: authorTint(member.id) }}>
        {initials(member.name)}
      </span>
      <span className="ec-roster-name">{member.name}</span>
      {member.badge && <span className="ec-role-badge"><IconShield size="sm" />{member.badge}</span>}
    </div>
  );
}

// ─── Channel sidebar ────────────────────────────────────────────────────
function ChannelSidebar({ channels, activeId, onPick, eventTitle, onlineCount, registeredCount, mobileOpen, onCloseMobile }) {
  return (
    <aside className={'ec-sidebar' + (mobileOpen ? ' is-mobile-open' : '')}>
      <div className="ec-sidebar-head">
        <div className="ec-sidebar-event">{eventTitle || 'Event chat'}</div>
        <div className="ec-sidebar-meta">
          {typeof registeredCount === 'number' && (
            <span>{registeredCount.toLocaleString('en-IN')} registered</span>
          )}
          {onlineCount > 0 && <span className="ec-online-pill">{onlineCount} online</span>}
        </div>
      </div>
      <div className="ec-sidebar-section-label">Channels</div>
      <nav className="ec-channel-list">
        {channels.map((c) => {
          const active = c.id === activeId;
          const unread = c.unread_count || 0;
          return (
            <button
              key={c.id}
              type="button"
              className={'ec-channel-btn' + (active ? ' is-active' : '') + (unread > 0 && !active ? ' has-unread' : '')}
              onClick={() => { onPick(c.id); onCloseMobile?.(); }}
            >
              <span className="ec-channel-icon">{channelGlyph(c.kind)}</span>
              <span className="ec-channel-name">{c.name}</span>
              {unread > 0 && !active && <span className="ec-channel-badge">{unread > 99 ? '99+' : unread}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

// ─── One message in the stream ──────────────────────────────────────────
function MessageItem({
  message, parent, mine, showAuthor, meId,
  onDelete, onReply, onReact, onPin, onReport, onRetry,
}) {
  const tint = authorTint(message.created_by);
  const [pickerOpen, setPickerOpen] = useState(false);
  const isDeleted = !!message.deleted_at;

  return (
    <div className={`ec-row ${mine ? 'is-mine' : 'is-theirs'}${isDeleted ? ' is-deleted' : ''}`} id={'msg-' + message.id}>
      {showAuthor
        ? <span className="ec-row-avatar" style={{ background: tint }}>{initials(message.author_name)}</span>
        : <span className="ec-row-avatar-spacer" />}

      <div className="ec-bubble-wrap">
        {showAuthor && (
          <div className="ec-author-row">
            <span className="ec-author-name" style={{ color: tint }}>{message.author_name}</span>
            {!isDeleted && message.author_badge && (
              <span className="ec-role-badge" title={`Role: ${message.author_badge}`}>
                <IconShield size="sm" /> {message.author_badge}
              </span>
            )}
            <span className="ec-author-time">{fmtTime(message.created_at)}</span>
          </div>
        )}

        {!isDeleted && parent && (
          <button type="button" className="ec-reply-ref" onClick={() => {
            const el = document.getElementById('msg-' + parent.id);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}>
            <span className="ec-reply-ref-author">{parent.author_name}</span>
            <span className="ec-reply-ref-body">{parent.body.slice(0, 100)}{parent.body.length > 100 ? '…' : ''}</span>
          </button>
        )}

        <div className={
          'ec-bubble'
          + (isDeleted ? ' is-deleted-bubble' : '')
          + (message.status === 'pending' ? ' is-pending' : '')
          + (message.status === 'failed' ? ' is-failed' : '')
          + (!isDeleted && meId && Array.isArray(message.mention_user_ids) && message.mention_user_ids.includes(meId) ? ' is-mentioned-me' : '')
        }>
          {isDeleted ? (
            <div className="ec-bubble-body ec-deleted-text">This message was deleted</div>
          ) : (
            <>
              <div className="ec-bubble-body">
                <ChatMarkdown text={message.body} />
              </div>
              {Array.isArray(message.attachments) && message.attachments.length > 0 && (
                <div className="ec-attach-grid">
                  {message.attachments.map((a, i) => <AttachmentTile key={i} attachment={a} />)}
                </div>
              )}
              {Array.isArray(message.reactions) && message.reactions.length > 0 && (
                <div className="ec-reactions">
                  {message.reactions.map((r) => {
                    const mineHere = !!meId && r.user_ids.includes(meId);
                    return (
                      <button
                        key={r.emoji}
                        type="button"
                        className={'ec-reaction-pill' + (mineHere ? ' is-mine' : '')}
                        onClick={() => onReact(r.emoji)}
                      >
                        <span>{r.emoji}</span><span className="ec-reaction-n">{r.count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {!!message.pinned_at && (
                <div className="ec-pinned-flag">📌 Pinned</div>
              )}
              {message.reply_count > 0 && (
                <button type="button" className="ec-reply-count" onClick={onReply}>
                  ↪ {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}
                </button>
              )}
              {message.status === 'pending' && (
                <span className="ec-send-status ec-send-status-pending">sending…</span>
              )}
              {message.status === 'failed' && (
                <div className="ec-send-status ec-send-status-failed" title={message.error_message || 'Send failed'}>
                  <span>Couldn't send</span>
                  <button type="button" className="ec-retry-btn" onClick={onRetry}>Retry</button>
                </div>
              )}
            </>
          )}
        </div>

        {!isDeleted && (
          <div className="ec-msg-actions">
            <button type="button" className="ec-msg-action" onClick={() => setPickerOpen((o) => !o)} title="React">😀</button>
            <button type="button" className="ec-msg-action" onClick={onReply} title="Reply">↪</button>
            {!!message.pinned_at && <button type="button" className="ec-msg-action" onClick={onPin} title="Unpin">📌</button>}
            {!message.pinned_at && <button type="button" className="ec-msg-action" onClick={onPin} title="Pin">📌</button>}
            {mine && <button type="button" className="ec-msg-action ec-msg-action-danger" onClick={onDelete} title="Delete"><IconTrash size="sm" /></button>}
            {!mine && onReport && (
              <button type="button" className="ec-msg-action" onClick={onReport} title="Report message">⚑</button>
            )}
          </div>
        )}

        {pickerOpen && !isDeleted && (
          <div className="ec-emoji-picker">
            {COMMON_EMOJIS.map((e) => (
              <button key={e} type="button" className="ec-emoji-btn" onClick={() => { onReact(e); setPickerOpen(false); }}>{e}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Attachment tile (image preview or file pill) ───────────────────────
function AttachmentTile({ attachment }) {
  const isImage = (attachment.mime_type || '').startsWith('image/');
  if (isImage) {
    return (
      <a className="ec-attach-img" href={attachment.url} target="_blank" rel="noopener noreferrer">
        <img src={attachment.url} alt={attachment.name} loading="lazy" />
      </a>
    );
  }
  return (
    <a className="ec-attach-file" href={attachment.url} target="_blank" rel="noopener noreferrer">
      <IconFileText size="sm" />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</span>
      <IconDownload size="sm" />
    </a>
  );
}

// ─── Composer (textarea + attachments + mention autocomplete) ───────────
function Composer({ channelId, replyTo, onClearReply, send, uploadAttachment, emitTyping, searchParticipants, disabled }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]); // [{ id, name, mime_type, url, size_bytes }]
  const [uploading, setUploading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null); // null | string after '@'
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionPick, setMentionPick] = useState(0);
  // Tracks which users the user has picked from the @ autocomplete in
  // this draft. We store { name, id } pairs so at send-time we can
  // build mention_user_ids without having to round-trip back to the
  // server to resolve names — the body itself is kept clean as
  // "@Name" plain text.
  const pickedMentionsRef = useRef([]);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(''); setAttachments([]); pickedMentionsRef.current = []; }, [channelId]);

  // Drag-drop files dispatched by the canvas land here via a custom event
  // so the Composer (which owns "pending attachments" state) can ingest
  // them. We allow images + PDFs, cap at 5 attachments total per message,
  // and reuse the same uploadAttachment helper as the manual file picker.
  useEffect(() => {
    const handler = async (e) => {
      const files = Array.from(e.detail?.files || []);
      if (files.length === 0) return;
      const filtered = files.filter((f) =>
        f.type.startsWith('image/') || f.type === 'application/pdf' || f.type === 'text/plain'
      );
      if (filtered.length === 0) return;
      setUploading(true);
      try {
        for (const f of filtered) {
          if (attachments.length + 1 > 5) break;
          const up = await uploadAttachment(f);
          if (up) setAttachments((cur) => [...cur, up]);
        }
      } finally { setUploading(false); }
    };
    window.addEventListener('event-chat:drop-files', handler);
    return () => window.removeEventListener('event-chat:drop-files', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadAttachment, attachments.length]);

  // When user types '@' then characters, fetch participant matches.
  useEffect(() => {
    if (mentionQuery == null) { setMentionResults([]); return; }
    const handle = setTimeout(async () => {
      const r = await searchParticipants(mentionQuery);
      setMentionResults(r.slice(0, 6));
      setMentionPick(0);
    }, 120);
    return () => clearTimeout(handle);
  }, [mentionQuery, searchParticipants]);

  // Parse the draft for "@..." right before the caret.
  function refreshMentionQueryFrom(value, caret) {
    const before = value.slice(0, caret);
    const at = before.lastIndexOf('@');
    if (at < 0) { setMentionQuery(null); return; }
    const between = before.slice(at + 1);
    // Must be the start, or preceded by whitespace.
    const charBeforeAt = at === 0 ? ' ' : before[at - 1];
    if (!/\s/.test(charBeforeAt) && at !== 0) { setMentionQuery(null); return; }
    if (/\s/.test(between)) { setMentionQuery(null); return; }
    setMentionQuery(between);
  }

  function onDraftChange(e) {
    const value = e.target.value;
    setDraft(value);
    refreshMentionQueryFrom(value, e.target.selectionStart || value.length);
    emitTyping?.();
  }

  function insertMention(u) {
    const el = inputRef.current;
    if (!el) return;
    const caret = el.selectionStart || draft.length;
    const before = draft.slice(0, caret);
    const after = draft.slice(caret);
    const atIdx = before.lastIndexOf('@');
    // Write the clean plain-text form `@Name ` into the textarea so
    // the user sees what they typed, not encoded markdown. We track
    // the (name → id) pair separately in `pickedMentionsRef` for
    // resolution at send time.
    const insertion = `@${u.name} `;
    const replaced = before.slice(0, atIdx) + insertion + after;
    setDraft(replaced);
    setMentionQuery(null);
    setMentionResults([]);
    // Remember this pick, replacing any prior entry for the same id so
    // edits-then-re-pick stay unambiguous.
    pickedMentionsRef.current = [
      ...pickedMentionsRef.current.filter((p) => p.id !== u.id),
      { id: u.id, name: u.name },
    ];
    requestAnimationFrame(() => {
      el.focus();
      const newCaret = atIdx + insertion.length;
      try { el.setSelectionRange(newCaret, newCaret); } catch { /* ignore */ }
    });
  }

  async function onPick(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const f of files.slice(0, 5 - attachments.length)) {
        const up = await uploadAttachment(f);
        if (up) setAttachments((cur) => [...cur, up]);
      }
    } finally { setUploading(false); }
  }

  async function onPaste(e) {
    const items = e.clipboardData?.items || [];
    const images = Array.from(items).filter((it) => it.type.startsWith('image/'));
    if (images.length === 0) return;
    e.preventDefault();
    setUploading(true);
    try {
      for (const it of images.slice(0, 5 - attachments.length)) {
        const blob = it.getAsFile();
        if (!blob) continue;
        const named = new File([blob], blob.name || `paste-${Date.now()}.png`, { type: blob.type });
        const up = await uploadAttachment(named);
        if (up) setAttachments((cur) => [...cur, up]);
      }
    } finally { setUploading(false); }
  }

  function extractMentionUserIds(body) {
    // Plain-text mentions: walk the picked list, include any id whose
    // name still appears as "@Name" in the body. Handles the edge case
    // where the user picks someone, then deletes the mention — we
    // don't want a phantom notification dispatched to them.
    const ids = [];
    for (const p of pickedMentionsRef.current) {
      // Use a word-boundary-ish check so "@Bob" doesn't match
      // "@Bobby". The trailing lookahead is whitespace, end-of-string,
      // or common punctuation.
      const escaped = p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`@${escaped}(\\s|$|[,.!?])`);
      if (re.test(body)) ids.push(p.id);
    }
    return Array.from(new Set(ids));
  }

  // send() now returns synchronously after queueing the optimistic
  // bubble — no await. We clear the draft + attachments + reply state
  // immediately so the composer is ready for the next message before
  // the server has even acknowledged this one. The background retry
  // worker inside the hook handles the canonical-row swap or failure.
  function onSend(e) {
    e?.preventDefault?.();
    if (sending || disabled) return;
    const body = draft.trim();
    if (!body && attachments.length === 0) return;
    setSending(true);
    try {
      const result = send({
        body,
        parent_post_id: replyTo?.id || null,
        attachments: attachments.map(({ id, name, mime_type, url, size_bytes }) => ({ id, name, mime_type, url, size_bytes })),
        mention_user_ids: extractMentionUserIds(body),
      });
      if (result) {
        setDraft('');
        setAttachments([]);
        onClearReply?.();
        setMentionQuery(null);
        pickedMentionsRef.current = [];
      }
    } finally {
      // Re-enable the composer on the next tick so a held-down Enter
      // key doesn't re-fire onSend before the optimistic bubble is in
      // the message list.
      setTimeout(() => setSending(false), 0);
    }
  }

  function onKey(e) {
    if (mentionResults.length > 0 && mentionQuery != null) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionPick((p) => Math.min(mentionResults.length - 1, p + 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionPick((p) => Math.max(0, p - 1)); return; }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        insertMention(mentionResults[mentionPick]);
        return;
      }
      if (e.key === 'Escape') { setMentionQuery(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <form className="ec-composer" onSubmit={onSend}>
      {replyTo && (
        <div className="ec-reply-banner">
          <span>Replying to <strong>{replyTo.author_name}</strong>: <em>{replyTo.body.slice(0, 80)}{replyTo.body.length > 80 ? '…' : ''}</em></span>
          <button type="button" className="ec-reply-clear" onClick={onClearReply} aria-label="Cancel reply"><IconX size="sm" /></button>
        </div>
      )}
      {attachments.length > 0 && (
        <div className="ec-pending-attachments">
          {attachments.map((a, i) => (
            <div key={i} className="ec-pending-attachment">
              <AttachmentTile attachment={a} />
              <button type="button" className="ec-remove-attach" onClick={() => setAttachments((cur) => cur.filter((_, j) => j !== i))}>
                <IconX size="sm" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="ec-composer-row">
        <label className="ec-attach-btn" title="Attach file">
          {uploading ? '…' : <IconPlus size="sm" />}
          <input
            type="file"
            multiple
            accept="image/*,application/pdf,text/plain"
            style={{ display: 'none' }}
            onChange={onPick}
            disabled={uploading || attachments.length >= 5}
          />
        </label>

        <textarea
          ref={inputRef}
          className="ec-composer-input"
          placeholder={disabled ? 'Chat unavailable…' : 'Message #channel  · @ to mention · paste images'}
          value={draft}
          onChange={onDraftChange}
          onKeyDown={onKey}
          onPaste={onPaste}
          rows={1}
          disabled={disabled}
        />
        <button
          type="submit"
          className="ec-composer-send"
          disabled={disabled || sending || (!draft.trim() && attachments.length === 0)}
          aria-label="Send"
        >
          <IconArrowRight size="sm" />
        </button>
      </div>

      {mentionQuery != null && mentionResults.length > 0 && (
        <div className="ec-mention-popover" role="listbox">
          {mentionResults.map((u, i) => (
            <button
              key={u.id}
              type="button"
              className={'ec-mention-row' + (i === mentionPick ? ' is-pick' : '')}
              onClick={() => insertMention(u)}
              onMouseEnter={() => setMentionPick(i)}
            >
              <span className="ec-mention-avatar" style={{ background: authorTint(u.id) }}>{initials(u.name)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="ec-mention-name">{u.name}</span>
                <span className="ec-mention-email">{u.email}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

// ─── Search panel ───────────────────────────────────────────────────────
function SearchPanel({ value, onChange, results, onPick, onClose }) {
  return (
    <div className="ec-search-panel">
      <div className="ec-search-row">
        <IconSearch size="sm" />
        <input
          autoFocus
          className="ec-search-input"
          placeholder="Search this channel…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="ec-icon-btn" onClick={onClose} aria-label="Close search"><IconX size="sm" /></button>
      </div>
      {value.trim().length >= 2 && (
        <div className="ec-search-results">
          {results.length === 0 ? (
            <div className="ec-empty" style={{ margin: '1rem auto', padding: '1rem' }}>
              <span>No results for <strong>"{value}"</strong></span>
            </div>
          ) : results.map((m) => (
            <button key={'sr-' + m.id} type="button" className="ec-search-result" onClick={() => onPick(m)}>
              <span className="ec-row-avatar" style={{ background: authorTint(m.created_by) }}>{initials(m.author_name)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: '.82rem' }}>{m.author_name} · <span className="muted-text" style={{ fontWeight: 400, fontSize: '.7rem' }}>{fmtTime(m.created_at)}</span></span>
                <span className="ec-search-snippet"><ChatMarkdown text={m.body} /></span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Icon stubs (inline SVGs match the project's icon style) ────────────
function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h6v6M14 10l7-7M9 21H3v-6M10 14l-7 7" />
    </svg>
  );
}
function CollapseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STYLES — all `.ec-*` so we don't collide with anything else on the page.
// ═══════════════════════════════════════════════════════════════════════
function ChatStyles() {
  return (
    <style>{`
      .ec-root {
        position: fixed; top: 0; bottom: 0; left: 0;
        z-index: 200;
        background: var(--background);
        color: var(--foreground);
        display: grid; grid-template-columns: 240px 1fr;
        font-family: inherit;
        transition: width .35s cubic-bezier(.32,.72,0,1);
      }
      .ec-root.is-panel {
        width: min(880px, 100vw);
        border-right: 1px solid var(--border);
        box-shadow: 12px 0 32px -16px oklch(0.36 0.13 255 / .25);
        animation: ecSlide .32s cubic-bezier(.32,.72,0,1);
      }
      .ec-root.is-fullscreen { width: 100vw; box-shadow: none; animation: ecFade .2s ease-out; }
      @keyframes ecSlide { from { transform: translateX(-100%); opacity: .85; } to { transform: translateX(0); opacity: 1; } }
      @keyframes ecFade  { from { opacity: 0; } to { opacity: 1; } }

      /* ── Sidebar ── */
      .ec-sidebar {
        background: #0f172a;
        color: rgba(255,255,255,.85);
        display: flex; flex-direction: column;
        overflow-y: auto;
      }
      .ec-sidebar-head { padding: 1rem .9rem; border-bottom: 1px solid rgba(255,255,255,.08); }
      .ec-sidebar-event { font-size: .92rem; font-weight: 700; color: white; line-height: 1.2; }
      .ec-sidebar-meta {
        margin-top: .35rem; font-size: .7rem; color: rgba(255,255,255,.6);
        display: flex; flex-wrap: wrap; gap: .4rem; align-items: center;
      }
      .ec-sidebar-section-label {
        font-size: .62rem; text-transform: uppercase; letter-spacing: .08em;
        font-weight: 700; color: rgba(255,255,255,.45);
        padding: .9rem .9rem .35rem;
      }
      .ec-channel-list { display: flex; flex-direction: column; padding: 0 .5rem .9rem; gap: 2px; }
      .ec-channel-btn {
        display: flex; align-items: center; gap: .5rem;
        padding: .42rem .65rem;
        background: transparent; border: 0; border-radius: 7px;
        color: rgba(255,255,255,.7); cursor: pointer;
        font-size: .85rem; text-align: left;
        transition: background .12s, color .12s;
      }
      .ec-channel-btn:hover { background: rgba(255,255,255,.05); color: white; }
      .ec-channel-btn.is-active { background: rgba(255,255,255,.08); color: white; font-weight: 600; }
      .ec-channel-btn.has-unread { color: white; }
      .ec-channel-icon {
        display: inline-grid; place-items: center; width: 18px;
        font-weight: 700; color: rgba(255,255,255,.45);
      }
      .ec-channel-btn.is-active .ec-channel-icon { color: white; }
      .ec-channel-name { flex: 1; }
      .ec-channel-badge {
        background: var(--destructive); color: white;
        font-size: .65rem; font-weight: 700;
        min-width: 18px; height: 18px; padding: 0 5px;
        border-radius: 999px;
        display: inline-flex; align-items: center; justify-content: center;
      }

      /* ── Main column ──
         min-height: 0 is critical here. Grid items default to
         min-height: auto, which means the grid track expands to fit
         the child's content. The canvas + composer combine to be
         taller than 100vh as soon as you have any history, so without
         this override .ec-main grew past the viewport and the
         canvas's flex:1 + overflow:auto never actually got to scroll
         — everything just pushed past the bottom of the screen.
         overflow:hidden is belt-and-braces in case any descendant
         tries to escape the column. */
      .ec-main {
        display: flex; flex-direction: column;
        min-width: 0; min-height: 0;
        overflow: hidden;
      }
      .ec-header {
        height: 56px; flex: 0 0 56px;
        display: flex; align-items: center; gap: .5rem;
        padding: 0 .75rem;
        background: rgba(255,255,255,.92);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--border);
      }
      .ec-back, .ec-icon-btn {
        display: grid; place-items: center;
        width: 34px; height: 34px; border-radius: 8px;
        background: transparent; border: 0;
        color: var(--muted-foreground); cursor: pointer;
        transition: background .15s, color .15s;
        flex-shrink: 0;
      }
      .ec-back:hover, .ec-icon-btn:hover {
        background: oklch(0.36 0.13 255 / .08);
        color: var(--primary);
      }
      .ec-icon-btn.is-active { background: oklch(0.36 0.13 255 / .12); color: var(--primary); }
      .ec-header-title { flex: 1; min-width: 0; }
      .ec-header-name {
        font-size: .95rem; font-weight: 700;
        display: flex; align-items: center; gap: .35rem;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .ec-channel-glyph { color: var(--muted-foreground); font-weight: 800; font-size: 1rem; }
      .ec-header-sub {
        font-size: .72rem; color: var(--muted-foreground); margin-top: .1rem;
        display: flex; gap: .4rem; align-items: center;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .ec-channel-desc { overflow: hidden; text-overflow: ellipsis; }
      .ec-online-pill {
        display: inline-flex; align-items: center; gap: .3rem;
        padding: .1rem .45rem; border-radius: 999px;
        background: oklch(0.50 0.16 145 / .15);
        color: oklch(0.42 0.14 145);
        font-size: 10px; font-weight: 600;
      }
      .ec-online-pill::before { content: ''; width: 6px; height: 6px; border-radius: 999px; background: oklch(0.50 0.16 145); }
      .ec-status-pill {
        padding: .1rem .45rem; border-radius: 999px;
        background: oklch(0.78 0.15 75 / .15); color: oklch(0.45 0.12 75);
        font-size: 10px; font-weight: 600;
      }
      .ec-mobile-only { display: none; }

      /* ── Pinned strip ── */
      .ec-pinned-strip {
        background: oklch(0.85 0.16 90 / .12);
        border-bottom: 1px solid oklch(0.85 0.16 90 / .35);
        padding: .45rem .85rem; font-size: .78rem;
        display: flex; align-items: center; gap: .5rem;
      }
      .ec-pinned-label { font-weight: 700; flex-shrink: 0; }
      .ec-pinned-list { flex: 1; min-width: 0; display: flex; gap: .5rem; overflow-x: auto; }
      .ec-pinned-item {
        background: transparent; border: 0; padding: .15rem .45rem;
        border-radius: 6px; color: inherit; cursor: pointer;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        max-width: 260px; font-size: .76rem;
      }
      .ec-pinned-item:hover { background: oklch(0.85 0.16 90 / .25); }

      /* ── Search panel ── */
      .ec-search-panel {
        background: var(--card); border-bottom: 1px solid var(--border);
        padding: .55rem .85rem;
      }
      .ec-search-row { display: flex; align-items: center; gap: .5rem; }
      .ec-search-input {
        flex: 1; background: var(--background); border: 1px solid var(--border);
        border-radius: 8px; padding: .45rem .65rem; font: inherit; font-size: .85rem;
        outline: none;
      }
      .ec-search-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px oklch(0.36 0.13 255 / .12); }
      .ec-search-results {
        margin-top: .5rem; max-height: 240px; overflow-y: auto;
        display: flex; flex-direction: column; gap: .25rem;
      }
      .ec-search-result {
        display: flex; align-items: flex-start; gap: .55rem;
        padding: .5rem .55rem; border-radius: 8px; cursor: pointer;
        background: transparent; border: 0; text-align: left; color: inherit;
      }
      .ec-search-result:hover { background: var(--muted, #fafaf9); }
      .ec-search-snippet { display: block; font-size: .8rem; color: var(--muted-foreground); margin-top: .1rem; line-height: 1.35; }

      /* ── Canvas + day dividers ── */
      .ec-canvas {
        flex: 1; min-height: 0;
        overflow-y: auto; overflow-x: hidden;
        padding: 1rem .9rem 1.25rem;
        background:
          radial-gradient(800px 320px at 50% -10%, oklch(0.36 0.13 255 / .04), transparent 60%),
          var(--background);
      }
      .ec-day-track { max-width: 880px; margin: 0 auto; display: flex; flex-direction: column; gap: .25rem; }
      .ec-day-divider { display: flex; justify-content: center; margin: 1rem 0 .65rem; }
      .ec-day-divider span {
        font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em;
        padding: .25rem .65rem; border-radius: 999px;
        background: oklch(0.36 0.13 255 / .08); color: var(--primary);
      }
      .ec-empty {
        max-width: 360px; margin: 2.5rem auto;
        background: var(--card); border: 1px dashed var(--border);
        border-radius: 14px; padding: 1.1rem 1.3rem; text-align: center;
        display: flex; flex-direction: column; gap: .3rem;
        font-size: 13px; color: var(--muted-foreground);
      }
      .ec-empty strong { font-size: 14px; color: var(--foreground); font-weight: 700; }

      /* ── Row + avatar ── */
      .ec-row {
        display: grid; grid-template-columns: 38px 1fr;
        gap: .55rem; margin: .15rem 0;
        position: relative;
      }
      .ec-row-avatar, .ec-row-avatar-spacer {
        width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
      }
      .ec-row-avatar {
        display: grid; place-items: center;
        color: white; font-weight: 700; font-size: 10px; letter-spacing: -.01em;
      }
      .ec-bubble-wrap { min-width: 0; position: relative; }
      .ec-row:hover .ec-msg-actions,
      .ec-row:focus-within .ec-msg-actions { opacity: 1; transform: translateY(0); }
      /* Action menu — anchored top-right INSIDE the bubble wrap.
         Bumped to z-index: 20 so it sits above every other chat
         element (bubble shadow, reactions row, pinned strip, etc.).
         Solid card background + crisper shadow + foreground icon
         colour so the buttons read as buttons, not faded smudges. */
      .ec-msg-actions {
        position: absolute; top: -16px; right: 6px;
        display: flex; gap: 2px; flex-wrap: wrap;
        max-width: calc(100% - 12px);
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 8px; padding: 3px;
        box-shadow:
          0 2px 4px rgba(15,23,42,.06),
          0 8px 24px -6px rgba(15,23,42,.22);
        opacity: 0; transform: translateY(4px); transition: opacity .12s, transform .12s;
        z-index: 20;
      }
      .ec-msg-action {
        background: transparent; border: 0;
        padding: 4px 7px; min-width: 26px; min-height: 26px;
        font-size: .9rem; line-height: 1; cursor: pointer;
        border-radius: 6px;
        /* Solid foreground colour so the icons aren't fighting with
           the bubble shadow underneath. Hover gets a tinted background
           for clearer interactivity feedback. */
        color: var(--foreground);
        display: inline-grid; place-items: center;
        transition: background .12s, color .12s, transform .08s;
      }
      .ec-msg-action:hover {
        background: oklch(0.36 0.13 255 / .10);
        color: var(--primary);
        transform: translateY(-1px);
      }
      .ec-msg-action-danger { color: var(--destructive); }
      .ec-msg-action-danger:hover { background: oklch(0.577 0.245 27.325 / .12); color: var(--destructive); }
      /* Emoji picker pops below the actions menu. Anchored to the
         right edge of the bubble wrap with a small inset so it can't
         clip the canvas. Wraps onto multiple rows on narrow screens
         where the 8-emoji strip is wider than the bubble itself. */
      .ec-emoji-picker {
        position: absolute; top: 18px; right: 6px;
        background: var(--card); border: 1px solid var(--border);
        border-radius: 10px; padding: 4px;
        display: flex; gap: 2px; flex-wrap: wrap;
        max-width: calc(100vw - 24px);
        box-shadow:
          0 2px 4px rgba(15,23,42,.06),
          0 10px 24px -8px rgba(15,23,42,.25);
        z-index: 25;
      }
      .ec-emoji-btn {
        background: transparent; border: 0; padding: 5px 7px;
        font-size: 1.1rem; line-height: 1; cursor: pointer; border-radius: 6px;
      }
      .ec-emoji-btn:hover { background: var(--muted, #fafafa); }

      .ec-author-row { display: flex; align-items: baseline; gap: .4rem; margin-bottom: .15rem; }
      .ec-author-name { font-weight: 700; font-size: .82rem; }
      .ec-author-time { font-size: .68rem; color: var(--muted-foreground); }

      .ec-reply-ref {
        display: flex; align-items: center; gap: .35rem;
        background: transparent; border: 0; padding: 0 0 .15rem;
        color: var(--muted-foreground); font-size: .72rem;
        cursor: pointer; text-align: left;
      }
      .ec-reply-ref::before {
        content: ''; width: 18px; height: 10px;
        border-top: 2px solid var(--border); border-left: 2px solid var(--border);
        border-top-left-radius: 6px; flex-shrink: 0;
      }
      .ec-reply-ref:hover { color: var(--primary); }
      .ec-reply-ref-author { font-weight: 700; }
      .ec-reply-ref-body {
        opacity: .85; overflow: hidden; text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
        min-width: 0;
      }
      .ec-reply-ref { min-width: 0; }

      .ec-bubble {
        background: var(--card); border: 1px solid var(--border);
        border-radius: 10px; padding: .5rem .7rem;
        font-size: 14px; line-height: 1.45;
        box-shadow: 0 1px 2px rgba(15,23,42,.03);
        max-width: 100%;
        min-width: 0;
        word-wrap: break-word;
        overflow-wrap: anywhere;
      }
      .ec-row.is-mine .ec-bubble {
        background: oklch(0.36 0.13 255 / .07);
        border-color: oklch(0.36 0.13 255 / .25);
      }

      /* B1 — optimistic send states.
         pending: muted opacity + "sending…" hint, no further action.
         failed:  red left border + inline Retry chip. Both keep the
                  bubble layout identical to a normal message so the
                  state change isn't disruptive when it flips. */
      .ec-bubble.is-pending { opacity: .65; }
      .ec-bubble.is-failed {
        border-left: 3px solid var(--destructive);
        background: oklch(0.577 0.245 27.325 / .04);
      }
      .ec-send-status {
        display: inline-flex; align-items: center; gap: .35rem;
        margin-top: .25rem;
        font-size: .68rem; font-weight: 600;
      }
      .ec-send-status-pending { color: var(--muted-foreground); font-style: italic; }
      .ec-send-status-failed  { color: var(--destructive); }
      .ec-retry-btn {
        background: transparent; border: 1px solid var(--destructive);
        color: var(--destructive);
        padding: .05rem .45rem; border-radius: 999px;
        font-size: .65rem; font-weight: 700; cursor: pointer;
      }
      .ec-retry-btn:hover { background: var(--destructive); color: white; }
      .ec-bubble-body { white-space: pre-wrap; word-wrap: break-word; overflow-wrap: anywhere; }
      .ec-pinned-flag { font-size: .65rem; color: #92400e; font-weight: 700; margin-top: .25rem; }

      /* Markdown inside chat bodies */
      .cm-link { color: var(--primary); text-decoration: underline; }
      .cm-code-inline { background: rgba(15,23,42,.06); padding: .05rem .3rem; border-radius: 4px; font-family: ui-monospace, Menlo, monospace; font-size: .85em; }
      .cm-code-block {
        background: #0f172a; color: #e2e8f0;
        padding: .55rem .7rem; border-radius: 8px;
        font-family: ui-monospace, Menlo, monospace; font-size: .82rem;
        margin: .3rem 0; overflow-x: auto;
      }
      .cm-mention {
        display: inline-block; padding: 1px 6px; border-radius: 4px;
        background: oklch(0.36 0.13 255 / .12); color: var(--primary);
        font-weight: 600; cursor: default;
      }

      /* Attachments */
      .ec-attach-grid {
        margin-top: .35rem; display: flex; flex-wrap: wrap; gap: .35rem;
      }
      .ec-attach-img {
        display: block; max-width: 260px; max-height: 200px;
        border-radius: 8px; overflow: hidden; border: 1px solid var(--border);
      }
      .ec-attach-img img { display: block; width: 100%; height: auto; max-height: 200px; object-fit: cover; }
      .ec-attach-file {
        display: inline-flex; align-items: center; gap: .35rem;
        padding: .3rem .55rem; border: 1px solid var(--border);
        border-radius: 8px; background: var(--background);
        color: var(--foreground); text-decoration: none;
        font-size: .8rem; max-width: 280px;
      }
      .ec-attach-file:hover { border-color: var(--primary); color: var(--primary); }

      /* Reactions */
      .ec-reactions { display: flex; flex-wrap: wrap; gap: .25rem; margin-top: .35rem; }
      .ec-reaction-pill {
        display: inline-flex; align-items: center; gap: .25rem;
        padding: .1rem .45rem; border-radius: 999px;
        background: var(--background); border: 1px solid var(--border);
        cursor: pointer; font-size: .78rem; color: var(--foreground);
        transition: border-color .12s, background .12s;
      }
      .ec-reaction-pill:hover { border-color: var(--primary); }
      .ec-reaction-pill.is-mine { border-color: var(--primary); background: oklch(0.36 0.13 255 / .12); color: var(--primary); }
      .ec-reaction-n { font-weight: 700; font-variant-numeric: tabular-nums; }

      /* Typing */
      .ec-typing {
        display: flex; align-items: center; gap: .5rem;
        font-size: .75rem; color: var(--muted-foreground);
        padding: .35rem 1rem; max-width: 880px; margin: 0 auto;
      }
      .ec-typing-dots { display: inline-flex; gap: 3px; }
      .ec-typing-dots i {
        width: 4px; height: 4px; border-radius: 999px;
        background: var(--muted-foreground); display: inline-block;
        animation: ecBlink 1.2s infinite ease-in-out;
      }
      .ec-typing-dots i:nth-child(2) { animation-delay: .15s; }
      .ec-typing-dots i:nth-child(3) { animation-delay: .3s; }
      @keyframes ecBlink { 0%, 80%, 100% { opacity: .25; } 40% { opacity: 1; } }

      /* ── Composer ── */
      .ec-composer {
        flex: 0 0 auto;
        padding: .55rem .85rem .85rem;
        background: var(--card);
        border-top: 1px solid var(--border);
      }
      .ec-composer-row { display: flex; align-items: flex-end; gap: .5rem; }
      .ec-composer-input {
        flex: 1; min-height: 40px; max-height: 160px;
        padding: .55rem .85rem;
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: 10px;
        font: inherit; font-size: 14px;
        color: var(--foreground);
        resize: none; outline: 0;
      }
      .ec-composer-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px oklch(0.36 0.13 255 / .12); }
      .ec-composer-send {
        flex: 0 0 40px;
        display: grid; place-items: center;
        width: 40px; height: 40px; border-radius: 10px;
        background: linear-gradient(135deg, var(--primary), oklch(0.30 0.13 255));
        color: white; border: 0; cursor: pointer;
        box-shadow: 0 6px 16px -8px oklch(0.36 0.13 255 / .55);
      }
      .ec-composer-send:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; }
      .ec-attach-btn {
        flex: 0 0 40px; height: 40px;
        display: grid; place-items: center;
        background: var(--background); border: 1px solid var(--border);
        border-radius: 10px; cursor: pointer; color: var(--muted-foreground);
      }
      .ec-attach-btn:hover { border-color: var(--primary); color: var(--primary); }

      .ec-reply-banner {
        display: flex; align-items: center; justify-content: space-between;
        background: oklch(0.36 0.13 255 / .06); border: 1px solid oklch(0.36 0.13 255 / .15);
        border-radius: 8px; padding: .35rem .65rem; margin-bottom: .45rem;
        font-size: .8rem;
      }
      .ec-reply-clear { background: transparent; border: 0; cursor: pointer; padding: 2px; color: var(--muted-foreground); }
      /* Pending attachments — small square thumbnails so a queued
         photo doesn't dominate the composer and squeeze the message
         canvas above. The in-message rendering (.ec-attach-img inside
         a bubble) keeps its larger size. */
      .ec-pending-attachments {
        display: flex; flex-wrap: wrap; gap: .35rem;
        margin-bottom: .45rem;
        max-height: 96px; overflow-y: auto;
      }
      .ec-pending-attachment {
        position: relative;
        width: 72px; height: 72px;
        flex: 0 0 72px;
      }
      .ec-pending-attachments .ec-attach-img,
      .ec-pending-attachments .ec-attach-img img {
        width: 72px; height: 72px;
        max-width: 72px; max-height: 72px;
        object-fit: cover;
        border-radius: 8px;
      }
      .ec-pending-attachments .ec-attach-file {
        max-width: 220px;
        font-size: .72rem;
        padding: .25rem .5rem;
      }
      /* Remove-X sits INSIDE the 72px thumbnail (not -8px outside it)
         so it can't clip past the composer edge on narrow viewports or
         get hidden by the surrounding row gap. */
      .ec-remove-attach {
        position: absolute; top: 2px; right: 2px;
        background: var(--destructive); color: white;
        border: 0; border-radius: 999px; width: 20px; height: 20px;
        display: grid; place-items: center; cursor: pointer;
        font-size: .65rem;
        box-shadow: 0 1px 3px rgba(15,23,42,.35);
      }

      /* Mention autocomplete */
      .ec-mention-popover {
        position: absolute; bottom: 70px; left: 1rem; right: 1rem;
        max-width: 320px;
        background: var(--card); border: 1px solid var(--border);
        border-radius: 10px; padding: .25rem;
        box-shadow: 0 8px 24px -6px rgba(15,23,42,.18);
        z-index: 5;
      }
      .ec-mention-row {
        display: flex; align-items: center; gap: .5rem; width: 100%;
        padding: .35rem .55rem; border-radius: 8px; cursor: pointer;
        background: transparent; border: 0; text-align: left; color: inherit;
      }
      .ec-mention-row.is-pick { background: oklch(0.36 0.13 255 / .08); }
      .ec-mention-avatar { width: 26px; height: 26px; border-radius: 7px; display: grid; place-items: center; color: white; font-size: 9px; font-weight: 700; flex-shrink: 0; }
      .ec-mention-name { display: block; font-weight: 600; font-size: .82rem; }
      .ec-mention-email { display: block; font-size: .7rem; color: var(--muted-foreground); }

      /* Deleted-message tombstone */
      .ec-deleted-text {
        font-style: italic;
        color: var(--muted-foreground);
        opacity: .9;
      }
      .ec-bubble.is-deleted-bubble {
        background: transparent;
        border: 1px dashed var(--border);
        box-shadow: none;
      }

      /* "You were mentioned" highlight — a soft amber band along the
         left edge of the bubble + a subtle background tint, so the
         message visibly stands out in a busy channel. */
      .ec-bubble.is-mentioned-me {
        background: oklch(0.96 0.07 90 / .55);
        border-left: 3px solid #f59e0b;
        padding-left: calc(.6rem - 3px);
      }

      /* No content-visibility on .ec-row: paint containment clipped
         the floating action toolbar that sits above the bubble. */

      /* ── Unread divider — Discord-style "new messages" line ── */
      .ec-unread-divider {
        display: flex; align-items: center; gap: .5rem;
        margin: .85rem 0 .25rem;
        color: var(--destructive);
        font-size: 10px; font-weight: 700;
        text-transform: uppercase; letter-spacing: .08em;
      }
      .ec-unread-divider::before, .ec-unread-divider::after {
        content: ''; flex: 1; height: 1px; background: var(--destructive); opacity: .35;
      }
      .ec-unread-divider span { white-space: nowrap; }

      /* ── Jump-to-bottom floating button ── */
      .ec-jump-btn {
        position: sticky; bottom: 1rem; align-self: center;
        margin-left: auto; margin-right: auto;
        display: block;
        background: linear-gradient(135deg, var(--primary), oklch(0.30 0.13 255));
        color: white; border: 0; padding: .45rem .8rem;
        border-radius: 999px; font-size: .78rem; font-weight: 700;
        box-shadow: 0 6px 20px -6px oklch(0.36 0.13 255 / .55);
        cursor: pointer;
        z-index: 4;
      }
      .ec-jump-btn:hover { transform: translateY(-1px); }

      /* ── Drag-drop overlay ── */
      .ec-canvas.is-drag-over { background: oklch(0.36 0.13 255 / .05); }
      .ec-drop-overlay {
        position: absolute; inset: 0;
        display: flex; flex-direction: column; gap: .35rem;
        align-items: center; justify-content: center;
        background: oklch(0.36 0.13 255 / .08);
        border: 2px dashed var(--primary);
        margin: .85rem; border-radius: 16px;
        pointer-events: none;
        z-index: 3;
        color: var(--primary);
      }
      .ec-drop-overlay strong { font-size: 1.05rem; font-weight: 700; }
      .ec-drop-overlay span { font-size: .8rem; color: var(--muted-foreground); }
      .ec-canvas { position: relative; }

      /* ── Role badge pill (rendered next to author name) ── */
      .ec-role-badge {
        display: inline-flex; align-items: center; gap: .15rem;
        padding: 0 .35rem; height: 16px;
        font-size: 9px; font-weight: 700;
        text-transform: uppercase; letter-spacing: .05em;
        background: oklch(0.50 0.16 145 / .14);
        color: oklch(0.40 0.14 145);
        border-radius: 4px;
        flex-shrink: 0;
      }

      /* ── Reply count chip below messages ── */
      .ec-reply-count {
        margin-top: .35rem;
        background: transparent; border: 0; padding: 0;
        color: var(--primary); font-weight: 600; font-size: .72rem;
        cursor: pointer;
      }
      .ec-reply-count:hover { text-decoration: underline; }

      /* ── Member roster sidebar ── */
      .ec-roster {
        background: var(--card); border-left: 1px solid var(--border);
        width: 220px; flex-shrink: 0;
        display: flex; flex-direction: column;
        overflow-y: auto;
      }
      .ec-roster-head {
        display: flex; align-items: center; gap: .4rem;
        padding: .75rem .8rem; border-bottom: 1px solid var(--border);
      }
      .ec-roster-head strong { font-size: .85rem; }
      .ec-roster-head .ec-icon-btn { margin-left: auto; }
      .ec-roster-section {
        font-size: .62rem; text-transform: uppercase; letter-spacing: .08em;
        font-weight: 700; color: var(--muted-foreground);
        padding: .75rem .8rem .35rem;
      }
      .ec-roster-row {
        display: flex; align-items: center; gap: .5rem;
        padding: .3rem .8rem;
        font-size: .8rem; color: var(--muted-foreground);
      }
      .ec-roster-row.is-online { color: var(--foreground); }
      .ec-roster-avatar { width: 24px; height: 24px; font-size: 9px; }
      .ec-roster-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      /* Adjust root grid when roster is mounted as a third column. */
      .ec-root:has(.ec-roster) { grid-template-columns: 240px 1fr 220px; }

      /* ── Responsive ──────────────────────────────────────────── */

      /* Tablet + small laptop: when the roster takes a third column
         the messages canvas can get cramped. Slightly tighter padding
         + smaller avatar gap. */
      @media (max-width: 1080px) {
        .ec-canvas { padding: .85rem .65rem 1rem; }
        .ec-bubble { font-size: 13.5px; }
      }

      /* Phones / narrow viewports: the sidebar collapses to a slide-
         out, the right roster hides, and we tighten every horizontal
         metric so nothing can clip off the edge. */
      @media (max-width: 720px) {
        .ec-root,
        .ec-root:has(.ec-roster) { grid-template-columns: 1fr; }
        .ec-root.is-panel { width: 100vw; box-shadow: none; border-right: 0; }
        .ec-sidebar {
          position: absolute; inset: 0 30% 0 0; z-index: 5;
          transform: translateX(-100%); transition: transform .2s ease;
        }
        .ec-sidebar.is-mobile-open { transform: translateX(0); }
        .ec-mobile-only { display: inline-grid; }
        .ec-roster { display: none; }

        .ec-header { gap: .25rem; padding: 0 .5rem; }
        .ec-back, .ec-icon-btn { width: 32px; height: 32px; }
        .ec-canvas { padding: .65rem .5rem .9rem; }
        .ec-row { grid-template-columns: 30px 1fr; gap: .4rem; }
        .ec-row-avatar, .ec-row-avatar-spacer { width: 28px; height: 28px; }
        .ec-composer { padding: .5rem .6rem .65rem; }
        .ec-attach-btn, .ec-composer-send { width: 36px; height: 36px; flex-basis: 36px; }
        .ec-msg-actions { top: -12px; right: 2px; }
        .ec-attach-img,
        .ec-attach-img img { max-width: 200px; max-height: 160px; }
      }

      /* Tiny phones (≤ 380 px): drop one of the header buttons (the
         expand/collapse toggle is redundant on a single-column layout
         since the chat already fills the viewport). */
      @media (max-width: 380px) {
        .ec-header .ec-icon-btn:nth-last-of-type(1) { display: none; }
        .ec-bubble { font-size: 13px; }
        .ec-canvas { padding: .55rem .35rem .85rem; }
      }
    `}</style>
  );
}
