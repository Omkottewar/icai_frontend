import { useEffect, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useRoute } from '../hooks/useRoute';
import { useSiteContent } from '../hooks/useSiteContent';
import { IconCheckCircle, IconX } from '../icons';
import Button from '../components/ui/Button';

const STATUS_LABELS = {
  open:       'Open · awaiting review',
  in_review:  'In review',
  resolved:   'Resolved',
  closed:     'Closed',
};

const STATUS_COLOURS = {
  open:      '#b45309',
  in_review: '#2563eb',
  resolved:  '#16a34a',
  closed:    '#64748b',
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function TrackGrievancePage() {
  const { query } = useRoute();
  const header = useSiteContent('track_grievance_page_header');
  const initial = { ticket_no: query.ticket_no ?? '', email: query.email ?? '' };
  const [form, setForm] = useState(initial);
  const [item, setItem] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const lookup = async (override) => {
    const payload = override ?? form;
    if (!payload.ticket_no || !payload.email) return;
    setBusy(true); setErr(''); setItem(null);
    try {
      const qs = new URLSearchParams({ ticket_no: payload.ticket_no, email: payload.email });
      const r = await fetch(`/api/grievances/track?${qs.toString()}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'Could not look up that ticket');
      setItem(j.item);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Auto-look-up if both params arrived in the URL (the link in the
  // acknowledgement email is the main entry point for this page).
  useEffect(() => {
    if (initial.ticket_no && initial.email) lookup(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e) => { e.preventDefault(); lookup(); };

  return (
    <>
      <PageHeader title={header.title} subtitle={header.subtitle} />
      <section className="container" style={{ padding: '3rem 1rem', maxWidth: '40rem' }}>
        <form className="card col gap-3" onSubmit={submit}>
          <div>
            <label className="field-label">Ticket number *</label>
            <input className="input-base" required placeholder="GRV-2026-000123"
              value={form.ticket_no}
              onChange={(e) => setForm((f) => ({ ...f, ticket_no: e.target.value.trim() }))} />
          </div>
          <div>
            <label className="field-label">Email *</label>
            <input className="input-base" type="email" required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value.trim() }))} />
          </div>
          <Button className="btn btn-primary" type="submit" loading={busy}
            style={{ justifyContent: 'center' }}>
            {busy ? 'Looking up…' : 'Track'}
          </Button>
        </form>

        {err && (
          <div className="alert alert-error" style={{ marginTop: '1rem' }}>
            <IconX size="sm" /> {err}
          </div>
        )}

        {item && (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div className="row gap-2" style={{ alignItems: 'center' }}>
              <IconCheckCircle size="sm" />
              <strong>{item.ticket_no}</strong>
              <span style={{
                marginLeft: 'auto',
                padding: '.15rem .6rem',
                borderRadius: '999px',
                fontSize: '.75rem',
                fontWeight: 600,
                color: '#fff',
                background: STATUS_COLOURS[item.status] ?? '#64748b',
              }}>
                {STATUS_LABELS[item.status] ?? item.status}
              </span>
            </div>
            <dl className="muted-text" style={{ fontSize: '.875rem', marginTop: '1rem', display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '.4rem 1rem' }}>
              <dt>Subject</dt><dd>{item.subject}</dd>
              <dt>Filed on</dt><dd>{fmt(item.created_at)}</dd>
              {item.resolved_at && <><dt>Resolved on</dt><dd>{fmt(item.resolved_at)}</dd></>}
            </dl>
            {item.resolution_note && (
              <div style={{ marginTop: '1rem', padding: '.75rem', background: 'var(--muted, #f1f5f9)', borderRadius: '.4rem' }}>
                <div className="muted-text" style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Resolution note</div>
                <div style={{ marginTop: '.25rem', whiteSpace: 'pre-wrap' }}>{item.resolution_note}</div>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
