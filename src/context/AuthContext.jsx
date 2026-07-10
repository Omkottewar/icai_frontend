import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { toast as notify } from '../lib/notify';
import { navigate } from '../hooks/useRoute';
import { dialog } from '../lib/dialog';

const AuthContext = createContext(null);

// Cache the signed-in user's identity in localStorage so subsequent visits
// render with the correct header (avatar + Dashboard link) on the FIRST
// frame instead of flashing "Sign in" while /api/auth/me round-trips.
//
// Security note: the actual session is in an httpOnly cookie — this cache
// is purely a UI hint. If the session was revoked server-side, /me will
// return 401 on the background refresh and we clear the cache. An attacker
// with XSS access could read name/email here, but couldn't impersonate the
// user (the cookie is httpOnly).
const USER_CACHE_KEY = 'icai_cached_user_v1';

function readCachedUser() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Sanity check the shape — refuse cache rows from old app versions to
    // avoid rendering with stale field names.
    if (!parsed || typeof parsed !== 'object' || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedUser(user) {
  if (typeof localStorage === 'undefined') return;
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else      localStorage.removeItem(USER_CACHE_KEY);
  } catch { /* incognito / quota — silently skip */ }
}

// Map the server's /api/auth/me shape onto the identity fields the UI uses.
// Role-specific dashboard data (MRN, SRN, CPE hours, etc.) lives in
// /api/dashboard — see src/hooks/useDashboard.js.
function toUiUser(apiUser) {
  if (!apiUser) return null;
  const roleMap = { member: 'Member', student: 'Student', employer: 'Employer', employee: 'Staff',
                    mcm: 'MCM', chairman: 'Chairman', admin: 'Admin', guest: 'Guest' };
  return {
    id:       apiUser.id,
    name:     apiUser.name,
    email:    apiUser.email,
    phone:    apiUser.phone ?? '',
    // Capitalised label used by legacy display code ("Welcome, Student").
    role:     roleMap[apiUser.primary_role] ?? 'Member',
    // Raw lowercase enum value ("student" / "member" / "employer" / "admin" / …).
    // Required by role gates that mirror the backend's `primary_role` checks
    // (e.g. the mock-tests Register button gate). Before this field existed,
    // every such gate evaluated `undefined === 'student'` → false, which silently
    // hid the action from the very users it was supposed to allow.
    primary_role: apiUser.primary_role,
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
  // Hydrate synchronously from the localStorage cache. On subsequent visits
  // this means the very first React render already has the correct user, so
  // the header shows the avatar instead of "Sign in" while /me is in flight.
  // On a brand-new device / after sign-out the cache is empty — `loading`
  // stays true and consumers can gate the UI with it.
  const initialCachedUser = readCachedUser();
  const [user, setUser] = useState(initialCachedUser);
  // `loading` means "we have not yet confirmed with the server who the user
  // is". When we have a cached user we still need to confirm in the
  // background, but we can render the UI immediately — `loading` is false
  // in that case because the UI is renderable with full confidence.
  const [loading, setLoading] = useState(!initialCachedUser);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      if (r.ok) {
        const u = toUiUser(await r.json());
        setUser(u);
        writeCachedUser(u);
        return u;
      }
      // 401 / other non-2xx → session is gone. Clear both the in-memory
      // user and the cache so the next reload doesn't flash a stale identity.
      if (r.status === 401) {
        setUser(null);
        writeCachedUser(null);
      }
    } catch {
      // Network error — keep whatever state we have. The cached user is
      // still the most accurate guess until the network comes back.
    }
    return null;
  }, []);

  // Confirm the session against the server on mount. If we already had a
  // cached user the UI is already rendered correctly; this is just a
  // background check that flips us to null if the cookie expired.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  // ─── Live role revalidation ──────────────────────────────────────────
  //
  // When the admin revokes a role (e.g. removes someone as treasurer), the
  // affected user's browser keeps the stale role array in memory + the
  // localStorage cache until they reload. They'd keep seeing the treasurer
  // dashboard frame even though every /api/admin/* call would 403.
  //
  // To close that gap we revalidate /api/auth/me on three triggers:
  //   1. The tab regaining focus (`visibilitychange`) — catches the most
  //      common case: admin changes a role in tab A, user has tab B open.
  //   2. Every SPA route change (`popstate` + custom `routechange`) —
  //      anyone navigating into an admin route gets a fresh role check
  //      before the gate evaluates.
  //   3. A periodic poll (every 5 min) — for the "tab open all day" case.
  //
  // We also expose a global event `auth:revalidate` that callers anywhere
  // in the app (e.g. apiCache when it hits a 403) can dispatch to force a
  // refresh out-of-band.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onRouteChange = () => { refresh(); };
    const onForceRevalidate = () => { refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('popstate', onRouteChange);
    window.addEventListener('routechange', onRouteChange);
    window.addEventListener('auth:revalidate', onForceRevalidate);
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 5 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('popstate', onRouteChange);
      window.removeEventListener('routechange', onRouteChange);
      window.removeEventListener('auth:revalidate', onForceRevalidate);
      clearInterval(poll);
    };
  }, [refresh]);

  // Bridge the legacy `showToast(text, kind)` API to the new top-right stack
  // (lib/notify.js). Callers across the app still use this signature.
  const showToast = (text, kind = 'success') => {
    notify.show(text, kind);
  };

  // Embedded sign-in: post credentials to our server, which calls Auth0's
  // /oauth/token (ROPG) server-side and sets the session cookie. The user
  // never leaves the site.
  const login = async ({ email, password }) => {
    try {
      const body = await postJson('/api/auth/login', { email, password });
      await refresh();
      navigate(body.redirect ?? '/dashboard');
    } catch (e) {
      // Self-signed-up accounts are blocked until the branch admin promotes
      // them. Surface the server message in a blocking modal rather than the
      // inline error banner so the user actually reads the next-step
      // instructions (contact branch with MRN).
      if (e?.code === 'account_pending_approval') {
        await dialog.alert({
          title: 'Account awaiting approval',
          message: e.message,
          okText: 'Got it',
        });
        return;
      }
      throw e;
    }
  };

  // Embedded sign-up: posts to /api/auth/signup, which creates the Auth0
  // user (sends a verification email) but does NOT mint a session — the
  // user must verify their email AND wait for branch-admin approval before
  // they can sign in. We surface both states in a blocking dialog so the
  // message is impossible to miss.
  const signup = async ({ email, password, name, role = 'Member', mrn }) => {
    const body = await postJson('/api/auth/signup', { email, password, name, role, mrn });
    if (body.requiresApproval) {
      await dialog.alert({
        title: 'Account created — awaiting approval',
        message: body.message,
        okText: 'Got it',
      });
      navigate('/login');
      return;
    }
    if (body.requiresVerification || body.requiresLogin) {
      showToast(body.message || 'Account created. Please verify your email and sign in.', 'success');
      navigate('/login');
      return;
    }
    await refresh();
    navigate(body.redirect ?? '/onboarding');
  };

  // Social IdPs (Google, Microsoft, …) can't be embedded — they require a
  // redirect to the provider's domain. The server bounces through Auth0 and
  // back to /api/auth/callback, which sets the cookie and redirects to
  // /dashboard or /onboarding.
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
    writeCachedUser(null);
    showToast('Signed out', 'info');
    navigate('/');
  };

  const logout = () => logoutInternal('/api/auth/logout');

  return (
    <AuthContext.Provider value={{
      user, loading,
      login, signup, socialLogin, forgotPassword,
      logout, showToast,
      // Exposed so gate components (RequireAdmin/RequireEmployer) can force
      // a fresh /me before evaluating their role checks, and so any caller
      // that detects a 403 can bring the auth state back in sync.
      refresh,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
