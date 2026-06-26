import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../hooks/useRoute';
import AuthSidePanel from '../../components/auth/AuthSidePanel';
import { IconArrowRight, IconShield, IconX, IconCheck } from '../../icons';
import Button from '../../components/ui/Button';

export default function OnboardingPage() {
  const { user, loading } = useAuth();
  const [data, setData] = useState({
    name: '',
    phone: '',
    consent: false,
    // Member
    mrn: '', is_fca: false, is_practising: false, gender: 'unspecified',
    city: 'Nagpur', pincode: '',
    // Student
    srn: '', level: 'foundation', articleship_status: 'not_started',
    // Employer
    company_name: '', gstin: '', pan: '', website: '', address: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  // Prefill name from Auth0 profile when we first load.
  useEffect(() => {
    if (user?.name && !data.name) setData((d) => ({ ...d, name: user.name }));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user]);

  if (loading || !user) return null;

  const role = user.role; // 'Member' | 'Student' | 'Employer' | …
  const update = (k, v) => setData((d) => ({ ...d, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setSubmitting(true);
    try {
      const r = await fetch('/api/onboarding', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || 'Could not save your details');
      navigate(json.redirect || '/dashboard');
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <AuthSidePanel mode="signup" />
      <div className="auth-form-wrap">
        <div className="auth-card" style={{ maxWidth: 560 }}>
          <div style={{ marginBottom: '1rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Complete your profile</h1>
            <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.25rem' }}>
              Signed in as <strong style={{ color: 'var(--foreground)' }}>{user.email}</strong> · {role}
            </p>
          </div>

          <form onSubmit={submit} className="col gap-4">
            {/* ─── Common fields ─────────────────────────────────────── */}
            <div>
              <label className="field-label">Full name</label>
              <input className="input-base" type="text" value={data.name}
                onChange={(e) => update('name', e.target.value)} placeholder="CA Anjali Sharma" required />
            </div>

            <div>
              <label className="field-label">Mobile number</label>
              <input className="input-base" type="tel" value={data.phone}
                onChange={(e) => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit Indian mobile" inputMode="numeric" required />
            </div>

            {/* ─── Member-specific ──────────────────────────────────── */}
            {role === 'Member' && (
              <>
                <div>
                  <label className="field-label">Membership Registration No. (MRN)</label>
                  <input className="input-base" type="text" value={data.mrn}
                    onChange={(e) => update('mrn', e.target.value.trim())}
                    placeholder="e.g. 138742" required />
                </div>
                <div className="row gap-3">
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Membership type</label>
                    <select className="input-base" value={data.is_fca ? 'fca' : 'aca'}
                      onChange={(e) => update('is_fca', e.target.value === 'fca')}>
                      <option value="aca">ACA</option>
                      <option value="fca">FCA</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Gender</label>
                    <select className="input-base" value={data.gender}
                      onChange={(e) => update('gender', e.target.value)}>
                      <option value="unspecified">Prefer not to say</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <label className="row gap-2" style={{ cursor: 'pointer', fontSize: '.875rem' }}>
                  <input type="checkbox" checked={data.is_practising}
                    onChange={(e) => update('is_practising', e.target.checked)} />
                  I am a practising CA
                </label>
                <div className="row gap-3">
                  <div style={{ flex: 2 }}>
                    <label className="field-label">City</label>
                    <input className="input-base" type="text" value={data.city}
                      onChange={(e) => update('city', e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Pincode</label>
                    <input className="input-base" type="text" value={data.pincode}
                      onChange={(e) => update('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric" />
                  </div>
                </div>
              </>
            )}

            {/* ─── Student-specific ─────────────────────────────────── */}
            {role === 'Student' && (
              <>
                <div>
                  <label className="field-label">Student Registration No. (SRN)</label>
                  <input className="input-base" type="text" value={data.srn}
                    onChange={(e) => update('srn', e.target.value.trim())}
                    placeholder="e.g. WRO-0563421" required />
                </div>
                <div className="row gap-3">
                  <div style={{ flex: 1 }}>
                    <label className="field-label">CA level</label>
                    <select className="input-base" value={data.level}
                      onChange={(e) => update('level', e.target.value)}>
                      <option value="foundation">Foundation</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="final">Final</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">Articleship</label>
                    <select className="input-base" value={data.articleship_status}
                      onChange={(e) => update('articleship_status', e.target.value)}>
                      <option value="not_started">Not started</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* ─── Employer-specific ────────────────────────────────── */}
            {role === 'Employer' && (
              <>
                <div>
                  <label className="field-label">Company name</label>
                  <input className="input-base" type="text" value={data.company_name}
                    onChange={(e) => update('company_name', e.target.value)} required />
                </div>
                <div className="row gap-3">
                  <div style={{ flex: 1 }}>
                    <label className="field-label">GSTIN</label>
                    <input className="input-base" type="text" value={data.gstin}
                      onChange={(e) => update('gstin', e.target.value.toUpperCase().slice(0, 15))}
                      placeholder="15 chars" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field-label">PAN</label>
                    <input className="input-base" type="text" value={data.pan}
                      onChange={(e) => update('pan', e.target.value.toUpperCase().slice(0, 10))}
                      placeholder="10 chars" />
                  </div>
                </div>
                <div>
                  <label className="field-label">Website (optional)</label>
                  <input className="input-base" type="url" value={data.website}
                    onChange={(e) => update('website', e.target.value)}
                    placeholder="https://example.com" />
                </div>
                <div>
                  <label className="field-label">Office address (optional)</label>
                  <input className="input-base" type="text" value={data.address}
                    onChange={(e) => update('address', e.target.value)} />
                </div>
              </>
            )}

            {/* ─── Consent + submit ─────────────────────────────────── */}
            <label className="row gap-2" style={{ cursor: 'pointer', fontSize: '.875rem' }}>
              <input type="checkbox" checked={data.consent}
                onChange={(e) => update('consent', e.target.checked)} />
              I have read and accept the ICAI Web-Media Policy and consent to
              processing of the details above.
            </label>

            {err && <div className="alert alert-error"><IconX size="sm" /> {err}</div>}

            <Button type="submit" className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '.875rem' }}
              loading={submitting}>
              {submitting ? 'Saving…' : <>Save and continue <IconArrowRight size="sm" /></>}
            </Button>

            <div className="alert alert-info" style={{ marginTop: '.25rem' }}>
              <IconShield size="sm" />
              <div>
                Your email and password are managed by ICAI's identity provider
                (Auth0). The details above are stored in the branch system to
                personalise your dashboard and verify your MRN/SRN/GSTIN.
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
