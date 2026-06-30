import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { IconMapPin, IconMail, IconPhone, IconClock, IconCheckCircle, IconX } from '../icons';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { useSiteContent } from '../hooks/useSiteContent';
import { useRecaptcha } from '../hooks/useRecaptcha';
import { renderMarkdown } from '../lib/markdown.jsx';
import { cachedGet } from '../lib/apiCache';
import Button from '../components/ui/Button';

const AGAINST_TYPES = [
  { value: 'branch', label: 'The branch / office' },
  { value: 'member', label: 'A specific member' },
  { value: 'firm',   label: 'A firm' },
];

const FALLBACK_SUBJECTS = [
  { value: 'events',              label: 'Events' },
  { value: 'membership_updation', label: 'Membership Updation' },
  { value: 'other',               label: 'Other' },
];

const EMPTY = {
  name: '', email: '', phone: '',
  subject: 'events', against_type: 'branch', against_ref: '',
  message: '',
};

export default function ContactPage() {
  const { settings } = useSiteSettings();
  const header   = useSiteContent('contact_page_header');
  const sections = useSiteContent('contact_sections');
  const { execute: executeRecaptcha, enabled: captchaEnabled } = useRecaptcha();
  const [form, setForm] = useState(EMPTY);
  const [subjects, setSubjects] = useState(FALLBACK_SUBJECTS);
  const [ticketNo, setTicketNo] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Subject list comes from the admin-editable route table. If the call
  // fails (e.g. dev with empty DB), the FALLBACK_SUBJECTS list keeps the
  // form usable. 10min TTL — routing rules change rarely; visitors who
  // open Contact twice in a session don't refetch.
  useEffect(() => {
    let cancelled = false;
    cachedGet('/api/grievances/subjects', undefined, 600_000)
      .then((j) => {
        if (cancelled || !j?.items?.length) return;
        setSubjects(j.items);
        setForm((f) => ({ ...f, subject: j.items[0].value }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const recaptcha_token = await executeRecaptcha('grievance_submit');
      const r = await fetch('/api/grievances', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, recaptcha_token }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'Could not submit. Please try again.');
      setTicketNo(j.ticket_no);
      setSubmittedEmail(form.email);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const trackHref = ticketNo
    ? `/track-grievance?ticket_no=${encodeURIComponent(ticketNo)}&email=${encodeURIComponent(submittedEmail)}`
    : '/track-grievance';

  return (
    <>
      <PageHeader title={header.title} subtitle={header.subtitle} />
      <section className="container" style={{ padding: '3rem 1rem', display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="card">
          <h3 style={{ fontWeight: 600, fontSize: '1.125rem' }}>{sections.info_card_title}</h3>
          <ul className="col gap-3 muted-text" style={{ listStyle: 'none', padding: 0, marginTop: '1rem', fontSize: '.875rem' }}>
            <li className="row gap-2"><IconMapPin size="sm" /> {settings.branch_address}</li>
            <li className="row gap-2"><IconMail size="sm" /> {settings.branch_email}</li>
            <li className="row gap-2"><IconPhone size="sm" /> {settings.branch_phone}</li>
            <li className="row gap-2"><IconClock size="sm" /> {settings.branch_hours}</li>
          </ul>
          <div style={{ marginTop: '1.25rem' }}>
            <a className="btn btn-ghost" href="/track-grievance">{sections.track_link_label}</a>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontWeight: 600, fontSize: '1.125rem' }}>{sections.form_card_title}</h3>

          {ticketNo ? (
            <div className="col gap-3" style={{ marginTop: '1rem' }}>
              <div className="alert alert-success">
                <IconCheckCircle size="sm" />{' '}
                {/* Markdown rendered with {ticketNo}/{email} placeholder
                    substitution so the admin keeps full control over wording. */}
                {renderMarkdown(
                  (sections.success_message || '')
                    .replace(/\{ticketNo\}/g, ticketNo)
                    .replace(/\{email\}/g, submittedEmail)
                )}
              </div>
              <div className="row gap-2">
                <a className="btn btn-primary" href={trackHref}>{sections.track_button_label}</a>
                <button type="button" className="btn btn-ghost"
                  onClick={() => { setTicketNo(''); setForm(EMPTY); }}>
                  {sections.another_button_label}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="col gap-3" style={{ marginTop: '1rem' }}>
              {err && <div className="alert alert-error"><IconX size="sm" /> {err}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div>
                  <label className="field-label">Name *</label>
                  <input className="input-base" value={form.name} maxLength={200} required
                    onChange={(e) => update('name', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Email *</label>
                  <input className="input-base" type="email" value={form.email} required
                    onChange={(e) => update('email', e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div>
                  <label className="field-label">Phone (optional)</label>
                  <input className="input-base" value={form.phone}
                    onChange={(e) => update('phone', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Subject *</label>
                  <select className="input-base" value={form.subject}
                    onChange={(e) => update('subject', e.target.value)}>
                    {subjects.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div>
                  <label className="field-label">Concerns</label>
                  <select className="input-base" value={form.against_type}
                    onChange={(e) => update('against_type', e.target.value)}>
                    {AGAINST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                {form.against_type !== 'branch' && (
                  <div>
                    <label className="field-label">Member / Firm name (optional)</label>
                    <input className="input-base" value={form.against_ref} maxLength={200}
                      onChange={(e) => update('against_ref', e.target.value)}
                      placeholder={form.against_type === 'member' ? 'e.g. CA Anjali Sharma' : 'e.g. Sharma & Co.'} />
                  </div>
                )}
              </div>

              <div>
                <label className="field-label">Message *</label>
                <textarea className="input-base" rows={5} required value={form.message} maxLength={5000}
                  onChange={(e) => update('message', e.target.value)} />
                <div className="muted-text" style={{ fontSize: '.7rem', textAlign: 'right' }}>
                  {form.message.length}/5000
                </div>
              </div>

              <Button className="btn btn-primary" type="submit" loading={busy}
                style={{ justifyContent: 'center' }}>
                {busy ? sections.submit_busy_label : sections.submit_button_label}
              </Button>

              {captchaEnabled && (
                <p className="muted-text" style={{ fontSize: '.7rem', marginTop: '.25rem' }}>
                  Protected by reCAPTCHA. Google{' '}
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy</a> &{' '}
                  <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms</a> apply.
                </p>
              )}
            </form>
          )}
        </div>
      </section>
    </>
  );
}
