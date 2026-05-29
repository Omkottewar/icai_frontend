export default function PageHeader({ title, subtitle }) {
  return (
    <section
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'linear-gradient(135deg, var(--primary), var(--primary-darker))',
        color: 'var(--primary-foreground)',
        padding: '3.5rem 0',
      }}
    >
      <div className="container">
        <h1 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-.01em', margin: 0 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ marginTop: '.5rem', maxWidth: '42rem', color: 'rgba(255,255,255,.8)' }}>
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
