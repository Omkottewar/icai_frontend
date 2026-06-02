import { useEffect, useState } from 'react';
import EmployerLayout from '../../components/employer/EmployerLayout';
import { navigate } from '../../hooks/useRoute';
import { IconBriefcase, IconArrowRight } from '../../icons';

export default function EmployerDashboardPage() {
  const [me, setMe] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/employer/me', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Could not load employer profile')))
      .then(setMe)
      .catch((e) => setErr(e.message));
  }, []);

  const e = me?.employer;

  return (
    <EmployerLayout
      title={e ? e.company_name : 'Loading…'}
      subtitle={me ? `Signed in as ${me.user_role}` : ''}
      actions={
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/employer/postings/new')}
        >
          <IconBriefcase size="sm" /> Post a job
        </button>
      }
    >
      {err && <div className="alert alert-error">{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '.875rem' }}>
        <StatTile label="Active postings"  value={me?.stats?.active ?? '—'} />
        <StatTile label="Total postings"   value={me?.stats?.total  ?? '—'} />
        <StatTile label="Company verified" value={e?.verified ? 'Yes' : 'Pending'} />
      </div>

      <div className="card" style={{ padding: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '.5rem' }}>Quick actions</h2>
        <div style={{ display: 'grid', gap: '.5rem' }}>
          <a href="#/employer/postings" className="btn btn-outline" style={{ justifyContent: 'space-between' }}>
            Manage postings <IconArrowRight size="sm" />
          </a>
          <a href="#/employer/profile" className="btn btn-outline" style={{ justifyContent: 'space-between' }}>
            Edit company details <IconArrowRight size="sm" />
          </a>
        </div>
      </div>
    </EmployerLayout>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div className="muted-text" style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '.25rem' }}>{value}</div>
    </div>
  );
}
