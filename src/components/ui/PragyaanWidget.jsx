import { useState, useRef, useEffect } from 'react';
import { IconX, IconThumbsUp, IconThumbsDown, IconCheck } from '../../icons';
import garudImg from '../../assets/garud.png';
import { usePragyaanChat } from '../../hooks/usePragyaanChat';
import { useAuth } from '../../context/AuthContext';

// Fallback suggestions shown before the role-aware /starters response lands
// (or if that request fails).
const FALLBACK_SUGGESTIONS = [
  'Upcoming CPE events',
  'How to generate UDIN?',
  'Articleship vacancies',
  'Branch contact details',
];

const GREETING = "Namaste! I'm Pragyaan — your ICAI Nagpur Branch assistant. Ask me about CPE events, UDIN, articleship, branch services, or anything else.";

// Supported reply languages (passed through to the backend as `lang`).
const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'HI' },
  { code: 'mr', label: 'MR' },
];

// Resolve a clickable href for a citation. Prefer the explicit url; otherwise
// derive a sensible same-app deep link from origin_kind/origin_id when the
// server provides them. Returns null when neither is available (render a
// plain, non-link label in that case — never invent a destination).
function citationHref(c) {
  if (c.url) return c.url;
  const kind = c.origin_kind || c.source_kind;
  const id = c.origin_id ?? c.source_ref_id;
  if (kind && id != null) {
    const map = { event: '/events/', circular: '/circulars/', resource: '/resources/', notification: '/notifications/' };
    const base = map[kind];
    if (base) return `#${base}${id}`;
  }
  return null;
}

