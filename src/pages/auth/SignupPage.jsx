import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRoute } from '../../hooks/useRoute';
import AuthSidePanel from '../../components/auth/AuthSidePanel';
import PasswordField from '../../components/auth/PasswordField';
import RolePicker from '../../components/auth/RolePicker';
import SocialButtons from '../../components/auth/SocialButtons';
import { IconArrowRight, IconShield, IconX, IconMail, IconUser } from '../../icons';

export default function SignupPage() {
  const { signup, socialLogin } = useAuth();
  const route = useRoute();
  const [role, setRole] = useState('Member');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      await signup({ email: email.trim(), password, name: name.trim(), role });
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
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Create your account</h1>
            <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.25rem' }}>
              Already a member?{' '}
              <a href="#/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Sign in</a>
            </p>
          </div>

          <div className="auth-tabs">
            <a href="#/login" className="auth-tab" style={{ textAlign: 'center' }}>Sign in</a>
            <a href="#/signup" className="auth-tab active" style={{ textAlign: 'center' }}>Create account</a>
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

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ width: '100%', justifyContent: 'center', padding: '.875rem' }}
            >
              {submitting ? 'Creating account…' : <>Create {role} account <IconArrowRight size="sm" /></>}
            </button>

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
