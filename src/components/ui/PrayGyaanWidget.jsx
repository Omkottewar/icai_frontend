import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconX, IconCheck } from '../../icons';
import garudImg from '../../assets/garud.png';
import { renderMarkdown } from '../../lib/markdown.jsx';
import {
  getAnonId, getConfig, getStarters, streamChat, sendFeedback,
} from '../../lib/pragyaan';

// Fallback shown when /config hasn't resolved yet (or fails). The server
// returns the canonical disclaimer at runtime.
const DEFAULT_DISCLAIMER =
  'Pragyaan is an AI assistant that answers from the ICAI Nagpur Branch knowledge base. ' +
  'Responses are general information, not professional advice — verify important details with the branch.';

const LANG_LABEL = { en: 'EN', hi: 'हिं', mr: 'मराठी' };

// Tiny thumbs-up / thumbs-down inline SVGs — there are no equivalents in
// icons/index.jsx and pulling in a whole icon set isn't worth it.
const ThumbsUp = ({ filled }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill={filled ? 'currentColor' : 'none'}
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 10v12" /><path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10l4.5-9 1.5 1.5z" />
  </svg>
);
const ThumbsDown = ({ filled }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill={filled ? 'currentColor' : 'none'}
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 14V2" /><path d="M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17v12l-4.5 9-1.5-1.5z" />
  </svg>
);

function botMessage(text) {
  return { id: cryptoId(), role: 'assistant', text, citations: [], streaming: false };
}

function userMessage(text) {
  return { id: cryptoId(), role: 'user', text };
}

function cryptoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function PrayGyaanWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState(() => [
    botMessage(
      "Namaste! I'm Pragyaan — your ICAI Nagpur Branch assistant. Ask me about CPE events, articleship, branch services, circulars, and more.",
    ),
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [lang, setLang] = useState('en');
  // Track FAB image load so the greeting bubble doesn't appear pointing
  // at an empty spot before the bird has rendered. Preload via
  // new Image() so the browser starts fetching the moment this widget
  // mounts, not when React paints the <img>.
  const [fabReady, setFabReady] = useState(false);
  useEffect(() => {
    if (typeof Image === 'undefined') { setFabReady(true); return; }
    const img = new Image();
    img.onload = img.onerror = () => setFabReady(true);
    img.src = garudImg;
    // Safety net — never block the bubble forever if the image hangs.
    const failsafe = setTimeout(() => setFabReady(true), 3000);
    return () => clearTimeout(failsafe);
  }, []);
  const [config, setConfig] = useState({ disclaimer: DEFAULT_DISCLAIMER, languages: ['en', 'hi', 'mr'] });
  const [starters, setStarters] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [feedbackState, setFeedbackState] = useState({}); // { [messageId]: 'up' | 'down' | 'pending' }

  const bottomRef = useRef(null);
  const streamRef = useRef(null);
  const anonId = useMemo(() => getAnonId(), []);

  // Load disclaimer + language list + role-keyed starters once (and again
  // when the widget is first opened in case the session changed since mount).
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    getConfig().then(setConfig).catch(() => { /* keep defaults */ });
    getStarters()
      .then((r) => setStarters(Array.isArray(r?.starters) ? r.starters : []))
      .catch(() => setStarters([]));
  }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, open]);

  // Cancel any in-flight stream when the widget unmounts.
  useEffect(() => () => streamRef.current?.abort(), []);

  const send = useCallback((textArg) => {
    const q = (textArg ?? input).trim();
    if (!q || streaming) return;
    setInput('');

    const assistantId = cryptoId();
    setMsgs((m) => [
      ...m,
      userMessage(q),
      { id: assistantId, role: 'assistant', text: '', citations: [], streaming: true },
    ]);
    setStreaming(true);

    streamRef.current?.abort();
    streamRef.current = streamChat(
      { message: q, conversationId, anonId, lang },
      {
        onToken: (delta) => {
          setMsgs((m) => m.map((row) => (row.id === assistantId
            ? { ...row, text: row.text + delta }
            : row)));
        },
        onDone: (final) => {
          setMsgs((m) => m.map((row) => (row.id === assistantId
            ? {
              ...row,
              streaming: false,
              citations: final.citations || [],
              followUps: final.follow_ups || [],
              messageId: final.messageId,
              noAnswer: !!final.noAnswer,
            }
            : row)));
          if (final.conversationId) setConversationId(final.conversationId);
          setStreaming(false);
        },
        onError: (err) => {
          setMsgs((m) => m.map((row) => (row.id === assistantId
            ? {
              ...row,
              streaming: false,
              text: row.text || `Sorry — I couldn't get an answer right now. ${err.message || ''}`.trim(),
              error: true,
            }
            : row)));
          setStreaming(false);
        },
      },
    );
  }, [input, streaming, conversationId, anonId, lang]);

  const onRate = useCallback(async (messageId, rating) => {
    if (!messageId) return;
    setFeedbackState((s) => ({ ...s, [messageId]: 'pending' }));
    try {
      await sendFeedback({ messageId, rating });
      setFeedbackState((s) => ({ ...s, [messageId]: rating }));
    } catch {
      // Roll the indicator back so the user can retry.
      setFeedbackState((s) => {
        const next = { ...s };
        delete next[messageId];
        return next;
      });
    }
  }, []);

  const showStarters = msgs.filter((m) => m.role === 'user').length === 0;

  // Hide the widget while an event chat is open — two floating chat
  // surfaces on the same screen is confusing. We listen for the toggle
  // event dispatched by EventChat on mount/unmount, plus seed from a
  // global flag so the widget hides correctly even if EventChat
  // mounted before this listener attached.
  const [eventChatOpen, setEventChatOpen] = useState(
    typeof window !== 'undefined' && !!window.__icaiEventChatOpen,
  );
  useEffect(() => {
    const onToggle = (e) => setEventChatOpen(!!(e?.detail?.open));
    window.addEventListener('icai:event-chat-toggle', onToggle);
    return () => window.removeEventListener('icai:event-chat-toggle', onToggle);
  }, []);

  // When the event chat opens while ours is open, close ours so the
  // user isn't left with a stale panel hovering. The state is
  // suppressed, not destroyed — conversationId / messages stay.
  useEffect(() => {
    if (eventChatOpen && open) setOpen(false);
  }, [eventChatOpen, open]);

  if (eventChatOpen) return null;

  return (
    <>
      {open && (
        <div id="icai-pragyaan-panel" style={{
          position: 'fixed',
          bottom: '5.5rem',
          right: '1.5rem',
          width: 'min(380px, calc(100vw - 2rem))',
          height: '540px',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '1rem',
          boxShadow: '0 20px 60px -10px rgba(0,0,0,.22)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 200,
          overflow: 'hidden',
          animation: 'widgetSlideUp .2s ease',
        }}>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, var(--primary), var(--primary-darker))',
            color: 'white',
            padding: '.875rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '.75rem',
          }}>
            <div style={{
              width: '2.25rem', height: '2.25rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <img src={garudImg} alt="Garud" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '.9375rem', lineHeight: 1.2 }}>Pragyaan AI</div>
              <div style={{ fontSize: '.7rem', opacity: .8 }}>ICAI Nagpur Branch Assistant · 24×7</div>
            </div>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              aria-label="Reply language"
              style={{
                background: 'rgba(255,255,255,.18)',
                color: 'white',
                border: 'none',
                borderRadius: '.375rem',
                padding: '.3rem .45rem',
                fontSize: '.72rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {(config.languages || ['en']).map((l) => (
                <option key={l} value={l} style={{ color: '#111' }}>{LANG_LABEL[l] || l.toUpperCase()}</option>
              ))}
            </select>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              style={{ background: 'rgba(255,255,255,.15)', border: 0, color: 'white', padding: '.3rem', borderRadius: '.375rem', cursor: 'pointer', display: 'flex' }}
            >
              <IconX size="sm" />
            </button>
          </div>

          {/* Disclaimer banner */}
          <div style={{
            background: 'var(--muted)',
            color: 'var(--muted-foreground)',
            fontSize: '.68rem',
            lineHeight: 1.4,
            padding: '.5rem .875rem',
            borderBottom: '1px solid var(--border)',
          }}>
            {config.disclaimer || DEFAULT_DISCLAIMER}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '.875rem', display: 'flex', flexDirection: 'column', gap: '.625rem' }}>
            {msgs.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                feedback={feedbackState[m.messageId]}
                onRate={onRate}
                onAsk={send}
                streaming={streaming}
              />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions — only while the conversation is still empty */}
          {showStarters && starters.length > 0 && (
            <div style={{ padding: '0 .875rem .625rem', display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
              {starters.slice(0, 6).map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={streaming}
                  style={{
                    padding: '.3rem .7rem',
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    fontSize: '.7rem',
                    fontWeight: 500,
                    cursor: streaming ? 'default' : 'pointer',
                    color: 'var(--foreground)',
                    transition: 'all .12s',
                  }}
                  onMouseEnter={(e) => { if (!streaming) { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--foreground)'; }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '.625rem', display: 'flex', gap: '.5rem' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder={streaming ? 'Pragyaan is replying…' : 'Ask anything…'}
              disabled={streaming}
              style={{
                flex: 1, border: '1px solid var(--border)', borderRadius: '.5rem',
                padding: '.5rem .75rem', fontSize: '.8125rem', outline: 'none',
                background: 'var(--background)', color: 'var(--foreground)',
                transition: 'border-color .15s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || streaming}
              style={{
                background: input.trim() && !streaming ? 'var(--primary)' : 'var(--muted)',
                color: input.trim() && !streaming ? 'white' : 'var(--muted-foreground)',
                border: 0, borderRadius: '.5rem',
                padding: '.5rem .875rem', fontWeight: 600, fontSize: '.8125rem',
                cursor: input.trim() && !streaming ? 'pointer' : 'default',
                transition: 'all .15s',
              }}
            >
              {streaming ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {/* First-load greeting bubble — small intro speech bubble that pops
          up beside the FAB the first time a user lands on a page in this
          session. Waits for `fabReady` (Garud image fully loaded) so the
          bubble never appears pointing at a not-yet-rendered FAB. */}
      {!open && fabReady && <PragyaanGreeting />}

      {/* Floating trigger button — held offscreen until the Garud image
          has finished loading so the user never sees an empty
          placeholder ring. Uses opacity (not display:none) so its
          fade-in transition is smooth. */}
      <button
        id="icai-pragyaan-fab"
        onClick={() => setOpen((v) => !v)}
        title="Chat with Pragyaan AI"
        aria-hidden={!fabReady ? 'true' : undefined}
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          width: '5.5rem',
          height: '5.5rem',
          borderRadius: 999,
          background: open ? 'var(--primary-darker)' : 'transparent',
          color: open ? 'white' : 'var(--primary)',
          border: 0,
          overflow: 'visible',
          boxShadow: open ? '0 6px 24px rgba(0,0,0,.22)' : 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 201,
          // Held invisible until the Garud image is preloaded so the user
          // never sees a hollow circle before the bird paints.
          opacity: fabReady ? 1 : 0,
          pointerEvents: fabReady ? 'auto' : 'none',
          transition: 'opacity .35s ease, transform .15s, box-shadow .15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
          if (open) e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,.28)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          if (open) e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,.22)';
        }}
      >
        {open ? (
          <IconX />
        ) : (
          <img
            src={garudImg}
            alt="Garud"
            style={{ width: '130%', height: '130%', objectFit: 'contain', display: 'block' }}
          />
        )}
      </button>

      <style>{`
        /* Hide the floating FAB when any modal / drawer / cropper / dialog
           overlay is open. Without this, the bird renders on top of action
           buttons inside drawers (e.g. checklist "Submit for review",
           cropper "Crop & upload") — bad UX. The :has() selector is
           supported in all evergreen browsers (Chrome 105+, Safari 15.4+,
           Firefox 121+). */
        body:has(.admin-drawer-root) #icai-pragyaan-fab,
        body:has(.dialog-overlay)    #icai-pragyaan-fab,
        body:has(.modal-backdrop)    #icai-pragyaan-fab,
        body:has(.admin-drawer-root) .pg-greet,
        body:has(.dialog-overlay)    .pg-greet,
        body:has(.modal-backdrop)    .pg-greet {
          display: none !important;
        }

        @keyframes widgetSlideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); }
          30%           { transform: translateY(-4px); }
        }
      `}</style>
    </>
  );
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: '.25rem', alignItems: 'center', marginLeft: '.15rem' }}>
      {[0, 1, 2].map((d) => (
        <span key={d} style={{
          width: '.35rem', height: '.35rem', borderRadius: 999,
          background: 'var(--muted-foreground)',
          display: 'inline-block',
          animation: `typingDot .9s ${d * 0.2}s ease-in-out infinite`,
        }} />
      ))}
    </span>
  );
}

// Greeting speech-bubble that appears once per session next to the FAB.
// Surfaces after a short delay so it doesn't clash with the initial page
// paint; auto-hides after 15 s; dismissable via the × button.
//
// Key versioning: bumping the suffix invalidates any prior dismissals so
// every tester sees the bubble again on next reload. Bump it when you
// substantively change the copy or position.
const GREET_DISMISSED_KEY = 'pg-greet-dismissed-v3';
function PragyaanGreeting() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') {
      // SSR / no-storage env — still show.
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
    if (sessionStorage.getItem(GREET_DISMISSED_KEY)) return;
    // Wait for the page to settle before popping in.
    const showTimer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => dismiss(), 15000);
    return () => clearTimeout(t);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  function dismiss() {
    setLeaving(true);
    try { sessionStorage.setItem(GREET_DISMISSED_KEY, '1'); } catch { /* incognito */ }
    setTimeout(() => setVisible(false), 250);   // matches pgGreetOut keyframe
  }

  if (!visible) return null;

  return (
    <div className={'pg-greet' + (leaving ? ' pg-greet-leaving' : '')} role="status" aria-live="polite">
      <div className="pg-greet-row">
        <div className="pg-greet-text">
          Hi! I'm <span className="pg-greet-name">Pragyaan</span> — ask me anything about the branch, events, or membership.
        </div>
        <button
          type="button"
          className="pg-greet-close"
          aria-label="Dismiss greeting"
          onClick={dismiss}
        >
          ×
        </button>
      </div>
    </div>
  );
}