export default function PragyaanWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [lang, setLang] = useState('en');
  const bottomRef = useRef(null);

  const { messages, sendMessage, streaming, starters, config, submitFeedback } = usePragyaanChat();
  const { user } = useAuth();

  const suggestions = starters && starters.length ? starters : FALLBACK_SUGGESTIONS;
  // Show the greeting + suggestions only before the visitor has sent anything.
  const isEmpty = messages.length === 0;

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, streaming]);

  const send = (text) => {
    const q = (text || input).trim();
    if (!q || streaming) return;
    setInput('');
    sendMessage(q, lang);
  };

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: '5.5rem',
          right: '1.5rem',
          width: 'min(360px, calc(100vw - 2rem))',
          height: 'min(480px, calc(100vh - 8rem))',
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
              width: '2.25rem', height: '2.25rem', borderRadius: 999,
              background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
            }}>
              <img src={garudImg} alt="Garud" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '.9375rem', lineHeight: 1.2 }}>Pragyaan AI</div>
              <div style={{ fontSize: '.7rem', opacity: .8 }}>ICAI Nagpur Branch Assistant · 24×7</div>
            </div>
            {/* Language selector */}
            <select
              aria-label="Reply language"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              style={{
                background: 'rgba(255,255,255,.15)', border: 0, color: 'white',
                padding: '.25rem .35rem', borderRadius: '.375rem', fontSize: '.7rem',
                fontWeight: 600, cursor: 'pointer', outline: 'none',
              }}
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code} style={{ color: 'var(--foreground)' }}>{l.label}</option>
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

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '.875rem', display: 'flex', flexDirection: 'column', gap: '.625rem' }}>
            {/* Greeting bubble — always shown first */}
            <Bubble role="assistant" text={GREETING} />

            {messages.map((m, i) => (
              <Bubble
                key={i}
                role={m.role}
                text={m.content}
                citations={m.citations}
                streaming={m.streaming}
                noAnswer={m.noAnswer}
                error={m.error}
                messageId={m.messageId}
                loggedOut={!user}
                onFeedback={submitFeedback}
              />
            ))}

            {/* Typing indicator — while the assistant message has no text yet mid-stream */}
            {streaming && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.content && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <div style={{
                  width: '1.5rem', height: '1.5rem', borderRadius: 999,
                  background: '#fff',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  overflow: 'hidden',
                }}>
                  <img src={garudImg} alt="Garud" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
                </div>
                <div style={{
                  padding: '.5rem .875rem', borderRadius: '.75rem .75rem .75rem 0',
                  background: 'var(--muted)', display: 'flex', gap: '.3rem', alignItems: 'center',
                }}>
                  {[0, 1, 2].map((d) => (
                    <span key={d} style={{
                      width: '.375rem', height: '.375rem', borderRadius: 999,
                      background: 'var(--muted-foreground)',
                      display: 'inline-block',
                      animation: `typingDot .9s ${d * 0.2}s ease-in-out infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions — only shown when no user messages yet */}
          {isEmpty && (
            <div style={{ padding: '0 .875rem .625rem', display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{
                    padding: '.3rem .7rem',
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    fontSize: '.7rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    color: 'var(--foreground)',
                    transition: 'all .12s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
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
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask anything…"
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
                background: (input.trim() && !streaming) ? 'var(--primary)' : 'var(--muted)',
                color: (input.trim() && !streaming) ? 'white' : 'var(--muted-foreground)',
                border: 0, borderRadius: '.5rem',
                padding: '.5rem .875rem', fontWeight: 600, fontSize: '.8125rem',
                cursor: (input.trim() && !streaming) ? 'pointer' : 'default',
                transition: 'all .15s',
              }}
            >
              Send
            </button>
          </div>

          {/* Disclaimer — shown once under the input */}
          {config?.disclaimer && (
            <div style={{
              padding: '0 .75rem .625rem', fontSize: '.625rem', lineHeight: 1.4,
              color: 'var(--muted-foreground)', textAlign: 'center',
            }}>
              {config.disclaimer}
            </div>
          )}
        </div>
      )}

      {/* Floating trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Chat with Pragyaan AI"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          width: '3.5rem',
          height: '3.5rem',
          borderRadius: 999,
          background: open ? 'var(--primary-darker)' : '#fff',
          color: open ? 'white' : 'var(--primary)',
          border: open ? 0 : '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: '0 6px 24px rgba(0,0,0,.22)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 201,
          transition: 'transform .15s, box-shadow .15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,.28)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,.22)'; }}
      >
        {open ? (
          <IconX />
        ) : (
          <img
            src={garudImg}
            alt="Garud"
            style={{ width: '110%', height: '110%', objectFit: 'contain', display: 'block' }}
          />
        )}

        {/* Pulse ring when closed */}
        {!open && (
          <span style={{
            position: 'absolute', inset: 0, borderRadius: 999,
            border: '2px solid var(--primary)',
            animation: 'pulseRing 2s ease-out infinite',
            pointerEvents: 'none',
          }} />
        )}
      </button>

      <style>{`
        @keyframes widgetSlideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
        @keyframes pulseRing {
          0%   { transform: scale(1);    opacity: .6; }
          70%  { transform: scale(1.45); opacity: 0;  }
          100% { transform: scale(1.45); opacity: 0;  }
        }
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); }
          30%           { transform: translateY(-4px); }
        }
        @keyframes pragyaanCaret { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </>
  );
}

// One chat bubble. `role` is 'user' | 'assistant'; assistant bubbles get the
// Garud avatar, optional citation chips, a blinking caret while streaming, a
// logged-out login nudge on no-answer, and thumbs up/down feedback.
function Bubble({ role, text, citations, streaming, noAnswer, error, messageId, loggedOut, onFeedback }) {
  const isUser = role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && (
        <div style={{
          width: '1.5rem', height: '1.5rem', borderRadius: 999,
          background: '#fff',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginRight: '.5rem', marginTop: '.1rem',
          overflow: 'hidden',
        }}>
          <img src={garudImg} alt="Garud" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
        </div>
      )}
      <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
        <div style={{
          padding: '.5rem .875rem',
          borderRadius: isUser ? '.75rem .75rem 0 .75rem' : '.75rem .75rem .75rem 0',
          fontSize: '.8125rem',
          lineHeight: 1.5,
          background: isUser ? 'var(--primary)' : 'var(--muted)',
          color: isUser ? 'white' : (error ? 'var(--destructive, #b91c1c)' : 'var(--foreground)'),
          whiteSpace: 'pre-wrap',
        }}>
          {error ? (error) : (text || '')}
          {/* Blinking caret while the assistant text is streaming in */}
          {!isUser && streaming && text && (
            <span style={{
              display: 'inline-block', width: '.4rem', marginLeft: '1px',
              animation: 'pragyaanCaret 1s steps(1) infinite',
            }}>▍</span>
          )}
        </div>

        {/* No-answer + logged-out nudge: surface member resources without
            claiming gated content exists. */}
        {!isUser && noAnswer && loggedOut && (
          <a
            href="#/login"
            style={{ fontSize: '.7rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}
          >
            Log in for member resources →
          </a>
        )}

        {/* Citation chips */}
        {!isUser && citations && citations.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.3rem' }}>
            {citations.map((c, i) => {
              const href = citationHref(c);
              const label = c.title || `Source ${i + 1}`;
              const chipStyle = {
                padding: '.15rem .5rem',
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                fontSize: '.65rem',
                fontWeight: 500,
                color: href ? 'var(--primary)' : 'var(--muted-foreground)',
                textDecoration: 'none',
              };
              const key = c.chunk_id || c.source_id || i;
              const isExternal = href && /^https?:\/\//i.test(href);
              return href ? (
                <a key={key} href={href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noreferrer' : undefined} style={chipStyle}>
                  {label}
                </a>
              ) : (
                <span key={key} style={chipStyle}>{label}</span>
              );
            })}
          </div>
        )}

        {/* Feedback — thumbs up/down on completed assistant messages */}
        {!isUser && !streaming && !error && messageId && (
          <FeedbackButtons messageId={messageId} onFeedback={onFeedback} />
        )}
      </div>
    </div>
  );
}

// Thumbs up/down for a single assistant message. Reflects the submitted state
// and tolerates the backend's 503 "not ready" (submitFeedback resolves false).
function FeedbackButtons({ messageId, onFeedback }) {
  const [submitted, setSubmitted] = useState(null); // 'up' | 'down'
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const vote = async (rating) => {
    if (busy || submitted) return;
    setBusy(true);
    setFailed(false);
    const ok = await onFeedback?.(messageId, rating);
    setBusy(false);
    if (ok) setSubmitted(rating);
    else setFailed(true);
  };

  if (submitted) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem', fontSize: '.65rem', color: 'var(--muted-foreground)' }}>
        <IconCheck size="sm" /> Thanks for the feedback
      </div>
    );
  }

  const btn = {
    background: 'transparent', border: 0, padding: '.15rem', cursor: 'pointer',
    color: 'var(--muted-foreground)', display: 'flex', lineHeight: 0,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.25rem' }}>
      <button type="button" aria-label="Helpful" title="Helpful" onClick={() => vote('up')} disabled={busy} style={btn}>
        <IconThumbsUp size="sm" />
      </button>
      <button type="button" aria-label="Not helpful" title="Not helpful" onClick={() => vote('down')} disabled={busy} style={btn}>
        <IconThumbsDown size="sm" />
      </button>
      {failed && <span style={{ fontSize: '.6rem', color: 'var(--muted-foreground)' }}>Try again later</span>}
    </div>
  );
}
