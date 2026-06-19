import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../hooks/useRoute';
import { IconBookOpen, IconAward } from '../icons';
import { Shimmer, ShimmerLines } from '../components/ui/Shimmer';

// "My Library" — every paper / e-journal issue this user has bookmarked,
// plus their CPE quiz history (passed papers + total minutes). One page
// because both are about "what I've engaged with so far".

async function api(url) {
  const r = await fetch(url, { credentials: 'include' });
  if (r.status === 401) return null;
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export default function MyLibraryPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState(null);
  const [cpe, setCpe] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/login'); return; }
    api('/api/resources/bookmarks/my').then((r) => setItems(r?.items || [])).catch(() => setItems([]));
    api('/api/resources/cpe/my').then((r) => setCpe(r)).catch(() => setCpe({ total_minutes: 0, items: [] }));
  }, [user?.id, loading]);

  if (!user) return null;

  return (
    <>
      <PageHeader title="My Library" subtitle="Your saved papers and CPE history." />
      <section className="container" style={{ padding: '1.5rem 1rem 3rem', maxWidth: '900px' }}>
        {/* CPE summary tile */}
        {cpe && (
          <div className="ml-cpe-tile">
            <IconAward />
            <div>
              <strong>{Math.round(cpe.total_minutes / 60 * 10) / 10} hours unstructured CPE earned</strong>
              <p className="muted-text" style={{ fontSize: '.85rem', margin: '.15rem 0 0' }}>
                Across {cpe.items.length} paper{cpe.items.length === 1 ? '' : 's'} passed.
              </p>
            </div>
          </div>
        )}

        {/* Bookmarks section */}
        <h2 className="ml-section">Saved papers & issues</h2>
        {items === null && (
          <div className="ml-grid" aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                <Shimmer height=".7rem" width="35%" />
                <Shimmer height="1rem" width="80%" />
                <ShimmerLines count={2} lastWidth="55%" />
              </div>
            ))}
          </div>
        )}
        {items && items.length === 0 && (
          <div className="ml-empty">
            <IconBookOpen />
            <strong>You haven't saved anything yet.</strong>
            <p className="muted-text">Tap "Save to library" on any paper to add it here.</p>
            <a href="#/resources" className="btn btn-primary" style={{ marginTop: '.75rem' }}>Browse resources →</a>
          </div>
        )}
        {items && items.length > 0 && (
          <div className="ml-grid">
            {items.map((item) => <SavedCard key={item.bookmark_id} item={item} />)}
          </div>
        )}

        {/* CPE detail — passed quizzes */}
        {cpe && cpe.items.length > 0 && (
          <>
            <h2 className="ml-section" style={{ marginTop: '2rem' }}>CPE history</h2>
            <ul className="ml-cpe-list">
              {cpe.items.map((c) => (
                <li key={c.attempt_id}>
                  <a href={`#/resources/papers/${c.paper_slug}`}>
                    <strong>{c.paper_title}</strong>
                    <span className="muted-text"> · {c.minutes} min · {new Date(c.completed_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <style>{`
        .ml-cpe-tile {
          display: flex; align-items: center; gap: 1rem;
          padding: 1rem 1.25rem;
          background: linear-gradient(135deg, #fef3c7, #fde68a);
          border: 1px solid #f59e0b;
          border-radius: .5rem; margin-bottom: 1.5rem;
        }
        .ml-cpe-tile strong { font-size: 1.05rem; }
        .ml-section { font-size: 1.15rem; font-weight: 700; margin: 1rem 0 .65rem; }
        .ml-empty {
          padding: 2rem; text-align: center;
          background: var(--card); border: 1px dashed var(--border); border-radius: .55rem;
        }
        .ml-empty strong { display: block; margin: .35rem 0 .25rem; }
        .ml-grid { display: grid; gap: .85rem; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
        .ml-cpe-list { list-style: none; padding: 0; margin: 0; }
        .ml-cpe-list li { padding: .55rem 0; border-bottom: 1px solid var(--border); }
        .ml-cpe-list a { color: inherit; text-decoration: none; }
        .ml-cpe-list a:hover strong { color: var(--primary); }
      `}</style>
    </>
  );
}

function SavedCard({ item }) {
  const href = item.resource_type === 'paper'
    ? `#/resources/papers/${item.slug}`
    : `#/resources/journal/${item.slug}`;
  return (
    <a href={href} className="ml-card">
      {item.cover_url
        ? <div className="ml-card-cover" style={{ backgroundImage: `url(${item.cover_url})` }} />
        : <div className="ml-card-cover ml-card-cover-fallback"><IconBookOpen /></div>}
      <div className="ml-card-body">
        <span className="ml-card-type">{item.resource_type === 'paper' ? '📄 Paper' : '📚 E-Journal'}</span>
        <strong>{item.title}</strong>
        {item.subtitle && <span className="muted-text">{item.subtitle}</span>}
      </div>
      <style>{`
        .ml-card { display: flex; flex-direction: column; background: var(--card); border: 1px solid var(--border); border-radius: .5rem; overflow: hidden; text-decoration: none; color: inherit; transition: all .12s; }
        .ml-card:hover { border-color: var(--primary); transform: translateY(-2px); }
        .ml-card-cover { aspect-ratio: 16 / 9; background-size: cover; background-position: center; background-color: var(--background); }
        .ml-card-cover-fallback { display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1e40af, #2563eb); color: white; }
        .ml-card-body { padding: .75rem .85rem; display: flex; flex-direction: column; gap: .25rem; }
        .ml-card-type { font-size: .68rem; font-weight: 700; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: .04em; }
        .ml-card-body strong { font-size: .9rem; line-height: 1.35; }
        .ml-card-body span:last-child { font-size: .75rem; }
      `}</style>
    </a>
  );
}
