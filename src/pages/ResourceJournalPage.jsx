import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useRoute, navigate } from '../hooks/useRoute';
import { IconDownload, IconBookOpen } from '../icons';
import { ShimmerPageBody } from '../components/ui/Shimmer';

// E-journal issue detail. Shares the comment thread component with the
// paper page (loaded inline here to keep the file self-contained — small
// enough not to warrant pulling into shared module).

async function api(url, opts = {}) {
  const r = await fetch(url, {
    credentials: 'include',
    method: opts.method || 'GET',
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (r.status === 401) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function ResourceJournalPage() {
  const { user } = useAuth();
  const route = useRoute();
  const slug = route.path.split('/').pop();
  const [issue, setIssue] = useState(null);
  const [err, setErr] = useState('');
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api(`/api/resources/ejournal-issues/${slug}`)
      .then((r) => setIssue(r?.issue || null))
      .catch((e) => setErr(e.message));
  }, [slug]);

  useEffect(() => {
    if (!user || !issue) return;
    api('/api/resources/bookmarks/my').then((r) => {
      setBookmarked((r?.items || []).some((x) => x.resource_type === 'ejournal' && x.slug === issue.slug));
    });
  }, [user?.id, issue?.id]);

  const toggleBookmark = async () => {
    if (!user) { navigate('/login'); return; }
    setBookmarked((b) => !b);
    try {
      await api('/api/resources/bookmarks', { method: 'POST', body: { resource_type: 'ejournal', resource_id: issue.id } });
    } catch { setBookmarked((b) => !b); }
  };

  const shareWhatsApp = () => {
    const text = `${issue.title} — ${issue.issue_label}\n${window.location.origin}/#/resources/journal/${issue.slug}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (err) {
    return (
      <section className="container" style={{ padding: '3rem 1rem' }}>
        <p style={{ color: 'var(--destructive)' }}>{err}</p>
        <a href="#/resources">← Back to Resources</a>
      </section>
    );
  }
  if (!issue) {
    return <ShimmerPageBody cards={3} />;
  }

  return (
    <>
      <PageHeader title="E-Journal" />
      <section className="container" style={{ padding: '1.5rem 1rem 3rem', maxWidth: '900px' }}>
        <a href="#/resources">← All resources</a>

        <div className="jp-hero">
          {issue.cover_url
            ? <div className="jp-cover" style={{ backgroundImage: `url(${issue.cover_url})` }} />
            : <div className="jp-cover jp-cover-fallback"><IconBookOpen /></div>
          }
          <div className="jp-meta">
            <span className="jp-label">{issue.issue_label}</span>
            <h1>{issue.title}</h1>
            {issue.editorial_summary && <p>{issue.editorial_summary}</p>}
            <div className="jp-actions">
              {issue.pdf_url && (
                <a href={issue.pdf_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                  <IconDownload size="sm" /> <span>Read / Download</span>
                </a>
              )}
              <button type="button" className={'btn btn-outline' + (bookmarked ? ' jp-on' : '')} onClick={toggleBookmark}>
                {bookmarked ? '★ Saved' : '☆ Save'}
              </button>
              <button type="button" className="btn btn-outline jp-wa" onClick={shareWhatsApp}>💬 WhatsApp</button>
            </div>
          </div>
        </div>

        <style>{`
          .jp-hero { display: grid; grid-template-columns: minmax(160px, 240px) 1fr; gap: 1.5rem; margin-top: 1.5rem; align-items: start; }
          @media (max-width: 640px) { .jp-hero { grid-template-columns: 1fr; } }
          .jp-cover { aspect-ratio: 3 / 4; background-size: cover; background-position: center; border-radius: .55rem; background-color: var(--background); }
          .jp-cover-fallback { display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1e40af, #2563eb); color: white; font-size: 3rem; }
          .jp-meta { display: flex; flex-direction: column; gap: .65rem; }
          .jp-label { font-size: .75rem; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: .04em; }
          .jp-meta h1 { font-size: 1.85rem; line-height: 1.2; margin: 0; }
          .jp-meta p { font-size: .95rem; line-height: 1.55; color: var(--foreground); margin: 0; }
          .jp-actions { display: flex; gap: .5rem; flex-wrap: wrap; margin-top: .5rem; }
          .jp-on { background: #fef3c7; border-color: #fcd34d; color: #92400e; }
          .jp-wa { background: #25d366 !important; color: white !important; border-color: #25d366 !important; }
        `}</style>
      </section>
    </>
  );
}
