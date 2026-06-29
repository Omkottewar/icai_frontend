import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSiteContent } from '../../hooks/useSiteContent';
import AuthSidePanel from '../../components/auth/AuthSidePanel';
import { IconArrowLeft, IconCheckCircle, IconX } from '../../icons';
import Button from '../../components/ui/Button';

export default function ForgotPage() {
  const { forgotPassword } = useAuth();
  const header = useSiteContent('auth_forgot');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      // Auth0 always returns ok (so we don't reveal whether the email exists);
      // reflect that by always showing the success state.
      setSent(true);
    } catch (e) {
      setErr(e.message || 'Could not send reset email');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <AuthSidePanel mode="login" />
      <div className="auth-form-wrap">
        <div className="auth-card">
          <a href="/login" className="row gap-1 muted-text" style={{ fontSize: '.8125rem', marginBottom: '1rem' }}>
            <IconArrowLeft size="sm" /> Back to sign in
          </a>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{header.title}</h1>
          <p className="muted-text" style={{ fontSize: '.875rem', marginTop: '.25rem', marginBottom: '1.5rem' }}>
            {header.subtitle}
          </p>
          {sent ? (
            <div className="alert alert-success">
              <IconCheckCircle size="sm" />
              <div>If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox.</div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="col gap-4">
              <div>
                <label className="field-label">Email</label>
                <input
                  className="input-base"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@firm.in"
                  autoComplete="email"
                  required
                />
              </div>
              {err && <div className="alert alert-error"><IconX size="sm" /> {err}</div>}
              <Button
                className="btn btn-primary"
                type="submit"
                loading={submitting}
                style={{ width: '100%', justifyContent: 'center', padding: '.75rem' }}
              >
                {submitting ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