// Follow-up question chips — replaces the old citation chips (which
// looked like buttons but only led to the home page). After each
// answer the backend suggests 3 short related questions; clicking a
// chip submits it as the next turn.
function FollowUps({ items, onPick, disabled }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginTop: '.5rem', display: 'flex', flexWrap: 'wrap', gap: '.3rem' }}>
      {items.map((q, i) => (
        <button
          key={i}
          type="button"
          disabled={disabled}
          onClick={() => onPick?.(q)}
          style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '.25rem .65rem',
            borderRadius: 999, border: '1px solid var(--border)',
            background: 'var(--card)', color: 'var(--foreground)',
            fontSize: '.7rem', lineHeight: 1.2,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.55 : 1,
            textAlign: 'left',
            transition: 'background .12s, border-color .12s',
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.background = 'oklch(0.96 0.04 255 / .5)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.background = 'var(--card)';
          }}
        >
          {q}
        </button>
      ))}
    </div>
  );
}

function FeedbackButtons({ messageId, value, onRate }) {
  if (!messageId) return null;
  const isUp = value === 'up';
  const isDown = value === 'down';
  const isPending = value === 'pending';
  const btn = (active) => ({
    background: active ? 'var(--primary)' : 'transparent',
    color: active ? 'white' : 'var(--muted-foreground)',
    border: '1px solid var(--border)',
    borderRadius: '.35rem',
    padding: '.2rem .35rem',
    cursor: isPending ? 'default' : 'pointer',
    display: 'inline-flex', alignItems: 'center',
    opacity: isPending && !active ? 0.4 : 1,
    transition: 'all .15s',
  });
  return (
    <div style={{ display: 'flex', gap: '.25rem', marginTop: '.4rem', alignItems: 'center' }}>
      <button
        onClick={() => !isPending && onRate(messageId, 'up')}
        aria-label="Helpful"
        style={btn(isUp)}
        disabled={isPending}
      >
        <ThumbsUp filled={isUp} />
      </button>
      <button
        onClick={() => !isPending && onRate(messageId, 'down')}
        aria-label="Not helpful"
        style={btn(isDown)}
        disabled={isPending}
      >
        <ThumbsDown filled={isDown} />
      </button>
      {(isUp || isDown) && (
        <span style={{ fontSize: '.65rem', color: 'var(--muted-foreground)', display: 'inline-flex', alignItems: 'center', gap: '.2rem' }}>
          <IconCheck size="sm" /> Thanks
        </span>
      )}
    </div>
  );
}

