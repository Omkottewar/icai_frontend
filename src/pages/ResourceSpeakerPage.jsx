import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useRoute, navigate } from '../hooks/useRoute';
import { ShimmerPageBody } from '../components/ui/Shimmer';

// Speaker profile — every published paper by one author. External speakers
// (uploaded by admin without a member account) get a minimal version of
// this page; member-authors get name + email visible.

async function api(url) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export default function ResourceSpeakerPage() {
  const route = useRoute();
  const slugOrId = route.path.split('/').pop();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!slugOrId) return;
    api(`/api/resources/speakers/${slugOrId}`)
      .then((r) => setData(r))
      .catch((e) => setErr(e.message));
  }, [slugOrId]);

  if (err) {
    return (
      <section className="container" style={{ padding: '3rem 1rem' }}>
        <p style={{ color: 'var(--destructive)' }}>{err}</p>
        <a href="/resources">← Back to Resources</a>
      </section>
    );
  }
  if (!data) {
    return <ShimmerPageBody cards={3} />;
  }

  return (
    <>
      <PageHeader title={data.speaker.name} subtitle={`${data.papers.length} paper${data.papers.length === 1 ? '' : 's'} published`} />
      <section className="container" style={{ padding: '1.5rem 1rem 3rem', maxWidth: '900px' }}>
        <a href="/resources">← All resources</a>

        <div className="sp-grid" style={{ marginTop: '1.5rem' }}>
          {data.papers.map((p) => (
            <a key={p.id} href={`/resources/papers/${p.slug}`} className="sp-card">
              {p.cover_url
                ? <div className="sp-card-cover" style={{ backgroundImage: `url(${p.cover_url})` }} />
                : <div className="sp-card-cover sp-card-cover-fallback"><span>📄</span></div>
              }
              <div className="sp-card-body">
                <strong>{p.title}</strong>
                {p.abstract && <p className="muted-text">{p.abstract}</p>}
                <div className="sp-meta">
                  {p.presented_on && <span>📅 {new Date(p.presented_on).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>}
                  {p.view_count > 0 && <span>👁 {p.view_count}</span>}
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <style>{`
        .sp-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
        .sp-card { display: flex; flex-direction: column; background: var(--card); border: 1px solid var(--border); border-radius: .55rem; overflow: hidden; text-decoration: none; color: inherit; transition: all .12s; }
        .sp-card:hover { border-color: var(--primary); transform: translateY(-2px); }
        .sp-card-cover { aspect-ratio: 16 / 9; background-size: cover; background-position: center; background-color: var(--background); }
        .sp-card-cover-fallback { display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1e40af, #2563eb); color: white; font-size: 2rem; }
        .sp-card-body { padding: .85rem; display: flex; flex-direction: column; gap: .35rem; }
        .sp-card-body strong { font-size: .95rem; line-height: 1.35; }
        .sp-card-body p { margin: 0; font-size: .8125rem; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .sp-meta { display: flex; gap: .85rem; font-size: .7rem; color: var(--muted-foreground); }
      `}</style>
    </>
  );
}
