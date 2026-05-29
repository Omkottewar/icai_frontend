export default function NotFound() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
        <h1 style={{ fontSize: '4.5rem', fontWeight: 700, color: 'var(--foreground)', margin: 0, lineHeight: 1 }}>404</h1>
        <h2 style={{ marginTop: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>Page not found</h2>
        <p className="muted-text" style={{ marginTop: '.5rem', fontSize: '.875rem' }}>
          The page you're looking for doesn't exist in this demo.
        </p>
        <a href="#/" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>Go home</a>
      </div>
    </div>
  );
}
