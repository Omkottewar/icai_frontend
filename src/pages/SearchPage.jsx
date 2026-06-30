import { useState, useEffect } from 'react';
import { useRoute, navigate } from '../hooks/useRoute';
import PageHeader from '../components/layout/PageHeader';
import EventCard from '../components/ui/EventCard';
import { useSiteContent } from '../hooks/useSiteContent';
import { renderMarkdown } from '../lib/markdown.jsx';
import { cachedGet } from '../lib/apiCache';
import { IconSearch } from '../icons';

// Map a /api/events row onto the shape EventCard expects (title, committee,
// cpe, date, time, venue). The card is shared across surfaces, so we keep
// the adaptation local instead of changing the card's contract.
function toCardShape(e) {
  const start = e.starts_at ? new Date(e.starts_at) : null;
  return {
    title: e.title,
    committee: e.committee_name || e.committee_code || '—',
    cpe: e.cpe_hours || 0,
    date: start ? start.toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '',
    time: start ? start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '',
    venue: e.venue || (e.mode === 'online' ? 'Online' : '—'),
  };
}

export default function SearchPage() {
  const route = useRoute();
  const header = useSiteContent('search_page_header');
  const q = route.query.q || '';
  const [query, setQuery] = useState(q);
  const [events, setEvents] = useState([]);

  useEffect(() => setQuery(q), [q]);

  // Pull the live upcoming events list once and filter client-side. The
  // branch publishes a small number of events at a time, so a full fetch
  // is fine; swap to a server-side ?q= when the list grows past ~200.
  // 60s TTL — search-page revisits feel instant.
  useEffect(() => {
    let cancelled = false;
    cachedGet('/api/events', undefined, 60_000)
      .then((j) => { if (!cancelled) setEvents(j.rows || []); })
      .catch(() => { if (!cancelled) setEvents([]); });
    return () => { cancelled = true; };
  }, []);

  const lc = query.toLowerCase();
  const matches = events.filter(
    (e) =>
      (e.title || '').toLowerCase().includes(lc) ||
      (e.committee_name || '').toLowerCase().includes(lc) ||
      (e.committee_code || '').toLowerCase().includes(lc),
  );

  return (
    <>
      <PageHeader
        title={header.title}
        subtitle={query
          ? (header.subtitle_template || '').replace(/\{query\}/g, query)
          : header.subtitle_idle}
      />
      <section className="container" style={{ padding: '3rem 1rem', maxWidth: '56rem' }}>
        <form
          onSubmit={(e) => { e.preventDefault(); navigate('/search?q=' + encodeURIComponent(query)); }}
          className="row gap-2"
        >
          <div className="row gap-2 input-base" style={{ flex: 1 }}>
            <IconSearch size="sm" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={header.placeholder}
              style={{ flex: 1, background: 'transparent', border: 0, outline: 'none' }}
            />
          </div>
          <button className="btn btn-primary">{header.submit_label}</button>
        </form>
        <div style={{ marginTop: '2rem', display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {matches.map((e) => <EventCard key={e.id} event={toCardShape(e)} />)}
          {query && matches.length === 0 && (
            <div className="muted-text">
              {renderMarkdown((header.empty_state || '').replace(/\{query\}/g, query))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
