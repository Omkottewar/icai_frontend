import { useEffect, useState } from 'react';
import EmployerLayout from '../../components/employer/EmployerLayout';
import { useAuth } from '../../context/AuthContext';
import { IconX } from '../../icons';

export default function EmployerProfilePage() {
  const { showToast } = useAuth();
  const [form, setForm] = useState(null);
  const [verified, setVerified] = useState(false);
  const [userRole, setUserRole] = useState('owner');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/employer/me', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Could not load profile')))
      .then((j) => {
        const e = j.employer;
        setVerified(!!e.verified);
        setUserRole(j.user_role);
        setForm({
          company_name: e.company_name ?? '',
          gstin:        e.gstin ?? '',
          pan:          e.pan ?? '',
          website:      e.website ?? '',
          address:      e.address ?? '',
        });
      })
      .catch((e) => setErr(e.message));
  }, []);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const r = await fetch('/api/employer/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'Save failed');
      showToast?.('Company details saved', 'success');
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const readOnly = userRole !== 'owner';

  return (
    <EmployerLayout
      title="Company details"
      subtitle={verified ? 'Verified employer' : 'Verification pending — admin will review your GSTIN'}
    >
      {!form && !err && <p className="muted-text">Loading…</p>}
      {err && <div className="alert alert-error"><IconX size="sm" /> {err}</div>}

      {form && (
        <form onSubmit={submit} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 720 }}>
          {readOnly && (
            <div className="alert alert-info">Only an owner can edit these details. Your role is {userRole}.</div>
          )}

          <div>
            <label className="field-label">Company name *</label>
            <input className="input-base" required disabled={readOnly}
              value={form.company_name} onChange={(e) => update('company_name', e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="field-label">GSTIN</label>
              <input className="input-base" disabled={readOnly} maxLength={15}
                value={form.gstin}
                onChange={(e) => update('gstin', e.target.value.toUpperCase())}
                placeholder="15 chars" />
            </div>
            <div>
              <label className="field-label">PAN</label>
              <input className="input-base" disabled={readOnly} maxLength={10}
                value={form.pan}
                onChange={(e) => update('pan', e.target.value.toUpperCase())}
                placeholder="10 chars" />
            </div>
          </div>

          <div>
            <label className="field-label">Website</label>
            <input className="input-base" type="url" disabled={readOnly}
              value={form.website} onChange={(e) => update('website', e.target.value)}
              placeholder="https://example.com" />
          </div>

          <div>
            <label className="field-label">Office address</label>
            <textarea className="input-base" rows={3} disabled={readOnly}
              value={form.address} onChange={(e) => update('address', e.target.value)} />
          </div>

          {!readOnly && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </form>
      )}
    </EmployerLayout>
  );
}
