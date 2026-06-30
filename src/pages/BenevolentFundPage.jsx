import GenericPage from '../components/ui/GenericPage';
import { useSiteContent } from '../hooks/useSiteContent';
import { renderMarkdown } from '../lib/markdown.jsx';
import { IconHandshake, IconArrowRight } from '../icons';

// All copy lives in the `benevolent_fund_content` site-content slot — admin
// can rewrite anything from /admin/site-content → Benevolent Fund tab.
export default function BenevolentFundPage() {
  const c = useSiteContent('benevolent_fund_content');
  const rawSlabs = c.slabs_csv || '';
  const slabs = (rawSlabs.includes(';') ? rawSlabs.split(';') : rawSlabs.split(','))
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <GenericPage
      title={c.title}
      subtitle={c.subtitle}
      body={
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <div className="card">
            <div className="icon-tile green"><IconHandshake size="lg" /></div>
            <h3 style={{ marginTop: '.75rem', fontWeight: 600 }}>{c.about_heading}</h3>
            <div className="muted-text" style={{ marginTop: '.5rem', fontSize: '.875rem' }}>
              {renderMarkdown(c.about_body)}
            </div>
          </div>
          <div className="card">
            <h3 style={{ fontWeight: 600 }}>{c.contribute_heading}</h3>
            <div className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>
              {renderMarkdown(c.contribute_body)}
            </div>
            <div className="row gap-2" style={{ marginTop: '.75rem', flexWrap: 'wrap' }}>
              {slabs.map((a) => (
                <span key={a} className="badge" style={{ padding: '.35rem .7rem', background: 'var(--muted)', color: 'var(--foreground)', fontWeight: 600 }}>{a}</span>
              ))}
            </div>
            <div style={{
              marginTop: '1.1rem', padding: '.75rem .9rem',
              background: 'oklch(0.95 0.05 90)',
              border: '1px solid oklch(0.85 0.08 90)',
              borderRadius: '.4rem', fontSize: '.8125rem', lineHeight: 1.5,
            }}>
              {renderMarkdown(c.alert_body)}
            </div>
            <div className="col gap-2" style={{ marginTop: '.75rem' }}>
              <a
                href={c.icai_btn_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ justifyContent: 'center' }}
              >
                {c.icai_btn_label} <IconArrowRight size="sm" />
              </a>
              <a
                href="/contact"
                className="btn btn-outline"
                style={{ justifyContent: 'center' }}
              >
                {c.contact_btn_label}
              </a>
            </div>
          </div>
        </div>
      }
    />
  );
}
