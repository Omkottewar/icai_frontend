import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminFetch } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { IconFileText, IconCalendar, IconAward, IconUsers } from '../../icons';
import Button from '../../components/ui/Button';

// ─── /admin/reports ──────────────────────────────────────────────────────
// One-page catalog of downloadable Excel reports. Each card:
//   • Title + one-line description
//   • Optional filter inputs (event picker, date range, FY, year)
//   • Download button that hits /api/admin/reports/<slug>.xlsx with the
//     filter query string appended.
//
// Downloads bypass fetch (no way to get the Blob to trigger a save-as
// dialog cleanly) — we set window.location which the server's
// Content-Disposition: attachment forces into a download without a page
// navigation.

const REPORT_CARDS = [
  {
    slug: 'event-registrations',
    title: 'Event registrations roster',
    description: 'Attendance sheet for a single event — name, MRN, phone, seat status, booked-by attribution, UPI UTR. Ready to print for the front desk on event day.',
    icon: IconCalendar,
    requiresEvent: true,
  },
  {
    slug: 'payments-ledger',
    title: 'Payments ledger',
    description: 'Every payment in a date window with GST split, status, UTR, and payer MRN. The statutory audit’s single source of truth. Filter by status and purpose.',
    icon: IconFileText,
    requiresDateRange: true,
    requiresStatus: true,
    requiresPurpose: true,
  },
  {
    slug: 'budget-vs-actual',
    title: 'Budget vs actual',
    description: 'Committee × category planned amount vs actual spend for the FY. Includes variance, utilisation %, and flags any uncategorised (unbudgeted) spend.',
    icon: IconAward,
    requiresFy: true,
  },
  {
    slug: 'member-directory',
    title: 'Member directory',
    description: 'All members with a portal account — MRN, FCA/ACA, COP, phone, email, city. Used by committees for outreach and the newsletter mailing list.',
    icon: IconUsers,
  },
];

const PAYMENT_STATUSES = ['', 'success', 'pending', 'pending_verification', 'failed', 'refunded', 'partially_refunded'];
const PAYMENT_PURPOSES = ['', 'event_registration', 'cop_renewal', 'firm_registration', 'job_posting', 'assignment_posting', 'cabf_donation', 'consultation', 'room_booking', 'other'];

function currentFyStartYear() {
  const now = new Date();
  // Indian FY starts in April; before April we're still in the previous FY.
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

export default function ReportsAdminPage() {
  const { showToast } = useAuth();

  return (
    <AdminLayout
      title="Reports (Excel)"
      subtitle="Formatted XLSX exports for the branch office, treasurer, and statutory audit. Pick a report, choose filters, download."
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
        {REPORT_CARDS.map((card) => (
          <ReportCard key={card.slug} card={card} showToast={showToast} />
        ))}
      </div>

      <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '1.5rem', maxWidth: 720 }}>
        Reports open in Excel, Numbers, or Google Sheets. Currency is shown in ₹ with Indian
        grouping (##,##,###). Header row is frozen and auto-filter is on so you can sort or
        filter without unfreezing.
      </div>
    </AdminLayout>
  );
}

