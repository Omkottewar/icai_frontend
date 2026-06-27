import GenericPage from '../components/ui/GenericPage';
import { useSiteContent } from '../hooks/useSiteContent';
import { renderMarkdown } from '../lib/markdown.jsx';
import { IconHeart, IconUsers, IconSparkles } from '../icons';

// Copy + icons live in the `ca2_vision_content` site-content slot. Icons
// stay structural — admin edits titles/descriptions only.
const CARD_ICONS = [IconHeart, IconUsers, IconSparkles];

export default function CA2VisionPage() {
  const c = useSiteContent('ca2_vision_content');
  return (
    <GenericPage
      title={c.title}
      subtitle={c.subtitle}
      body={
        <div className="col gap-5">
          <div className="muted-text" style={{ lineHeight: 1.6 }}>
            {renderMarkdown(c.intro)}
          </div>
          <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {[1, 2, 3].map((n) => {
              const Icon = CARD_ICONS[n - 1];
              const t = c[`card_${n}_title`];
              const d = c[`card_${n}_desc`];
              if (!t) return null;
              return (
                <div key={n} className="card">
                  <div className="icon-tile green"><Icon size="lg" /></div>
                  <div style={{ marginTop: '.75rem', fontWeight: 600 }}>{t}</div>
                  <div className="muted-text" style={{ fontSize: '.875rem' }}>{d}</div>
                </div>
              );
            })}
          </div>
        </div>
      }
    />
  );
}
