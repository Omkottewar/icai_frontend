import { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { cachedGet } from '../lib/apiCache';
import { IconSearch, IconLock, IconArrowRight } from '../icons';

const STATUS_COLORS = {
  FCA: { bg: '#eff6ff', color: '#2563eb' },
  ACA: { bg: '#f0fdf4', color: '#16a34a' },
};

function useDirectoryData(q, statusFilter, page) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, pageSize: 25 });
    if (q.trim())               params.set('q', q.trim());
    cachedGet(`/api/members/directory?${params}`, null, 0)
      .then(setData)
      .catch(() => setData({ rows: [], total: 0, page: 1, pageSize: 25 }))
      .finally(() => setLoading(false));
  }, [q, page]);

  useEffect(() => { fetch(); }, [fetch]);

  const rows = (data?.rows ?? []).filter(
    (m) => statusFilter === 'All' || m.status === statusFilter,
  );

  return { rows, total: data?.total ?? 0, loading };
}

export default function MembersDirectoryPage() {
  const { user } = useAuth();
  const [query, setQuery]           = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage]             = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(query); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const { rows, total, loading } = useDirectoryData(debouncedQ, statusFilter, page);

  if (!user) {
    return (
      <>
        <PageHeader title="Members' Directory" subtitle="Accessible only to logged-in members" />
        <section className="container" style={{ padding: '5rem 1rem', display: 'flex', justifyContent: 'center' }}>
          <div className="card" style={{ maxWidth: '28rem', width: '100%', textAlign: 'center', padding: '2.5rem' }}>
            <div style={{
              width: '3.5rem', height: '3.5rem', borderRadius: 999,
              background: 'oklch(0.36 0.13 255 / 0.1)', color: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}>
              <IconLock size="lg" />
            </div>
            <h2 style={{ fontWeight: 700, fontSize: '1.25rem' }}>Login Required</h2>
            <p className="muted-text" style={{ marginTop: '.625rem', fontSize: '.875rem', lineHeight: 1.55 }}>
              The Members' Directory is accessible only to registered members of the Nagpur Branch.
              Please sign in to view the directory.
            </p>
            <div className="col gap-2" style={{ marginTop: '1.5rem' }}>
              <a href="#/login" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                Sign in to your account <IconArrowRight size="sm" />
              </a>
              <a href="#/signup" className="btn btn-outline" style={{ justifyContent: 'center' }}>
                Create account
              </a>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Members' Directory" subtitle="Nagpur Branch — registered members list" />

      <section className="container" style={{ padding: '2.5rem 1rem' }}>

        {/* Policy notice */}
        <div style={{
          background: 'oklch(0.50 0.16 145 / 0.07)',
          border: '1px solid oklch(0.50 0.16 145 / 0.2)',
          borderRadius: '.5rem', padding: '.875rem 1rem', marginBottom: '1.5rem', fontSize: '.8125rem',
        }}>
          <strong>Confidential:</strong> This directory is restricted to members under the jurisdiction of the Nagpur Branch.
          Do not share or reproduce member contact details outside authorised use.
        </div>

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

        {/* Directory table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                {['#', 'Name', 'Membership No.', 'Status', 'City'].map((h) => (
                  <th key={h} style={{ padding: '.625rem .75rem', fontWeight: 600, color: 'var(--muted-foreground)', fontSize: '.8125rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
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
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
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
          Data is accessible to logged-in members only, per ICAI Web-Media Policy 5(n).
        </p>
      </section>
    </>
  );
}