function MessageBubble({ message, feedback, onRate, onAsk, streaming }) {
  const isUser = message.role === 'user';
  const bubbleStyle = {
    maxWidth: '80%',
    padding: '.5rem .875rem',
    borderRadius: isUser ? '.75rem .75rem 0 .75rem' : '.75rem .75rem .75rem 0',
    fontSize: '.8125rem',
    lineHeight: 1.5,
    background: isUser ? 'var(--primary)' : 'var(--muted)',
    color: isUser ? 'white' : 'var(--foreground)',
    wordBreak: 'break-word',
  };
  const text = message.text;
  const isStreamingEmpty = message.streaming && !text;

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && (
        <div style={{
          width: '1.5rem', height: '1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginRight: '.5rem', marginTop: '.1rem',
        }}>
          <img src={garudImg} alt="Garud" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%' }}>
        <div style={bubbleStyle}>
          {isUser ? (
            text
          ) : isStreamingEmpty ? (
            <TypingDots />
          ) : (
            <div className="pragyaan-prose" style={{ display: 'inline-block' }}>
              {renderMarkdown(text)}
              {message.streaming && <TypingDots />}
            </div>
          )}
        </div>
        {!isUser && !message.streaming && (
          <>
            <FollowUps items={message.followUps} onPick={onAsk} disabled={streaming} />
            <FeedbackButtons messageId={message.messageId} value={feedback} onRate={onRate} />
          </>
        )}
      </div>
    </div>
  );
}
