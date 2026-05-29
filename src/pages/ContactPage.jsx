import { useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { IconMapPin, IconMail, IconPhone, IconClock, IconCheckCircle } from '../icons';
import { useSiteSettings } from '../hooks/useSiteSettings';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const { settings } = useSiteSettings();

  return (
    <>
      <PageHeader title="Contact the Branch" subtitle="We typically respond within 2 working days." />
      <section className="container" style={{ padding: '3rem 1rem', display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="card">
          <h3 style={{ fontWeight: 600, fontSize: '1.125rem' }}>ICAI Bhawan, Nagpur</h3>
          <ul className="col gap-3 muted-text" style={{ listStyle: 'none', padding: 0, marginTop: '1rem', fontSize: '.875rem' }}>
            <li className="row gap-2"><IconMapPin size="sm" /> {settings.branch_address}</li>
            <li className="row gap-2"><IconMail size="sm" /> {settings.branch_email}</li>
            <li className="row gap-2"><IconPhone size="sm" /> {settings.branch_phone}</li>
            <li className="row gap-2"><IconClock size="sm" /> {settings.branch_hours}</li>
          </ul>
          <div style={{ marginTop: '1.25rem', aspectRatio: '16/10', background: 'repeating-linear-gradient(135deg, oklch(0.93 0.02 240), oklch(0.93 0.02 240) 12px, oklch(0.95 0.02 240) 12px, oklch(0.95 0.02 240) 24px)', borderRadius: '.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: '.75rem', fontFamily: 'monospace' }}>
            [ map placeholder ]
          </div>
        </div>
        <div className="card">
          <h3 style={{ fontWeight: 600, fontSize: '1.125rem' }}>Send a message</h3>
          {submitted ? (
            <div className="alert alert-success" style={{ marginTop: '1rem' }}>
              <IconCheckCircle size="sm" /> Thanks — your message has been logged. We'll get back to you soon.
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} className="col gap-3" style={{ marginTop: '1rem' }}>
              <div><label className="field-label">Name</label><input className="input-base" required /></div>
              <div><label className="field-label">Email</label><input className="input-base" type="email" required /></div>
              <div>
                <label className="field-label">Subject</label>
                <select className="input-base">
                  <option>General enquiry</option>
                  <option>Event registration</option>
                  <option>Membership query</option>
                  <option>Grievance</option>
                </select>
              </div>
              <div><label className="field-label">Message</label><textarea className="input-base" rows="5" required /></div>
              <button className="btn btn-primary" style={{ justifyContent: 'center' }}>Send message</button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
