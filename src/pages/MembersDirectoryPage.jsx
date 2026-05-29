import { useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { MEMBERS_DIRECTORY } from '../data/constants';
import { IconSearch, IconUser, IconLock, IconArrowRight } from '../icons';

const STATUS_COLORS = {
  FCA: { bg: '#eff6ff', color: '#2563eb' },
  ACA: { bg: '#f0fdf4', color: '#16a34a' },
};

export default function MembersDirectoryPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const filtered = MEMBERS_DIRECTORY.filter((m) => {
    const matchQ = query === '' ||
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.area.toLowerCase().includes(query.toLowerCase()) ||
      m.memNo.toLowerCase().includes(query.toLowerCase());
    const matchS = statusFilter === 'All' || m.status === statusFilter;
    return matchQ && matchS;
  });

  if (!user) {
    return (
      <>
        <PageHeader title="Members' Directory" subtitle="Accessible only to logged-in members" />
        <section className="container" style={{ padding: '5rem 1rem', display: 'flex', justifyContent: 'center' }}>
          <div className="card" style={{ maxWidth: '28rem', width: '100%', textAlign: 'center', padding: '2.5rem' }}>
            <div style={{
              width: '3.5rem', height: '3.5rem', borderRadius: 999,
              background: 'oklch(0.36 0.13 255 / 0.1)',
              color: 'var(--primary)',
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
          borderRadius: '.5rem',
          padding: '.875rem 1rem',
          marginBottom: '1.5rem',
          fontSize: '.8125rem',
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
              placeholder="Search by name, area or membership no."
              style={{ border: 0, outline: 'none', background: 'transparent', flex: 1, fontSize: '.875rem' }}
            />
          </div>
          <div className="row gap-2">
            {['All', 'FCA', 'ACA'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
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
          Showing {filtered.length} of {MEMBERS_DIRECTORY.length} members
        </p>

        {/* Directory table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '.625rem .75rem', fontWeight: 600, color: 'var(--muted-foreground)', fontSize: '.8125rem' }}>#</th>
                <th style={{ padding: '.625rem .75rem', fontWeight: 600, color: 'var(--muted-foreground)', fontSize: '.8125rem' }}>Name</th>
                <th style={{ padding: '.625rem .75rem', fontWeight: 600, color: 'var(--muted-foreground)', fontSize: '.8125rem' }}>Membership No.</th>
                <th style={{ padding: '.625rem .75rem', fontWeight: 600, color: 'var(--muted-foreground)', fontSize: '.8125rem' }}>Status</th>
                <th style={{ padding: '.625rem .75rem', fontWeight: 600, color: 'var(--muted-foreground)', fontSize: '.8125rem' }}>Area of Practice</th>
                <th style={{ padding: '.625rem .75rem', fontWeight: 600, color: 'var(--muted-foreground)', fontSize: '.8125rem' }}>City</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => {
                const sc = STATUS_COLORS[m.status] || { bg: '#f9fafb', color: '#6b7280' };
                return (
                  <tr
                    key={m.memNo}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background .1s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--muted)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '.625rem .75rem', color: 'var(--muted-foreground)' }}>{i + 1}</td>
                    <td style={{ padding: '.625rem .75rem' }}>
                      <div className="row gap-2">
                        <div style={{
                          width: '1.75rem', height: '1.75rem', borderRadius: 999,
                          background: 'oklch(0.36 0.13 255 / 0.1)',
                          color: 'var(--primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '.625rem', fontWeight: 700, flexShrink: 0,
                        }}>
                          {m.name.split(' ').filter((w, idx) => idx > 0).slice(0, 2).map((w) => w[0]).join('')}
                        </div>
                        <span style={{ fontWeight: 500 }}>{m.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '.625rem .75rem', fontFamily: 'monospace', fontSize: '.8125rem', color: 'var(--muted-foreground)' }}>{m.memNo}</td>
                    <td style={{ padding: '.625rem .75rem' }}>
                      <span style={{
                        padding: '.125rem .5rem', borderRadius: '.25rem',
                        fontSize: '.75rem', fontWeight: 600,
                        background: sc.bg, color: sc.color,
                      }}>{m.status}</span>
                    </td>
                    <td style={{ padding: '.625rem .75rem', color: 'var(--muted-foreground)' }}>{m.area}</td>
                    <td style={{ padding: '.625rem .75rem', color: 'var(--muted-foreground)' }}>{m.city}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                    No members found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="muted-text" style={{ marginTop: '1.25rem', fontSize: '.75rem' }}>
          This is a demo directory. In the live system, the full branch members' list will be available here.
          Data is accessible to logged-in members only, per ICAI Web-Media Policy 5(n).
        </p>
      </section>
    </>
  );
}
