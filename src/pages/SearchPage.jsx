import { useState, useEffect } from 'react';
import { useRoute, navigate } from '../hooks/useRoute';
import PageHeader from '../components/layout/PageHeader';
import EventCard from '../components/ui/EventCard';
import { useSiteContent } from '../hooks/useSiteContent';
import { renderMarkdown } from '../lib/markdown.jsx';
import { HOME_EVENTS } from '../data/constants';
import { IconSearch } from '../icons';

export default function SearchPage() {
  const route = useRoute();
  const header = useSiteContent('search_page_header');
  const q = route.query.q || '';
  const [query, setQuery] = useState(q);

  useEffect(() => setQuery(q), [q]);

  const matches = HOME_EVENTS.filter(
    (e) =>
      e.title.toLowerCase().includes(query.toLowerCase()) ||
      e.committee.toLowerCase().includes(query.toLowerCase()),
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
          {matches.map((e) => <EventCard key={e.title} event={e} />)}
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
