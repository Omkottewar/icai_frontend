import { useEffect, useState } from 'react';
import EmployerLayout from '../../components/employer/EmployerLayout';
import { useRoute, navigate } from '../../hooks/useRoute';
import { useAuth } from '../../context/AuthContext';
import { IconArrowRight, IconX } from '../../icons';
import { ShimmerDrawerBody } from '../../components/ui/Shimmer';

const EMPTY = {
  type:        'job',
  title:       '',
  description: '',
  seat_count:  1,
  location:    'Nagpur',
  experience_required: '',
  expires_at:  '',
};

// Handles both /employer/postings/new and /employer/postings/:id/edit.
// Route is matched against the path pattern in AppShell; here we just look
// at route.path to decide between new vs edit, and the URL pattern uses
// trailing /:id/edit so we slice it out.
export default function EmployerPostingFormPage() {
  const route = useRoute();
  const { showToast } = useAuth();

  const editId = route.path.startsWith('/employer/postings/') && route.path.endsWith('/edit')
    ? route.path.replace('/employer/postings/', '').replace('/edit', '')
    : null;
  const isNew = !editId;

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Load existing posting if editing
  useEffect(() => {
    if (isNew) return;
    fetch(`/api/employer/postings/${editId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Posting not found')))
      .then((j) => {
        const p = j.item;
        setForm({
          type:        p.type,
          title:       p.title,
          description: p.description,
          seat_count:  p.seat_count,
          location:    p.location ?? '',
          experience_required: p.experience_required ?? '',
          expires_at:  p.expires_at ? p.expires_at.slice(0, 10) : '',
        });
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [editId, isNew]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const url    = isNew ? '/api/employer/postings' : `/api/employer/postings/${editId}`;
      const method = isNew ? 'POST' : 'PATCH';
      const r = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'Save failed');
      showToast?.(isNew ? 'Posting created' : 'Posting saved', 'success');
      navigate('/employer/postings');
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <EmployerLayout
      title={isNew ? 'New posting' : 'Edit posting'}
      subtitle={isNew ? 'Auto-published once saved' : ''}
      actions={
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/employer/postings')}>
          Cancel
        </button>
      }
    >
      {loading && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <ShimmerDrawerBody fields={8} cols={2} />
        </div>
      )}
      {err && <div className="alert alert-error"><IconX size="sm" /> {err}</div>}

      {!loading && (
        <form onSubmit={submit} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '1rem' }}>
            <div>
              <label className="field-label">Title *</label>
              <input className="input-base" type="text" value={form.title} required
                onChange={(e) => update('title', e.target.value)}
                placeholder="e.g. Senior Auditor — 3+ years experience" maxLength={200} />
            </div>
            <div>
              <label className="field-label">Type *</label>
              <select className="input-base" value={form.type} onChange={(e) => update('type', e.target.value)}>
                <option value="job">Job</option>
                <option value="articleship">Articleship</option>
                <option value="assignment">Assignment</option>
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">Description *</label>
            <textarea className="input-base" rows={8} value={form.description} required
              onChange={(e) => update('description', e.target.value)}
              placeholder="Responsibilities, qualifications, what the candidate will do day-to-day…" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div>
              <label className="field-label">Seats</label>
              <input className="input-base" type="number" min={1} max={50} value={form.seat_count}
                onChange={(e) => update('seat_count', Math.max(1, Number(e.target.value)))} />
            </div>
            <div>
              <label className="field-label">Location</label>
              <input className="input-base" type="text" value={form.location}
                onChange={(e) => update('location', e.target.value)} placeholder="City or 'Remote'" />
            </div>
            <div>
              <label className="field-label">Experience</label>
              <input className="input-base" type="text" value={form.experience_required}
                onChange={(e) => update('experience_required', e.target.value)} placeholder="e.g. 3–5 years" />
            </div>
          </div>

          <div>
            <label className="field-label">Expires on (optional)</label>
            <input className="input-base" type="date" value={form.expires_at}
              onChange={(e) => update('expires_at', e.target.value)} />
            <p className="muted-text" style={{ fontSize: '.75rem', marginTop: '.25rem' }}>
              Leave blank to keep the posting active until you close it.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end', marginTop: '.5rem' }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/employer/postings')}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : (
                <>{isNew ? 'Publish' : 'Save'} <IconArrowRight size="sm" /></>
              )}
            </button>
          </div>
        </form>
      )}
    </EmployerLayout>
  );
}
