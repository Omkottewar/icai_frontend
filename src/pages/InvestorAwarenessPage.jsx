import GenericPage from '../components/ui/GenericPage';
import { useSiteContent } from '../hooks/useSiteContent';
import { renderMarkdown } from '../lib/markdown.jsx';

// Page copy + the upcoming-sessions list live in the
// `investor_awareness_content` slot. The sessions list is rendered as
// markdown (admin edits a bullet list); the page no longer ships with a
// hardcoded 3-session array.
export default function InvestorAwarenessPage() {
  const c = useSiteContent('investor_awareness_content');
  return (
    <GenericPage
      title={c.title}
      subtitle={c.subtitle}
      body={
        <div className="col gap-5">
          <div className="muted-text" style={{ lineHeight: 1.6 }}>
            {renderMarkdown(c.intro)}
          </div>
          <div className="card">
            <h3 style={{ fontWeight: 600 }}>{c.sessions_heading}</h3>
            <div className="muted-text" style={{ marginTop: '.75rem' }}>
              {renderMarkdown(c.sessions_body)}
            </div>
          </div>
        </div>
      }
    />
  );
}
