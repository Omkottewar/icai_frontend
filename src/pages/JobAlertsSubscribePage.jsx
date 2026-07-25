import { useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useSiteContent } from '../hooks/useSiteContent';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../hooks/useRoute';
import { renderMarkdown } from '../lib/markdown.jsx';
import SubscribeAlertsModal from '../components/jobs/SubscribeAlertsModal';
import { IconBell } from '../icons';

export default function JobAlertsSubscribePage() {
  const copy = useSiteContent('job_alerts_subscribe');
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  function open() {
    if (!user) {
      navigate('/login?next=' + encodeURIComponent('/job-alerts/subscribe'));
      return;
    }
    setModalOpen(true);
  }

  return (
    <>
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <section className="container" style={{ padding: '2.5rem 1rem', display: 'grid', gap: '2rem', maxWidth: '52rem' }}>
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ color: 'var(--primary)', marginBottom: '.5rem' }}><IconBell size="lg" /></div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Ready to subscribe?</h2>
          <p className="muted-text" style={{ margin: '.5rem auto 1rem', fontSize: '.9rem', maxWidth: '32rem' }}>
            Pick your categories and delivery frequency below. You can update or unsubscribe anytime.
          </p>
          <button
            type="button"
            onClick={open}
            className="btn btn-primary"
            style={{ padding: '.65rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}
          >
            <IconBell size="sm" /> Choose categories & subscribe
          </button>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ lineHeight: 1.65, fontSize: '.925rem' }}>
            {renderMarkdown(copy.how_it_works)}
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ lineHeight: 1.65, fontSize: '.925rem' }}>
            {renderMarkdown(copy.faq)}
          </div>
        </div>
      </section>

      {modalOpen && <SubscribeAlertsModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
