import AdminLayout from '../../components/admin/AdminLayout';
import { IconSparkles } from '../../icons';

export default function ComingSoonPage({ title = 'Coming soon', description }) {
  return (
    <AdminLayout title={title} subtitle="This section is on the roadmap">
      <div style={{
        background: 'var(--card)', border: '1px dashed var(--border)',
        borderRadius: '.75rem', padding: '3rem 1.5rem',
        textAlign: 'center', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '.75rem',
      }}>
        <IconSparkles />
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{title}</h2>
        <p className="muted-text" style={{ maxWidth: '32rem' }}>
          {description ?? 'The data model is already in place — this admin view will land in a follow-up release. For now, use Events to drive the public site.'}
        </p>
        <a href="/admin/events" className="btn btn-primary" style={{ marginTop: '.5rem', padding: '.5rem 1rem' }}>
          Go to Events
        </a>
      </div>
    </AdminLayout>
  );
}
