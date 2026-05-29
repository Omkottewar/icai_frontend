import { useState, useRef, useEffect } from 'react';
import { IconBot, IconX, IconSparkles } from '../../icons';
import garudImg from '../../assets/garud.png';

const SUGGESTIONS = [
  'Upcoming CPE events',
  'How to generate UDIN?',
  'Articleship vacancies',
  'Branch contact details',
];

export default function PrayGyaanWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([
    { role: 'bot', text: "Namaste! I'm PrayGyaan — your ICAI Nagpur Branch assistant. Ask me about CPE events, UDIN, articleship, branch services, or anything else." },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, open]);

  const send = (text) => {
    const q = (text || input).trim();
    if (!q) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, {
        role: 'bot',
        text: 'Thanks for your query! This is a demo response — the AI backend will provide live answers once connected.',
      }]);
    }, 1000);
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
          height: '480px',
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
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '.9375rem', lineHeight: 1.2 }}>PrayGyaan AI</div>
              <div style={{ fontSize: '.7rem', opacity: .8 }}>ICAI Nagpur Branch Assistant · 24×7</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'rgba(255,255,255,.15)', border: 0, color: 'white', padding: '.3rem', borderRadius: '.375rem', cursor: 'pointer', display: 'flex' }}
            >
              <IconX size="sm" />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '.875rem', display: 'flex', flexDirection: 'column', gap: '.625rem' }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {m.role === 'bot' && (
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
                <div style={{
                  maxWidth: '80%',
                  padding: '.5rem .875rem',
                  borderRadius: m.role === 'user' ? '.75rem .75rem 0 .75rem' : '.75rem .75rem .75rem 0',
                  fontSize: '.8125rem',
                  lineHeight: 1.5,
                  background: m.role === 'user' ? 'var(--primary)' : 'var(--muted)',
                  color: m.role === 'user' ? 'white' : 'var(--foreground)',
                }}>
                  {m.text}
                </div>
              </div>
            ))}

            {typing && (
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
          {msgs.length === 1 && (
            <div style={{ padding: '0 .875rem .625rem', display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
              {SUGGESTIONS.map((s) => (
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
              disabled={!input.trim()}
              style={{
                background: input.trim() ? 'var(--primary)' : 'var(--muted)',
                color: input.trim() ? 'white' : 'var(--muted-foreground)',
                border: 0, borderRadius: '.5rem',
                padding: '.5rem .875rem', fontWeight: 600, fontSize: '.8125rem',
                cursor: input.trim() ? 'pointer' : 'default',
                transition: 'all .15s',
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Floating trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Chat with PrayGyaan AI"
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
      `}</style>
    </>
  );
}
