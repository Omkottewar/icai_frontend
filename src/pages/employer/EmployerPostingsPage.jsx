import { useEffect, useState } from 'react';
import EmployerLayout from '../../components/employer/EmployerLayout';
import { navigate } from '../../hooks/useRoute';
import { useAuth } from '../../context/AuthContext';
import { IconBriefcase, IconX } from '../../icons';

const STATUS_BADGE = {
  draft:           { bg: '#f1f5f9', fg: '#475569', label: 'Draft'   },
  pending_payment: { bg: '#fef3c7', fg: '#92400e', label: 'Pending' },
  active:          { bg: '#dcfce7', fg: '#166534', label: 'Live'    },
  filled:          { bg: '#dbeafe', fg: '#1e3a8a', label: 'Filled'  },
  expired:         { bg: '#f1f5f9', fg: '#94a3b8', label: 'Expired' },
  closed:          { bg: '#f1f5f9', fg: '#94a3b8', label: 'Closed'  },
};

const TYPE_LABEL = {
  job:         'Job',
  articleship: 'Articleship',
  assignment:  'Assignment',
};

export default function EmployerPostingsPage() {
  const { showToast } = useAuth();
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const r = await fetch('/api/employer/postings', { credentials: 'include' });
      if (!r.ok) throw new Error('Could not load postings');
      const j = await r.json();
      setItems(j.items);
    } catch (e) { setErr(e.message); }
  };

  useEffect(() => { load(); }, []);

  const close = async (id) => {
    if (!confirm('Close this posting? It will be hidden from job seekers.')) return;
    const r = await fetch(`/api/employer/postings/${id}/close`, { method: 'POST', credentials: 'include' });
    if (r.ok) { showToast?.('Posting closed', 'success'); load(); }
    else      { showToast?.('Could not close posting', 'error'); }
  };

  const del = async (id) => {
    if (!confirm('Delete this posting permanently?')) return;
    const r = await fetch(`/api/employer/postings/${id}`, { method: 'DELETE', credentials: 'include' });
    if (r.ok) { showToast?.('Deleted', 'success'); load(); }
    else      { showToast?.('Could not delete', 'error'); }
  };

  return (
    <EmployerLayout
      title="My job postings"
      subtitle={items ? `${items.length} total` : ''}
      actions={
        <button type="button" className="btn btn-primary" onClick={() => navigate('/employer/postings/new')}>
          <IconBriefcase size="sm" /> New posting
        </button>
      }
    >
      {err && <div className="alert alert-error"><IconX size="sm" /> {err}</div>}

      {!items && !err && <p className="muted-text">Loading…</p>}

      {items && items.length === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="muted-text" style={{ marginBottom: '1rem' }}>
            You haven't posted any jobs yet. Create your first posting to reach members and students.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/employer/postings/new')}>
            <IconBriefcase size="sm" /> Post your first job
          </button>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--muted, #f1f5f9)', fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Title</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '.75rem' }}>Seats</th>
                <th style={{ textAlign: 'right', padding: '.75rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.draft;
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '.75rem' }}>
                      <div style={{ fontWeight: 600 }}>{p.title}</div>
                      <div className="muted-text" style={{ fontSize: '.75rem' }}>{p.location ?? '—'}</div>
                    </td>
                    <td style={{ padding: '.75rem' }}>{TYPE_LABEL[p.type] ?? p.type}</td>
                    <td style={{ padding: '.75rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '.15rem .5rem',
                        borderRadius: '999px',
                        fontSize: '.7rem',
                        fontWeight: 600,
                        background: badge.bg,
                        color: badge.fg,
                      }}>{badge.label}</span>
                    </td>
                    <td style={{ padding: '.75rem' }}>{p.seat_count}</td>
                    <td style={{ padding: '.75rem', textAlign: 'right' }}>
                      <button className="btn btn-ghost" onClick={() => navigate(`/employer/postings/${p.id}/edit`)}>Edit</button>
                      {p.status === 'active' && (
                        <button className="btn btn-ghost" onClick={() => close(p.id)}>Close</button>
                      )}
                      <button className="btn btn-ghost" style={{ color: '#b91c1c' }} onClick={() => del(p.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </EmployerLayout>
  );
}
