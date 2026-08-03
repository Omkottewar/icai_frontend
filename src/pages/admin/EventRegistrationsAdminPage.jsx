import { useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import DataTable from '../../components/admin/DataTable';
import { useAdminList, adminFetch } from '../../hooks/useAdminList';
import { useAuth } from '../../context/AuthContext';
import { useRoute } from '../../hooks/useRoute';
import { IconSearch } from '../../icons';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

const STATUS_OPTIONS = ['registered', 'waitlisted', 'cancelled', 'attended', 'no_show'];

// Colour palette for the status pill.
const STATUS_PILL = {
  registered: { bg: 'oklch(0.94 0.04 255)', fg: 'oklch(0.28 0.13 255)' },
  waitlisted: { bg: 'oklch(0.94 0.10 90)',  fg: 'oklch(0.35 0.15 60)' },
  cancelled:  { bg: 'oklch(0.94 0 0)',      fg: 'oklch(0.45 0 0)' },
  attended:   { bg: 'oklch(0.94 0.10 145)', fg: 'oklch(0.30 0.14 145)' },
  no_show:    { bg: 'oklch(0.94 0.10 25)',  fg: 'oklch(0.42 0.20 25)' },
};

// Quick-filter chips for the status column. "All" is the default; the rest
// map 1:1 to the backend `status` filter param.
const STATUS_CHIPS = [
  { value: '',           label: 'All' },
  { value: 'registered', label: 'Registered' },
  { value: 'waitlisted', label: 'Waitlisted' },
  { value: 'attended',   label: 'Attended' },
  { value: 'no_show',    label: 'No-show' },
  { value: 'cancelled',  label: 'Cancelled' },
];

export default function EventRegistrationsAdminPage() {
  const route = useRoute();
  const { showToast } = useAuth();
  const eventIdFromUrl = route.query.event_id || '';

  // Kept minimal on purpose. Admins asked for a page a non-tech user can
  // scan in 5 seconds — one row of filters, a table, pagination.
  //  · eventIds  → multi-select event picker (deep-link ?event_id= seeds it)
  //  · status    → single-value chip row above the table
  //  · queryText → what the user is typing; debounced into `q` for the API
  const [page, setPage]         = useState(1);
  const [queryText, setQueryText] = useState('');
  const [q, setQ]               = useState('');
  const [eventIds, setEventIds] = useState(() => eventIdFromUrl ? [eventIdFromUrl] : []);
  const [status, setStatus]     = useState('');
  const [selected, setSelected] = useState(new Set());

  // Debounce search 250 ms — snappy but avoids one request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setQ(queryText.trim()); setPage(1); }, 250);
    return () => clearTimeout(t);
  }, [queryText]);

  const eventIdsParam = eventIds.join(',');

  // Full event list for the multi-select picker.
  const { data: eventOptions } = useAdminList('/api/admin/registrations/_meta/events');

  const { data, loading, refresh } = useAdminList('/api/admin/registrations', {
    page,
    pageSize: 50,
    q,
    event_ids: eventIdsParam,
    status,
    sort: 'registered_at',
    dir: 'desc',
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleOne = (id) => {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (rows.length === 0) return;
    setSelected((s) => {
      const all = rows.every((r) => s.has(r.id));
      return new Set(all ? [] : rows.map((r) => r.id));
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

  const changeStatus = async (id, newStatus) => {
    try {
      await adminFetch(`/api/admin/registrations/${id}`, { method: 'PATCH', body: { status: newStatus } });
      showToast?.('Status updated', 'success');
      refresh();
    } catch (e) { showToast?.(e.message, 'error'); }
  };

  // CSV export URL — backend dumps ALL matching rows (not just this page).
  const exportUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (q)             qs.set('q', q);
    if (eventIdsParam) qs.set('event_ids', eventIdsParam);
    if (status)        qs.set('status', status);
    const s = qs.toString();
    return `/api/admin/registrations/export.csv${s ? '?' + s : ''}`;
  }, [q, eventIdsParam, status]);

  // Programmatic download — fetch the CSV as a blob and stream it into a
  // hidden anchor. This is more robust than an `<a href>` navigation:
  //   • Never triggers the SW's navigation-mode fetch path (which some
  //     Workbox versions mangle for file-download responses)
  //   • Errors surface as normal toast messages instead of a browser-
  //     level "Failed to fetch"
  //   • Filename comes from the backend's Content-Disposition, but we
  //     supply a sensible fallback for clarity
  const [exporting, setExporting] = useState(false);
  const downloadCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const r = await fetch(exportUrl, { credentials: 'include' });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(text || `Export failed (${r.status})`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `registrations-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke on next tick so the browser has time to start the download.
      setTimeout(() => URL.revokeObjectURL(url), 500);
    } catch (e) {
      showToast?.(e.message || 'Could not export CSV', 'error');
    } finally {
      setExporting(false);
    }
  };

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
    { key: 'status', header: 'Status', width: 140, render: (r) => (
      <StatusCell status={r.status} onChange={(next) => changeStatus(r.id, next)} />
    )},
    { key: 'registered_at', header: 'Registered', width: 160, render: (r) => fmtDate(r.registered_at) },
    { key: 'attended_at', header: 'Attended', width: 160, render: (r) => fmtDate(r.attended_at) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [selected, allSelected]);

  return (
    <AdminLayout
      title="Registrations"
      subtitle={eventIdFromUrl ? `Filtered by event ${eventIdFromUrl.slice(0, 8)}…` : 'All event registrations across the branch'}
      actions={
        <>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={exporting}
            className="btn btn-outline"
            style={{ padding: '.5rem 1rem' }}
            title={eventIds.length > 1
              ? `Export combined list of ${eventIds.length} events (all filtered rows)`
              : 'Export all filtered rows as CSV'}
          >
            {exporting ? 'Preparing…' : (
              <>⬇ Export CSV{eventIds.length > 1 ? ` (${eventIds.length} events combined)` : ''}</>
            )}
          </button>
          <button className="btn btn-primary" disabled={selected.size === 0} onClick={markAttended} style={{ padding: '.5rem 1rem' }}>
            Mark attended ({selected.size})
          </button>
        </>
      }
    >
      {/* Row 1 — Event picker + search. Both wide enough to breathe. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '.5rem', marginBottom: '.5rem' }}>
        <EventPickerButton
          selected={eventIds}
          options={eventOptions?.events || []}
          onChange={(next) => { setEventIds(next); setPage(1); }}
        />
        <label style={{
          display: 'flex', alignItems: 'center', gap: '.4rem',
          padding: '.5rem .7rem', border: '1px solid var(--border)',
          borderRadius: '.375rem', background: 'var(--background)',
        }}>
          <IconSearch size="sm" />
          <input
            type="search"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Search by name or email…"
            style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: '.875rem' }}
          />
        </label>
      </div>

      {/* Row 2 — Status quick-filter chips. One row, always visible. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.35rem', marginBottom: '.75rem' }}>
        {STATUS_CHIPS.map((c) => {
          const on = status === c.value;
          return (
            <button
              key={c.value || 'all'}
              type="button"
              onClick={() => { setStatus(c.value); setPage(1); }}
              style={{
                padding: '.3rem .75rem', borderRadius: 999,
                border: '1px solid ' + (on ? 'var(--primary)' : 'var(--border)'),
                background: on ? 'oklch(0.36 0.13 255 / 0.10)' : 'var(--card)',
                color: on ? 'var(--primary)' : 'var(--foreground)',
                fontSize: '.78rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {c.label}
            </button>
          );
        })}
        <span className="muted-text" style={{ fontSize: '.75rem', marginLeft: 'auto', alignSelf: 'center' }}>
          {loading ? 'Loading…' : `${total.toLocaleString('en-IN')} registration${total === 1 ? '' : 's'}`}
        </span>
      </div>

      {/* Bulk-action bar — only visible when rows are selected. */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '.6rem',
          padding: '.55rem .75rem',
          background: 'oklch(0.94 0.05 145 / .55)',
          border: '1px solid oklch(0.65 0.14 145 / .35)',
          borderRadius: '.4rem',
          marginBottom: '.6rem',
          fontSize: '.85rem',
        }}>
          <span style={{ fontWeight: 600 }}>{selected.size} selected</span>
          <button
            type="button"
            onClick={markAttended}
            className="btn btn-primary"
            style={{ padding: '.35rem .8rem', fontSize: '.8rem' }}
          >
            ✓ Mark attended
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="btn btn-outline"
            style={{ padding: '.35rem .7rem', fontSize: '.8rem' }}
          >
            Clear selection
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        total={total}
        page={page}
        pageSize={data?.pageSize ?? 50}
        onPageChange={setPage}
        emptyMessage={
          (q || eventIds.length > 0 || status)
            ? 'No registrations match these filters. Try clearing the search or picking a different event / status.'
            : 'No registrations yet. Once members register for events, they\'ll appear here.'
        }
      />

      {/* Simple prev/next pager below the table so page 3 → page 4 is one click even with 200 rows. */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '.75rem', fontSize: '.8rem' }}>
          <button type="button" className="btn btn-outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            style={{ padding: '.35rem .75rem', fontSize: '.75rem' }}>← Previous</button>
          <span className="muted-text">Page {page} of {totalPages}</span>
          <button type="button" className="btn btn-outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            style={{ padding: '.35rem .75rem', fontSize: '.75rem' }}>Next →</button>
        </div>
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

// Status cell — colored pill by default (like every other admin table),
// click to reveal a native <select> for change. Prevents accidental
// status flips on the 99% of rows that never need editing while
// keeping the "change one row's status" path a single click away for
// the rare cases (mark a specific person no-show, cancel one seat).
// Bulk transitions still go through the toolbar's "Mark attended" button.
function StatusCell({ status, onChange }) {
  const [editing, setEditing] = useState(false);
  const palette = STATUS_PILL[status] || STATUS_PILL.registered;

  if (editing) {
    return (
      <select
        autoFocus
        className="input-base"
        value={status}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => { onChange(e.target.value); setEditing(false); }}
        onBlur={() => setEditing(false)}
        style={{ padding: '.25rem .5rem', fontSize: '.75rem' }}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{s.replace('_', ' ')}</option>
        ))}
      </select>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      title="Click to change status"
      style={{
        background: palette.bg, color: palette.fg,
        border: 'none', padding: '.2rem .55rem',
        borderRadius: 999,
        fontSize: '.7rem', fontWeight: 700,
        textTransform: 'capitalize', letterSpacing: '.02em',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: '.25rem',
      }}
    >
      {status.replace('_', ' ')}
      <span aria-hidden style={{ opacity: 0.55, fontSize: '.62rem' }}>▾</span>
    </button>
  );
}

// Compact button that shows the current event-filter state ("All events"
// or "3 events selected") and opens the multi-event picker below it in a
// click-outside popover. Simpler than a persistent panel — non-tech users
// see one clear button on the toolbar until they need to filter.
function EventPickerButton({ selected, options, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = selected.length === 0
    ? 'All events'
    : selected.length === 1
      ? '1 event selected'
      : `${selected.length} events selected`;

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          padding: '.5rem .75rem',
          border: '1px solid ' + (selected.length > 0 ? 'var(--primary)' : 'var(--border)'),
          borderRadius: '.375rem',
          background: selected.length > 0 ? 'oklch(0.36 0.13 255 / 0.08)' : 'var(--background)',
          color: 'var(--foreground)',
          fontSize: '.875rem', textAlign: 'left', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem',
        }}
      >
        <span style={{ fontWeight: selected.length > 0 ? 600 : 400 }}>
          📅 {label}
        </span>
        <span aria-hidden style={{ color: 'var(--muted-foreground)', fontSize: '.75rem' }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + .3rem)', left: 0, right: 0,
            zIndex: 50, background: 'var(--card)',
            border: '1px solid var(--border)', borderRadius: '.5rem',
            boxShadow: '0 12px 30px oklch(0.2 0.05 250 / 0.15)',
            padding: '.65rem', minWidth: 320,
          }}
        >
          <MultiEventPicker options={options} selected={selected} onChange={onChange} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '.5rem' }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn btn-primary"
              style={{ padding: '.3rem .8rem', fontSize: '.78rem' }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Multi-event picker — chips of selected events on top, searchable
// checkbox list below. Used inside EventPickerButton above.
function MultiEventPicker({ options, selected, onChange }) {
  const [q, setQ] = useState('');
  const selectedSet = new Set(selected);
  const selectedRows = options.filter((e) => selectedSet.has(e.id));

  const filtered = q.trim()
    ? options.filter((e) => (e.title || '').toLowerCase().includes(q.trim().toLowerCase()))
    : options;

  const toggle = (id) => {
    if (selectedSet.has(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
      {selectedRows.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.25rem' }}>
          {selectedRows.map((e) => (
            <span key={e.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: '.3rem',
              padding: '.1rem .5rem', borderRadius: 999,
              background: 'oklch(0.36 0.13 255 / 0.10)', color: 'var(--primary)',
              fontSize: '.7rem', fontWeight: 600,
            }}>
              {e.title.length > 40 ? e.title.slice(0, 40) + '…' : e.title}
              <button
                type="button"
                aria-label={`Remove ${e.title}`}
                onClick={() => toggle(e.id)}
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'inherit', padding: 0, fontSize: '.85rem', lineHeight: 1 }}
              >×</button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            style={{ fontSize: '.68rem', background: 'transparent', border: 0, color: 'var(--muted-foreground)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Clear all
          </button>
        </div>
      )}

      <input
        type="search"
        placeholder="Search events by title…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="input-base"
        style={{ fontSize: '.8rem' }}
      />
      <div style={{
        maxHeight: 200, overflowY: 'auto',
        border: '1px solid var(--border)', borderRadius: '.35rem',
      }}>
        {options.length === 0 && (
          <div className="muted-text" style={{ padding: '.6rem', fontSize: '.78rem', textAlign: 'center' }}>
            Loading events…
          </div>
        )}
        {options.length > 0 && filtered.length === 0 && (
          <div className="muted-text" style={{ padding: '.6rem', fontSize: '.78rem', textAlign: 'center' }}>
            No events match &quot;{q}&quot;.
          </div>
        )}
        {filtered.slice(0, 100).map((e) => {
          const on = selectedSet.has(e.id);
          const when = e.starts_at ? new Date(e.starts_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
          return (
            <label key={e.id} style={{
              display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '.5rem',
              padding: '.4rem .55rem', borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              background: on ? 'oklch(0.90 0.10 145 / 0.15)' : 'transparent',
              fontSize: '.8rem', color: 'var(--foreground)',
            }}>
              <input type="checkbox" checked={on} onChange={() => toggle(e.id)} />
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
              <span className="muted-text" style={{ fontSize: '.68rem' }}>
                {when}
                {e.registered_count > 0 ? ` · ${e.registered_count} reg` : ''}
              </span>
            </label>
          );
        })}
        {filtered.length > 100 && (
          <div className="muted-text" style={{ padding: '.4rem', fontSize: '.7rem', textAlign: 'center' }}>
            Showing first 100 — refine the search to narrow down.
          </div>
        )}
      </div>
    </div>
  );
}

