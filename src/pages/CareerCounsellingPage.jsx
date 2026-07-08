import GenericPage from '../components/ui/GenericPage';
import { useSiteContent } from '../hooks/useSiteContent';
import { renderMarkdown } from '../lib/markdown.jsx';

// All copy is admin-editable via the `career_counselling_content` slot.
// Bookings are currently on hold — once the volunteer panel + counsellor
// availability workflow is finalised, this page wires up to a real
// booking flow. Until then the CTA points members at the generic contact
// form.
export default function CareerCounsellingPage() {
  const c = useSiteContent('career_counselling_content');
  return (
    <GenericPage
      title={c.title}
      subtitle={c.subtitle}
      body={
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <div className="card">
            <h3 style={{ fontWeight: 600 }}>{c.benefits_heading}</h3>
            <div className="muted-text" style={{ marginTop: '.75rem', fontSize: '.875rem' }}>
              {renderMarkdown(c.benefits_body)}
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontWeight: 600 }}>{c.bookings_heading}</h3>
            <div className="muted-text" style={{ marginTop: '.75rem', fontSize: '.875rem', lineHeight: 1.5 }}>
              {renderMarkdown(c.bookings_body)}
            </div>
            <a href="/contact" className="btn btn-primary" style={{ marginTop: '1rem', justifyContent: 'center' }}>
              {c.contact_button_label}
            </a>
          </div>
        </div>
      }
    />
  );
}
