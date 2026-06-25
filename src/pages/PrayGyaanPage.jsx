import { useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useLang } from '../context/LanguageContext';
import { IconBot, IconSparkles, IconMessageSquare } from '../icons';

export default function PrayGyaanPage() {
  const { t } = useLang();
  const [msgs, setMsgs] = useState([
    { role: 'bot', text: t('ui.praygyaan.greeting', "Namaste! I'm PrayGyaan. Ask me about CPE events, UDIN, articleship, or branch services.") },
  ]);
  const [input, setInput] = useState('');

  const FEATURES = [
    { Icon: IconBot,          key: 'instant',  title: t('ui.praygyaan.instant_title', 'Instant Answers'), desc: t('ui.praygyaan.instant_desc', 'Quick replies on CPE, UDIN, COP and more.') },
    { Icon: IconSparkles,     key: 'smart',    title: t('ui.praygyaan.smart_title',   'Smart Search'),    desc: t('ui.praygyaan.smart_desc',   'Find circulars, events & resources fast.') },
    { Icon: IconMessageSquare,key: 'alwayson', title: t('ui.praygyaan.alwayson_title','Always On'),       desc: t('ui.praygyaan.alwayson_desc','Available 24×7 for members & students.') },
  ];

  const send = () => {
    if (!input.trim()) return;
    setMsgs((m) => [
      ...m,
      { role: 'user', text: input },
      { role: 'bot', text: t('ui.praygyaan.sample_reply', 'Thanks — a sample response will appear here once the AI backend is connected.') },
    ]);
    setInput('');
  };

  return (
    <>
      <PageHeader
        title={t('ui.praygyaan.page_title', 'PrayGyaan — AI Assistant')}
        subtitle={t('ui.praygyaan.page_subtitle', 'Your 24×7 guide to ICAI services, events and resources')}
      />
      <section className="container" style={{ padding: '3rem 1rem', maxWidth: '64rem' }}>
        <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {FEATURES.map((f) => (
            <div key={f.key} className="card">
              <f.Icon size="lg" />
              <div style={{ marginTop: '.75rem', fontWeight: 600 }}>{f.title}</div>
              <div className="muted-text" style={{ fontSize: '.875rem' }}>{f.desc}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: '2rem', padding: 0 }}>
          <div style={{ borderBottom: '1px solid var(--border)', padding: '.75rem 1.25rem', fontWeight: 600 }}>
            {t('ui.praygyaan.chat_heading', 'Chat with PrayGyaan')}
          </div>
          <div style={{ height: '20rem', overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            {msgs.map((m, i) => (
              <div key={i} className="row" style={{ justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%', padding: '.5rem 1rem', borderRadius: '.5rem', fontSize: '.875rem',
                  background: m.role === 'user' ? 'var(--primary)' : 'var(--muted)',
                  color: m.role === 'user' ? 'var(--primary-foreground)' : 'var(--foreground)',
                }}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <div className="row gap-2" style={{ borderTop: '1px solid var(--border)', padding: '.75rem' }}>
            <input
              className="input-base"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={t('ui.praygyaan.placeholder', 'Ask anything…')}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={send}>{t('ui.praygyaan.send_btn', 'Send')}</button>
          </div>
        </div>
      </section>
    </>
  );
}
