import { useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { ShimmerLines } from '../../components/ui/Shimmer';
import { IconX, IconAward } from '../../icons';
import { dialog } from '../../lib/dialog';
import FlipMenu from '../../components/ui/FlipMenu';

// ─── /admin/cpe ─────────────────────────────────────────────────────────────
//
// CPE credit administration. Three tools:
//   1. Browse / search / revoke individual credits.
//   2. Manually issue a credit to one member (external CPE, etc.).
//   3. Bulk-issue credits from a past event to every 'attended' registrant.
//
// Compliance check: pick a user, see structured / unstructured / total
// hours for the current 3-year block against the ICAI 120hr / 90 structured
// threshold.

export default function CpeAdminPage() {
  const [tab, setTab] = useState('credits');

  return (
    <AdminLayout
      title="CPE credits"
      subtitle="Issue, revoke, and audit member CPE hours"
    >
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #e5e7eb' }}>
        {[
          ['credits', 'All credits'],
          ['compliance', 'Member compliance'],
        ].map(([k, label]) => (
          <button key={k} className="btn btn-ghost"
            onClick={() => setTab(k)}
            style={{
              borderRadius: 0,
              borderBottom: tab === k ? '2px solid #0f172a' : '2px solid transparent',
              fontWeight: tab === k ? 600 : 400,
              padding: '.5rem 1rem',
            }}>{label}</button>
        ))}
      </div>

      {tab === 'credits' && <CreditsTab />}
      {tab === 'compliance' && <ComplianceTab />}
    </AdminLayout>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Credits tab — list + issue + bulk-issue + revoke
// ════════════════════════════════════════════════════════════════════════════

function CreditsTab() {
  const { showToast } = useAuth();
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ q: '', type: '', year: '' });
  const [showIssue, setShowIssue] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  async function load() {
    setRows(null);
    const qs = new URLSearchParams();
    if (filters.q)    qs.set('q', filters.q);
    if (filters.type) qs.set('type', filters.type);
    if (filters.year) qs.set('year', filters.year);
    qs.set('page', String(page));
    qs.set('pageSize', '50');
    try {
      const r = await fetch(`/api/admin/cpe?${qs}`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      setRows(j.rows);
      setTotal(j.total);
    } catch (e) { showToast?.(e.message, 'error'); setRows([]); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, filters.type, filters.year]);

  async function revoke(id) {
    const ok = await dialog.confirm({
      title: 'Revoke credit?',
      message: 'Revoke this credit? This soft-deletes the row — member CPE totals will exclude it.',
      confirmText: 'Revoke',
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await fetch(`/api/admin/cpe/${id}`, { method: 'DELETE', credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      showToast?.('Credit revoked', 'success');
      load();
    } catch (e) { showToast?.(e.message, 'error'); }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <input className="input-base" placeholder="Search member name / email…" style={{ maxWidth: 280 }}
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(); } }} />
        <select className="input-base" value={filters.type}
          onChange={(e) => { setPage(1); setFilters({ ...filters, type: e.target.value }); }}>
          <option value="">All types</option>
          <option value="structured">Structured</option>
          <option value="unstructured">Unstructured</option>
        </select>
        <input className="input-base" placeholder="Year" style={{ maxWidth: 100 }} type="number"
          value={filters.year}
          onChange={(e) => { setPage(1); setFilters({ ...filters, year: e.target.value }); }} />
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={() => setShowBulk(true)}>Bulk-issue from event</button>
        <button className="btn btn-primary" onClick={() => setShowIssue(true)}>+ Issue credit</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <th style={th}>Member</th>
              <th style={th}>Event</th>
              <th style={th}>Hours</th>
              <th style={th}>Type</th>
              <th style={th}>Year</th>
              <th style={th}>Source</th>
              <th style={th}>Issued</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {!rows && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={8} style={td}><ShimmerLines count={1} /></td></tr>
            ))}
            {rows && rows.length === 0 && (
              <tr><td colSpan={8} style={{ ...td, textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                No CPE credits match your filters.
              </td></tr>
            )}
            {rows && rows.map((c) => (
              <tr key={c.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td style={td}>
                  <div style={{ fontWeight: 500 }}>{c.user_name || '—'}</div>
                  <div className="muted-text" style={{ fontSize: '.75rem' }}>{c.user_email}</div>
                </td>
                <td style={td}>{c.event_title || <span className="muted-text">—</span>}</td>
                <td style={td}><strong>{c.hours}</strong></td>
                <td style={td}>{c.type}</td>
                <td style={td}>{c.year}</td>
                <td style={td}>{c.source || '—'}</td>
                <td style={td}>{formatDate(c.issued_at)}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button className="btn btn-ghost" style={{ ...btnSm, color: '#dc2626' }} onClick={() => revoke(c.id)}>Revoke</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager page={page} pageSize={50} total={total} onChange={setPage} />

      {showIssue && <IssueCreditModal onClose={() => setShowIssue(false)} onSaved={async () => { setShowIssue(false); await load(); }} />}
      {showBulk && <BulkIssueModal onClose={() => setShowBulk(false)} onSaved={async () => { setShowBulk(false); await load(); }} />}
    </div>
  );
}

function IssueCreditModal({ onClose, onSaved }) {
  const { showToast } = useAuth();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    hours: '4',
    type: 'structured',
    year: String(new Date().getFullYear()),
    source: 'admin_issued',
    event_id: '',
  });
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!user || !form.hours || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/cpe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          hours: Number(form.hours),
          type: form.type,
          year: Number(form.year),
          source: form.source || null,
          event_id: form.event_id || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      showToast?.(`${form.hours} hrs credited to ${user.name}`, 'success');
      onSaved();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="Issue a CPE credit" onClose={onClose}>
      <label style={fieldLbl}>Member</label>
      <UserPicker value={user} onChange={setUser} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.5rem', marginTop: '.75rem' }}>
        <div>
          <label style={fieldLbl}>Hours</label>
          <input className="input-base" type="number" step="0.5" min="0.5" max="40"
            value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
        </div>
        <div>
          <label style={fieldLbl}>Type</label>
          <select className="input-base" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="structured">Structured</option>
            <option value="unstructured">Unstructured</option>
          </select>
        </div>
        <div>
          <label style={fieldLbl}>Year</label>
          <input className="input-base" type="number" value={form.year}
            onChange={(e) => setForm({ ...form, year: e.target.value })} />
        </div>
      </div>

      <label style={{ ...fieldLbl, marginTop: '.75rem' }}>Source (free text)</label>
      <input className="input-base" placeholder="e.g. ICAI self-study, external programme"
        value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '1.25rem' }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={!user || !form.hours || busy}>
          {busy ? 'Issuing…' : 'Issue credit'}
        </button>
      </div>
    </Modal>
  );
}

function BulkIssueModal({ onClose, onSaved }) {
  const { showToast } = useAuth();
  const [events, setEvents] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function load() {
    setEvents(null);
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('q', search);
      const r = await fetch(`/api/admin/cpe/_meta/events?${qs}`, { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      setEvents(j.rows);
    } catch (e) { showToast?.(e.message, 'error'); setEvents([]); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search]);

  async function fire() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/cpe/bulk-issue-from-event/${selected.id}`, {
        method: 'POST', credentials: 'include',
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      setResult(j);
      showToast?.(`Issued ${j.issued} credits (${j.skipped} already existed)`, 'success');
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  }

  return (
    <Modal title="Bulk-issue from a past event" onClose={onClose}>
      <p className="muted-text" style={{ fontSize: '.875rem', marginBottom: '.75rem' }}>
        Pick a past event. Every member whose registration status is <strong>attended</strong> will receive the event's CPE hours. Members who already have credit for this event are skipped automatically.
      </p>

      <input className="input-base" placeholder="Search past events…"
        value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: '.75rem' }} />

      <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
        {!events && <div style={{ padding: '1rem' }}><ShimmerLines count={4} /></div>}
        {events && events.length === 0 && <p className="muted-text" style={{ padding: '1rem' }}>No past CPE events match.</p>}
        {events && events.map((ev) => (
          <label key={ev.id} style={{ display: 'flex', gap: '.5rem', padding: '.5rem .75rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', background: selected?.id === ev.id ? '#f1f5f9' : 'transparent' }}>
            <input type="radio" name="event" checked={selected?.id === ev.id} onChange={() => setSelected(ev)} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{ev.title}</div>
              <div className="muted-text" style={{ fontSize: '.75rem' }}>
                {formatDate(ev.starts_at)} · {ev.cpe_hours} CPE hrs · {ev.registered_count} registered
              </div>
            </div>
          </label>
        ))}
      </div>

      {result && (
        <div className="alert alert-success" style={{ marginTop: '.75rem' }}>
          <strong>{result.event_title}</strong>: {result.issued} new credits issued
          ({result.skipped} already existed, {result.eligible} eligible attendees in total).
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '1.25rem' }}>
        <button className="btn btn-ghost" onClick={result ? onSaved : onClose}>{result ? 'Done' : 'Cancel'}</button>
        {!result && (
          <button className="btn btn-primary" onClick={fire} disabled={!selected || busy}>
            {busy ? 'Issuing…' : 'Issue credits'}
          </button>
        )}
      </div>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Compliance tab — pick a member, see structured/unstructured/total
// ════════════════════════════════════════════════════════════════════════════

function ComplianceTab() {
  const { showToast } = useAuth();
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);

  // 3-year block. ICAI's current block is 2023–2025; we default to "last 3
  // calendar years up to today".
  const [block, setBlock] = useState(() => {
    const y = new Date().getFullYear();
    return { from: y - 2, to: y };
  });

  useEffect(() => {
    if (!user) { setData(null); return; }
    (async () => {
      try {
        const r = await fetch(`/api/admin/cpe/compliance/${user.id}?from_year=${block.from}&to_year=${block.to}`, { credentials: 'include' });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Failed');
        setData(j);
      } catch (e) { showToast?.(e.message, 'error'); setData(null); }
    })();
  }, [user, block.from, block.to]); // eslint-disable-line

  return (
    <div>
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <label style={fieldLbl}>Member</label>
        <UserPicker value={user} onChange={setUser} />

        <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem' }}>
          <div>
            <label style={fieldLbl}>From year</label>
            <input className="input-base" type="number" value={block.from}
              onChange={(e) => setBlock({ ...block, from: Number(e.target.value) })} style={{ width: 110 }} />
          </div>
          <div>
            <label style={fieldLbl}>To year</label>
            <input className="input-base" type="number" value={block.to}
              onChange={(e) => setBlock({ ...block, to: Number(e.target.value) })} style={{ width: 110 }} />
          </div>
        </div>
      </div>

      {user && !data && <ShimmerLines count={5} />}
      {user && data && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '.75rem', marginBottom: '1rem' }}>
            <StatCard label="Total hours" value={data.total.all} tone={data.total.all >= data.threshold.total ? 'ok' : 'warn'} sub={`Target ${data.threshold.total}`} />
            <StatCard label="Structured" value={data.total.structured} tone={data.total.structured >= data.threshold.structured_min ? 'ok' : 'warn'} sub={`Min ${data.threshold.structured_min}`} />
            <StatCard label="Unstructured" value={data.total.unstructured} />
            <StatCard label="Block" value={`${data.from_year}–${data.to_year}`} />
          </div>

          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Year-by-year breakdown</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <th style={th}>Year</th>
                  <th style={th}>Structured</th>
                  <th style={th}>Unstructured</th>
                  <th style={th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(data.by_year).length === 0 && (
                  <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: '#64748b', padding: '1rem' }}>
                    No CPE credits in this block.
                  </td></tr>
                )}
                {Object.entries(data.by_year).sort(([a], [b]) => Number(a) - Number(b)).map(([yr, h]) => (
                  <tr key={yr} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={td}>{yr}</td>
                    <td style={td}>{h.structured}</td>
                    <td style={td}>{h.unstructured}</td>
                    <td style={td}><strong>{h.total}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="muted-text" style={{ fontSize: '.75rem', marginTop: '.5rem' }}>
            ICAI compliance rules: full-time CAs in practice need 120 hours per 3-year block,
            with at least 90 structured hours.
          </p>
        </div>
      )}

      {!user && (
        <p className="muted-text">Pick a member above to see their CPE compliance for the chosen block.</p>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Shared: UserPicker (debounced typeahead)
// ════════════════════════════════════════════════════════════════════════════

function UserPicker({ value, onChange }) {
  const { showToast } = useAuth();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q || q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}&pageSize=10`, { credentials: 'include' });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Failed');
        setResults(j.rows || []);
      } catch (e) { showToast?.(e.message, 'error'); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line

  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.5rem .75rem', border: '1px solid #e5e7eb', borderRadius: 4, background: '#f8fafc' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500 }}>{value.name}</div>
          <div className="muted-text" style={{ fontSize: '.75rem' }}>{value.email}</div>
        </div>
        <button className="btn btn-ghost" style={{ padding: '.25rem' }} onClick={() => { onChange(null); setQ(''); }}><IconX /></button>
      </div>
    );
  }
  const inputRef = useRef(null);
  return (
    <div style={{ position: 'relative' }}>
      <input ref={inputRef} className="input-base" placeholder="Type 2+ letters of name or email…"
        value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} />
      <FlipMenu
        open={open && results.length > 0}
        triggerRef={inputRef}
        onClose={() => setOpen(false)}
        align="stretch"
        offset={2}
        maxHeight={240}
        style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 4 }}
      >
        {results.map((u) => (
          <button key={u.id} type="button" className="btn btn-ghost"
            style={{ width: '100%', textAlign: 'left', padding: '.5rem .75rem', borderRadius: 0 }}
            onMouseDown={() => { onChange(u); setOpen(false); setQ(''); }}>
            <div style={{ fontWeight: 500 }}>{u.name}</div>
            <div className="muted-text" style={{ fontSize: '.75rem' }}>{u.email}</div>
          </button>
        ))}
      </FlipMenu>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Shared bits
