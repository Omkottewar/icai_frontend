import GenericPage from '../components/ui/GenericPage';
import { IconCheck } from '../icons';

// Branch has flagged Career Counselling (CLIENT_REQUIREMENTS M.4) as
// "kept on hold" — they still need to supply the volunteer counsellor
// list, pricing decision, and confirmation-email copy before we can wire
// real bookings. Until then the page shows the planned offering as a
// preview, with a clear "launching soon" banner and a CTA that routes
// urgent queries to the Contact form (which IS live).
export default function CareerCounsellingPage() {
  return (
    <GenericPage
      title="Career Counselling"
      subtitle="One-to-one sessions with volunteer CAs and alma-mater mentors — launching soon."
      body={
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <div className="card">
            <h3 style={{ fontWeight: 600 }}>What you'll get</h3>
            <ul className="col gap-2 muted-text" style={{ marginTop: '.75rem', padding: 0, listStyle: 'none', fontSize: '.875rem' }}>
              <li className="row gap-2"><IconCheck size="sm" style={{ color: 'var(--secondary)' }} /> A 30-minute 1:1 with a practising CA</li>
              <li className="row gap-2"><IconCheck size="sm" style={{ color: 'var(--secondary)' }} /> Help with articleship, exams and career paths</li>
              <li className="row gap-2"><IconCheck size="sm" style={{ color: 'var(--secondary)' }} /> Optional follow-up over email</li>
            </ul>
          </div>

          <div className="card">
            <h3 style={{ fontWeight: 600 }}>Bookings open soon</h3>
            <p className="muted-text" style={{ marginTop: '.75rem', fontSize: '.875rem', lineHeight: 1.5 }}>
              The Nagpur Branch is onboarding its volunteer counsellor panel for this term. Once the
              roster is in place, you'll be able to pick a counsellor and a time slot directly from
              this page. We'll announce the launch in the branch newsletter and via the homepage
              announcement ticker.
            </p>
            <p className="muted-text" style={{ marginTop: '.75rem', fontSize: '.875rem', lineHeight: 1.5 }}>
              Need career guidance now? Reach out via the contact form and we'll route your request
              to the right person at the branch.
            </p>
            <a href="#/contact" className="btn btn-primary" style={{ marginTop: '1rem', justifyContent: 'center' }}>
              Open the contact form
            </a>
          </div>
        </div>
      }
    />
  );
}
