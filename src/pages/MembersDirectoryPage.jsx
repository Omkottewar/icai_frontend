import { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { cachedGet } from '../lib/apiCache';
import { IconSearch, IconArrowRight, IconLock } from '../icons';
import { ShimmerTableRow } from '../components/ui/Shimmer';

const STATUS_COLORS = {
  FCA: { bg: '#eff6ff', color: '#2563eb' },
  ACA: { bg: '#f0fdf4', color: '#16a34a' },
};

// Send status to the server so pagination/total are correct per filter
// (filtering client-side over a 25-row page would show "0 results" any
// time the page happens to contain only the opposite-status members).
function useDirectoryData(q, statusFilter, page) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, pageSize: 25 });
    if (q.trim())                 params.set('q', q.trim());
    if (statusFilter !== 'All')   params.set('status', statusFilter);
    cachedGet(`/api/members/directory?${params}`, null, 0)
      .then(setData)
      .catch(() => setData({ rows: [], total: 0, page: 1, pageSize: 25, authed: false }))
      .finally(() => setLoading(false));
  }, [q, page, statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  return {
    rows: data?.rows ?? [],
    total: data?.total ?? 0,
    authed: !!data?.authed,
    loading,
  };
}

export default function MembersDirectoryPage() {
  const [query, setQuery]           = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage]             = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(query); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const { rows, total, authed, loading } = useDirectoryData(debouncedQ, statusFilter, page);

  return (
    <>
      <PageHeader title="Members' Directory" subtitle="Nagpur Branch — registered members list" />

      <section className="container" style={{ padding: '2.5rem 1rem' }}>

        {/* Policy / sign-in nudge — wording depends on auth state. */}
        {authed ? (
          <div style={{
            background: 'oklch(0.50 0.16 145 / 0.07)',
            border: '1px solid oklch(0.50 0.16 145 / 0.2)',
            borderRadius: '.5rem', padding: '.875rem 1rem', marginBottom: '1.5rem', fontSize: '.8125rem',
          }}>
            <strong>Confidential:</strong> This directory is restricted to members under the jurisdiction
            of the Nagpur Branch. Do not share or reproduce member contact details outside authorised use.
          </div>
        ) : (
          <div className="row gap-2" style={{
            background: 'oklch(0.85 0.16 90 / 0.18)',
            border: '1px solid oklch(0.78 0.13 90 / 0.5)',
            borderRadius: '.5rem', padding: '.875rem 1rem', marginBottom: '1.5rem', fontSize: '.8125rem',
            alignItems: 'flex-start', flexWrap: 'wrap',
          }}>
            <span style={{ color: 'oklch(0.45 0.18 75)', marginTop: 2 }}><IconLock size="sm" /></span>
            <div style={{ flex: 1, minWidth: '14rem' }}>
              <strong>Sign in to see contact details.</strong>{' '}
              You're viewing the public roster. Members can sign in to access phone, email and firm information.
            </div>
            <a href="#/login" className="btn btn-primary" style={{ padding: '.3rem .75rem', fontSize: '.75rem', whiteSpace: 'nowrap' }}>
              Sign in <IconArrowRight size="sm" />
            </a>
          </div>
        )}

        {/* Filters */}
        <div className="row gap-3" style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div className="row gap-2" style={{
            flex: 1, minWidth: '220px',
            border: '1px solid var(--border)', borderRadius: '.375rem',
            padding: '.5rem .75rem', background: 'var(--card)',
          }}>
            <IconSearch size="sm" style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or membership no."
              style={{ border: 0, outline: 'none', background: 'transparent', flex: 1, fontSize: '.875rem' }}
            />
          </div>
          <div className="row gap-2">
            {['All', 'FCA', 'ACA'].map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={'btn ' + (statusFilter === s ? 'btn-primary' : 'btn-outline')}
                style={{ padding: '.375rem .875rem', borderRadius: 999, fontSize: '.8125rem' }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <p className="muted-text" style={{ marginBottom: '1rem', fontSize: '.8125rem' }}>
          {loading ? 'Loading…' : `Showing ${rows.length} of ${total} members`}
        </p>

        {/* Directory table — columns vary by auth state. Anonymous callers
            see the same 5 columns as before; authed callers also get Phone,
            Email and Firm. The Email column gets a mailto:, and Phone gets
            a tel: link so members can tap to dial / mail on mobile. */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                {(authed
                  ? ['#', 'Name', 'Membership No.', 'Status', 'City', 'Phone', 'Email', 'Firm']
                  : ['#', 'Name', 'Membership No.', 'Status', 'City']
                ).map((h) => (
                  <th key={h} style={{ padding: '.625rem .75rem', fontWeight: 600, color: 'var(--muted-foreground)', fontSize: '.8125rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && Array.from({ length: 8 }).map((_, i) => (
                <ShimmerTableRow key={'mds-' + i} cols={authed ? 8 : 5} />
              ))}
              {rows.map((m, i) => {
                const sc = STATUS_COLORS[m.status] || { bg: '#f9fafb', color: '#6b7280' };
                return (
                  <tr
                    key={m.id}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--muted)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '.625rem .75rem', color: 'var(--muted-foreground)' }}>{(page - 1) * 25 + i + 1}</td>
                    <td style={{ padding: '.625rem .75rem' }}>
                      <div className="row gap-2">
                        <div style={{
                          width: '1.75rem', height: '1.75rem', borderRadius: 999,
                          background: 'oklch(0.36 0.13 255 / 0.1)', color: 'var(--primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '.625rem', fontWeight: 700, flexShrink: 0,
                        }}>
                          {m.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}
                        </div>
                        <span style={{ fontWeight: 500 }}>{m.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '.625rem .75rem', fontFamily: 'monospace', fontSize: '.8125rem', color: 'var(--muted-foreground)' }}>{m.mrn}</td>
                    <td style={{ padding: '.625rem .75rem' }}>
                      <span style={{
                        padding: '.125rem .5rem', borderRadius: '.25rem',
                        fontSize: '.75rem', fontWeight: 600,
                        background: sc.bg, color: sc.color,
                      }}>{m.status}</span>
                    </td>
                    <td style={{ padding: '.625rem .75rem', color: 'var(--muted-foreground)' }}>{m.city || '—'}</td>
                    {authed && (
                      <>
                        <td style={{ padding: '.625rem .75rem', fontFamily: 'monospace', fontSize: '.8125rem' }}>
                          {m.phone ? (
                            <a href={`tel:${m.phone}`} style={{ color: 'var(--primary)' }}>{m.phone}</a>
                          ) : <span style={{ color: 'var(--muted-foreground)' }}>—</span>}
                        </td>
                        <td style={{ padding: '.625rem .75rem', fontSize: '.8125rem' }}>
                          {m.email ? (
                            <a href={`mailto:${m.email}`} style={{ color: 'var(--primary)' }}>{m.email}</a>
                          ) : <span style={{ color: 'var(--muted-foreground)' }}>—</span>}
                        </td>
                        <td style={{ padding: '.625rem .75rem', color: 'var(--muted-foreground)', fontSize: '.8125rem', maxWidth: '14rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={m.firm_name || ''}>
                          {m.firm_name || '—'}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={authed ? 8 : 5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                    No members found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 25 && (
          <div className="row gap-2" style={{ marginTop: '1.25rem', justifyContent: 'center' }}>
            <button
              className="btn btn-outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              style={{ padding: '.375rem .875rem', fontSize: '.8125rem' }}
            >
              Previous
            </button>
            <span className="muted-text" style={{ display: 'flex', alignItems: 'center', fontSize: '.8125rem' }}>
              Page {page} of {Math.ceil(total / 25)}
            </span>
            <button
              className="btn btn-outline"
              disabled={page >= Math.ceil(total / 25)}
              onClick={() => setPage((p) => p + 1)}
              style={{ padding: '.375rem .875rem', fontSize: '.8125rem' }}
            >
              Next
            </button>
          </div>
        )}

        <p className="muted-text" style={{ marginTop: '1.25rem', fontSize: '.75rem' }}>
          {authed
            ? 'Contact details are visible to signed-in members only, per ICAI Web-Media Policy 5(n).'
            : 'Sign in to view phone, email and firm details. The roster itself is public.'}
        </p>
      </section>
    </>
  );
}
