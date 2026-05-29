import { useState } from 'react';
import GenericPage from '../components/ui/GenericPage';
import { IconCheck, IconCheckCircle } from '../icons';

export default function CareerCounsellingPage() {
  const [booked, setBooked] = useState(false);

  return (
    <GenericPage
      title="Career Counselling"
      subtitle="One-to-one sessions with volunteer CAs and alma-mater mentors."
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
            <h3 style={{ fontWeight: 600 }}>Book a session</h3>
            {booked ? (
              <div className="alert alert-success" style={{ marginTop: '1rem' }}>
                <IconCheckCircle size="sm" /> Booked! A volunteer CA will reach out within 48 hours.
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setBooked(true); }} className="col gap-3" style={{ marginTop: '1rem' }}>
                <div><label className="field-label">Your name</label><input className="input-base" required /></div>
                <div>
                  <label className="field-label">CA stage</label>
                  <select className="input-base">
                    <option>Foundation</option>
                    <option>Intermediate</option>
                    <option>Final</option>
                    <option>Articleship</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">What do you want to discuss?</label>
                  <textarea className="input-base" rows="3" />
                </div>
                <button className="btn btn-primary" style={{ justifyContent: 'center' }}>Request session</button>
              </form>
            )}
          </div>
        </div>
      }
    />
  );
}
