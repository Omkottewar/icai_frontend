import { useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';
import { useAdminList, adminFetch } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { useRoute } from '../../hooks/useRoute';
import { ShimmerLines } from '../../components/ui/Shimmer';
import { IconSearch, IconCalendar, IconMapPin } from '../../icons';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
function fmtEventDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_OPTIONS = ['registered', 'waitlisted', 'cancelled', 'attended', 'no_show'];

// Sort presets shared by the flat and grouped views. Backend whitelists
// these — anything else falls back to `registered_at desc`.
const SORT_OPTIONS = [
  { value: 'registered_at:desc',   label: 'Recently registered' },
  { value: 'registered_at:asc',    label: 'Oldest registration first' },
  { value: 'attended_at:desc',     label: 'Recently attended' },
  { value: 'event_starts_at:desc', label: 'Event date — newest first' },
  { value: 'event_starts_at:asc',  label: 'Event date — oldest first' },
  { value: 'user_name:asc',        label: 'Attendee A → Z' },
  { value: 'user_name:desc',       label: 'Attendee Z → A' },
  { value: 'event_title:asc',      label: 'Event title A → Z' },
  { value: 'status:asc',           label: 'Status' },
];

export default function EventRegistrationsAdminPage() {
  const route = useRoute();
  const { showToast } = useAuth();
  const eventIdFromUrl = route.query.event_id || '';

  const [page, setPage]           = useState(1);
  const [q, setQ]                 = useState('');
  const [eventId, setEventId]     = useState(eventIdFromUrl);
  const [committeeId, setCommitteeId] = useState('');
  const [status, setStatus]       = useState('');
  const [mode, setMode]           = useState('');
  const [attended, setAttended]   = useState('');   // '' | 'yes' | 'no'
  const [when, setWhen]           = useState('');   // '' | 'upcoming' | 'past'
  const [from, setFrom]           = useState('');
  const [to, setTo]               = useState('');
  const [sortOpt, setSortOpt]     = useState('registered_at:desc');
  const [groupByEvent, setGroupByEvent] = useState(false);
  const [selected, setSelected]   = useState(new Set());

  const [sort, dir] = sortOpt.split(':');

  const { data: lookups } = useAdminList('/api/admin/events/_meta/lookups');

  // When grouping by event, we override sort so rows come back grouped
  // together (event_starts_at, then user_name inside each event) —
  // otherwise the UI can't render clean event section headers.
  const effectiveSort = groupByEvent ? 'event_starts_at' : sort;
  const effectiveDir  = groupByEvent ? 'desc'           : dir;

  const { data, loading, refresh } = useAdminList('/api/admin/registrations', {
    page,
    pageSize: groupByEvent ? 200 : 50,   // grouped view needs bigger chunk so groups aren't split across pages
    q,
    event_id: eventId,
    committee_id: committeeId,
    status,
    mode,
    attended,
    from, to, when,
    sort: effectiveSort, dir: effectiveDir,
  });

  const activeFilterCount = [
    q, eventId, committeeId, status, mode, attended, from, to, when,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setQ(''); setEventId(''); setCommitteeId(''); setStatus('');
    setMode(''); setAttended(''); setFrom(''); setTo(''); setWhen('');
    setPage(1);
  };

  const toggleOne = (id) => {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!data?.rows) return;
    const allIds = data.rows.map((r) => r.id);
    setSelected((s) => {
      const allSelected = allIds.every((id) => s.has(id));
      return new Set(allSelected ? [] : allIds);
    });
  };

  const markAttended = async () => {
    if (selected.size === 0) return;
    try {
      const r = await adminFetch('/api/admin/registrations/bulk-attended', {
        method: 'POST',
        body: { ids: Array.from(selected) },
      });
      showToast?.(`Marked ${r.updated} as attended`, 'success');
      setSelected(new Set());
      refresh();
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  const exportCsv = () => {
    const rows = data?.rows || [];
    const csv = [
      ['User', 'Email', 'Event', 'Event date', 'Committee', 'Status', 'Registered at', 'Attended at'],
      ...rows.map((r) => [
        r.user_name || '', r.user_email || '',
        r.event_title || '', r.event_starts_at || '',
        r.event_committee_name || '',
        r.status, r.registered_at || '', r.attended_at || '',
      ]),
    ].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `registrations-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const changeStatus = async (id, newStatus) => {
    try {
      await adminFetch(`/api/admin/registrations/${id}`, { method: 'PATCH', body: { status: newStatus } });
      showToast?.('Registration updated', 'success');
      refresh();
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  const rows = data?.rows ?? [];
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const columns = useMemo(() => [
    {
      key: '_select', header: (
        <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
      ),
      width: 40,
      render: (r) => (
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleOne(r.id)}
          aria-label="Select"
        />
      ),
    },
    { key: 'user', header: 'Attendee', render: (r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{r.user_name || '—'}</div>
        <div className="muted-text" style={{ fontSize: '.75rem' }}>{r.user_email || '—'}</div>
      </div>
    )},
    { key: 'event', header: 'Event', render: (r) => (
      <div>
        <div style={{ fontWeight: 600, fontSize: '.8125rem' }}>{r.event_title || '—'}</div>
        <div className="muted-text" style={{ fontSize: '.75rem' }}>
          {fmtDate(r.event_starts_at)}
          {r.event_committee_name && ` · ${r.event_committee_name}`}
        </div>
      </div>
    )},
    { key: 'status', header: 'Status', width: 160, render: (r) => (
      <select
        className="input-base"
        value={r.status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => changeStatus(r.id, e.target.value)}
        style={{ padding: '.25rem .5rem', fontSize: '.75rem' }}
      >
        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
      </select>
    )},
    { key: 'registered_at', header: 'Registered', width: 160, render: (r) => fmtDate(r.registered_at) },
    { key: 'attended_at', header: 'Attended', width: 160, render: (r) => fmtDate(r.attended_at) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selected, allSelected]);

  // Group rows by event when the toggle is on. The backend already sorts
  // by event_starts_at desc in that mode, so a linear walk produces groups
  // in the right order without another client-side sort.
  const grouped = useMemo(() => {
    if (!groupByEvent) return null;
    const out = [];
    let current = null;
    for (const r of rows) {
      if (!current || current.event_id !== r.event_id) {
        current = {
          event_id: r.event_id,
          event_title: r.event_title,
          event_starts_at: r.event_starts_at,
          event_venue: r.event_venue,
          event_mode: r.event_mode,
          event_committee_name: r.event_committee_name,
          registrations: [],
        };
        out.push(current);
      }
      current.registrations.push(r);
    }
    return out;
  }, [rows, groupByEvent]);

  return (
    <AdminLayout
      title="Registrations"
      subtitle={eventIdFromUrl ? `Filtered by event ${eventIdFromUrl.slice(0, 8)}…` : 'All event registrations across the branch'}
      actions={
        <>
          <button className="btn btn-outline" onClick={exportCsv} style={{ padding: '.5rem 1rem' }}>Export CSV</button>
          <button className="btn btn-primary" disabled={selected.size === 0} onClick={markAttended} style={{ padding: '.5rem 1rem' }}>
            Mark attended ({selected.size})
          </button>
        </>
      }
    >
      {/* Toolbar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '.5rem', alignItems: 'center',
        padding: '.75rem', background: 'var(--card)',
        border: '1px solid var(--border)', borderRadius: '.5rem',
        marginBottom: '.75rem',
      }}>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: '.4rem',
          padding: '.35rem .6rem', border: '1px solid var(--border)',
          borderRadius: '.375rem', background: 'var(--background)',
          minWidth: 240, flex: 1, maxWidth: 400,
        }}>
          <IconSearch size="sm" />
          <input
            type="text"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search attendee name or email…"
            style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: '.875rem' }}
          />
        </label>

        <select
          className="input-base"
          value={sortOpt}
          onChange={(e) => { setSortOpt(e.target.value); setPage(1); }}
          disabled={groupByEvent}
          title={groupByEvent ? 'Sort disabled while grouped by event' : 'Sort'}
          style={{ maxWidth: 220 }}
          aria-label="Sort by"
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: '.4rem',
          padding: '.4rem .7rem', border: '1px solid var(--border)',
          borderRadius: '.375rem', fontSize: '.8rem', cursor: 'pointer',
          background: groupByEvent ? 'oklch(0.94 0.03 250)' : 'var(--background)',
          color: groupByEvent ? 'oklch(0.28 0.09 250)' : 'inherit',
          fontWeight: groupByEvent ? 600 : 400,
        }}>
          <input
            type="checkbox"
            checked={groupByEvent}
            onChange={(e) => { setGroupByEvent(e.target.checked); setPage(1); }}
            style={{ margin: 0 }}
          />
          Group by event
        </label>

        <FiltersButton
          state={{ eventId, committeeId, status, mode, attended, when, from, to }}
          setters={{ setEventId, setCommitteeId, setStatus, setMode, setAttended, setWhen, setFrom, setTo }}
          lookups={lookups}
          activeFilterCount={activeFilterCount}
          clearFilters={clearFilters}
          onAnyChange={() => setPage(1)}
        />

        {activeFilterCount > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={clearFilters}
            style={{ padding: '.4rem .6rem', fontSize: '.75rem', color: '#dc2626' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Body — either the flat DataTable or the grouped list */}
      {groupByEvent ? (
        <GroupedView
          groups={grouped}
          loading={loading}
          selected={selected}
          onToggleOne={toggleOne}
          onChangeStatus={changeStatus}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          total={data?.total ?? 0}
          page={page}
          pageSize={data?.pageSize ?? 50}
          onPageChange={setPage}
        />
      )}

      <style>{`
        .input-base {
          width: 100%; padding: .5rem .75rem;
          border: 1px solid var(--border); border-radius: .375rem;
          background: var(--background); font-size: .875rem; color: var(--foreground);
        }
      `}</style>
    </AdminLayout>
  );
}

// ─── Grouped-by-event view ───────────────────────────────────────────────
// One card per event with a compact header (title, date, venue, mode,
// registration counts) and the attendee list inside. Cards collapse on
// click for events with lots of registrants.
function GroupedView({ groups, loading, selected, onToggleOne, onChangeStatus }) {
  if (loading) return <ShimmerLines count={4} />;
  if (!groups || groups.length === 0) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
        No registrations match your filters.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
      {groups.map((g) => (
        <EventGroupCard
          key={g.event_id}
          group={g}
          selected={selected}
          onToggleOne={onToggleOne}
          onChangeStatus={onChangeStatus}
        />
      ))}
    </div>
  );
}

function EventGroupCard({ group, selected, onToggleOne, onChangeStatus }) {
  const [open, setOpen] = useState(true);
  const registrations = group.registrations;
  const counts = registrations.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const attendedCount = registrations.filter((r) => r.attended_at).length;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', background: 'oklch(0.97 0.02 250)',
          border: 'none', borderBottom: open ? '1px solid var(--border)' : 'none',
          padding: '.85rem 1rem',
          display: 'flex', alignItems: 'flex-start', gap: '.75rem',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '1rem', lineHeight: 1.2, color: 'var(--muted-foreground)' }}>
          {open ? '▾' : '▸'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '.95rem' }}>{group.event_title || '—'}</div>
          <div className="muted-text" style={{ fontSize: '.75rem', marginTop: '.15rem', display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
            <span className="row gap-1"><IconCalendar size="sm" /> {fmtEventDate(group.event_starts_at)}</span>
            {group.event_venue && <span className="row gap-1"><IconMapPin size="sm" /> {group.event_venue}</span>}
            {group.event_mode && <span>· {String(group.event_mode).replace('_', ' ')}</span>}
            {group.event_committee_name && <span>· {group.event_committee_name}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '.35rem', alignItems: 'center', flexShrink: 0 }}>
          <StatusChip label={`${registrations.length} total`} tone="neutral" />
          {counts.registered > 0 && <StatusChip label={`${counts.registered} registered`} tone="primary" />}
          {counts.waitlisted > 0 && <StatusChip label={`${counts.waitlisted} waitlist`} tone="warn" />}
          {attendedCount > 0 && <StatusChip label={`${attendedCount} attended`} tone="success" />}
          {counts.cancelled > 0 && <StatusChip label={`${counts.cancelled} cancelled`} tone="muted" />}
        </div>
      </button>

      {open && (
        <div style={{ padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th style={th} width={36} />
                <th style={th}>Attendee</th>
                <th style={th}>Status</th>
                <th style={th}>Registered</th>
                <th style={th}>Attended</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => onToggleOne(r.id)}
                    />
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{r.user_name || '—'}</div>
                    <div className="muted-text" style={{ fontSize: '.72rem' }}>{r.user_email || '—'}</div>
                  </td>
                  <td style={td} width={160}>
                    <select
                      className="input-base"
                      value={r.status}
                      onChange={(e) => onChangeStatus(r.id, e.target.value)}
                      style={{ padding: '.25rem .5rem', fontSize: '.72rem' }}
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td style={td} width={150}>{fmtDate(r.registered_at)}</td>
                  <td style={td} width={150}>{fmtDate(r.attended_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusChip({ label, tone }) {
  const colours = {
    primary: { bg: '#dbeafe', fg: '#1e40af' },
    success: { bg: '#d1fae5', fg: '#065f46' },
    warn:    { bg: '#fef3c7', fg: '#92400e' },
    muted:   { bg: '#f1f5f9', fg: '#475569' },
    neutral: { bg: '#e2e8f0', fg: '#0f172a' },
  }[tone] ?? { bg: '#e2e8f0', fg: '#0f172a' };
  return (
    <span style={{
      background: colours.bg, color: colours.fg,
      padding: '.15rem .55rem', borderRadius: 999,
      fontSize: '.7rem', fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ─── Filters popover ─────────────────────────────────────────────────────
// Same pattern as EventsAdminPage — one button, click-outside/Esc closes,
// two-column grid inside. Every filter change resets page to 1 via the
// onAnyChange callback the parent supplies.
function FiltersButton({ state, setters, lookups, activeFilterCount, clearFilters, onAnyChange }) {
  const { eventId, committeeId, status, mode, attended, when, from, to } = state;
  const { setEventId, setCommitteeId, setStatus, setMode, setAttended, setWhen, setFrom, setTo } = setters;
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);
  const buttonRef  = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (popoverRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const wrap = (fn) => (v) => { fn(v); onAnyChange?.(); };

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-outline"
        onClick={() => setOpen((v) => !v)}
        style={{ padding: '.45rem .85rem', fontSize: '.85rem', display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}
        aria-expanded={open}
      >
        Filters
        {activeFilterCount > 0 && (
          <span style={{
            background: 'var(--primary)', color: 'white',
            padding: '.05rem .45rem', borderRadius: 999,
            fontSize: '.7rem', fontWeight: 700, lineHeight: 1.4,
          }}>{activeFilterCount}</span>
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Registration filters"
          style={{
            position: 'absolute', top: 'calc(100% + .4rem)', right: 0,
            width: 'min(560px, 90vw)',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '.5rem',
            boxShadow: '0 20px 40px oklch(0.2 0.05 250 / 0.15)',
            zIndex: 50,
            padding: '1rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '.75rem',
          }}
        >
          <FilterField label="Event">
            <input
              type="text"
              className="input-base"
              value={eventId}
              placeholder="Event ID (leave blank for all)"
              onChange={(e) => wrap(setEventId)(e.target.value)}
            />
          </FilterField>

          <FilterField label="Committee">
            <select className="input-base" value={committeeId} onChange={(e) => wrap(setCommitteeId)(e.target.value)}>
              <option value="">All committees</option>
              {lookups?.committees?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Registration status">
            <select className="input-base" value={status} onChange={(e) => wrap(setStatus)(e.target.value)}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </FilterField>

          <FilterField label="Event mode">
            <select className="input-base" value={mode} onChange={(e) => wrap(setMode)(e.target.value)}>
              <option value="">Any mode</option>
              <option value="in_person">In person</option>
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </FilterField>

          <FilterField label="Attendance marked?">
            <select className="input-base" value={attended} onChange={(e) => wrap(setAttended)(e.target.value)}>
              <option value="">Any</option>
              <option value="yes">Attended</option>
              <option value="no">Not marked</option>
            </select>
          </FilterField>

          <FilterField label="When (shortcut)">
            <select className="input-base" value={when} onChange={(e) => wrap(setWhen)(e.target.value)}>
              <option value="">Any date</option>
              <option value="upcoming">Upcoming events only</option>
              <option value="past">Past events only</option>
            </select>
          </FilterField>

          <FilterField label="Event date from" hint={when ? 'disabled — clear shortcut above' : null}>
            <input
              type="date"
              className="input-base"
              value={from}
              disabled={!!when}
              onChange={(e) => wrap(setFrom)(e.target.value)}
            />
          </FilterField>

          <FilterField label="Event date to" hint={when ? 'disabled — clear shortcut above' : null}>
            <input
              type="date"
              className="input-base"
              value={to}
              disabled={!!when}
              onChange={(e) => wrap(setTo)(e.target.value)}
            />
          </FilterField>

          <div style={{
            gridColumn: '1 / -1',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: '.4rem', paddingTop: '.75rem',
            borderTop: '1px solid var(--border)',
          }}>
            <span className="muted-text" style={{ fontSize: '.75rem' }}>
              {activeFilterCount === 0 ? 'No filters applied' : `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} applied`}
            </span>
            <div style={{ display: 'flex', gap: '.4rem' }}>
              {activeFilterCount > 0 && (
                <button type="button" className="btn btn-ghost" onClick={clearFilters} style={{ padding: '.35rem .7rem', fontSize: '.75rem', color: '#dc2626' }}>
                  Clear all
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={() => setOpen(false)} style={{ padding: '.35rem .8rem', fontSize: '.8rem' }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterField({ label, hint, children }) {
  return (
    <label style={{ fontSize: '.72rem', color: 'var(--muted-foreground)', display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
      <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--foreground)' }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: '.68rem', color: 'var(--muted-foreground)' }}>{hint}</span>}
    </label>
  );
}

const th = { textAlign: 'left', padding: '.5rem .75rem', fontWeight: 600, fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.05em', color: '#475569' };
const td = { padding: '.5rem .75rem', verticalAlign: 'top' };
