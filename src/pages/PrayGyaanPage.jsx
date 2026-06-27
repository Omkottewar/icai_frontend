import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { IconBot, IconSparkles, IconMessageSquare, IconShield, IconCheck } from '../icons';
import garudImg from '../assets/garud.png';
import { renderMarkdown } from '../lib/markdown.jsx';
import { useSiteContent } from '../hooks/useSiteContent';
import {
  getAnonId, getConfig, getStarters, streamChat, sendFeedback,
} from '../lib/pragyaan';

const DEFAULT_DISCLAIMER =
  'Pragyaan is an AI assistant that answers from the ICAI Nagpur Branch knowledge base. ' +
  'Responses are general information, not professional, legal, or financial advice, and may be ' +
  'incomplete or out of date. Verify important details with the branch before acting.';

const LANG_LABEL = { en: 'English', hi: 'हिन्दी', mr: 'मराठी' };

const FEATURE_ICONS = [IconBot, IconSparkles, IconMessageSquare];

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

function cryptoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function PrayGyaanPage() {
  const header   = useSiteContent('praygyaan_page_header');
  const features = useSiteContent('praygyaan_features');
  const welcomeMessage = useMemo(() => ({
    id: 'welcome',
    role: 'assistant',
    text: features.welcome,
    citations: [],
    streaming: false,
  }), [features.welcome]);

  const [msgs, setMsgs] = useState(() => [welcomeMessage]);
  // Keep the welcome message in sync if an admin edits it while the page
  // is mounted (rare, but cheap).
  useEffect(() => {
    setMsgs((m) => (m.length > 0 && m[0].id === 'welcome' ? [welcomeMessage, ...m.slice(1)] : m));
  }, [welcomeMessage]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [lang, setLang] = useState('en');
  const [config, setConfig] = useState({ disclaimer: DEFAULT_DISCLAIMER, languages: ['en', 'hi', 'mr'] });
  const [starters, setStarters] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [feedbackState, setFeedbackState] = useState({});

  const bottomRef = useRef(null);
  const streamRef = useRef(null);
  const anonId = useMemo(() => getAnonId(), []);

  useEffect(() => {
    getConfig().then(setConfig).catch(() => { /* keep defaults */ });
    getStarters()
      .then((r) => setStarters(Array.isArray(r?.starters) ? r.starters : []))
      .catch(() => setStarters([]));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  useEffect(() => () => streamRef.current?.abort(), []);

  const send = useCallback((textArg) => {
    const q = (textArg ?? input).trim();
    if (!q || streaming) return;
    setInput('');

    const assistantId = cryptoId();
    setMsgs((m) => [
      ...m,
      { id: cryptoId(), role: 'user', text: q },
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
      setFeedbackState((s) => {
        const next = { ...s };
        delete next[messageId];
        return next;
      });
    }
  }, []);

  const showStarters = msgs.filter((m) => m.role === 'user').length === 0;

  return (
    <>
      <PageHeader title={header.title} subtitle={header.subtitle} />
      <section className="container" style={{ padding: '3rem 1rem', maxWidth: '64rem' }}>
        {/* Feature cards — admin-editable via the praygyaan_features slot */}
        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {[1, 2, 3].map((n) => {
            const Icon = FEATURE_ICONS[n - 1];
            const t = features[`card_${n}_title`];
            const d = features[`card_${n}_desc`];
            if (!t) return null;
            return (
              <div key={n} className="card">
                <Icon size="lg" />
                <div style={{ marginTop: '.75rem', fontWeight: 600 }}>{t}</div>
                <div className="muted-text" style={{ fontSize: '.875rem' }}>{d}</div>
              </div>
            );
          })}
        </div>

        {/* Chat card */}
        <div className="card" style={{ marginTop: '2rem', padding: 0, overflow: 'hidden' }}>
          <div style={{
            borderBottom: '1px solid var(--border)',
            padding: '.75rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '.75rem',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.55rem', fontWeight: 600 }}>
              <div style={{
                width: '1.75rem', height: '1.75rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img src={garudImg} alt="Garud" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              {features.chat_title}
            </div>

            <div style={{ flex: 1 }} />

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', fontSize: '.78rem', color: 'var(--muted-foreground)' }}>
              {features.reply_in_label}
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '.4rem',
                  padding: '.25rem .45rem',
                  fontSize: '.78rem',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                }}
              >
                {(config.languages || ['en']).map((l) => (
                  <option key={l} value={l}>{LANG_LABEL[l] || l.toUpperCase()}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Disclaimer banner */}
          <div style={{
            background: 'var(--muted)',
            color: 'var(--muted-foreground)',
            fontSize: '.75rem',
            lineHeight: 1.45,
            padding: '.6rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '.5rem',
          }}>
            <IconShield size="sm" />
            <span>{config.disclaimer || DEFAULT_DISCLAIMER}</span>
          </div>

          {/* Messages */}
          <div style={{
            height: 'min(60vh, 26rem)',
            overflowY: 'auto',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '.85rem',
          }}>
            {msgs.map((m) => (
              <MessageRow
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

          {/* Starters */}
          {showStarters && starters.length > 0 && (
            <div style={{
              padding: '.5rem 1.25rem 1rem',
              display: 'flex', flexWrap: 'wrap', gap: '.4rem',
              borderTop: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '.72rem', color: 'var(--muted-foreground)', alignSelf: 'center', marginRight: '.25rem' }}>
                {features.starters_prefix}
              </span>
              {starters.map((s) => (
                <button
                  key={s}
                  className="btn"
                  onClick={() => send(s)}
                  disabled={streaming}
                  style={{
                    padding: '.3rem .75rem',
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    fontSize: '.75rem',
                    fontWeight: 500,
                    cursor: streaming ? 'default' : 'pointer',
                    color: 'var(--foreground)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="row gap-2" style={{ borderTop: '1px solid var(--border)', padding: '.75rem' }}>
            <input
              className="input-base"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder={streaming ? features.input_placeholder_streaming : features.input_placeholder}
              disabled={streaming}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
              onClick={() => send()}
              disabled={!input.trim() || streaming}
            >
              {streaming ? features.send_label_streaming : features.send_label}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: '.25rem', alignItems: 'center', marginLeft: '.2rem' }}>
      {[0, 1, 2].map((d) => (
        <span key={d} style={{
          width: '.4rem', height: '.4rem', borderRadius: 999,
          background: 'var(--muted-foreground)',
          display: 'inline-block',
          animation: `pgDot .9s ${d * 0.2}s ease-in-out infinite`,
        }} />
      ))}
      <style>{`@keyframes pgDot { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }`}</style>
    </span>
  );
}

// Follow-up question chips — replaces the old citation chips. After
// each answer the backend suggests 3 short related questions; clicking
// a chip pre-fills the composer and submits.
function FollowUps({ items, onPick, disabled }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginTop: '.6rem' }}>
      <div style={{ fontSize: '.7rem', color: 'var(--muted-foreground)', marginBottom: '.3rem' }}>
        Ask next
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem' }}>
        {items.map((q, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onPick?.(q)}
            style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '.3rem .75rem',
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--card)',
              color: 'var(--foreground)',
              fontSize: '.78rem', lineHeight: 1.3,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.55 : 1,
              textAlign: 'left',
              maxWidth: '100%',
              transition: 'background .12s, border-color .12s, transform .12s',
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
    padding: '.25rem .4rem',
    cursor: isPending ? 'default' : 'pointer',
    display: 'inline-flex', alignItems: 'center',
    opacity: isPending && !active ? 0.4 : 1,
    transition: 'all .15s',
  });
  return (
    <div style={{ display: 'flex', gap: '.35rem', marginTop: '.5rem', alignItems: 'center' }}>
      <span style={{ fontSize: '.7rem', color: 'var(--muted-foreground)' }}>Was this helpful?</span>
      <button onClick={() => !isPending && onRate(messageId, 'up')} aria-label="Helpful" style={btn(isUp)} disabled={isPending}>
        <ThumbsUp filled={isUp} />
      </button>
      <button onClick={() => !isPending && onRate(messageId, 'down')} aria-label="Not helpful" style={btn(isDown)} disabled={isPending}>
        <ThumbsDown filled={isDown} />
      </button>
      {(isUp || isDown) && (
        <span style={{ fontSize: '.7rem', color: 'var(--muted-foreground)', display: 'inline-flex', alignItems: 'center', gap: '.2rem' }}>
          <IconCheck size="sm" /> Thanks for the feedback
        </span>
      )}
    </div>
  );
}

function MessageRow({ message, feedback, onRate, onAsk, streaming }) {
  const isUser = message.role === 'user';
  const bubbleStyle = {
    padding: '.65rem 1rem',
    borderRadius: isUser ? '.85rem .85rem .15rem .85rem' : '.85rem .85rem .85rem .15rem',
    fontSize: '.9rem',
    lineHeight: 1.55,
    background: isUser ? 'var(--primary)' : 'var(--muted)',
    color: isUser ? 'var(--primary-foreground)' : 'var(--foreground)',
    wordBreak: 'break-word',
  };
  const isStreamingEmpty = message.streaming && !message.text;

  return (
    <div className="row" style={{ justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-start' }}>
      {!isUser && (
        <div style={{
          width: '1.85rem', height: '1.85rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginRight: '.55rem', marginTop: '.15rem',
        }}>
          <img src={garudImg} alt="Garud" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: isUser ? '80%' : 'min(38rem, 85%)' }}>
        <div style={bubbleStyle}>
          {isUser ? (
            message.text
          ) : isStreamingEmpty ? (
            <TypingDots />
          ) : (
            <div className="pragyaan-prose">
              {renderMarkdown(message.text)}
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
