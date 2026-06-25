import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useLang } from '../context/LanguageContext';
import { IconMapPin, IconMail, IconPhone, IconClock, IconCheckCircle, IconX } from '../icons';
import { useSiteSettings } from '../hooks/useSiteSettings';

const EMPTY = {
  name: '', email: '', phone: '',
  subject: 'events', against_type: 'branch', against_ref: '',
  message: '',
};

export default function ContactPage() {
  const { t } = useLang();
  const { settings } = useSiteSettings();

  const AGAINST_TYPES = [
    { value: 'branch', label: t('ui.contact.against_branch', 'The branch / office') },
    { value: 'member', label: t('ui.contact.against_member', 'A specific member') },
    { value: 'firm',   label: t('ui.contact.against_firm',   'A firm') },
  ];

  const FALLBACK_SUBJECTS = [
    { value: 'events',              label: t('ui.contact.subject_events',    'Events') },
    { value: 'membership_updation', label: t('ui.contact.subject_membership','Membership Updation') },
    { value: 'other',               label: t('ui.contact.subject_other',     'Other') },
  ];

  const [form, setForm] = useState(EMPTY);
  const [subjects, setSubjects] = useState(FALLBACK_SUBJECTS);
  const [ticketNo, setTicketNo] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/grievances/subjects')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.items?.length) return;
        setSubjects(j.items);
        setForm((f) => ({ ...f, subject: j.items[0].value }));
      })
      .catch(() => {});
  }, []);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/grievances', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? t('ui.contact.error_default', 'Could not submit. Please try again.'));
      setTicketNo(j.ticket_no);
      setSubmittedEmail(form.email);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const trackHref = ticketNo
    ? `#/track-grievance?ticket_no=${encodeURIComponent(ticketNo)}&email=${encodeURIComponent(submittedEmail)}`
    : '#/track-grievance';

  return (
    <>
      <PageHeader
        title={t('ui.contact.page_title', 'Contact the Branch')}
        subtitle={t('ui.contact.page_subtitle', 'Raise a grievance, share a suggestion, or send a general query. We aim to respond within 48 hours.')}
      />
      <section className="container" style={{ padding: '3rem 1rem', display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="card">
          <h3 style={{ fontWeight: 600, fontSize: '1.125rem' }}>{t('ui.contact.office_heading', 'ICAI Bhawan, Nagpur')}</h3>
          <ul className="col gap-3 muted-text" style={{ listStyle: 'none', padding: 0, marginTop: '1rem', fontSize: '.875rem' }}>
            <li className="row gap-2"><IconMapPin size="sm" /> {settings.branch_address}</li>
            <li className="row gap-2"><IconMail size="sm" /> {settings.branch_email}</li>
            <li className="row gap-2"><IconPhone size="sm" /> {settings.branch_phone}</li>
            <li className="row gap-2"><IconClock size="sm" /> {settings.branch_hours}</li>
          </ul>
          <div style={{ marginTop: '1.25rem' }}>
            <a className="btn btn-ghost" href="#/track-grievance">{t('ui.contact.track_link', 'Track an existing ticket →')}</a>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontWeight: 600, fontSize: '1.125rem' }}>{t('ui.contact.form_heading', 'Send a message')}</h3>

          {ticketNo ? (
            <div className="col gap-3" style={{ marginTop: '1rem' }}>
              <div className="alert alert-success">
                <IconCheckCircle size="sm" /> {t('ui.contact.success_msg', 'Thanks — your message has been logged. Reference:')}{' '}
                <strong>{ticketNo}</strong>. {t('ui.contact.success_email_note', 'A confirmation has been emailed to')} {submittedEmail}.
              </div>
              <div className="row gap-2">
                <a className="btn btn-primary" href={trackHref}>{t('ui.contact.track_this', 'Track this ticket')}</a>
                <button type="button" className="btn btn-ghost"
                  onClick={() => { setTicketNo(''); setForm(EMPTY); }}>
                  {t('ui.contact.submit_another', 'Submit another')}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="col gap-3" style={{ marginTop: '1rem' }}>
              {err && <div className="alert alert-error"><IconX size="sm" /> {err}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div>
                  <label className="field-label">{t('ui.contact.name_label', 'Name')} *</label>
                  <input className="input-base" value={form.name} maxLength={200} required
                    onChange={(e) => update('name', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">{t('ui.contact.email_label', 'Email')} *</label>
                  <input className="input-base" type="email" value={form.email} required
                    onChange={(e) => update('email', e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div>
                  <label className="field-label">{t('ui.contact.phone_label', 'Phone (optional)')}</label>
                  <input className="input-base" value={form.phone}
                    onChange={(e) => update('phone', e.target.value)} />
                </div>
                <div>
                  <label className="field-label">{t('ui.contact.subject_label', 'Subject')} *</label>
                  <select className="input-base" value={form.subject}
                    onChange={(e) => update('subject', e.target.value)}>
                    {subjects.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                <div>
                  <label className="field-label">{t('ui.contact.concerns_label', 'Concerns')}</label>
                  <select className="input-base" value={form.against_type}
                    onChange={(e) => update('against_type', e.target.value)}>
                    {AGAINST_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
                {form.against_type !== 'branch' && (
                  <div>
                    <label className="field-label">{t('ui.contact.member_firm_label', 'Member / Firm name (optional)')}</label>
                    <input className="input-base" value={form.against_ref} maxLength={200}
                      onChange={(e) => update('against_ref', e.target.value)}
                      placeholder={form.against_type === 'member'
                        ? t('ui.contact.placeholder_ca',   'e.g. CA Anjali Sharma')
                        : t('ui.contact.placeholder_firm', 'e.g. Sharma & Co.')} />
                  </div>
                )}
              </div>

              <div>
                <label className="field-label">{t('ui.contact.message_label', 'Message')} *</label>
                <textarea className="input-base" rows={5} required value={form.message} maxLength={5000}
                  onChange={(e) => update('message', e.target.value)} />
                <div className="muted-text" style={{ fontSize: '.7rem', textAlign: 'right' }}>
                  {form.message.length}/5000
                </div>
              </div>

              <button className="btn btn-primary" type="submit" disabled={busy}
                style={{ justifyContent: 'center' }}>
                {busy ? t('ui.contact.sending', 'Sending…') : t('ui.contact.send_btn', 'Send message')}
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
