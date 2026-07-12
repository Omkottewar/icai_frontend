import { Component } from 'react';

// Top-level React error boundary. Catches any uncaught render / effect
// error in any lazy-loaded page and renders a graceful fallback instead
// of white-screening the whole app. Two common triggers today:
//   • Bugs in newly-added page components (thrown from render or a hook)
//   • Stale lazy-import chunks after a deploy (the browser has an old
//     bundle URL pointing at a hash that no longer exists — dynamic
//     import() rejects with "Failed to fetch dynamically imported module")
// The reload button below fixes the second class without the user
// needing to know a hard-refresh unblocks it.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info?.componentStack);
    // Sentry auto-captures unhandled exceptions if it's initialised —
    // we don't call it explicitly here to avoid a hard dependency.
  }

  reset = () => this.setState({ error: null });
  reload = () => { window.location.reload(); };

  render() {
    if (!this.state.error) return this.props.children;

    // A stale chunk after a deploy throws this specific class of error.
    // Reload is the definitive fix — it fetches the current index.html
    // and its up-to-date chunk manifest.
    const msg = String(this.state.error?.message || this.state.error || '');
    const looksLikeStaleChunk =
      /Failed to fetch dynamically imported module|Loading chunk|ChunkLoadError|Importing a module script failed/i.test(msg);

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem 1rem',
        background: 'var(--background, #fff)',
        color: 'var(--foreground, #0f172a)',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      }}>
        <div style={{
          maxWidth: '32rem', textAlign: 'center',
          padding: '2rem 1.5rem',
          border: '1px solid #e5e7eb', borderRadius: '.75rem',
          background: '#fff',
          boxShadow: '0 6px 20px -12px rgba(15,23,42,.12)',
        }}>
          <div style={{
            display: 'inline-block',
            padding: '.35rem .75rem',
            background: '#fee2e2', color: '#991b1b',
            fontSize: '.7rem', fontWeight: 700, letterSpacing: '.05em',
            borderRadius: 999, textTransform: 'uppercase',
            marginBottom: '.85rem',
          }}>Something went wrong</div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>
            {looksLikeStaleChunk ? 'A new version is available' : "This page hit an error"}
          </h1>
          <p style={{ marginTop: '.6rem', color: '#475569', fontSize: '.92rem', lineHeight: 1.55 }}>
            {looksLikeStaleChunk
              ? 'The site was updated while you had it open. Reload to fetch the latest version.'
              : 'The rest of the site should still work. Try reloading, or head back to the homepage.'}
          </p>

          <div style={{
            display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '.55rem',
            marginTop: '1.25rem',
          }}>
            <button
              type="button" onClick={this.reload}
              style={btnPrimary}
            >Reload</button>
            {!looksLikeStaleChunk && (
              <a href="/" style={btnSecondary}>Go to homepage</a>
            )}
          </div>

          {import.meta.env?.DEV && (
            <details style={{ marginTop: '1.25rem', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', color: '#64748b', fontSize: '.8rem' }}>Error detail (dev only)</summary>
              <pre style={{
                marginTop: '.5rem', padding: '.75rem',
                background: '#f1f5f9', border: '1px solid #e2e8f0',
                borderRadius: '.35rem', fontSize: '.75rem',
                overflow: 'auto', maxHeight: '12rem',
              }}>{msg}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

const btnBase = {
  padding: '.55rem 1.1rem', borderRadius: '.4rem',
  fontSize: '.9rem', fontWeight: 600,
  border: '1px solid transparent', cursor: 'pointer',
  textDecoration: 'none', display: 'inline-block',
};
const btnPrimary = {
  ...btnBase,
  background: '#0f172a', color: '#fff',
};
const btnSecondary = {
  ...btnBase,
  background: '#fff', color: '#0f172a',
  borderColor: '#cbd5e1',
};