// ════════════════════════════════════════════════════════════════════════════

function Modal({ title, children, onClose }) {
  const titleId = `modal-title-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
         onClick={onClose}
         role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div style={{ background: 'white', borderRadius: 8, padding: '1.5rem', width: 'min(560px, 95vw)', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: '1.25rem' }}>{title}</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '.25rem' }} aria-label="Close dialog"><IconX /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Pager({ page, pageSize, total, onChange }) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.75rem', fontSize: '.875rem' }}>
      <span className="muted-text">{total} credits</span>
      <div style={{ display: 'flex', gap: '.5rem' }}>
        <button className="btn btn-ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</button>
        <span style={{ alignSelf: 'center' }}>{page} / {last}</span>
        <button className="btn btn-ghost" disabled={page >= last} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, tone }) {
  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div className="muted-text" style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{
        fontSize: '1.75rem', fontWeight: 600, marginTop: '.25rem',
        color: tone === 'warn' ? '#dc2626' : tone === 'ok' ? '#059669' : '#0f172a',
      }}>{value}</div>
      {sub && <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.25rem' }}>{sub}</div>}
    </div>
  );
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return String(d); }
}

const th = { textAlign: 'left', padding: '.5rem .75rem', fontWeight: 600, fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em', color: '#475569' };
const td = { padding: '.5rem .75rem', verticalAlign: 'top' };
const btnSm = { padding: '.25rem .5rem', fontSize: '.75rem' };
const fieldLbl = { display: 'block', fontSize: '.75rem', fontWeight: 600, color: '#475569', marginBottom: '.25rem', textTransform: 'uppercase', letterSpacing: '.05em' };
