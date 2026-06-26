// Frontend bridge to Google reCAPTCHA v3.
//
// Usage:
//   const { execute, enabled } = useRecaptcha();
//   const token = await execute('grievance_submit');
//   // POST token in the form body; backend verifies it.
//
// When VITE_RECAPTCHA_SITE_KEY is empty (dev), execute() returns ''
// and the backend's verifyRecaptcha() silently passes — the contact form
// stays usable without any captcha plumbing.
//
// The Google script is loaded ONCE per page, lazily on first call.
// grecaptcha.ready() guarantees the SDK is initialised before we call execute.

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';
const SCRIPT_ID = 'icai-recaptcha-v3';

let scriptPromise = null;

function loadScript() {
  if (!SITE_KEY) return Promise.resolve(null);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (document.getElementById(SCRIPT_ID)) return resolve(window.grecaptcha);
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(SITE_KEY)}`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.grecaptcha);
    s.onerror = () => reject(new Error('Failed to load reCAPTCHA'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function useRecaptcha() {
  const enabled = Boolean(SITE_KEY);

  async function execute(action) {
    if (!enabled) return '';
    try {
      const grecaptcha = await loadScript();
      if (!grecaptcha) return '';
      await new Promise((resolve) => grecaptcha.ready(resolve));
      return await grecaptcha.execute(SITE_KEY, { action });
    } catch {
      // If reCAPTCHA fails to load (network issue, blocked by browser
      // extension, etc.) we fail open on the client — the backend will
      // still reject the request if a real secret is configured, so we
      // don't end up with a silent bypass.
      return '';
    }
  }

  return { execute, enabled };
}
