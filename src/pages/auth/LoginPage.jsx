import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRoute } from '../../hooks/useRoute';
import { useSiteContent } from '../../hooks/useSiteContent';
import AuthSidePanel from '../../components/auth/AuthSidePanel';
import PasswordField from '../../components/auth/PasswordField';
import SocialButtons from '../../components/auth/SocialButtons';
import { IconArrowRight, IconShield, IconX, IconMail } from '../../icons';
import Button from '../../components/ui/Button';

export default function LoginPage() {
  const { login, socialLogin } = useAuth();
  const route = useRoute();
  const header = useSiteContent('auth_login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ?error=... is set by the social /callback when the redirect round-trip
  // fails (provider denial, expired state, etc.).
  useEffect(() => {
    if (route.query?.error) setErr(decodeURIComponent(route.query.error));
  }, [route.query?.error]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
    } catch (e) {
      setErr(e.message || 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <AuthSidePanel mode="login" />
      <div className="auth-form-wrap">
        <div className="auth-card">
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{header.title}</h1>
            <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.25rem' }}>
              {header.subtitle}
            </p>
          </div>

          <div className="auth-tabs">
            <a href="/login" className="auth-tab active">Sign in</a>
            <a href="/signup" className="auth-tab">Create account</a>
          </div>

          {err && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              <IconX size="sm" /> {err}
            </div>
          )}

          <form onSubmit={onSubmit} className="col gap-4">
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
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label className="field-label" style={{ marginBottom: 0 }}>Password</label>
                <a href="/forgot" style={{ fontSize: '.8125rem', color: 'var(--primary)', fontWeight: 600 }}>
                  Forgot password?
                </a>
              </div>
              <PasswordField
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                show={showPw}
                setShow={setShowPw}
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="btn btn-primary"
              loading={submitting}
              style={{ width: '100%', justifyContent: 'center', padding: '.875rem' }}
            >
              {submitting ? 'Signing in…' : <>Sign in <IconArrowRight size="sm" /></>}
            </Button>
          </form>

          <SocialButtons mode="login" onPick={(provider) => socialLogin(provider)} />

          <div className="alert alert-info" style={{ marginTop: '1rem' }}>
            <IconShield size="sm" />
            <div>
              Your credentials are encrypted in transit and verified by ICAI's
              identity provider. Members and students can link their MRN/SRN
              after sign-in.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
