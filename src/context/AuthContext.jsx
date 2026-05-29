import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { IconCheckCircle, IconX, IconBell } from '../icons';

const AuthContext = createContext(null);

// Map the server's /api/auth/me shape onto the identity fields the UI uses.
// Role-specific dashboard data (MRN, SRN, CPE hours, etc.) lives in
// /api/dashboard — see src/hooks/useDashboard.js.
function toUiUser(apiUser) {
  if (!apiUser) return null;
  const roleMap = { member: 'Member', student: 'Student', employer: 'Employer', employee: 'Staff',
                    mcm: 'MCM', chairman: 'Chairman', admin: 'Admin' };
  return {
    id:       apiUser.id,
    name:     apiUser.name,
    email:    apiUser.email,
    phone:    apiUser.phone ?? '',
    role:     roleMap[apiUser.primary_role] ?? 'Member',
    // Active role assignments (the real source of truth — see schema).
    // Each entry: { code, name, scope_committee_id, effective_from, effective_to }
    roles:    Array.isArray(apiUser.roles) ? apiUser.roles : [],
    locale:   apiUser.locale,
    branchId: apiUser.branch_id,
  };
}

async function postJson(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(json.message || json.error || 'Request failed');
    err.code = json.error;
    err.status = r.status;
    throw err;
  }
  return json;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      if (r.ok) {
        const u = toUiUser(await r.json());
        setUser(u);
        return u;
      }
    } catch {
      /* fall through */
    }
    setUser(null);
    return null;
  }, []);

  // Hydrate from the server on mount. Cookie-based session, so just GET /me.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  const showToast = (text, kind = 'success') => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 2800);
  };

  // Embedded sign-in: post credentials to our server, which calls Auth0's
  // /oauth/token (ROPG) server-side and sets the session cookie. The user
  // never leaves the site.
  const login = async ({ email, password }) => {
    const body = await postJson('/api/auth/login', { email, password });
    await refresh();
    window.location.hash = '#' + (body.redirect ?? '/dashboard');
  };

  // Embedded sign-up: posts to /api/auth/signup, which creates the Auth0
  // user, auto-logs them in, and sets the session cookie. If the Auth0
  // tenant requires email verification first, we get { requiresLogin: true }
  // and bounce the user to /login with a friendly message.
  const signup = async ({ email, password, name, role = 'Member' }) => {
    const body = await postJson('/api/auth/signup', { email, password, name, role });
    // Account created but the user has to verify their email first (or the
    // tenant blocks first-login auto-auth). Send them to /login with a hint.
    if (body.requiresVerification || body.requiresLogin) {
      showToast(body.message || 'Account created. Please verify your email and sign in.', 'success');
      window.location.hash = '#/login';
      return;
    }
    await refresh();
    window.location.hash = '#' + (body.redirect ?? '/onboarding');
  };

  // Social IdPs (Google, Microsoft, …) can't be embedded — they require a
  // redirect to the provider's domain. The server bounces through Auth0 and
  // back to /api/auth/callback, which sets the cookie and redirects to
  // /#/dashboard or /#/onboarding.
  const socialLogin = (provider, opts = {}) => {
    const params = new URLSearchParams();
    if (opts.signup) params.set('mode', 'signup');
    if (opts.role)   params.set('role', opts.role);
    const qs = params.toString();
    window.location.href = `/api/auth/social/${provider}${qs ? '?' + qs : ''}`;
  };

  const forgotPassword = async (email) => {
    await postJson('/api/auth/forgot-password', { email });
  };

  const logoutInternal = async (path) => {
    try {
      await fetch(path, { method: 'POST', credentials: 'include' });
    } catch {
      /* even if the server call fails, drop local state */
    }
    setUser(null);
    showToast('Signed out', 'info');
    window.location.hash = '#/';
  };

  const logout = () => logoutInternal('/api/auth/logout');

  return (
    <AuthContext.Provider value={{
      user, loading,
      login, signup, socialLogin, forgotPassword,
      logout, showToast,
    }}>
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast.kind === 'success' ? <IconCheckCircle /> :
           toast.kind === 'error'   ? <IconX /> :
                                      <IconBell />}
          <span>{toast.text}</span>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
