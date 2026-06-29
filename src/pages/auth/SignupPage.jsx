import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRoute } from '../../hooks/useRoute';
import { useSiteContent } from '../../hooks/useSiteContent';
import AuthSidePanel from '../../components/auth/AuthSidePanel';
import PasswordField from '../../components/auth/PasswordField';
import RolePicker from '../../components/auth/RolePicker';
import SocialButtons from '../../components/auth/SocialButtons';
import { IconArrowRight, IconShield, IconX, IconMail, IconUser } from '../../icons';
import Button from '../../components/ui/Button';

export default function SignupPage() {
  const { signup, socialLogin } = useAuth();
  const route = useRoute();
  const header = useSiteContent('auth_signup');
  const [role, setRole] = useState('Member');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // MRN gate (Open Question #3) — backend tells us whether gating is
  // enabled; when it is, signup is rejected unless the MRN exists in the
  // imported ICAI directory. We pre-check on blur so the user gets
  // immediate feedback instead of waiting for submit.
  const [mrn, setMrn] = useState('');
  const [mrnState, setMrnState] = useState({ checked: false, exists: false, gating: false, profile: null });

  async function checkMrn(value) {
    const m = value.trim();
    if (!m) { setMrnState({ checked: false, exists: false, gating: false, profile: null }); return; }
    try {
      const r = await fetch(`/api/auth/check-mrn?mrn=${encodeURIComponent(m)}`);
      const j = await r.json();
      setMrnState({
        checked: true,
        exists: Boolean(j.exists),
        gating: Boolean(j.gating_enabled),
        profile: j.profile ?? null,
      });
    } catch {
      setMrnState({ checked: false, exists: false, gating: false, profile: null });
    }
  }

  useEffect(() => {
    if (route.query?.error) setErr(decodeURIComponent(route.query.error));
  }, [route.query?.error]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    // Mirrors validatePassword() on the server — keep these in sync.
    if (password.length < 8) {
      setErr('Password must be at least 8 characters.');
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setErr('Password must include at least one letter and one number.');
      return;
    }
    // Pre-empt the server gate when we already know the MRN is missing.
    if (role === 'Member' && mrnState.gating && (!mrn.trim() || !mrnState.exists)) {
      setErr('Please enter a valid Membership Number (MRN) registered with the Nagpur branch.');
      return;
    }
    setSubmitting(true);
    try {
      await signup({ email: email.trim(), password, name: name.trim(), role, mrn: mrn.trim() || undefined });
    } catch (e) {
      setErr(e.message || 'Could not create account');
    } finally {
      setSubmitting(false);
    }
  };

  const blurb = {
    Member:   "You'll be asked to link your ICAI Membership Registration Number (MRN) after sign-up.",
    Student:  "You'll be asked to link your ICAI Student Registration Number (SRN) after sign-up.",
    Employer: "You'll be asked for your company details and GSTIN to verify your employer account.",
  }[role];

  return (
    <div className="auth-shell">
      <AuthSidePanel mode="signup" />
      <div className="auth-form-wrap">
        <div className="auth-card">
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{header.title}</h1>
            <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.25rem' }}>
              {header.subtitle}
            </p>
          </div>

          <div className="auth-tabs">
            <a href="/login" className="auth-tab" style={{ textAlign: 'center' }}>Sign in</a>
            <a href="/signup" className="auth-tab active" style={{ textAlign: 'center' }}>Create account</a>
          </div>

          <form onSubmit={onSubmit} className="col gap-4">
            <RolePicker value={role} onChange={setRole} />

            <div>
              <label className="field-label">Full name</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }}>
                  <IconUser size="sm" />
                </span>
                <input
                  className="input-base"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="CA Anjali Sharma"
                  autoComplete="name"
                  required
                  style={{ paddingLeft: '2.25rem' }}
                />
              </div>
            </div>

            {role === 'Member' && (
              <div>
                <label className="field-label">Membership Number (MRN)</label>
                <input
                  className="input-base"
                  type="text"
                  value={mrn}
                  onChange={(e) => setMrn(e.target.value.toUpperCase())}
                  onBlur={(e) => checkMrn(e.target.value)}
                  placeholder="e.g. 123456"
                  autoComplete="off"
                />
                {mrnState.checked && mrnState.exists && mrnState.profile && (
                  <p className="muted-text" style={{ fontSize: '.75rem', marginTop: '.375rem', color: 'var(--success, #047857)' }}>
                    ✓ Verified — {mrnState.profile.name}
                    {mrnState.profile.city ? ` · ${mrnState.profile.city}` : ''}
                  </p>
                )}
                {mrnState.checked && !mrnState.exists && mrnState.gating && (
                  <p className="muted-text" style={{ fontSize: '.75rem', marginTop: '.375rem', color: 'var(--danger, #b91c1c)' }}>
                    This MRN is not in the Nagpur branch directory. Email{' '}
                    <a href="mailto:nagpur@icai.org">nagpur@icai.org</a> if you believe this is a mistake.
                  </p>
                )}
                {mrnState.checked && !mrnState.gating && (
                  <p className="muted-text" style={{ fontSize: '.7rem', marginTop: '.375rem' }}>
                    Directory check is in soft-launch mode. You can sign up either way.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="field-label">Email</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }}>
                  <IconMail size="sm" />
                </span>
                <input
                  className="input-base"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@firm.in"
                  autoComplete="email"
                  required
                  style={{ paddingLeft: '2.25rem' }}
                />
              </div>
            </div>

            <div>
              <label className="field-label">Password</label>
              <PasswordField
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                show={showPw}
                setShow={setShowPw}
                autoComplete="new-password"
              />
              <p className="muted-text" style={{ fontSize: '.75rem', marginTop: '.375rem' }}>
                At least 8 characters, with one letter and one number. Symbols are encouraged.
              </p>
            </div>

            {err && (
              <div className="alert alert-error">
                <IconX size="sm" /> {err}
              </div>
            )}

            <Button
              type="submit"
              className="btn btn-primary"
              loading={submitting}
              style={{ width: '100%', justifyContent: 'center', padding: '.875rem' }}
            >
              {submitting ? 'Creating account…' : <>Create {role} account <IconArrowRight size="sm" /></>}
            </Button>

            <div className="alert alert-info">
              <IconShield size="sm" />
              <div>{blurb}</div>
            </div>
          </form>

          <SocialButtons
            mode="signup"
            onPick={(provider) => socialLogin(provider, { signup: true, role })}
          />
        </div>
      </div>
    </div>
  );
}