function ReportCard({ card, showToast }) {
  const Icon = card.icon ?? IconFileText;
  const [eventId, setEventId] = useState('');
  const [from, setFrom] = useState('');
  const [to,   setTo]   = useState('');
  const [status,  setStatus]  = useState('');
  const [purpose, setPurpose] = useState('');
  const [fy,   setFy]   = useState(currentFyStartYear());
  const [year, setYear] = useState(new Date().getFullYear());
  const [busy, setBusy] = useState(false);

  const download = () => {
    // Simple client-side validation
    if (card.requiresEvent && !eventId) { showToast?.('Pick an event first', 'error'); return; }

    const qs = new URLSearchParams();
    if (card.requiresEvent) qs.set('event_id', eventId);
    if (card.requiresDateRange) {
      if (from) qs.set('from', from);
      if (to)   qs.set('to', to);
    }
    if (card.requiresStatus && status)   qs.set('status', status);
    if (card.requiresPurpose && purpose) qs.set('purpose', purpose);
    if (card.requiresFy)   qs.set('fy', String(fy));
    if (card.requiresYear) qs.set('year', String(year));

    setBusy(true);
    // Setting window.location triggers the browser download prompt via the
    // server's Content-Disposition: attachment header. Bypasses fetch()
    // entirely so we don't have to hold the whole workbook in JS memory
    // (some of these can be tens of MB).
    const url = `/api/admin/reports/${card.slug}.xlsx?${qs.toString()}`;
    window.location.assign(url);
    // Reset spinner after a beat — no way to know when the browser starts
    // the download from JS. 3s is enough visual feedback.
    setTimeout(() => setBusy(false), 3000);
  };

  return (
    <div className="card" style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.6rem' }}>
        <div style={{
          background: 'oklch(0.94 0.03 250)', color: 'oklch(0.28 0.09 250)',
          padding: '.45rem', borderRadius: '.4rem', display: 'flex',
        }}>
          <Icon size="md" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '.95rem' }}>{card.title}</div>
          <div className="muted-text" style={{ fontSize: '.78rem', lineHeight: 1.4, marginTop: '.15rem' }}>
            {card.description}
          </div>
        </div>
      </div>

      {(card.requiresEvent || card.requiresDateRange || card.requiresStatus || card.requiresPurpose || card.requiresFy || card.requiresYear) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {card.requiresEvent && <EventPicker value={eventId} onChange={setEventId} />}

          {card.requiresDateRange && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.4rem' }}>
              <label style={{ fontSize: '.75rem' }}>
                From
                <input className="input-base" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label style={{ fontSize: '.75rem' }}>
                To
                <input className="input-base" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
            </div>
          )}

          {card.requiresStatus && (
            <label style={{ fontSize: '.75rem' }}>
              Status
              <select className="input-base" value={status} onChange={(e) => setStatus(e.target.value)}>
                {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
              </select>
            </label>
          )}

          {card.requiresPurpose && (
            <label style={{ fontSize: '.75rem' }}>
              Purpose
              <select className="input-base" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                {PAYMENT_PURPOSES.map((p) => <option key={p} value={p}>{p || 'All purposes'}</option>)}
              </select>
            </label>
          )}

          {card.requiresFy && (
            <label style={{ fontSize: '.75rem' }}>
              Financial year (start year)
              <input className="input-base" type="number" min={2020} max={2100} value={fy} onChange={(e) => setFy(Number(e.target.value))} />
              <div className="muted-text" style={{ fontSize: '.68rem', marginTop: '.15rem' }}>
                {fy} → FY {fy}-{String((fy + 1) % 100).padStart(2, '0')}
              </div>
            </label>
          )}

          {card.requiresYear && (
            <label style={{ fontSize: '.75rem' }}>
              Calendar year
              <input className="input-base" type="number" min={2020} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </label>
          )}
        </div>
      )}

      <Button className="btn btn-primary" onClick={download} loading={busy} style={{ marginTop: 'auto' }}>
        Download .xlsx
      </Button>
    </div>
  );
}

// Two-step picker to keep the payload small: we don't want to load 500
// events into a <select>. Type to filter, click to pick.
function EventPicker({ value, onChange }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [selectedLabel, setSelectedLabel] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams();
        if (q.trim()) qs.set('q', q.trim());
        qs.set('pageSize', '20');
        const j = await adminFetch(`/api/admin/events?${qs.toString()}`);
        if (!cancelled) setRows(j.rows || []);
      } catch { if (!cancelled) setRows([]); }
    })();
    return () => { cancelled = true; };
  }, [q]);

  const pick = (row) => {
    onChange(row.id);
    setSelectedLabel(`${row.title} · ${new Date(row.starts_at).toLocaleDateString('en-IN')}`);
  };

  return (
    <div style={{ fontSize: '.75rem' }}>
      Event
      {selectedLabel ? (
        <div style={{
          display: 'flex', gap: '.5rem', alignItems: 'center',
          background: 'oklch(0.94 0.03 250)', color: 'oklch(0.28 0.09 250)',
          padding: '.35rem .55rem', borderRadius: '.35rem', marginTop: '.15rem',
        }}>
          <span style={{ flex: 1, fontSize: '.78rem' }}>{selectedLabel}</span>
          <button
            type="button"
            onClick={() => { onChange(''); setSelectedLabel(''); }}
            className="btn btn-ghost"
            style={{ padding: '.15rem .4rem', fontSize: '.72rem' }}
          >Change</button>
        </div>
      ) : (
        <>
          <input
            className="input-base"
            placeholder="Search by title…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div style={{
            maxHeight: 160, overflowY: 'auto', marginTop: '.3rem',
            border: '1px solid var(--border)', borderRadius: '.35rem',
          }}>
            {rows === null && <div className="muted-text" style={{ padding: '.5rem', fontSize: '.75rem' }}>Loading…</div>}
            {rows !== null && rows.length === 0 && <div className="muted-text" style={{ padding: '.5rem', fontSize: '.75rem' }}>No events match.</div>}
            {rows && rows.slice(0, 20).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => pick(r)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '.35rem .55rem', background: 'transparent',
                  border: 'none', borderTop: '1px solid var(--border)',
                  cursor: 'pointer', fontSize: '.78rem',
                }}
              >
                <div style={{ fontWeight: 600 }}>{r.title}</div>
                <div className="muted-text" style={{ fontSize: '.7rem' }}>
                  {r.starts_at ? new Date(r.starts_at).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
